package com.insiderflow.corporate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Ingests SEC Form 4 corporate-insider transactions (F10). To keep fetch volume sane, it only
 * downloads filings whose company (CIK) maps to a ticker that Congress has traded — that
 * intersection is the interesting part ("Congress buying while the CEO sells"). Powers the
 * Corporate Insiders tab and the corporate section on the ticker page.
 */
@Service
public class Form4IngestionService {

    private static final Logger log = LoggerFactory.getLogger(Form4IngestionService.class);

    private static final DateTimeFormatter IDX_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final Pattern XML_BLOCK = Pattern.compile("<XML>(.*?)</XML>", Pattern.DOTALL);
    private static final int STARTUP_BACKFILL_DAYS = 45;
    private static final int DAILY_LOOKBACK_DAYS = 4;

    private final MongoTemplate mongoTemplate;
    private final InsiderTradeRepository repository;
    private final ObjectMapper objectMapper;
    private final RestClient edgar;
    private final boolean enabled;

    /** Uppercase ticker -> zero-padded 10-digit CIK, from SEC's company_tickers.json. */
    private final Map<String, String> tickerToCik = new HashMap<>();
    /** 10-digit CIK -> ticker (reverse), for filtering the daily index. */
    private final Map<String, String> cikToTicker = new HashMap<>();

