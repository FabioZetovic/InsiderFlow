package com.insiderflow.corporate;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

/**
 * A corporate-insider transaction parsed from an SEC Form 4 (officers/directors/10%-owners).
 * Separate collection from congressional trades so the two can be compared on a ticker.
 */
@Document(collection = "insider_trades")
public class InsiderTrade {

    @Id
    private String id; // accession|owner|line — stable across re-ingest

    @Indexed
    private String ticker;

    private String issuerName;

    private String insiderName;

    private String insiderTitle;

    private boolean director;
    private boolean officer;
    private boolean tenPercentOwner;

    // BUY (open-market purchase, code P), SELL (code S), GRANT (A), OTHER (everything else)
    @Indexed
    private String transactionType;

    private String transactionCode; // raw SEC code

    @Indexed
    private LocalDate transactionDate;

    private Double shares;
    private Double pricePerShare;
    private Double value; // shares * price when both present

    private String accession;
    private String filingUrl;
    private Instant fetchedAt;

    public InsiderTrade() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTicker() {
        return ticker;
    }

    public void setTicker(String ticker) {
        this.ticker = ticker;
    }

    public String getIssuerName() {
        return issuerName;
    }

    public void setIssuerName(String issuerName) {
        this.issuerName = issuerName;
    }

    public String getInsiderName() {
        return insiderName;
    }

    public void setInsiderName(String insiderName) {
        this.insiderName = insiderName;
    }

    public String getInsiderTitle() {
        return insiderTitle;
    }

    public void setInsiderTitle(String insiderTitle) {
        this.insiderTitle = insiderTitle;
    }

    public boolean isDirector() {
        return director;
    }

    public void setDirector(boolean director) {
        this.director = director;
    }

    public boolean isOfficer() {
        return officer;
    }

    public void setOfficer(boolean officer) {
        this.officer = officer;
    }

    public boolean isTenPercentOwner() {
        return tenPercentOwner;
    }

    public void setTenPercentOwner(boolean tenPercentOwner) {
        this.tenPercentOwner = tenPercentOwner;
    }

    public String getTransactionType() {
        return transactionType;
    }

    public void setTransactionType(String transactionType) {
        this.transactionType = transactionType;
    }

    public String getTransactionCode() {
        return transactionCode;
    }

    public void setTransactionCode(String transactionCode) {
        this.transactionCode = transactionCode;
    }

    public LocalDate getTransactionDate() {
        return transactionDate;
    }

    public void setTransactionDate(LocalDate transactionDate) {
        this.transactionDate = transactionDate;
    }

    public Double getShares() {
        return shares;
    }

    public void setShares(Double shares) {
        this.shares = shares;
    }

    public Double getPricePerShare() {
        return pricePerShare;
    }

    public void setPricePerShare(Double pricePerShare) {
        this.pricePerShare = pricePerShare;
    }

    public Double getValue() {
        return value;
    }

    public void setValue(Double value) {
        this.value = value;
    }

    public String getAccession() {
        return accession;
    }

    public void setAccession(String accession) {
        this.accession = accession;
    }

    public String getFilingUrl() {
        return filingUrl;
    }

    public void setFilingUrl(String filingUrl) {
        this.filingUrl = filingUrl;
    }

    public Instant getFetchedAt() {
        return fetchedAt;
    }

    public void setFetchedAt(Instant fetchedAt) {
        this.fetchedAt = fetchedAt;
    }
}
