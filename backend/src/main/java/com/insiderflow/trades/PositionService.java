package com.insiderflow.trades;

import com.insiderflow.common.ApiException;
import com.insiderflow.market.PriceHistoryService;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.regex.Pattern;

import static org.springframework.data.mongodb.core.query.Criteria.where;

/**
 * Trade detail: where a member entered (or exited) a stock, at what price, how their average
 * buy price compares to today, and the price chart around those trades.
 *
 * <p>Disclosures report dollar ranges, not share counts, so the "average buy price" is an
 * estimate: each buy's closing price on its trade date, weighted by the midpoint of its
 * disclosed amount range.
 */
@Service
public class PositionService {

    static final Pattern VALID_ID = Pattern.compile("^[A-Za-z0-9_-]{1,64}$");
    /** Chart padding before the member's first trade in the ticker. */
    private static final int LEAD_IN_DAYS = 45;

    private final MongoTemplate mongoTemplate;
    private final PriceHistoryService priceHistory;

    public PositionService(MongoTemplate mongoTemplate, PriceHistoryService priceHistory) {
        this.mongoTemplate = mongoTemplate;
        this.priceHistory = priceHistory;
    }

    /** One of the member's trades in this ticker, with the close on its trade date. */
    public record PositionTrade(String id, String transactionDate, String transactionType,
                                String amountRange, Long amountMid, Double price) {
    }

    public record TradePosition(
            Trade trade,
            String ticker,
            /** Close on (or just before) this trade's date; null if price history doesn't reach back. */
            Double entryPrice,
            Double latestPrice,
            String latestDate,
            /** Percent move from this trade's price to the latest close. */
            Double changeSinceTradePercent,
            /** Estimated average buy price across the member's buys of this ticker (amount-weighted). */
            Double avgBuyPrice,
            /** Percent from the average buy price to the latest close. */
            Double avgBuyReturnPercent,
            int buyCount,
            int sellCount,
            /** How many of the member's buys had a price available (fed into the average). */
            int pricedBuys,
            List<PositionTrade> memberTrades,
            List<TradeDtos.PricePoint> priceHistory) {
    }

    public TradePosition position(String id) {
        if (id == null || !VALID_ID.matcher(id).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid trade id");
        }
        Trade trade = mongoTemplate.findById(id, Trade.class);
        if (trade == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Trade not found");
        }

        String ticker = trade.getTicker() == null ? null : trade.getTicker().trim().toUpperCase();
        if (ticker == null || !AnalyticsService.VALID_TICKER.matcher(ticker).matches()) {
            // Not an exchange-listed asset (bonds, funds without a symbol, etc.): no prices to show.
            return new TradePosition(trade, null, null, null, null, null, null, null,
                    isBuy(trade) ? 1 : 0, isSell(trade) ? 1 : 0, 0, List.of(), List.of());
        }

        List<Trade> mine = mongoTemplate.find(
                new Query(where("member").is(trade.getMember()).and("ticker").is(ticker))
                        .with(Sort.by(Sort.Direction.ASC, "transactionDate")),
                Trade.class);

        NavigableMap<LocalDate, Double> series = priceHistory.history(ticker);
        List<PositionTrade> rows = new ArrayList<>();
        List<double[]> pricedBuys = new ArrayList<>(); // {price, weight}
        int buys = 0;
        int sells = 0;
        for (Trade t : mine) {
            Double price = closeOnOrBefore(series, t.getTransactionDate());
            rows.add(new PositionTrade(t.getId(),
                    t.getTransactionDate() == null ? null : t.getTransactionDate().toString(),
                    t.getTransactionType(), t.getAmountRange(), t.getAmountMid(), round2(price)));
            if (isBuy(t)) {
                buys++;
                if (price != null) {
                    pricedBuys.add(new double[]{price, weightOf(t)});
                }
            } else if (isSell(t)) {
                sells++;
            }
        }

        Double entry = closeOnOrBefore(series, trade.getTransactionDate());
        Double latest = series.isEmpty() ? null : series.lastEntry().getValue();
        String latestDate = series.isEmpty() ? null : series.lastKey().toString();
        Double avgBuy = weightedAverage(pricedBuys);

        // Chart from a little before the member's first trade here (or one year back, whichever
        // is earlier) to the latest close.
        List<TradeDtos.PricePoint> chart = List.of();
        if (!series.isEmpty()) {
            LocalDate first = mine.stream().map(Trade::getTransactionDate)
                    .filter(d -> d != null).min(LocalDate::compareTo).orElse(series.lastKey());
            LocalDate yearAgo = series.lastKey().minusYears(1);
            LocalDate from = first.minusDays(LEAD_IN_DAYS);
            if (yearAgo.isBefore(from)) {
                from = yearAgo;
            }
            chart = series.tailMap(from, true).entrySet().stream()
                    .map(e -> new TradeDtos.PricePoint(e.getKey().toString(), e.getValue()))
                    .toList();
        }

        return new TradePosition(trade, ticker,
                round2(entry), round2(latest), latestDate,
                round2(percentChange(entry, latest)),
                round2(avgBuy), round2(percentChange(avgBuy, latest)),
                buys, sells, pricedBuys.size(), rows, chart);
    }

