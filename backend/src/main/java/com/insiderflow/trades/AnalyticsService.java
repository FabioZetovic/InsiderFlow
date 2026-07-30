package com.insiderflow.trades;

import com.insiderflow.common.ApiException;
import com.insiderflow.market.PriceHistoryService;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.springframework.data.mongodb.core.aggregation.Aggregation.*;
import static org.springframework.data.mongodb.core.query.Criteria.where;

/**
 * Heavier analytics built on price history: the trader leaderboard ("who's winning") and the
 * per-ticker detail view. Leaderboard is computed in the background (Yahoo lookups are slow)
 * and cached in memory; endpoints serve the last computed result.
 */
@Service
public class AnalyticsService {

    private static final Logger log = LoggerFactory.getLogger(AnalyticsService.class);

    /** Score buys made within this window — older trades say little about current skill. */
    private static final int LEADERBOARD_WINDOW_DAYS = 365;
    /** Only rank members with at least this many scored buys (avoids one-lucky-trade noise). */
    private static final int MIN_SCORED_BUYS = 5;
    /** Cap the number of distinct tickers priced per run to bound Yahoo traffic. */
    private static final int MAX_TICKERS_PER_RUN = 400;

    private final MongoTemplate mongoTemplate;
    private final PriceHistoryService priceHistory;

    private volatile List<TradeDtos.LeaderboardEntry> leaderboard = List.of();
    private volatile Instant leaderboardComputedAt;
    private final AtomicBoolean computing = new AtomicBoolean(false);

    public AnalyticsService(MongoTemplate mongoTemplate, PriceHistoryService priceHistory) {
        this.mongoTemplate = mongoTemplate;
        this.priceHistory = priceHistory;
    }

    // ---------- Leaderboard ----------

    public record LeaderboardResponse(List<TradeDtos.LeaderboardEntry> entries, Instant computedAt,
                                      boolean computing) {
    }

    public LeaderboardResponse getLeaderboard() {
        if (leaderboard.isEmpty() && leaderboardComputedAt == null) {
            computeLeaderboardAsync();
        }
        return new LeaderboardResponse(leaderboard, leaderboardComputedAt, computing.get());
    }

    @Async
    public void computeLeaderboardAsync() {
        computeLeaderboard();
    }

