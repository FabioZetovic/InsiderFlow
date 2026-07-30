package com.insiderflow.trades;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Canonicalizes member names across data sources and attaches party + full state, using the
 * bundled congress-legislators dataset (legislators.json). Different sources spell the same
 * person differently ("Shelley M Capito" vs "Shelley Moore Capito"); without this they'd count
 * as separate members, splitting trade histories.
 */
@Service
public class MemberDirectory {

    private static final Logger log = LoggerFactory.getLogger(MemberDirectory.class);

    public record MemberInfo(String canonical, String party, String state, String stateAbbr, String chamber,
                             java.util.List<String> committees) {
    }

    /** normalized alias -> canonical member info */
    private final Map<String, MemberInfo> byAlias = new HashMap<>();
    /** normalized "last name" -> info, used as a loose fallback when the full name doesn't match */
    private final Map<String, MemberInfo> byLastName = new HashMap<>();
    private final Map<String, Integer> lastNameCollisions = new HashMap<>();

    private final ObjectMapper objectMapper;

    public MemberDirectory(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void load() {
        try (InputStream in = new ClassPathResource("legislators.json").getInputStream()) {
            JsonNode root = objectMapper.readTree(in);
            for (JsonNode m : root.path("members")) {
                String canonical = m.path("canonical").asText(null);
                if (canonical == null) {
                    continue;
                }
                java.util.List<String> committees = new java.util.ArrayList<>();
                for (JsonNode c : m.path("committees")) {
                    committees.add(c.asText());
                }
                MemberInfo info = new MemberInfo(
                        canonical,
                        m.path("party").asText(null),
                        m.path("state").asText(null),
                        m.path("stateAbbr").asText(null),
                        m.path("chamber").asText(null),
                        java.util.List.copyOf(committees));
                registerAlias(canonical, info);
                for (JsonNode nick : m.path("nicknames")) {
                    registerAlias(nick.asText(), info);
                }
                String last = m.path("last").asText(null);
                if (last != null && !last.isBlank()) {
                    String key = normalize(last);
                    lastNameCollisions.merge(key, 1, Integer::sum);
                    byLastName.put(key, info);
                }
            }
            // Ambiguous surnames (two legislators share it) are unreliable — drop them.
            lastNameCollisions.forEach((key, count) -> {
                if (count > 1) {
                    byLastName.remove(key);
                }
            });
            log.info("MemberDirectory loaded: {} aliases, {} usable surnames", byAlias.size(), byLastName.size());
        } catch (Exception e) {
            log.error("Failed to load legislators.json — member normalization disabled", e);
        }
    }

    private void registerAlias(String alias, MemberInfo info) {
        String key = normalize(alias);
        if (!key.isBlank()) {
            byAlias.putIfAbsent(key, info);
        }
    }

    /**
     * Resolves a raw member name to canonical info. Returns null when no confident match exists
     * (caller keeps the original name). Handles "Last, First" ordering and common suffixes.
     */
    public MemberInfo resolve(String rawName) {
        if (rawName == null || rawName.isBlank()) {
            return null;
        }
        String cleaned = cleanName(rawName);

        MemberInfo direct = byAlias.get(normalize(cleaned));
        if (direct != null) {
            return direct;
        }

        // "Capito, Shelley Moore" -> "Shelley Moore Capito"
        int comma = cleaned.indexOf(',');
        if (comma > 0) {
            String flipped = (cleaned.substring(comma + 1) + " " + cleaned.substring(0, comma)).trim();
            MemberInfo byFlip = byAlias.get(normalize(flipped));
            if (byFlip != null) {
                return byFlip;
            }
        }

        // Loose fallback: match on an unambiguous surname (the last whitespace-delimited token).
        String[] parts = cleaned.replace(",", " ").trim().split("\\s+");
        if (parts.length >= 2) {
            MemberInfo bySurname = byLastName.get(normalize(parts[parts.length - 1]));
            if (bySurname != null) {
                return bySurname;
            }
        }
        return null;
    }

    private String cleanName(String raw) {
        return raw
                .replaceFirst("(?i)^(hon|mr|mrs|ms|dr)\\.?\\s+", "")
                .replaceAll("(?i)\\b(jr|sr|ii|iii|iv)\\.?$", "")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String normalize(String s) {
        if (s == null) {
            return "";
        }
        return s.toLowerCase()
                .replaceAll("[.'\"]", "")
                .replaceAll("[^a-z0-9, ]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