    // ---------- Member P&L ----------

    /** Window for P&L: buys from the last 12 months (matches the leaderboard). */
    private static final int PNL_WINDOW_DAYS = 365;
    /** Guard against pathological members with thousands of distinct tickers. */
    private static final int PNL_MAX_TICKERS = 400;

    public record PnlTrade(String ticker, String transactionDate, double returnPercent, double estimatedPnl) {
    }

    public record MemberPnl(
            String member,
            /** Buys in the window that had a price on the trade date (the ones scored). */
            int scoredBuys,
            int totalBuys,
            /** Sum of disclosed amount midpoints of the scored buys. */
            double estimatedInvested,
            /** Sum over scored buys of amount midpoint x return. */
            double estimatedPnl,
            Double estimatedPnlPercent,
            Double avgReturnPercent,
            /** Average return in excess of SPY over each buy's holding period. */
            Double avgAlphaPercent,
            /** Share of scored buys that are up. */
            Double winRatePercent,
            PnlTrade best,
            PnlTrade worst) {
    }

    /** One scored buy: amount weight, return %, and SPY return % over the same window (nullable). */
    record ScoredBuy(String ticker, String date, double amount, double returnPercent, Double spyReturnPercent) {
    }

    public MemberPnl memberPnl(String member) {
        if (member == null || member.isBlank() || member.length() > 120) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid member");
        }
        LocalDate cutoff = LocalDate.now().minusDays(PNL_WINDOW_DAYS);
        List<Trade> buys = mongoTemplate.find(
                new Query(where("member").is(member).and("transactionType").is("BUY")
                        .and("ticker").ne(null).and("transactionDate").gte(cutoff)),
                Trade.class);

