package com.insiderflow.trades;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Cached ticker -> sector resolution so each unknown ticker is looked up on Finnhub only once.
 */
@Document(collection = "tickers")
public class TickerInfo {

    @Id
    private String ticker;

    private String sector;

    private String source; // SEED, FINNHUB, UNRESOLVED

    private Instant resolvedAt;

    public TickerInfo() {
    }

    public TickerInfo(String ticker, String sector, String source) {
        this.ticker = ticker;
        this.sector = sector;
        this.source = source;
        this.resolvedAt = Instant.now();
    }

    public String getTicker() {
        return ticker;
    }

    public void setTicker(String ticker) {
        this.ticker = ticker;
    }

    public String getSector() {
        return sector;
    }

    public void setSector(String sector) {
        this.sector = sector;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Instant resolvedAt) {
        this.resolvedAt = resolvedAt;
    }
}
