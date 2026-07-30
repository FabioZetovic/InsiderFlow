package com.insiderflow.market;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Daily closing prices per ticker from the keyless Yahoo Finance chart API, cached in Mongo
 * (and in memory) so the ticker-detail chart and the trader leaderboard don't re-hit Yahoo.
 */
@Service
public class PriceHistoryService {

    private static final Logger log = LoggerFactory.getLogger(PriceHistoryService.class);
    private static final long CACHE_TTL_HOURS = 18;

    @Document(collection = "price_history")
    public static class CachedHistory {
        @Id
        public String ticker;
        public List<String> dates;   // ISO yyyy-MM-dd, ascending
        public List<Double> closes;
        public Instant fetchedAt;
    }

    private final MongoTemplate mongoTemplate;
    private final RestClient yahooClient = RestClient.builder()
            .baseUrl("https://query1.finance.yahoo.com")
            .defaultHeader("User-Agent", "Mozilla/5.0")
            .build();

    private final Map<String, NavigableMap<LocalDate, Double>> memory = new ConcurrentHashMap<>();

    public PriceHistoryService(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    /** Full daily close series for a ticker (ascending by date), or empty if unavailable. */
    public NavigableMap<LocalDate, Double> history(String ticker) {
        if (ticker == null || ticker.isBlank()) {
            return new TreeMap<>();
        }
        String symbol = ticker.trim().toUpperCase();
        NavigableMap<LocalDate, Double> cached = memory.get(symbol);
        if (cached != null) {
            return cached;
        }

        CachedHistory doc = mongoTemplate.findById(symbol, CachedHistory.class);
        if (doc != null && doc.fetchedAt != null
                && doc.fetchedAt.isAfter(Instant.now().minus(CACHE_TTL_HOURS, ChronoUnit.HOURS))) {
            NavigableMap<LocalDate, Double> series = toSeries(doc);
            memory.put(symbol, series);
            return series;
        }

        NavigableMap<LocalDate, Double> fetched = fetchFromYahoo(symbol);
        if (fetched.isEmpty()) {
            // Fall back to a stale cache entry rather than nothing.
            if (doc != null) {
                NavigableMap<LocalDate, Double> series = toSeries(doc);
                memory.put(symbol, series);
                return series;
            }
            return fetched;
        }
        persist(symbol, fetched);
        memory.put(symbol, fetched);
        return fetched;
    }

    /** Closing price on the given date, or the most recent close before it. */
    public Double priceOnOrBefore(String ticker, LocalDate date) {
        NavigableMap<LocalDate, Double> series = history(ticker);
        if (series.isEmpty()) {
            return null;
        }
        Map.Entry<LocalDate, Double> e = series.floorEntry(date);
        return e != null ? e.getValue() : null;
    }

    /** Latest known close for a ticker. */
    public Double latest(String ticker) {
        NavigableMap<LocalDate, Double> series = history(ticker);
        return series.isEmpty() ? null : series.lastEntry().getValue();
    }

    private NavigableMap<LocalDate, Double> fetchFromYahoo(String symbol) {
        NavigableMap<LocalDate, Double> series = new TreeMap<>();
        try {
            JsonNode root = yahooClient.get()
                    .uri("/v8/finance/chart/" + symbol + "?range=3y&interval=1d")
                    .retrieve()
                    .body(JsonNode.class);
            JsonNode result = root == null ? null : root.path("chart").path("result").path(0);
            if (result == null || result.isMissingNode()) {
                return series;
            }
            JsonNode timestamps = result.path("timestamp");
            JsonNode closes = result.path("indicators").path("quote").path(0).path("close");
            for (int i = 0; i < timestamps.size(); i++) {
                JsonNode close = closes.get(i);
                if (close != null && close.isNumber()) {
                    LocalDate date = Instant.ofEpochSecond(timestamps.get(i).asLong())
                            .atZone(ZoneOffset.UTC).toLocalDate();
                    series.put(date, close.asDouble());
                }
            }
        } catch (Exception e) {
            log.warn("Yahoo price history fetch failed for {}: {}", symbol, e.getMessage());
        }
        return series;
    }

    private NavigableMap<LocalDate, Double> toSeries(CachedHistory doc) {
        NavigableMap<LocalDate, Double> series = new TreeMap<>();
        if (doc.dates == null || doc.closes == null) {
            return series;
        }
        for (int i = 0; i < Math.min(doc.dates.size(), doc.closes.size()); i++) {
            series.put(LocalDate.parse(doc.dates.get(i)), doc.closes.get(i));
        }
        return series;
    }

    private void persist(String symbol, NavigableMap<LocalDate, Double> series) {
        CachedHistory doc = new CachedHistory();
        doc.ticker = symbol;
        doc.dates = new ArrayList<>();
        doc.closes = new ArrayList<>();
        series.forEach((date, close) -> {
            doc.dates.add(date.toString());
            doc.closes.add(close);
        });
        doc.fetchedAt = Instant.now();
        try {
            mongoTemplate.save(doc);
        } catch (Exception e) {
            log.warn("Failed to cache price history for {}: {}", symbol, e.getMessage());
        }
    }

    /** Removes a symbol from the in-memory cache (used by tests / manual refresh). */
    public void evict(String ticker) {
        if (ticker != null) {
            memory.remove(ticker.trim().toUpperCase());
            mongoTemplate.remove(new Query(Criteria.where("_id").is(ticker.trim().toUpperCase())), CachedHistory.class);
        }
    }
}
