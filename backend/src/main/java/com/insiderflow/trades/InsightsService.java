package com.insiderflow.trades;

import com.fasterxml.jackson.databind.JsonNode;
import com.insiderflow.market.FinnhubClient;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationExpression;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static org.springframework.data.mongodb.core.aggregation.Aggregation.*;
import static org.springframework.data.mongodb.core.query.Criteria.where;

/**
 * "Editorial" analytics over the trade data: the daily digest of new filings (F1), the STOCK Act
 * late-filer accountability list (F2), and buy/sell cluster detection (F5).
 */
@Service
public class InsightsService {

    private static final Logger log = LoggerFactory.getLogger(InsightsService.class);

    private final MongoTemplate mongoTemplate;
    private final FinnhubClient finnhubClient;

    public InsightsService(MongoTemplate mongoTemplate, FinnhubClient finnhubClient) {
        this.mongoTemplate = mongoTemplate;
        this.finnhubClient = finnhubClient;
    }

    // ---------- F1: digest of recent filings ----------

    /**
     * Everything disclosed since {@code since} (default: the most recent disclosure date in the
     * data, so "today's filings" works even if the app is opened on a weekend).
     */
    private static final int DIGEST_DEFAULT_WINDOW_DAYS = 3;

    public TradeDtos.Digest digest(LocalDate since) {
        LocalDate cutoff = since;
        if (cutoff == null) {
            // Default: the last few days of disclosures (robust across weekends), anchored to
            // the newest disclosure date in the data rather than "today".
            LocalDate latest = latestDisclosureDate();
            cutoff = latest != null ? latest.minusDays(DIGEST_DEFAULT_WINDOW_DAYS - 1) : null;
        }
        if (cutoff == null) {
            return new TradeDtos.Digest(null, 0, 0, 0, 0, List.of(), List.of(), List.of());
        }
        Date cutoffDate = toDate(cutoff);
        var base = where("disclosureDate").gte(cutoffDate).and("suspiciousDate").ne(true);

        long total = mongoTemplate.count(new Query(base), Trade.class);
        long buys = mongoTemplate.count(new Query(where("disclosureDate").gte(cutoffDate)
                .and("suspiciousDate").ne(true).and("transactionType").is("BUY")), Trade.class);
        long sells = mongoTemplate.count(new Query(where("disclosureDate").gte(cutoffDate)
                .and("suspiciousDate").ne(true).and("transactionType").is("SELL")), Trade.class);

        // Notable = biggest by estimated amount.
        Query notableQuery = new Query(base).with(Sort.by(Sort.Direction.DESC, "amountMid")).limit(12);
        List<Trade> notable = mongoTemplate.find(notableQuery, Trade.class);

        long volume = sumVolume(match(base));

        Aggregation tickerAgg = newAggregation(
                match(base.and("ticker").ne(null)),
                group("ticker")
                        .first("sector").as("sector")
                        .sum(typeFlag("BUY")).as("buyCount")
                        .sum(typeFlag("SELL")).as("sellCount")
                        .sum("amountMid").as("volume"),
                sort(Sort.Direction.DESC, "volume"),
                limit(10));
        List<TradeDtos.TickerActivity> topTickers = mongoTemplate.aggregate(tickerAgg, "trades", Document.class)
                .getMappedResults().stream()
                .map(d -> new TradeDtos.TickerActivity(d.getString("_id"), d.getString("sector"),
                        num(d, "buyCount"), num(d, "sellCount"), num(d, "volume")))
                .toList();

        Aggregation memberAgg = newAggregation(
                match(base),
                group("member")
                        .first("party").as("party")
                        .first("chamber").as("chamber")
                        .count().as("tradeCount")
                        .sum("amountMid").as("volume"),
                sort(Sort.Direction.DESC, "volume"),
                limit(10));
        List<TradeDtos.MemberActivity> topMembers = mongoTemplate.aggregate(memberAgg, "trades", Document.class)
                .getMappedResults().stream()
                .map(d -> new TradeDtos.MemberActivity(d.getString("_id"), d.getString("party"),
                        d.getString("chamber"), num(d, "tradeCount"), num(d, "volume")))
                .toList();

        return new TradeDtos.Digest(cutoff.toString(), total, buys, sells, volume, notable, topTickers, topMembers);
    }

    private LocalDate latestDisclosureDate() {
        Query q = new Query().with(Sort.by(Sort.Direction.DESC, "disclosureDate")).limit(1);
        q.fields().include("disclosureDate");
        Trade t = mongoTemplate.findOne(q, Trade.class);
        return t != null ? t.getDisclosureDate() : null;
    }

