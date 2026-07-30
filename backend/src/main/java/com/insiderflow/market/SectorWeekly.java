package com.insiderflow.market;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Weekly (5 trading days) performance of one SPDR sector ETF, computed from Stooq daily closes.
 */
@Document(collection = "sector_weekly")
public class SectorWeekly {

    @Id
    private String symbol;

    private String name;

    private double lastClose;

    private double weekAgoClose;

    private double weeklyChangePercent;

    private LocalDate lastDate;

    private Instant updatedAt;

    public SectorWeekly() {
    }

    public SectorWeekly(String symbol, String name, double lastClose, double weekAgoClose, LocalDate lastDate) {
        this.symbol = symbol;
        this.name = name;
        this.lastClose = lastClose;
        this.weekAgoClose = weekAgoClose;
        this.weeklyChangePercent = weekAgoClose == 0 ? 0 : ((lastClose - weekAgoClose) / weekAgoClose) * 100.0;
        this.lastDate = lastDate;
        this.updatedAt = Instant.now();
    }

    public String getSymbol() {
        return symbol;
    }

    public void setSymbol(String symbol) {
        this.symbol = symbol;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public double getLastClose() {
        return lastClose;
    }

    public void setLastClose(double lastClose) {
        this.lastClose = lastClose;
    }

    public double getWeekAgoClose() {
        return weekAgoClose;
    }

    public void setWeekAgoClose(double weekAgoClose) {
        this.weekAgoClose = weekAgoClose;
    }

    public double getWeeklyChangePercent() {
        return weeklyChangePercent;
    }

    public void setWeeklyChangePercent(double weeklyChangePercent) {
        this.weeklyChangePercent = weeklyChangePercent;
    }

    public LocalDate getLastDate() {
        return lastDate;
    }

    public void setLastDate(LocalDate lastDate) {
        this.lastDate = lastDate;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
