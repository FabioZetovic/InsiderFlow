package com.insiderflow.market;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.ClassPathResource;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class MarketService {

    private static final Logger log = LoggerFactory.getLogger(MarketService.class);

    /** The 11 SPDR sector ETFs, in conventional order. */
    private static final Map<String, String> SECTOR_ETFS = new LinkedHashMap<>() {{
        put("XLK", "Technology");
        put("XLF", "Financials");
        put("XLV", "Health Care");
        put("XLE", "Energy");
        put("XLI", "Industrials");
        put("XLY", "Consumer Discretionary");
        put("XLP", "Consumer Staples");
        put("XLU", "Utilities");
        put("XLB", "Materials");
        put("XLRE", "Real Estate");
        put("XLC", "Communication Services");
    }};

    private final FinnhubClient finnhubClient;
    private final SectorFlowRepository sectorFlowRepository;
    private final SectorWeeklyRepository sectorWeeklyRepository;
    private final EarningsRepository earningsRepository;
    private final ObjectMapper objectMapper;
    private final org.springframework.web.client.RestClient yahooClient =
            org.springframework.web.client.RestClient.builder()
                    .baseUrl("https://query1.finance.yahoo.com")
                    .defaultHeader("User-Agent", "Mozilla/5.0")
                    .build();

    private List<MarketDtos.MarketEvent> events = List.of();

    public MarketService(FinnhubClient finnhubClient,
                         SectorFlowRepository sectorFlowRepository,
                         SectorWeeklyRepository sectorWeeklyRepository,
                         EarningsRepository earningsRepository,
                         ObjectMapper objectMapper) {
        this.finnhubClient = finnhubClient;
        this.sectorFlowRepository = sectorFlowRepository;
        this.sectorWeeklyRepository = sectorWeeklyRepository;
        this.earningsRepository = earningsRepository;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void loadEvents() {
        try (InputStream in = new ClassPathResource("market_events.json").getInputStream()) {
            JsonNode root = objectMapper.readTree(in);
            List<MarketDtos.MarketEvent> loaded = new ArrayList<>();
            for (JsonNode node : root) {
                loaded.add(new MarketDtos.MarketEvent(
                        LocalDate.parse(node.path("date").asText()),
                        node.path("type").asText(),
                        node.path("title").asText()));
            }
            loaded.sort((a, b) -> a.date().compareTo(b.date()));
            this.events = List.copyOf(loaded);
            log.info("Loaded {} market events from market_events.json", events.size());
        } catch (Exception e) {
            log.error("Failed to load market_events.json", e);
        }
    }

    // ---------- Sector flow ----------

    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void refreshOnStartup() {
        refreshSectorFlow();
        refreshEarnings();
        refreshSectorWeekly();
    }

    /**
     * Every 15 minutes during US market hours (roughly 13:00-21:00 UTC, Mon-Fri).
     */
    @Scheduled(cron = "0 */15 13-21 * * MON-FRI", zone = "UTC")
    public void refreshSectorFlow() {
        if (!finnhubClient.isConfigured()) {
            log.info("FINNHUB_API_KEY not set — skipping sector flow refresh");
            return;
        }
        List<SectorFlow> flows = new ArrayList<>();
        SECTOR_ETFS.forEach((symbol, name) -> {
            FinnhubClient.Quote quote = finnhubClient.quote(symbol);
            if (quote != null) {
                flows.add(new SectorFlow(symbol, name, quote.current(), quote.change(),
                        quote.percentChange(), quote.previousClose()));
            }
        });
        FinnhubClient.Quote spy = finnhubClient.quote("SPY");
        if (spy != null) {
            flows.add(new SectorFlow("SPY", "S&P 500 (SPY)", spy.current(), spy.change(),
                    spy.percentChange(), spy.previousClose()));
        }
        if (!flows.isEmpty()) {
            sectorFlowRepository.saveAll(flows);
            log.info("Refreshed sector flow for {} symbols", flows.size());
        }
    }

    public List<SectorFlow> getSectorFlow() {
        return sectorFlowRepository.findAll().stream()
                .filter(f -> !"SPY".equals(f.getSymbol()))
                .sorted((a, b) -> Double.compare(b.getChangePercent(), a.getChangePercent()))
                .toList();
    }

    // ---------- Weekly sector performance (Yahoo Finance chart API, keyless) ----------

    /**
     * Refreshes weekly (5 trading days) performance for the 11 sector ETFs from Yahoo Finance
     * daily closes. Runs at startup and twice a day (pre-market and after US close).
     */
    @Scheduled(cron = "0 30 6,22 * * *", zone = "UTC")
    public void refreshSectorWeekly() {
        List<SectorWeekly> results = new ArrayList<>();
        SECTOR_ETFS.forEach((symbol, name) -> {
            SectorWeekly weekly = fetchWeeklyFromYahoo(symbol, name);
            if (weekly != null) {
                results.add(weekly);
            }
        });
        if (!results.isEmpty()) {
            sectorWeeklyRepository.saveAll(results);
            log.info("Refreshed weekly sector performance for {} ETFs via Yahoo Finance", results.size());
        } else {
            log.warn("Yahoo weekly sector refresh produced no data");
        }
    }

    /**
     * Weekly change = last daily close vs the close 5 trading days earlier, from the Yahoo
     * chart endpoint (1 month of daily candles).
     */
    private SectorWeekly fetchWeeklyFromYahoo(String symbol, String name) {
        try {
            JsonNode root = yahooClient.get()
                    .uri("/v8/finance/chart/" + symbol + "?range=1mo&interval=1d")
                    .retrieve()
                    .body(JsonNode.class);
            JsonNode result = root == null ? null : root.path("chart").path("result").path(0);
            if (result == null || result.isMissingNode()) {
                return null;
            }
            JsonNode closesNode = result.path("indicators").path("quote").path(0).path("close");
            JsonNode timestamps = result.path("timestamp");
            List<Double> closes = new ArrayList<>();
            List<Long> times = new ArrayList<>();
            for (int i = 0; i < closesNode.size(); i++) {
                if (closesNode.get(i) != null && closesNode.get(i).isNumber()) {
                    closes.add(closesNode.get(i).asDouble());
                    times.add(timestamps.path(i).asLong());
                }
            }
            if (closes.size() < 6) {
                return null;
            }
            double lastClose = closes.get(closes.size() - 1);
            double weekAgoClose = closes.get(closes.size() - 6);
            LocalDate lastDate = Instant.ofEpochSecond(times.get(times.size() - 1))
                    .atZone(java.time.ZoneOffset.UTC).toLocalDate();
            return new SectorWeekly(symbol, name, lastClose, weekAgoClose, lastDate);
        } catch (Exception e) {
            log.warn("Yahoo weekly fetch failed for {}: {}", symbol, e.getMessage());
            return null;
        }
    }

    public List<SectorWeekly> getSectorWeekly() {
        return sectorWeeklyRepository.findAll().stream()
                .sorted((a, b) -> Double.compare(b.getWeeklyChangePercent(), a.getWeeklyChangePercent()))
                .toList();
    }

    // ---------- S&P 500 strip ----------

    public MarketDtos.SpxResponse getSpx() {
        SectorFlow cached = sectorFlowRepository.findById("SPY").orElse(null);

        // Prefer a live quote when possible; fall back to the cached one.
        FinnhubClient.Quote live = finnhubClient.quote("SPY");
        double price, change, changePercent;
        Instant updatedAt;
        if (live != null) {
            price = live.current();
            change = live.change();
            changePercent = live.percentChange();
            updatedAt = Instant.now();
        } else if (cached != null) {
            price = cached.getPrice();
            change = cached.getChange();
            changePercent = cached.getChangePercent();
            updatedAt = cached.getUpdatedAt();
        } else {
            return null;
        }

        List<Double> sparkline = intradaySparkline();
        return new MarketDtos.SpxResponse("SPY", price, change, changePercent, sparkline, updatedAt);
    }

    /**
     * Intraday candles are not available on all Finnhub free-tier keys; returns an empty list
     * when unavailable so the frontend renders just the quote strip.
     */
    private List<Double> intradaySparkline() {
        try {
            long now = Instant.now().getEpochSecond();
            long dayStart = now - 60 * 60 * 8;
            JsonNode candles = finnhubClient.candles("SPY", "5", dayStart, now);
            if (candles == null) {
                return List.of();
            }
            List<Double> closes = new ArrayList<>();
            for (JsonNode c : candles.path("c")) {
                closes.add(c.asDouble());
            }
            return closes;
        } catch (Exception e) {
            return List.of();
        }
    }

    // ---------- Market events ----------

    public List<MarketDtos.MarketEvent> getEvents(LocalDate from, LocalDate to) {
        LocalDate effectiveFrom = from != null ? from : LocalDate.now();
        return events.stream()
                .filter(e -> !e.date().isBefore(effectiveFrom))
                .filter(e -> to == null || !e.date().isAfter(to))
                .toList();
    }

    // ---------- Earnings ----------

    /**
     * Daily cache refresh of this week's earnings calendar (05:30 UTC + startup).
     */
    @Scheduled(cron = "0 30 5 * * *", zone = "UTC")
    public void refreshEarnings() {
        if (!finnhubClient.isConfigured()) {
            log.info("FINNHUB_API_KEY not set — skipping earnings refresh");
            return;
        }
        LocalDate monday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate friday = monday.plusDays(4);
        JsonNode calendar = finnhubClient.earningsCalendar(monday.toString(), friday.toString());
        if (calendar == null || !calendar.isArray()) {
            log.warn("Earnings calendar fetch failed for {} - {}", monday, friday);
            return;
        }
        List<EarningsEntry> entries = new ArrayList<>();
        for (JsonNode node : calendar) {
            String symbol = node.path("symbol").asText(null);
            String date = node.path("date").asText(null);
            if (symbol == null || date == null) {
                continue;
            }
            EarningsEntry entry = new EarningsEntry();
            entry.setId(symbol + "|" + date);
            entry.setSymbol(symbol);
            entry.setDate(LocalDate.parse(date));
            entry.setEpsEstimate(node.path("epsEstimate").isNumber() ? node.path("epsEstimate").asDouble() : null);
            entry.setEpsActual(node.path("epsActual").isNumber() ? node.path("epsActual").asDouble() : null);
            entry.setRevenueEstimate(node.path("revenueEstimate").isNumber() ? node.path("revenueEstimate").asDouble() : null);
            entry.setHour(node.path("hour").asText(null));
            entry.setQuarter(node.path("quarter").isNumber() ? node.path("quarter").asInt() : null);
            entry.setYear(node.path("year").isNumber() ? node.path("year").asInt() : null);
            entry.setFetchedAt(Instant.now());
            entries.add(entry);
        }
        if (!entries.isEmpty()) {
            earningsRepository.saveAll(entries);
            log.info("Cached {} earnings entries for week {} - {}", entries.size(), monday, friday);
        }
    }

    public List<EarningsEntry> getEarningsThisWeek() {
        LocalDate monday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate friday = monday.plusDays(4);
        return earningsRepository.findByDateBetweenOrderByDateAsc(monday.minusDays(1), friday.plusDays(1));
    }
}
