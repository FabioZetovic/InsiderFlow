package com.insiderflow.trades;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.springframework.data.mongodb.core.query.Criteria.where;

@Service
public class TradeIngestionService {

    private static final Logger log = LoggerFactory.getLogger(TradeIngestionService.class);

    private static final int BULK_BATCH_SIZE = 1000;
    private static final int ENRICH_LIMIT_PER_RUN = 300;

    private final MongoTemplate mongoTemplate;
    private final SectorService sectorService;
    private final MemberDirectory memberDirectory;
    private final TickerRepository tickerRepository;
    private final com.insiderflow.market.FinnhubClient finnhubClient;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;

    private final String senateUrl;
    private final String houseUrl;
    private final String senateFallbackUrl;
    private final String houseFallbackUrl;
    private final boolean ingestOnStartup;
    private final String trumpUrl;
    private final String trumpPtrLink;
    private final String senateLocalFile;

    private volatile boolean ingesting = false;

    /** Published after each completed ingest run — listeners refresh caches and analytics. */
    public record IngestCompletedEvent(long totalProcessed) {
    }

    public TradeIngestionService(MongoTemplate mongoTemplate,
                                 SectorService sectorService,
                                 MemberDirectory memberDirectory,
                                 TickerRepository tickerRepository,
                                 com.insiderflow.market.FinnhubClient finnhubClient,
                                 ObjectMapper objectMapper,
                                 org.springframework.context.ApplicationEventPublisher eventPublisher,
                                 @Value("${insiderflow.trades.senate-url}") String senateUrl,
                                 @Value("${insiderflow.trades.house-url}") String houseUrl,
                                 @Value("${insiderflow.trades.senate-fallback-url}") String senateFallbackUrl,
                                 @Value("${insiderflow.trades.house-fallback-url}") String houseFallbackUrl,
                                 @Value("${insiderflow.trades.ingest-on-startup}") boolean ingestOnStartup,
                                 @Value("${insiderflow.trades.trump-url}") String trumpUrl,
                                 @Value("${insiderflow.trades.trump-ptr-link}") String trumpPtrLink,
                                 @Value("${insiderflow.trades.senate-local-file}") String senateLocalFile) {
        this.mongoTemplate = mongoTemplate;
        this.sectorService = sectorService;
        this.memberDirectory = memberDirectory;
        this.eventPublisher = eventPublisher;
        this.tickerRepository = tickerRepository;
        this.finnhubClient = finnhubClient;
        this.objectMapper = objectMapper;
        this.senateUrl = senateUrl;
        this.houseUrl = houseUrl;
        this.senateFallbackUrl = senateFallbackUrl;
        this.houseFallbackUrl = houseFallbackUrl;
        this.ingestOnStartup = ingestOnStartup;
        this.trumpUrl = trumpUrl;
        this.trumpPtrLink = trumpPtrLink;
        this.senateLocalFile = senateLocalFile;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(15));
        factory.setReadTimeout(Duration.ofMinutes(3));
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void ingestOnStartup() {
        if (ingestOnStartup) {
            ingestAll();
        }
    }

    @Scheduled(cron = "0 0 6 * * *", zone = "UTC")
    public void ingestDaily() {
        ingestAll();
    }

    public synchronized void ingestAll() {
        if (ingesting) {
            return;
        }
        ingesting = true;
        try {
            long start = System.currentTimeMillis();
            int senate = ingestChamber("SENATE", senateUrl, senateFallbackUrl);
            int senateLocal = ingestSenateLocalFile();
            int house = ingestChamber("HOUSE", houseUrl, houseFallbackUrl);
            int trump = ingestTrump();
            log.info("Ingestion finished: {} senate (mirror) + {} senate (eFD scraper) + {} house + {} trump records processed in {} ms",
                    senate, senateLocal, house, trump, System.currentTimeMillis() - start);
            eventPublisher.publishEvent(new IngestCompletedEvent(
                    (long) senate + senateLocal + house + trump));
            enrichSectors();
        } finally {
            ingesting = false;
        }
    }

    private int ingestChamber(String chamber, String url, String fallbackUrl) {
        JsonNode root = fetchJson(url);
        if (root == null) {
            log.warn("Primary {} source is unreachable ({}), falling back to GitHub mirror", chamber, url);
            root = fetchJson(fallbackUrl);
        }
        if (root == null || !root.isArray()) {
            log.error("Could not fetch {} transactions from primary or fallback source", chamber);
            return 0;
        }

        List<Trade> batch = new ArrayList<>(BULK_BATCH_SIZE);
        int processed = 0;
        for (JsonNode node : root) {
            Trade trade = "SENATE".equals(chamber) ? mapSenate(node) : mapHouse(node);
            if (trade == null) {
                continue;
            }
            batch.add(trade);
            if (batch.size() >= BULK_BATCH_SIZE) {
                processed += flush(batch);
            }
        }
        processed += flush(batch);
        log.info("Ingested {} {} trades", processed, chamber);
        return processed;
    }

