package com.insiderflow.common;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Data-freshness reporting (#12) and new-Trump-filing detection (#8). The frontend footer
 * shows per-source freshness and a warning banner when the senate scraper output goes stale
 * or a new presidential 278-T appears that we haven't ingested.
 */
@Service
public class StatusService {

    private static final Logger log = LoggerFactory.getLogger(StatusService.class);
    private static final int SENATE_STALE_DAYS = 3;

    /** Disclosure date of the Trump 278-T filing the current dataset covers. */
    private static final LocalDate KNOWN_TRUMP_FILING = LocalDate.of(2026, 5, 8);
    private static final Pattern FILING_DATE = Pattern.compile("(\\d{2})[./](\\d{2})[./](\\d{4})");

    private final MongoTemplate mongoTemplate;
    private final String senateLocalFile;
    private final RestClient ogeClient = RestClient.builder()
            .baseUrl("https://extapps2.oge.gov")
            .defaultHeader("User-Agent", "Mozilla/5.0")
            .build();

    private volatile Instant lastIngestAt;
    private volatile LocalDate newestTrumpFilingSeen;

    public StatusService(MongoTemplate mongoTemplate,
                         @Value("${insiderflow.trades.senate-local-file}") String senateLocalFile) {
        this.mongoTemplate = mongoTemplate;
        this.senateLocalFile = senateLocalFile;
    }

    public void markIngestCompleted() {
        this.lastIngestAt = Instant.now();
    }

    public record SourceStatus(String source, String detail, Instant updatedAt, boolean stale) {
    }

    public record AppStatus(long totalTrades, Instant lastIngestAt, List<SourceStatus> sources,
                            boolean senateStale, boolean newTrumpFilingDetected,
                            String newTrumpFilingDate) {
    }

    public AppStatus status() {
        long total = mongoTemplate.count(new Query(), "trades");

        List<SourceStatus> sources = new ArrayList<>();

        // Latest disclosure per chamber straight from the data.
        for (String chamber : List.of("SENATE", "HOUSE", "EXECUTIVE")) {
            LocalDate latest = latestDisclosure(chamber);
            boolean stale = false;
            if ("HOUSE".equals(chamber) && latest != null) {
                stale = latest.isBefore(LocalDate.now().minusDays(14));
            }
            sources.add(new SourceStatus(chamber,
                    latest == null ? "no data" : "latest disclosure " + latest,
                    null, stale));
        }

        // Senate scraper file mtime — the thing most likely to silently rot.
        Instant scraperMtime = senateScraperMtime();
        boolean senateStale = scraperMtime == null
                || scraperMtime.isBefore(Instant.now().minus(SENATE_STALE_DAYS, ChronoUnit.DAYS));
        sources.add(new SourceStatus("SENATE_SCRAPER",
                scraperMtime == null ? "output file missing" : "file updated",
                scraperMtime, senateStale));

        boolean newTrump = newestTrumpFilingSeen != null && newestTrumpFilingSeen.isAfter(KNOWN_TRUMP_FILING);
        return new AppStatus(total, lastIngestAt, sources, senateStale, newTrump,
                newTrump ? newestTrumpFilingSeen.toString() : null);
    }

    private LocalDate latestDisclosure(String chamber) {
        Query q = new Query(Criteria.where("chamber").is(chamber))
                .with(org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Direction.DESC, "disclosureDate"))
                .limit(1);
        q.fields().include("disclosureDate");
        org.bson.Document doc = mongoTemplate.findOne(q, org.bson.Document.class, "trades");
        if (doc == null || doc.get("disclosureDate") == null) {
            return null;
        }
        Object v = doc.get("disclosureDate");
        if (v instanceof java.util.Date d) {
            return d.toInstant().atZone(java.time.ZoneOffset.UTC).toLocalDate();
        }
        return null;
    }

    private Instant senateScraperMtime() {
        try {
            Path path = Paths.get(senateLocalFile).toAbsolutePath().normalize();
            if (!Files.exists(path)) {
                return null;
            }
            return Files.getLastModifiedTime(path).toInstant();
        } catch (Exception e) {
            return null;
        }
    }

    // ---------- Trump 278-T watcher ----------

    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void checkTrumpFilingsOnStartup() {
        checkTrumpFilings();
    }

    /** Daily check of the OGE presidential index for a newer 278-T than the one we ingest. */
    @Scheduled(cron = "0 15 6 * * *", zone = "UTC")
    public void checkTrumpFilings() {
        try {
            JsonNode root = ogeClient.get()
                    .uri("/201/Presiden.nsf/PAS+Index?ReadViewEntries&outputformat=json&count=3000")
                    .retrieve()
                    .body(JsonNode.class);
            if (root == null) {
                return;
            }
            LocalDate newest = null;
            boolean inTrump = false;
            for (JsonNode entry : root.path("viewentry")) {
                String text = entry.path("entrydata").path(0).path("text").path("0").asText("");
                boolean isCategory = entry.path("entrydata").path(0).path("@category").asBoolean(false);
                if (isCategory) {
                    inTrump = text.startsWith("Trump, Donald");
                    continue;
                }
                if (!inTrump || !text.contains("278T") && !text.contains("278-T")) {
                    continue;
                }
                Matcher m = FILING_DATE.matcher(text);
                if (m.find()) {
                    LocalDate date = LocalDate.of(Integer.parseInt(m.group(3)),
                            Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)));
                    if (newest == null || date.isAfter(newest)) {
                        newest = date;
                    }
                }
            }
            if (newest != null) {
                this.newestTrumpFilingSeen = newest;
                if (newest.isAfter(KNOWN_TRUMP_FILING)) {
                    log.warn("NEW Trump 278-T filing detected on OGE dated {} — the ingested dataset covers {}. "
                            + "Check whether trump-portfolio-tracker has updated.", newest, KNOWN_TRUMP_FILING);
                } else {
                    log.info("Trump 278-T watcher: newest OGE filing {} (already covered)", newest);
                }
            }
        } catch (Exception e) {
            log.warn("Trump 278-T watcher failed: {}", e.getMessage());
        }
    }
}
