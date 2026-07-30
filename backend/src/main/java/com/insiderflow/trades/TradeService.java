package com.insiderflow.trades;

import com.insiderflow.common.ApiException;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

import static org.springframework.data.mongodb.core.aggregation.Aggregation.*;
import static org.springframework.data.mongodb.core.query.Criteria.where;

@Service
public class TradeService {

    private static final Set<String> SORTABLE_FIELDS = Set.of(
            "transactionDate", "disclosureDate", "member", "ticker", "sector", "transactionType",
            "amountRange", "amountMid", "amountHigh");

    private final MongoTemplate mongoTemplate;

    public TradeService(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    /** Filters for a trade query; any field may be null/blank to skip it. */
    public record TradeQuery(String member, String sector, String chamber, String type,
                             String search, java.time.LocalDate from, java.time.LocalDate to,
                             int page, int size, String sort) {
    }

    public TradeDtos.PagedResponse<Trade> findTrades(TradeQuery q) {
        Criteria criteria = buildCriteria(q);
        Query query = new Query(criteria);

        long total = mongoTemplate.count(query, Trade.class);

        query.with(parseSort(q.sort()));
        query.skip((long) q.page() * q.size()).limit(q.size());
        List<Trade> content = mongoTemplate.find(query, Trade.class);

        int totalPages = q.size() == 0 ? 0 : (int) Math.ceil((double) total / q.size());
        return new TradeDtos.PagedResponse<>(content, q.page(), q.size(), total, totalPages);
    }

    private Criteria buildCriteria(TradeQuery q) {
        Criteria criteria = new Criteria();
        if (q.member() != null && !q.member().isBlank()) {
            criteria = criteria.and("member").is(q.member());
        }
        if (q.sector() != null && !q.sector().isBlank()) {
            criteria = criteria.and("sector").is(q.sector());
        }
        if (q.chamber() != null && !q.chamber().isBlank()) {
            criteria = criteria.and("chamber").is(q.chamber().toUpperCase());
        }
        if (q.type() != null && !q.type().isBlank()) {
            criteria = criteria.and("transactionType").is(q.type().toUpperCase());
        }
        if (q.search() != null && !q.search().isBlank()) {
            // Match on ticker or asset description, case-insensitive.
            String escaped = java.util.regex.Pattern.quote(q.search().trim());
            criteria = criteria.orOperator(
                    where("ticker").regex(escaped, "i"),
                    where("assetDescription").regex(escaped, "i"));
        }
        if (q.from() != null || q.to() != null) {
            Criteria dateCriteria = where("transactionDate");
            if (q.from() != null) {
                dateCriteria = dateCriteria.gte(toDate(q.from()));
            }
            if (q.to() != null) {
                dateCriteria = dateCriteria.lte(toDate(q.to().plusDays(1)));
            }
            criteria = criteria.andOperator(dateCriteria);
        }
        return criteria;
    }

    private java.util.Date toDate(java.time.LocalDate d) {
        return java.util.Date.from(d.atStartOfDay(java.time.ZoneOffset.UTC).toInstant());
    }

    private Sort parseSort(String sort) {
        // Suspicious (typo-dated) trades always sink to the bottom of the default view.
        Sort suspiciousLast = Sort.by(Sort.Direction.ASC, "suspiciousDate");
        if (sort == null || sort.isBlank()) {
            return suspiciousLast.and(Sort.by(Sort.Direction.DESC, "transactionDate"));
        }
        String[] parts = sort.split(",");
        String field = parts[0].trim();
        if (!SORTABLE_FIELDS.contains(field)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unsortable field: " + field);
        }
        Sort.Direction direction = parts.length > 1 && "asc".equalsIgnoreCase(parts[1].trim())
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        return suspiciousLast.and(Sort.by(direction, field));
    }

    // ---------- Cached aggregates (#16) ----------
    // memberStats/sectorStats scan the whole collection; they only change on ingest, so cache
    // them for 10 minutes and invalidate explicitly after each ingest run.

    private static final long AGGREGATE_CACHE_TTL_MS = 10 * 60 * 1000;
    private volatile List<TradeDtos.MemberStats> memberStatsCache;
    private volatile long memberStatsCachedAt;
    private volatile List<TradeDtos.SectorStats> sectorStatsCache;
    private volatile long sectorStatsCachedAt;

    public void invalidateAggregateCaches() {
        memberStatsCache = null;
        sectorStatsCache = null;
    }

    public List<TradeDtos.MemberStats> memberStats() {
        List<TradeDtos.MemberStats> cached = memberStatsCache;
        if (cached != null && System.currentTimeMillis() - memberStatsCachedAt < AGGREGATE_CACHE_TTL_MS) {
            return cached;
        }
        List<TradeDtos.MemberStats> fresh = computeMemberStats();
        memberStatsCache = fresh;
        memberStatsCachedAt = System.currentTimeMillis();
        return fresh;
    }

    private List<TradeDtos.MemberStats> computeMemberStats() {
        Aggregation agg = newAggregation(
                group("member")
                        .first("chamber").as("chamber")
                        .first("state").as("state")
                        .first("party").as("party")
                        .count().as("tradeCount")
                        .sum(ConditionalOperators.buyFlag()).as("buyCount")
                        .sum(ConditionalOperators.sellFlag()).as("sellCount")
                        .sum("amountMid").as("volume"),
                sort(Sort.Direction.DESC, "tradeCount"));
        AggregationResults<Document> results = mongoTemplate.aggregate(agg, "trades", Document.class);
        return results.getMappedResults().stream()
                .map(d -> new TradeDtos.MemberStats(
                        d.getString("_id"),
                        d.getString("chamber"),
                        d.getString("state"),
                        d.getString("party"),
                        toLong(d.get("tradeCount")),
                        toLong(d.get("buyCount")),
                        toLong(d.get("sellCount")),
                        toLong(d.get("volume"))))
                .toList();
    }

    public List<TradeDtos.SectorStats> sectorStats() {
        List<TradeDtos.SectorStats> cached = sectorStatsCache;
        if (cached != null && System.currentTimeMillis() - sectorStatsCachedAt < AGGREGATE_CACHE_TTL_MS) {
            return cached;
        }
        List<TradeDtos.SectorStats> fresh = computeSectorStats();
        sectorStatsCache = fresh;
        sectorStatsCachedAt = System.currentTimeMillis();
        return fresh;
    }

    private List<TradeDtos.SectorStats> computeSectorStats() {
        Aggregation agg = newAggregation(
                group("sector")
                        .count().as("tradeCount")
                        .sum(ConditionalOperators.buyFlag()).as("buyCount")
                        .sum(ConditionalOperators.sellFlag()).as("sellCount")
                        .sum("amountMid").as("volume"),
                sort(Sort.Direction.DESC, "tradeCount"));
        AggregationResults<Document> results = mongoTemplate.aggregate(agg, "trades", Document.class);
        return results.getMappedResults().stream()
                .map(d -> new TradeDtos.SectorStats(
                        d.getString("_id") == null ? SectorService.UNKNOWN : d.getString("_id"),
                        toLong(d.get("tradeCount")),
                        toLong(d.get("buyCount")),
                        toLong(d.get("sellCount")),
                        toLong(d.get("volume"))))
                .toList();
    }

    public TradeDtos.MemberSummary memberSummary(String member) {
        Query base = new Query(where("member").is(member));
        long total = mongoTemplate.count(base, Trade.class);
        if (total == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "No trades found for member: " + member);
        }
        Trade sample = mongoTemplate.findOne(base.limit(1), Trade.class);
        long buys = mongoTemplate.count(new Query(where("member").is(member).and("transactionType").is("BUY")), Trade.class);
        long sells = mongoTemplate.count(new Query(where("member").is(member).and("transactionType").is("SELL")), Trade.class);

        Aggregation tickerAgg = newAggregation(
                match(where("member").is(member).and("ticker").ne(null)),
                group("ticker").count().as("count"),
                sort(Sort.Direction.DESC, "count"),
                limit(10));
        List<TradeDtos.TickerCount> topTickers = mongoTemplate.aggregate(tickerAgg, "trades", Document.class)
                .getMappedResults().stream()
                .map(d -> new TradeDtos.TickerCount(d.getString("_id"), toLong(d.get("count"))))
                .toList();

        Aggregation sectorAgg = newAggregation(
                match(where("member").is(member)),
                group("sector").count().as("count"),
                sort(Sort.Direction.DESC, "count"));
        List<TradeDtos.SectorCount> sectorBreakdown = mongoTemplate.aggregate(sectorAgg, "trades", Document.class)
                .getMappedResults().stream()
                .map(d -> new TradeDtos.SectorCount(
                        d.getString("_id") == null ? SectorService.UNKNOWN : d.getString("_id"),
                        toLong(d.get("count"))))
                .toList();

        Aggregation volumeAgg = newAggregation(
                match(where("member").is(member)),
                group().sum("amountMid").as("volume"));
        Document volumeDoc = mongoTemplate.aggregate(volumeAgg, "trades", Document.class).getUniqueMappedResult();
        long estimatedVolume = volumeDoc == null ? 0 : toLong(volumeDoc.get("volume"));

        return new TradeDtos.MemberSummary(member,
                sample != null ? sample.getChamber() : null,
                sample != null ? sample.getState() : null,
                sample != null ? sample.getParty() : null,
                total, buys, sells, estimatedVolume, topTickers, sectorBreakdown);
    }

