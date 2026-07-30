package com.insiderflow.market;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class FinnhubClient {

    private static final Logger log = LoggerFactory.getLogger(FinnhubClient.class);

    private final RestClient restClient;
    private final String apiKey;

    public FinnhubClient(@Value("${insiderflow.finnhub.base-url}") String baseUrl,
                         @Value("${insiderflow.finnhub.api-key}") String apiKey) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
        this.apiKey = apiKey;
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public record Quote(double current, double change, double percentChange,
                        double high, double low, double open, double previousClose) {
    }

    /**
     * GET /quote — real-time quote. Returns null when the key is missing or the call fails.
     */
    public Quote quote(String symbol) {
        JsonNode node = get("/quote?symbol=" + symbol);
        if (node == null || node.path("c").asDouble(0) == 0 && node.path("pc").asDouble(0) == 0) {
            return null;
        }
        return new Quote(
                node.path("c").asDouble(),
                node.path("d").asDouble(),
                node.path("dp").asDouble(),
                node.path("h").asDouble(),
                node.path("l").asDouble(),
                node.path("o").asDouble(),
                node.path("pc").asDouble());
    }

    /**
     * GET /stock/profile2 — company profile. Returns the finnhubIndustry field or null.
     */
    public String industry(String symbol) {
        JsonNode node = get("/stock/profile2?symbol=" + symbol);
        if (node == null) {
            return null;
        }
        String industry = node.path("finnhubIndustry").asText(null);
        return (industry == null || industry.isBlank()) ? null : industry;
    }

    /**
     * GET /calendar/earnings — earnings calendar between two ISO dates. Returns the raw
     * earningsCalendar array node or null.
     */
    public JsonNode earningsCalendar(String from, String to) {
        JsonNode node = get("/calendar/earnings?from=" + from + "&to=" + to);
        return node == null ? null : node.path("earningsCalendar");
    }

    /**
     * GET /stock/candle — intraday candles. Not available on all free-tier keys; returns null
     * on any failure so callers can degrade gracefully.
     */
    public JsonNode candles(String symbol, String resolution, long from, long to) {
        JsonNode node = get("/stock/candle?symbol=" + symbol + "&resolution=" + resolution
                + "&from=" + from + "&to=" + to);
        if (node == null || !"ok".equals(node.path("s").asText())) {
            return null;
        }
        return node;
    }

    private JsonNode get(String pathAndQuery) {
        if (!isConfigured()) {
            return null;
        }
        try {
            return restClient.get()
                    .uri(pathAndQuery + "&token=" + apiKey)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (Exception e) {
            log.warn("Finnhub request failed for {}: {}", pathAndQuery.split("\\?")[0], e.getMessage());
            return null;
        }
    }
}