    public Form4IngestionService(MongoTemplate mongoTemplate,
                                 InsiderTradeRepository repository,
                                 ObjectMapper objectMapper,
                                 @Value("${insiderflow.sec.user-agent:InsiderFlow/1.0 (research)}") String userAgent,
                                 @Value("${insiderflow.sec.enabled:true}") boolean enabled) {
        this.mongoTemplate = mongoTemplate;
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.enabled = enabled;
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(Duration.ofSeconds(15));
        f.setReadTimeout(Duration.ofSeconds(30));
        this.edgar = RestClient.builder()
                .baseUrl("https://www.sec.gov")
                .requestFactory(f)
                .defaultHeader("User-Agent", userAgent)
                // No gzip: the simple request factory doesn't auto-decompress, which corrupts
                // the JSON/idx bodies. Identity encoding keeps responses plain-text.
                .defaultHeader("Accept-Encoding", "identity")
                .build();
    }

    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void ingestOnStartup() {
        if (!enabled) {
            log.info("SEC Form 4 ingestion disabled");
            return;
        }
        // Give the congress ingest a head start so the ticker set is populated.
        try {
            Thread.sleep(45_000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return;
        }
        ingest(STARTUP_BACKFILL_DAYS);
    }

    /** Daily at 07:00 UTC, after the congress ingest. */
    @Scheduled(cron = "0 0 7 * * *", zone = "UTC")
    public void ingestDaily() {
        if (enabled) {
            ingest(DAILY_LOOKBACK_DAYS);
        }
    }

    public synchronized void ingest(int lookbackDays) {
        try {
            loadCikMap();
            Set<String> interestingCiks = interestingCiks();
            if (interestingCiks.isEmpty()) {
                log.warn("Form 4 ingest: no congress-traded tickers mapped to CIKs yet; skipping");
                return;
            }
            long start = System.currentTimeMillis();
            int filings = 0, saved = 0;
            LocalDate day = LocalDate.now();
            for (int i = 0; i < lookbackDays; i++, day = day.minusDays(1)) {
                List<String[]> entries = form4IndexEntries(day, interestingCiks);
                for (String[] e : entries) {
                    filings++;
                    saved += ingestFiling(e[0], e[1]); // ticker, path
                    politeSleep();
                }
            }
            log.info("Form 4 ingest: {} interesting filings across {} days, {} transactions saved in {} ms",
                    filings, lookbackDays, saved, System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.error("Form 4 ingestion failed", e);
        }
    }

    private void loadCikMap() {
        if (!tickerToCik.isEmpty()) {
            return;
        }
        try {
            JsonNode root = edgar.get().uri("/files/company_tickers.json").retrieve().body(JsonNode.class);
            if (root == null) {
                return;
            }
            var it = root.elements();
            while (it.hasNext()) {
                JsonNode n = it.next();
                String ticker = n.path("ticker").asText(null);
                long cik = n.path("cik_str").asLong(0);
                if (ticker != null && cik > 0) {
                    String padded = String.format("%010d", cik);
                    tickerToCik.put(ticker.toUpperCase(), padded);
                    cikToTicker.putIfAbsent(padded, ticker.toUpperCase());
                }
            }
            log.info("Loaded SEC ticker->CIK map: {} tickers", tickerToCik.size());
        } catch (Exception e) {
            log.warn("Failed to load SEC company_tickers.json: {}", e.getMessage());
        }
    }

    /** CIKs whose ticker Congress has traded (distinct tickers in the trades collection). */
    private Set<String> interestingCiks() {
        List<String> tickers = mongoTemplate.findDistinct(new Query(), "ticker", "trades", String.class);
        Set<String> ciks = new HashSet<>();
        for (String t : tickers) {
            if (t == null) {
                continue;
            }
            String cik = tickerToCik.get(t.toUpperCase());
            if (cik != null) {
                ciks.add(cik);
            }
        }
        return ciks;
    }

    /** Returns [ticker, submissionTxtPath] for Form 4 filings on {@code day} from interesting CIKs. */
    private List<String[]> form4IndexEntries(LocalDate day, Set<String> interestingCiks) {
        List<String[]> out = new ArrayList<>();
        int quarter = (day.getMonthValue() - 1) / 3 + 1;
        String url = "/Archives/edgar/daily-index/" + day.getYear() + "/QTR" + quarter
                + "/form." + day.format(IDX_DATE) + ".idx";
        String body;
        try {
            body = edgar.get().uri(url).retrieve().body(String.class);
        } catch (Exception e) {
            return out; // weekends/holidays 403/404 — nothing filed
        }
        if (body == null) {
            return out;
        }
        for (String line : body.split("\n")) {
            if (!line.startsWith("4 ") && !line.startsWith("4/A")) {
                continue;
            }
            // Fixed-ish columns; split on 2+ spaces: [form, company, cik, date, path]
            String[] cols = line.trim().split("\\s{2,}");
            if (cols.length < 5) {
                continue;
            }
            String cik = String.format("%010d", parseLongSafe(cols[2]));
            if (!interestingCiks.contains(cik)) {
                continue;
            }
            String ticker = cikToTicker.get(cik);
            out.add(new String[]{ticker, "/Archives/" + cols[4].trim()});
        }
        return out;
    }

    private int ingestFiling(String ticker, String path) {
        try {
            String txt = edgar.get().uri(path).retrieve().body(String.class);
            if (txt == null) {
                return 0;
            }
            Matcher m = XML_BLOCK.matcher(txt);
            if (!m.find()) {
                return 0;
            }
            return parseForm4Xml(m.group(1), ticker, path);
        } catch (Exception e) {
            log.debug("Form 4 fetch/parse failed for {}: {}", path, e.getMessage());
            return 0;
        }
    }

    private int parseForm4Xml(String xml, String indexTicker, String path) throws Exception {
        var factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
        var doc = factory.newDocumentBuilder()
                .parse(new ByteArrayInputStream(xml.trim().getBytes(StandardCharsets.UTF_8)));

        String ticker = textOf(doc, "issuerTradingSymbol");
        if (ticker == null || ticker.isBlank()) {
            ticker = indexTicker;
        }
        ticker = ticker == null ? null : ticker.toUpperCase();
        String issuerName = textOf(doc, "issuerName");
        String ownerName = textOf(doc, "rptOwnerName");
        String officerTitle = textOf(doc, "officerTitle");
        boolean isDirector = "1".equals(textOf(doc, "isDirector")) || "true".equalsIgnoreCase(textOf(doc, "isDirector"));
        boolean isOfficer = "1".equals(textOf(doc, "isOfficer")) || "true".equalsIgnoreCase(textOf(doc, "isOfficer"));
        boolean isTenPct = "1".equals(textOf(doc, "isTenPercentOwner")) || "true".equalsIgnoreCase(textOf(doc, "isTenPercentOwner"));
        String accession = accessionFromPath(path);

        var txns = doc.getElementsByTagName("nonDerivativeTransaction");
        List<InsiderTrade> batch = new ArrayList<>();
        for (int i = 0; i < txns.getLength(); i++) {
            org.w3c.dom.Element tx = (org.w3c.dom.Element) txns.item(i);
            String dateStr = childValue(tx, "transactionDate");
            String code = childValue(tx, "transactionCode");
            String sharesStr = childValue(tx, "transactionShares");
            String priceStr = childValue(tx, "transactionPricePerShare");
            LocalDate date = parseDate(dateStr);
            if (date == null || code == null) {
                continue;
            }
            InsiderTrade t = new InsiderTrade();
            t.setId(accession + "|" + safe(ownerName) + "|" + i);
            t.setTicker(ticker);
            t.setIssuerName(issuerName);
            t.setInsiderName(prettyName(ownerName));
            t.setInsiderTitle(titleOf(officerTitle, isDirector, isOfficer, isTenPct));
            t.setDirector(isDirector);
            t.setOfficer(isOfficer);
            t.setTenPercentOwner(isTenPct);
            t.setTransactionCode(code);
            t.setTransactionType(classifyCode(code));
            t.setTransactionDate(date);
            Double shares = parseDoubleSafe(sharesStr);
            Double price = parseDoubleSafe(priceStr);
            t.setShares(shares);
            t.setPricePerShare(price);
            if (shares != null && price != null) {
                t.setValue(shares * price);
            }
            t.setAccession(accession);
            t.setFilingUrl("https://www.sec.gov" + path);
            t.setFetchedAt(java.time.Instant.now());
            batch.add(t);
        }
        if (!batch.isEmpty()) {
            repository.saveAll(batch);
        }
        return batch.size();
    }

    // ---------- helpers ----------

    private static String classifyCode(String code) {
        return switch (code) {
            case "P" -> "BUY";
            case "S" -> "SELL";
            case "A" -> "GRANT";
            default -> "OTHER";
        };
    }

    /** Placeholders Form 4 filers use in the officerTitle field instead of a real title. */
    private static boolean isTitlePlaceholder(String title) {
        String t = title.toLowerCase().replaceAll("[^a-z]", "");
        // "See Remarks", "See remarks below", "see footnotes", "N/A", "none", etc.
        return t.contains("seeremark") || t.contains("seefootnote") || t.equals("na") || t.equals("none");
    }

    private static String titleOf(String officerTitle, boolean dir, boolean off, boolean ten) {
        if (officerTitle != null && !officerTitle.isBlank() && !isTitlePlaceholder(officerTitle)) {
            return officerTitle.trim();
        }
        // Fall back to the role flags (a 10%-owner entity like a bank often files with no title).
        if (ten && dir) return "Director & 10% Owner";
        if (ten) return "10% Owner";
        if (dir) return "Director";
        if (off) return "Officer";
        return null;
    }

    /** "Kohler Terry" -> "Terry Kohler" is risky (SEC uses "Last First Middle"); keep as-is but tidy. */
    private static String prettyName(String raw) {
        return raw == null ? null : raw.replaceAll("\\s+", " ").trim();
    }

    private static String accessionFromPath(String path) {
        int slash = path.lastIndexOf('/');
        String file = slash >= 0 ? path.substring(slash + 1) : path;
        return file.replace(".txt", "");
    }

    private String textOf(org.w3c.dom.Document doc, String tag) {
        var nodes = doc.getElementsByTagName(tag);
        return nodes.getLength() > 0 ? nodes.item(0).getTextContent().trim() : null;
    }

    private String childValue(org.w3c.dom.Element parent, String tag) {
        var nodes = parent.getElementsByTagName(tag);
        if (nodes.getLength() == 0) {
            return null;
        }
        org.w3c.dom.Element el = (org.w3c.dom.Element) nodes.item(0);
        var values = el.getElementsByTagName("value");
        if (values.getLength() > 0) {
            return values.item(0).getTextContent().trim();
        }
        return el.getTextContent().trim();
    }

    private static LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(s.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private static Double parseDoubleSafe(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return Double.parseDouble(s.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private static long parseLongSafe(String s) {
        try {
            return Long.parseLong(s.trim());
        } catch (Exception e) {
            return 0;
        }
    }

    private static String safe(String s) {
        return s == null ? "" : s.replaceAll("[|]", "_");
    }

    private void politeSleep() {
        try {
            Thread.sleep(120); // SEC fair-access: stay well under 10 req/s
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