    private JsonNode fetchJson(String url) {
        try {
            byte[] body = restClient.get().uri(url).retrieve().body(byte[].class);
            return body == null ? null : objectMapper.readTree(body);
        } catch (Exception e) {
            log.warn("Fetch failed for {}: {}", url, e.getMessage());
            return null;
        }
    }

    private Trade mapSenate(JsonNode node) {
        return mapCommon(node,
                text(node, "senator"),
                "SENATE",
                null);
    }

    private Trade mapHouse(JsonNode node) {
        String district = text(node, "district");
        String state = (district != null && district.length() >= 2) ? district.substring(0, 2) : null;
        String member = text(node, "representative");
        if (member != null) {
            member = member.replaceFirst("^Hon\\.?\\s+", "").trim();
        }
        Trade trade = mapCommon(node, member, "HOUSE", state);
        return trade;
    }

    private Trade mapCommon(JsonNode node, String member, String chamber, String state) {
        if (member == null || member.isBlank()) {
            return null;
        }
        String type = TradeMapper.normalizeType(text(node, "type"));
        if (type == null) {
            return null;
        }
        LocalDate transactionDate = TradeMapper.parseDate(text(node, "transaction_date"));
        if (transactionDate == null) {
            return null;
        }

        String assetType = text(node, "asset_type");
        String description = text(node, "asset_description");
        String ticker = TradeMapper.normalizeTicker(text(node, "ticker"));
        if (ticker == null) {
            ticker = TradeMapper.recoverTicker(description, assetType);
        }

        String ptrLink = text(node, "ptr_link");
        if (ptrLink == null) {
            ptrLink = text(node, "source_url"); // house mirror uses source_url
        }

        Trade trade = new Trade();
        // Canonicalize the member and, when matched, prefer directory party/state over the feed.
        MemberDirectory.MemberInfo info = memberDirectory.resolve(member);
        trade.setMember(info != null ? info.canonical() : member.trim());
        trade.setChamber(chamber);
        trade.setState(info != null && info.state() != null ? info.state() : state);
        trade.setParty(info != null && info.party() != null ? info.party() : text(node, "party"));
        trade.setTicker(ticker);
        trade.setAssetDescription(description);
        trade.setAssetType(assetType);
        trade.setTransactionType(type);
        trade.setAmountRange(text(node, "amount"));
        applyAmounts(trade);
        LocalDate disclosureDate = TradeMapper.parseDate(text(node, "disclosure_date"));
        trade.setTransactionDate(transactionDate);
        trade.setDisclosureDate(disclosureDate);
        trade.setSuspiciousDate(TradeMapper.isSuspiciousDate(transactionDate, disclosureDate, LocalDate.now()));
        trade.setPtrLink(ptrLink);
        trade.setSector(resolveSector(ticker, assetType, description));
        applyDerivedFlags(trade, info);
        // Dedup on the RAW source member name (stable), not the canonical display name.
        // Otherwise regenerating legislators.json changes a member's canonical name, which would
        // change the dedupKey and create a duplicate document instead of updating the existing
        // one in place — the bug that previously forced a manual `db.trades.drop()`.
        trade.setDedupKey(TradeMapper.dedupKey(member.trim(), ticker, transactionDate,
                trade.getAmountRange(), type));
        return trade;
    }

    private void applyAmounts(Trade trade) {
        TradeMapper.AmountBounds bounds = TradeMapper.parseAmount(trade.getAmountRange());
        trade.setAmountLow(bounds.low());
        trade.setAmountMid(bounds.mid());
        trade.setAmountHigh(bounds.high());
    }

    /**
     * Derived accountability fields: disclosure lag vs the STOCK Act's 45-day window, and a
     * committee-oversight flag when the member's committee maps to the trade's sector.
     * (nearEarnings is filled by a separate post-ingest pass — it needs the earnings cache.)
     */
    private void applyDerivedFlags(Trade trade, MemberDirectory.MemberInfo info) {
        LocalDate tx = trade.getTransactionDate();
        LocalDate disclosed = trade.getDisclosureDate();
        if (tx != null && disclosed != null && !tx.isAfter(disclosed)) {
            trade.setDisclosureLagDays((int) java.time.temporal.ChronoUnit.DAYS.between(tx, disclosed));
        }
        trade.setLateDisclosure(TradeMapper.isLateDisclosure(tx, disclosed));
        if (info != null && info.committees() != null) {
            trade.setCommitteeConflict(
                    CommitteeSectorMap.conflictFor(info.committees(), trade.getSector()));
        }
    }

