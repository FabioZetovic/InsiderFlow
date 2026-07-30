package com.insiderflow.market;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "sector_flow")
public class SectorFlow {

    @Id
    private String symbol;

    private String name;

    private double price;

    private double change;

    private double changePercent;

    private double previousClose;

    private Instant updatedAt;

    public SectorFlow() {
    }

    public SectorFlow(String symbol, String name, double price, double change,
                      double changePercent, double previousClose) {
        this.symbol = symbol;
        this.name = name;
        this.price = price;
        this.change = change;
        this.changePercent = changePercent;
        this.previousClose = previousClose;
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

    public double getPrice() {
        return price;
    }

    public void setPrice(double price) {
        this.price = price;
    }

    public double getChange() {
        return change;
    }

    public void setChange(double change) {
        this.change = change;
    }

    public double getChangePercent() {
        return changePercent;
    }

    public void setChangePercent(double changePercent) {
        this.changePercent = changePercent;
    }

    public double getPreviousClose() {
        return previousClose;
    }

    public void setPreviousClose(double previousClose) {
        this.previousClose = previousClose;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