    /** Recomputed nightly after the 06:00 ingest. */
    @Scheduled(cron = "0 30 6 * * *", zone = "UTC")
    public void computeLeaderboard() {
        if (!computing.compareAndSet(false, true)) {
            return;
        }
        try {
            long start = System.currentTimeMillis();
            Date cutoff = Date.from(LocalDate.now().minusDays(LEADERBOARD_WINDOW_DAYS)
                    .atStartOfDay(ZoneOffset.UTC).toInstant());
            Query query = new Query(where("transactionType").is("BUY")
                    .and("ticker").ne(null)
                    .and("suspiciousDate").ne(true)
                    .and("transactionDate").gte(cutoff));
            query.fields().include("member", "chamber", "state", "party", "ticker", "transactionDate");
            List<Trade> buys = mongoTemplate.find(query, Trade.class);

            // Bound Yahoo traffic: price only the most-traded tickers.
            Map<String, Integer> tickerCounts = new HashMap<>();
            for (Trade t : buys) {
                tickerCounts.merge(t.getTicker(), 1, Integer::sum);
            }
            List<String> pricedTickers = tickerCounts.entrySet().stream()
                    .sorted((a, b) -> b.getValue() - a.getValue())
                    .limit(MAX_TICKERS_PER_RUN)
                    .map(Map.Entry::getKey)
                    .toList();
            Map<String, NavigableMap<LocalDate, Double>> series = new HashMap<>();
            for (String ticker : pricedTickers) {
                NavigableMap<LocalDate, Double> s = priceHistory.history(ticker);
                if (!s.isEmpty()) {
                    series.put(ticker, s);
                }
            }
            // SPY as the benchmark for alpha (return in excess of the market over the same window).
            NavigableMap<LocalDate, Double> spy = priceHistory.history("SPY");

            record Acc(String chamber, String state, String party, List<Double> returns,
                       List<Double> alphas, Map<String, Double> perTicker) {
            }
            Map<String, Acc> byMember = new HashMap<>();
            for (Trade t : buys) {
                NavigableMap<LocalDate, Double> s = series.get(t.getTicker());
                if (s == null) {
                    continue;
                }
                Map.Entry<LocalDate, Double> atBuy = s.floorEntry(t.getTransactionDate());
                if (atBuy == null || atBuy.getValue() == 0) {
                    continue;
                }
                double latest = s.lastEntry().getValue();
                double ret = (latest - atBuy.getValue()) / atBuy.getValue() * 100.0;
                // Market return over the same holding period, if SPY data covers it.
                Double alpha = null;
                if (spy != null && !spy.isEmpty()) {
                    Map.Entry<LocalDate, Double> spyAtBuy = spy.floorEntry(t.getTransactionDate());
                    if (spyAtBuy != null && spyAtBuy.getValue() != 0) {
                        double spyRet = (spy.lastEntry().getValue() - spyAtBuy.getValue()) / spyAtBuy.getValue() * 100.0;
                        alpha = ret - spyRet;
                    }
                }
                Acc acc = byMember.computeIfAbsent(t.getMember(),
                        k -> new Acc(t.getChamber(), t.getState(), t.getParty(), new ArrayList<>(),
                                new ArrayList<>(), new HashMap<>()));
                acc.returns().add(ret);
                if (alpha != null) {
                    acc.alphas().add(alpha);
                }
                acc.perTicker().merge(t.getTicker(), ret, Math::max);
            }

            List<TradeDtos.LeaderboardEntry> entries = new ArrayList<>();
            byMember.forEach((member, acc) -> {
                if (acc.returns().size() < MIN_SCORED_BUYS) {
                    return;
                }
                double avg = acc.returns().stream().mapToDouble(Double::doubleValue).average().orElse(0);
                double avgAlpha = acc.alphas().stream().mapToDouble(Double::doubleValue).average().orElse(0);
                String bestTicker = null;
                double best = Double.NEGATIVE_INFINITY;
                for (Map.Entry<String, Double> e : acc.perTicker().entrySet()) {
                    if (e.getValue() > best) {
                        best = e.getValue();
                        bestTicker = e.getKey();
                    }
                }
                entries.add(new TradeDtos.LeaderboardEntry(member, acc.chamber(), acc.state(), acc.party(),
                        acc.returns().size(), round2(avg), round2(avgAlpha), round2(best), bestTicker));
            });
            entries.sort((a, b) -> Double.compare(b.avgReturnPercent(), a.avgReturnPercent()));

            this.leaderboard = List.copyOf(entries);
            this.leaderboardComputedAt = Instant.now();
            log.info("Leaderboard computed: {} ranked members, {} buys scored across {} tickers in {} ms",
                    entries.size(), buys.size(), series.size(), System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.error("Leaderboard computation failed", e);
        } finally {
            computing.set(false);
        }
    }

    // ---------- Ticker detail ----------

    /** Real tickers are short and alphanumeric; reject anything else before it reaches an outbound URL. */
    static final java.util.regex.Pattern VALID_TICKER = java.util.regex.Pattern.compile("^[A-Z0-9.\\-]{1,10}$");

    public TradeDtos.TickerDetail tickerDetail(String rawTicker) {
        String ticker = rawTicker == null ? "" : rawTicker.trim().toUpperCase();
        if (!VALID_TICKER.matcher(ticker).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid ticker");
        }
        long total = mongoTemplate.count(new Query(where("ticker").is(ticker)), Trade.class);

        // One year of daily closes for the chart.
        NavigableMap<LocalDate, Double> series = priceHistory.history(ticker);
        LocalDate yearAgo = LocalDate.now().minusYears(1);
        List<TradeDtos.PricePoint> prices = series.tailMap(yearAgo, true).entrySet().stream()
                .map(e -> new TradeDtos.PricePoint(e.getKey().toString(), e.getValue()))
                .toList();

        // Only a truly empty ticker (no congress trades AND no price history) is a 404. A ticker
        // reached from the Corporate tab may have zero congress trades but still have a price
        // chart and Form 4 data (fetched separately by the frontend) worth showing.
        if (total == 0 && prices.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "No data found for ticker " + ticker);
        }

        long buys = mongoTemplate.count(
                new Query(where("ticker").is(ticker).and("transactionType").is("BUY")), Trade.class);
        long sells = mongoTemplate.count(
                new Query(where("ticker").is(ticker).and("transactionType").is("SELL")), Trade.class);

        Query recentQuery = new Query(where("ticker").is(ticker))
                .with(Sort.by(Sort.Direction.ASC, "suspiciousDate")
                        .and(Sort.by(Sort.Direction.DESC, "transactionDate")))
                .limit(50);
        List<Trade> recent = mongoTemplate.find(recentQuery, Trade.class);
        Trade sample = recent.isEmpty() ? null : recent.get(0);

        Aggregation memberAgg = newAggregation(
                match(where("ticker").is(ticker)),
                group("member")
                        .first("party").as("party")
                        .sum(typeFlag("BUY")).as("buyCount")
                        .sum(typeFlag("SELL")).as("sellCount"),
                sort(Sort.Direction.DESC, "buyCount"));
        List<TradeDtos.TickerMemberActivity> members = mongoTemplate.aggregate(memberAgg, "trades", Document.class)
                .getMappedResults().stream()
                .map(d -> new TradeDtos.TickerMemberActivity(
                        d.getString("_id"),
                        d.getString("party"),
                        ((Number) d.getOrDefault("buyCount", 0)).longValue(),
                        ((Number) d.getOrDefault("sellCount", 0)).longValue()))
                .toList();

        return new TradeDtos.TickerDetail(
                ticker,
                sample != null ? sample.getSector() : null,
                sample != null ? sample.getAssetDescription() : null,
                total, buys, sells, members, recent, prices);
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static org.springframework.data.mongodb.core.aggregation.AggregationExpression typeFlag(String type) {
        return context -> new Document("$cond",
                List.of(new Document("$eq", List.of("$transactionType", type)), 1, 0));
    }
}