    /**
     * Sector for a trade: coarse non-equity category (bonds/funds/etc.) when applicable,
     * otherwise the GICS sector from the ticker, otherwise Unknown.
     */
    private String resolveSector(String ticker, String assetType, String description) {
        String nonEquity = TradeMapper.classifyNonEquity(assetType, description);
        if (nonEquity != null) {
            return nonEquity;
        }
        return ticker == null ? SectorService.UNKNOWN : sectorService.resolveOffline(ticker);
    }

    private int flush(List<Trade> batch) {
        if (batch.isEmpty()) {
            return 0;
        }
        BulkOperations bulk = mongoTemplate.bulkOps(BulkOperations.BulkMode.UNORDERED, Trade.class);
        for (Trade t : batch) {
            Update update = new Update()
                    .set("member", t.getMember())
                    .set("chamber", t.getChamber())
                    .set("state", t.getState())
                    .set("party", t.getParty())
                    .set("ticker", t.getTicker())
                    .set("assetDescription", t.getAssetDescription())
                    .set("assetType", t.getAssetType())
                    .set("transactionType", t.getTransactionType())
                    .set("amountRange", t.getAmountRange())
                    .set("amountLow", t.getAmountLow())
                    .set("amountMid", t.getAmountMid())
                    .set("amountHigh", t.getAmountHigh())
                    .set("transactionDate", t.getTransactionDate())
                    .set("disclosureDate", t.getDisclosureDate())
                    .set("suspiciousDate", t.isSuspiciousDate())
                    .set("disclosureLagDays", t.getDisclosureLagDays())
                    .set("lateDisclosure", t.isLateDisclosure())
                    .set("committeeConflict", t.getCommitteeConflict())
                    // nearEarnings is set by the post-ingest enrichment pass, not here, so a
                    // re-ingest doesn't clobber it; setOnInsert seeds it false for new docs.
                    .setOnInsert("nearEarnings", t.isNearEarnings())
                    .set("ptrLink", t.getPtrLink())
                    .set("sector", t.getSector());
            bulk.upsert(Query.query(where("dedupKey").is(t.getDedupKey())), update);
        }
        int size = batch.size();
        try {
            bulk.execute();
        } catch (Exception e) {
            log.warn("Bulk upsert batch failed: {}", e.getMessage());
        }
        batch.clear();
        return size;
    }

    /**
     * Ingests the Senate eFD scraper output (scripts/senate-efd-scraper.js) — same record
     * schema as the senate mirror. The mirror died in March 2021; this file carries
     * everything the scraper has pulled from efdsearch.senate.gov since then.
     */
    private int ingestSenateLocalFile() {
        try {
            java.nio.file.Path path = java.nio.file.Paths.get(senateLocalFile).toAbsolutePath().normalize();
            if (!java.nio.file.Files.exists(path)) {
                log.info("Senate eFD scraper file not found at {} — skipping (run scripts/senate-efd-scraper.js)", path);
                return 0;
            }
            JsonNode root = objectMapper.readTree(java.nio.file.Files.readAllBytes(path));
            if (!root.isArray()) {
                return 0;
            }
            List<Trade> batch = new ArrayList<>(BULK_BATCH_SIZE);
            int processed = 0;
            for (JsonNode node : root) {
                Trade trade = mapSenate(node);
                if (trade == null) {
                    continue;
                }
                batch.add(trade);
                if (batch.size() >= BULK_BATCH_SIZE) {
                    processed += flush(batch);
                }
            }
            processed += flush(batch);
            log.info("Ingested {} SENATE trades from eFD scraper file {}", processed, path);
            return processed;
        } catch (Exception e) {
            log.warn("Senate eFD local file ingestion failed: {}", e.getMessage());
            return 0;
        }
    }

