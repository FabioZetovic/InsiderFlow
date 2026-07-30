package com.insiderflow.trades;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.insiderflow.market.FinnhubClient;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resolves ticker -> sector. Order: static GICS seed (sectors.json) -> tickers cache
 * collection -> Finnhub profile2 (cached forever afterwards) -> "Unknown".
 */
@Service
public class SectorService {

    private static final Logger log = LoggerFactory.getLogger(SectorService.class);
    public static final String UNKNOWN = "Unknown";

    private final TickerRepository tickerRepository;
    private final FinnhubClient finnhubClient;
    private final ObjectMapper objectMapper;

    private final Map<String, String> seed = new ConcurrentHashMap<>();
    private final Map<String, String> cache = new ConcurrentHashMap<>();

    public SectorService(TickerRepository tickerRepository, FinnhubClient finnhubClient, ObjectMapper objectMapper) {
        this.tickerRepository = tickerRepository;
        this.finnhubClient = finnhubClient;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void loadSeed() {
        try (InputStream in = new ClassPathResource("sectors.json").getInputStream()) {
            Map<String, String> loaded = objectMapper.readValue(in, new TypeReference<>() {
            });
            seed.putAll(loaded);
            log.info("Loaded {} seed ticker->sector mappings", seed.size());
        } catch (Exception e) {
            log.error("Failed to load sectors.json seed", e);
        }
    }

    /**
     * Seed + cached resolutions only — never calls Finnhub. Used during bulk ingestion;
     * unknown tickers are enriched afterwards by the ingestion service.
     */
    public String resolveOffline(String ticker) {
        if (ticker == null || ticker.isBlank()) {
            return UNKNOWN;
        }
        String symbol = ticker.trim().toUpperCase();
        String fromSeed = seed.get(symbol);
        if (fromSeed != null) {
            return fromSeed;
        }
        String cached = cache.get(symbol);
        if (cached != null) {
            return cached;
        }
        return tickerRepository.findById(symbol)
                .map(info -> {
                    cache.put(symbol, info.getSector());
                    return info.getSector();
                })
                .orElse(UNKNOWN);
    }

    /**
     * True when the ticker has never been looked up (not in seed, memory cache, or tickers
     * collection) — i.e. a Finnhub lookup could still resolve it.
     */
    public boolean isUnresolved(String ticker) {
        if (ticker == null || ticker.isBlank()) {
            return false;
        }
        String symbol = ticker.trim().toUpperCase();
        return !seed.containsKey(symbol) && !cache.containsKey(symbol)
                && tickerRepository.findById(symbol).isEmpty();
    }

    public String resolve(String ticker) {
        if (ticker == null || ticker.isBlank()) {
            return UNKNOWN;
        }
        String symbol = ticker.trim().toUpperCase();

        String fromSeed = seed.get(symbol);
        if (fromSeed != null) {
            return fromSeed;
        }

        String cached = cache.get(symbol);
        if (cached != null) {
            return cached;
        }

        return cache.computeIfAbsent(symbol, this::resolveUncached);
    }

    private String resolveUncached(String symbol) {
        try {
            var existing = tickerRepository.findById(symbol);
            if (existing.isPresent()) {
                return existing.get().getSector();
            }
            String industry = finnhubClient.industry(symbol);
            if (industry != null) {
                tickerRepository.save(new TickerInfo(symbol, industry, "FINNHUB"));
                return industry;
            }
            tickerRepository.save(new TickerInfo(symbol, UNKNOWN, "UNRESOLVED"));
        } catch (Exception e) {
            log.warn("Sector resolution failed for {}: {}", symbol, e.getMessage());
        }
        return UNKNOWN;
    }
}