        NavigableMap<LocalDate, Double> spy = priceHistory.history("SPY");
        java.util.Map<String, NavigableMap<LocalDate, Double>> seriesCache = new java.util.HashMap<>();
        List<ScoredBuy> scored = new ArrayList<>();
        for (Trade t : buys) {
            String ticker = t.getTicker().trim().toUpperCase();
            if (!AnalyticsService.VALID_TICKER.matcher(ticker).matches()) {
                continue;
            }
            if (!seriesCache.containsKey(ticker) && seriesCache.size() >= PNL_MAX_TICKERS) {
                continue;
            }
            NavigableMap<LocalDate, Double> s = seriesCache.computeIfAbsent(ticker, priceHistory::history);
            Double entry = closeOnOrBefore(s, t.getTransactionDate());
            if (entry == null || entry == 0 || s.isEmpty()) {
                continue;
            }
            double ret = percentChange(entry, s.lastEntry().getValue());
            Double spyEntry = closeOnOrBefore(spy, t.getTransactionDate());
            Double spyRet = spy.isEmpty() ? null : percentChange(spyEntry, spy.lastEntry().getValue());
            scored.add(new ScoredBuy(ticker, t.getTransactionDate().toString(), weightOf(t), ret, spyRet));
        }
        return summarize(member, buys.size(), scored);
    }

    /** Pure aggregation of scored buys into the P&L summary (unit-tested). */
    static MemberPnl summarize(String member, int totalBuys, List<ScoredBuy> scored) {
        if (scored.isEmpty()) {
            return new MemberPnl(member, 0, totalBuys, 0, 0, null, null, null, null, null, null);
        }
        double invested = 0;
        double pnl = 0;
        double sumRet = 0;
        double sumAlpha = 0;
        int alphaCount = 0;
        int wins = 0;
        ScoredBuy best = null;
        ScoredBuy worst = null;
        for (ScoredBuy b : scored) {
            invested += b.amount();
            pnl += b.amount() * b.returnPercent() / 100.0;
            sumRet += b.returnPercent();
            if (b.spyReturnPercent() != null) {
                sumAlpha += b.returnPercent() - b.spyReturnPercent();
                alphaCount++;
            }
            if (b.returnPercent() > 0) {
                wins++;
            }
            if (best == null || b.returnPercent() > best.returnPercent()) best = b;
            if (worst == null || b.returnPercent() < worst.returnPercent()) worst = b;
        }
        int n = scored.size();
        return new MemberPnl(member, n, totalBuys,
                Math.round(invested), Math.round(pnl),
                round2(invested == 0 ? null : pnl / invested * 100.0),
                round2(sumRet / n),
                alphaCount == 0 ? null : round2(sumAlpha / alphaCount),
                round2(wins * 100.0 / n),
                toPnlTrade(best), toPnlTrade(worst));
    }

    private static PnlTrade toPnlTrade(ScoredBuy b) {
        return new PnlTrade(b.ticker(), b.date(), round2(b.returnPercent()), Math.round(b.amount() * b.returnPercent() / 100.0));
    }

    // ---------- pure helpers (unit-tested) ----------

    /** Weighted mean of {value, weight} pairs; null when there is nothing to average. */
    static Double weightedAverage(List<double[]> valueWeightPairs) {
        double sum = 0;
        double weights = 0;
        for (double[] vw : valueWeightPairs) {
            if (vw[1] <= 0 || Double.isNaN(vw[0])) {
                continue;
            }
            sum += vw[0] * vw[1];
            weights += vw[1];
        }
        return weights == 0 ? null : sum / weights;
    }

    /** Percent change from {@code from} to {@code to}; null if either is missing or from is zero. */
    static Double percentChange(Double from, Double to) {
        if (from == null || to == null || from == 0) {
            return null;
        }
        return (to - from) / from * 100.0;
    }

    /** Weight of a disclosed trade: its amount-range midpoint, falling back to the low end, then 1. */
    static double weightOf(Trade t) {
        if (t.getAmountMid() != null && t.getAmountMid() > 0) {
            return t.getAmountMid();
        }
        if (t.getAmountLow() != null && t.getAmountLow() > 0) {
            return t.getAmountLow();
        }
        return 1;
    }

    private static Double closeOnOrBefore(NavigableMap<LocalDate, Double> series, LocalDate date) {
        if (date == null || series.isEmpty()) {
            return null;
        }
        Map.Entry<LocalDate, Double> e = series.floorEntry(date);
        return e == null ? null : e.getValue();
    }

    private static boolean isBuy(Trade t) {
        return "BUY".equals(t.getTransactionType());
    }

    private static boolean isSell(Trade t) {
        return "SELL".equals(t.getTransactionType());
    }

    private static Double round2(Double v) {
        return v == null ? null : Math.round(v * 100.0) / 100.0;
    }
}