    // ---------- F2: STOCK Act late filers ----------

    public List<TradeDtos.LateFiler> lateFilers() {
        Aggregation agg = newAggregation(
                match(where("disclosureLagDays").ne(null).and("suspiciousDate").ne(true)),
                group("member")
                        .first("party").as("party")
                        .first("chamber").as("chamber")
                        .first("state").as("state")
                        .count().as("totalDisclosed")
                        .sum(lateFlag()).as("lateCount")
                        .avg("disclosureLagDays").as("avgLag")
                        .max("disclosureLagDays").as("maxLag"),
                match(where("lateCount").gt(0)),
                sort(Sort.Direction.DESC, "lateCount"),
                limit(100));
        return mongoTemplate.aggregate(agg, "trades", Document.class).getMappedResults().stream()
                .map(d -> {
                    long total = num(d, "totalDisclosed");
                    long late = num(d, "lateCount");
                    return new TradeDtos.LateFiler(d.getString("_id"), d.getString("party"),
                            d.getString("chamber"), d.getString("state"),
                            late, total, total == 0 ? 0 : round2((double) late / total * 100),
                            round2(dbl(d, "avgLag")), num(d, "maxLag"));
                })
                .toList();
    }

    // ---------- F5: buy/sell clusters ----------

    private static final int CLUSTER_WINDOW_DAYS = 14;
    private static final int CLUSTER_MIN_MEMBERS = 3;

    /**
     * Tickers where {@value CLUSTER_MIN_MEMBERS}+ distinct members traded the same direction
     * within the last {@code lookbackDays}. A rough but useful "everyone's piling into X" signal.
     */
    public List<TradeDtos.Cluster> clusters(int lookbackDays, String direction) {
        String dir = "SELL".equalsIgnoreCase(direction) ? "SELL" : "BUY";
        Date cutoff = toDate(LocalDate.now().minusDays(Math.max(lookbackDays, CLUSTER_WINDOW_DAYS)));
        Query q = new Query(where("transactionType").is(dir).and("ticker").ne(null)
                .and("suspiciousDate").ne(true).and("transactionDate").gte(cutoff));
        q.fields().include("ticker", "sector", "member", "party", "transactionDate", "amountRange", "amountMid");
        List<Trade> trades = mongoTemplate.find(q, Trade.class);

        // Group by ticker.
        java.util.Map<String, List<Trade>> byTicker = new java.util.HashMap<>();
        for (Trade t : trades) {
            byTicker.computeIfAbsent(t.getTicker(), k -> new ArrayList<>()).add(t);
        }

        List<TradeDtos.Cluster> clusters = new ArrayList<>();
        for (var entry : byTicker.entrySet()) {
            List<Trade> list = entry.getValue();
            list.sort(java.util.Comparator.comparing(Trade::getTransactionDate));
            // Sliding window: find any CLUSTER_WINDOW_DAYS span containing >= min distinct members.
            for (int i = 0; i < list.size(); i++) {
                LocalDate windowStart = list.get(i).getTransactionDate();
                java.util.Set<String> members = new java.util.LinkedHashSet<>();
                long volume = 0;
                LocalDate last = windowStart;
                List<TradeDtos.ClusterMember> clusterMembers = new ArrayList<>();
                for (int j = i; j < list.size(); j++) {
                    Trade t = list.get(j);
                    if (java.time.temporal.ChronoUnit.DAYS.between(windowStart, t.getTransactionDate()) > CLUSTER_WINDOW_DAYS) {
                        break;
                    }
                    if (members.add(t.getMember())) {
                        clusterMembers.add(new TradeDtos.ClusterMember(t.getMember(), t.getParty(),
                                t.getTransactionDate().toString(), t.getAmountRange()));
                    }
                    volume += t.getAmountMid() != null ? t.getAmountMid() : 0;
                    last = t.getTransactionDate();
                }
                if (members.size() >= CLUSTER_MIN_MEMBERS) {
                    clusters.add(new TradeDtos.Cluster(entry.getKey(), list.get(0).getSector(), dir,
                            members.size(), clusterMembers.size() >= list.size() ? list.size() : members.size(),
                            volume, windowStart.toString(), last.toString(), clusterMembers));
                    break; // one cluster per ticker (the earliest qualifying window)
                }
            }
        }
        clusters.sort((a, b) -> b.memberCount() - a.memberCount());
        return clusters;
    }

    // ---------- F9: earnings-proximity flag ----------