    /** Side-by-side comparison of up to 3 members (F8) — each is a full member summary. */
    public TradeDtos.MemberComparison compare(List<String> members) {
        if (members == null || members.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "At least one member is required");
        }
        List<TradeDtos.MemberSummary> summaries = new java.util.ArrayList<>();
        for (String m : members.stream().distinct().limit(3).toList()) {
            try {
                summaries.add(memberSummary(m));
            } catch (ApiException ignored) {
                // skip members with no trades rather than failing the whole comparison
            }
        }
        if (summaries.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "No trades found for the requested members");
        }
        return new TradeDtos.MemberComparison(summaries);
    }

    public List<TradeDtos.TimelinePoint> sectorTimeline(String sector) {
        Aggregation agg = newAggregation(
                match(where("sector").is(sector)),
                project("transactionType")
                        .and(org.springframework.data.mongodb.core.aggregation.DateOperators.DateToString
                                .dateOf("transactionDate").toString("%Y-%m")).as("period"),
                group("period")
                        .sum(ConditionalOperators.buyFlag()).as("buyCount")
                        .sum(ConditionalOperators.sellFlag()).as("sellCount"),
                sort(Sort.Direction.ASC, "_id"));
        AggregationResults<Document> results = mongoTemplate.aggregate(agg, "trades", Document.class);
        return results.getMappedResults().stream()
                .map(d -> new TradeDtos.TimelinePoint(
                        d.getString("_id"),
                        toLong(d.get("buyCount")),
                        toLong(d.get("sellCount"))))
                .toList();
    }

    private static final int HOT_THRESHOLD = 5;
    private static final int HOT_WINDOW_DAYS = 90;

    /**
     * Tickers bought or sold more than {@value HOT_THRESHOLD} times in the last
     * {@value HOT_WINDOW_DAYS} days across all members.
     */
    public List<TradeDtos.HotTicker> hotTickers() {
        java.util.Date cutoff = java.util.Date.from(
                java.time.LocalDate.now().minusDays(HOT_WINDOW_DAYS)
                        .atStartOfDay(java.time.ZoneOffset.UTC).toInstant());
        Aggregation agg = newAggregation(
                match(where("ticker").ne(null).and("transactionDate").gte(cutoff)),
                group("ticker")
                        .sum(ConditionalOperators.buyFlag()).as("buyCount")
                        .sum(ConditionalOperators.sellFlag()).as("sellCount"),
                match(new Criteria().orOperator(
                        where("buyCount").gt(HOT_THRESHOLD),
                        where("sellCount").gt(HOT_THRESHOLD))),
                sort(Sort.Direction.DESC, "buyCount"));
        return mongoTemplate.aggregate(agg, "trades", Document.class)
                .getMappedResults().stream()
                .map(d -> {
                    long buys = toLong(d.get("buyCount"));
                    long sells = toLong(d.get("sellCount"));
                    String highlight;
                    if (buys > HOT_THRESHOLD && buys >= sells) {
                        highlight = "BUY";
                    } else {
                        highlight = "SELL";
                    }
                    return new TradeDtos.HotTicker(d.getString("_id"), buys, sells, highlight);
                })
                .toList();
    }

    public List<TradeDtos.SpotlightMember> spotlight(List<String> names) {
        return names.stream().map(this::spotlightFor).toList();
    }

    private TradeDtos.SpotlightMember spotlightFor(String name) {
        Query base = new Query(where("member").is(name));
        long total = mongoTemplate.count(base, Trade.class);
        if (total == 0) {
            return new TradeDtos.SpotlightMember(name, false, null, null, null, 0, 0, 0, List.of());
        }
        long buys = mongoTemplate.count(
                new Query(where("member").is(name).and("transactionType").is("BUY")), Trade.class);
        long sells = mongoTemplate.count(
                new Query(where("member").is(name).and("transactionType").is("SELL")), Trade.class);
        // Newest genuine trades first; typo-dated ones sink so the card doesn't lead with junk.
        Query recentQuery = new Query(where("member").is(name))
                .with(Sort.by(Sort.Direction.ASC, "suspiciousDate").and(Sort.by(Sort.Direction.DESC, "transactionDate")))
                .limit(6);
        List<Trade> recent = mongoTemplate.find(recentQuery, Trade.class);
        Trade sample = recent.isEmpty() ? null : recent.get(0);
        return new TradeDtos.SpotlightMember(name, true,
                sample != null ? sample.getChamber() : null,
                sample != null ? sample.getState() : null,
                sample != null ? sample.getParty() : null,
                total, buys, sells, recent);
    }

    private long toLong(Object value) {
        if (value instanceof Number n) {
            return n.longValue();
        }
        return 0;
    }

    /**
     * Helpers producing {$cond: [{$eq: ["$transactionType", X]}, 1, 0]} expressions for
     * buy/sell counts inside $group stages.
     */
    private static class ConditionalOperators {
        static org.springframework.data.mongodb.core.aggregation.AggregationExpression buyFlag() {
            return typeFlag("BUY");
        }

        static org.springframework.data.mongodb.core.aggregation.AggregationExpression sellFlag() {
            return typeFlag("SELL");
        }

        private static org.springframework.data.mongodb.core.aggregation.AggregationExpression typeFlag(String type) {
            return context -> new Document("$cond",
                    List.of(new Document("$eq", List.of("$transactionType", type)), 1, 0));
        }
    }
}