    /**
     * Ingests President Trump's OGE Form 278-T transactions from the cleaned
     * trump-portfolio-tracker dataset (the 2026-05-08 filing: Jan-Mar 2026, 3642 trades).
     * Presidents file with OGE, not the House/Senate systems, so this is a separate source.
     */
    private int ingestTrump() {
        JsonNode root = fetchJson(trumpUrl);
        if (root == null) {
            log.warn("Could not fetch Trump 278-T dataset from {}", trumpUrl);
            return 0;
        }
        JsonNode stocks = root.path("stocks");
        if (!stocks.isObject()) {
            return 0;
        }
        LocalDate disclosureDate = LocalDate.of(2026, 5, 8);
        List<Trade> batch = new ArrayList<>(BULK_BATCH_SIZE);
        int processed = 0;
        var fields = stocks.properties().iterator();
        while (fields.hasNext()) {
            var entry = fields.next();
            JsonNode stock = entry.getValue();
            String ticker = TradeMapper.normalizeTicker(stock.path("ticker").asText(null));
            String name = text(stock, "name");
            String datasetSector = text(stock, "sector");
            for (JsonNode tx : stock.path("transactions")) {
                String type = TradeMapper.normalizeType(text(tx, "type"));
                LocalDate transactionDate = TradeMapper.parseDate(text(tx, "date"));
                if (type == null || transactionDate == null) {
                    continue;
                }
                Trade trade = new Trade();
                trade.setMember("Donald Trump");
                trade.setChamber("EXECUTIVE");
                trade.setState("District of Columbia");
                trade.setParty("Republican");
                trade.setTicker(ticker);
                trade.setAssetDescription(name != null ? name : text(tx, "rawDescription"));
                trade.setTransactionType(type);
                trade.setAmountRange(text(tx, "amount"));
                applyAmounts(trade);
                trade.setTransactionDate(transactionDate);
                trade.setDisclosureDate(disclosureDate);
                trade.setSuspiciousDate(TradeMapper.isSuspiciousDate(transactionDate, disclosureDate, LocalDate.now()));
                trade.setPtrLink(trumpPtrLink);
                String sector = ticker == null ? SectorService.UNKNOWN : sectorService.resolveOffline(ticker);
                if (SectorService.UNKNOWN.equals(sector) && datasetSector != null) {
                    sector = datasetSector;
                }
                trade.setSector(sector);
                applyDerivedFlags(trade, null); // President has no congressional committee
                trade.setDedupKey(TradeMapper.dedupKey("Donald Trump", ticker, transactionDate,
                        trade.getAmountRange(), type)
                        + "|" + tx.path("n").asText("")); // row number keeps same-day same-amount trades distinct
                batch.add(trade);
                if (batch.size() >= BULK_BATCH_SIZE) {
                    processed += flush(batch);
                }
            }
        }
        processed += flush(batch);
        log.info("Ingested {} EXECUTIVE (Trump 278-T) trades", processed);
        return processed;
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        // Some mirrored filings contain control characters from PDF extraction — strip them.
        String s = value.asText().replaceAll("\\p{Cntrl}", " ").replaceAll("\\s{2,}", " ").trim();
        return s.isEmpty() ? null : s;
    }

    /**
     * Resolves sectors for tickers still marked Unknown via Finnhub (rate-limited, capped per
     * run, each ticker looked up once thanks to the tickers cache collection).
     */
    private void enrichSectors() {
        if (!finnhubClient.isConfigured()) {
            log.info("FINNHUB_API_KEY not set — skipping sector enrichment for unknown tickers");
            return;
        }
        List<String> unknown = mongoTemplate.findDistinct(
                Query.query(where("sector").is(SectorService.UNKNOWN).and("ticker").ne(null)),
                "ticker", Trade.class, String.class);

        int resolvedCount = 0;
        int attempts = 0;
        for (String ticker : unknown) {
            if (attempts >= ENRICH_LIMIT_PER_RUN) {
                break;
            }
            if (!sectorService.isUnresolved(ticker)) {
                String sector = sectorService.resolveOffline(ticker);
                if (!SectorService.UNKNOWN.equals(sector)) {
                    updateTradeSectors(ticker, sector);
                }
                continue;
            }
            attempts++;
            String industry = finnhubClient.industry(ticker);
            tickerRepository.save(new TickerInfo(ticker,
                    industry != null ? industry : SectorService.UNKNOWN,
                    industry != null ? "FINNHUB" : "UNRESOLVED"));
            if (industry != null) {
                updateTradeSectors(ticker, industry);
                resolvedCount++;
            }
            try {
                Thread.sleep(1100); // stay under Finnhub free-tier 60 req/min
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        log.info("Sector enrichment: {} tickers resolved via Finnhub ({} attempted)", resolvedCount, attempts);
    }

    private void updateTradeSectors(String ticker, String sector) {
        mongoTemplate.updateMulti(
                Query.query(Criteria.where("ticker").is(ticker)),
                new Update().set("sector", sector),
                Trade.class);
    }
}