    private static final int EARNINGS_PROXIMITY_DAYS = 14;
    private static final int EARNINGS_LOOKBACK_DAYS = 200;

    /**
     * Flags trades made within {@value EARNINGS_PROXIMITY_DAYS} days before the traded company's
     * earnings report. Finnhub's earnings calendar is date-ranged (all symbols at once), so we
     * pull the recent window in monthly chunks, build ticker -> report-dates, and flag matching
     * recent trades. Bounded API usage; only touches the last {@value EARNINGS_LOOKBACK_DAYS} days.
     */
    public void enrichNearEarnings() {
        if (!finnhubClient.isConfigured()) {
            log.info("FINNHUB_API_KEY not set — skipping earnings-proximity enrichment");
            return;
        }
        LocalDate today = LocalDate.now();
        LocalDate windowStart = today.minusDays(EARNINGS_LOOKBACK_DAYS);

        // ticker -> sorted earnings report dates
        java.util.Map<String, java.util.TreeSet<LocalDate>> earningsByTicker = new java.util.HashMap<>();
        LocalDate chunkStart = windowStart;
        while (chunkStart.isBefore(today)) {
            LocalDate chunkEnd = chunkStart.plusDays(30).isAfter(today) ? today : chunkStart.plusDays(30);
            JsonNode cal = finnhubClient.earningsCalendar(chunkStart.toString(), chunkEnd.toString());
            if (cal != null && cal.isArray()) {
                for (JsonNode e : cal) {
                    String sym = e.path("symbol").asText(null);
                    String date = e.path("date").asText(null);
                    if (sym == null || date == null) {
                        continue;
                    }
                    try {
                        earningsByTicker.computeIfAbsent(sym.toUpperCase(), k -> new java.util.TreeSet<>())
                                .add(LocalDate.parse(date));
                    } catch (Exception ignored) {
                        // skip unparseable dates
                    }
                }
            }
            chunkStart = chunkEnd.plusDays(1);
        }
        if (earningsByTicker.isEmpty()) {
            log.warn("Earnings-proximity: no earnings data returned; skipping");
            return;
        }

        // Scan recent trades and flag those shortly before a report.
        Query q = new Query(where("ticker").ne(null)
                .and("transactionDate").gte(toDate(windowStart.minusDays(EARNINGS_PROXIMITY_DAYS))));
        q.fields().include("ticker", "transactionDate");
        List<Trade> recent = mongoTemplate.find(q, Trade.class);
        int flagged = 0;
        for (Trade t : recent) {
            java.util.TreeSet<LocalDate> dates = earningsByTicker.get(t.getTicker());
            if (dates == null) {
                continue;
            }
            LocalDate tx = t.getTransactionDate();
            LocalDate nextReport = dates.ceiling(tx);
            boolean near = nextReport != null
                    && java.time.temporal.ChronoUnit.DAYS.between(tx, nextReport) <= EARNINGS_PROXIMITY_DAYS;
            mongoTemplate.updateFirst(new Query(where("_id").is(t.getId())),
                    new Update().set("nearEarnings", near), Trade.class);
            if (near) {
                flagged++;
            }
        }
        log.info("Earnings-proximity: flagged {} trades near earnings across {} tickers",
                flagged, earningsByTicker.size());
    }

    // ---------- helpers ----------

    private long sumVolume(org.springframework.data.mongodb.core.aggregation.AggregationOperation matchOp) {
        Aggregation agg = newAggregation(matchOp, group().sum("amountMid").as("volume"));
        Document d = mongoTemplate.aggregate(agg, "trades", Document.class).getUniqueMappedResult();
        return d == null ? 0 : num(d, "volume");
    }

    private static AggregationExpression typeFlag(String type) {
        return ctx -> new Document("$cond",
                List.of(new Document("$eq", List.of("$transactionType", type)), 1, 0));
    }

    private static AggregationExpression lateFlag() {
        return ctx -> new Document("$cond",
                List.of(new Document("$eq", List.of("$lateDisclosure", true)), 1, 0));
    }

    private static long num(Document d, String key) {
        Object v = d.get(key);
        return v instanceof Number n ? n.longValue() : 0;
    }

    private static double dbl(Document d, String key) {
        Object v = d.get(key);
        return v instanceof Number n ? n.doubleValue() : 0;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static Date toDate(LocalDate d) {
        // Spring Data MongoDB persists LocalDate at system-zone midnight, so build query
        // bounds the same way — using UTC here would shift by the zone offset and drop
        // same-day rows.
        return Date.from(d.atStartOfDay(java.time.ZoneId.systemDefault()).toInstant());
    }
}
