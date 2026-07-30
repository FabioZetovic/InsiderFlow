package com.insiderflow.market;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

@Document(collection = "earnings")
public class EarningsEntry {

    @Id
    private String id; // symbol|date

    private String symbol;

    @Indexed
    private LocalDate date;

    private Double epsEstimate;

    private Double epsActual;

    private Double revenueEstimate;

    private String hour; // bmo (before market open), amc (after market close), dmh (during)

    private Integer quarter;

    private Integer year;

    private Instant fetchedAt;

    public EarningsEntry() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getSymbol() {
        return symbol;
    }

    public void setSymbol(String symbol) {
        this.symbol = symbol;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public Double getEpsEstimate() {
        return epsEstimate;
    }

    public void setEpsEstimate(Double epsEstimate) {
        this.epsEstimate = epsEstimate;
    }

    public Double getEpsActual() {
        return epsActual;
    }

    public void setEpsActual(Double epsActual) {
        this.epsActual = epsActual;
    }

    public Double getRevenueEstimate() {
        return revenueEstimate;
    }

    public void setRevenueEstimate(Double revenueEstimate) {
        this.revenueEstimate = revenueEstimate;
    }

    public String getHour() {
        return hour;
    }

    public void setHour(String hour) {
        this.hour = hour;
    }

    public Integer getQuarter() {
        return quarter;
    }

    public void setQuarter(Integer quarter) {
        this.quarter = quarter;
    }

    public Integer getYear() {
        return year;
    }

    public void setYear(Integer year) {
        this.year = year;
    }

    public Instant getFetchedAt() {
        return fetchedAt;
    }

    public void setFetchedAt(Instant fetchedAt) {
        this.fetchedAt = fetchedAt;
    }
}
