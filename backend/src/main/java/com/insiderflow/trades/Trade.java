package com.insiderflow.trades;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;

@Document(collection = "trades")
public class Trade {

    @Id
    private String id;

    /**
     * Deduplication key: member|ticker|transactionDate|amountRange|transactionType
     */
    @Indexed(unique = true)
    private String dedupKey;

    @Indexed
    private String member;

    private String chamber; // HOUSE or SENATE

    private String state;

    private String party;

    @Indexed
    private String ticker;

    private String assetDescription;

    @Indexed
    private String transactionType; // BUY, SELL, EXCHANGE

    private String amountRange;

    // Numeric bounds parsed from amountRange (e.g. "$1,001 - $15,000") for volume-weighted views.
    private Long amountLow;
    private Long amountMid;
    private Long amountHigh;

    // Raw asset type from the filing (Stock, Municipal Security, Corporate Bond, ...).
    private String assetType;

    @Indexed
    private LocalDate transactionDate;

    private LocalDate disclosureDate;

    // True when the transaction date is implausible (after the disclosure date, or absurdly
    // far in the future) — usually a filing typo. De-prioritized in default sorting.
    private boolean suspiciousDate;

    // Days between transaction and disclosure; late = beyond the STOCK Act's 45-day window.
    private Integer disclosureLagDays;
    private boolean lateDisclosure;

    // Set when the member sits on a committee that oversees this trade's sector (potential
    // conflict of interest), e.g. Armed Services member trading a defense stock.
    private String committeeConflict;

    // Set when the trade fell within ~2 weeks before this ticker's earnings report.
    private boolean nearEarnings;

    private String ptrLink;

    @Indexed
    private String sector;

    public Trade() {
    }

    public Long getAmountLow() {
        return amountLow;
    }

    public void setAmountLow(Long amountLow) {
        this.amountLow = amountLow;
    }

    public Long getAmountMid() {
        return amountMid;
    }

    public void setAmountMid(Long amountMid) {
        this.amountMid = amountMid;
    }

    public Long getAmountHigh() {
        return amountHigh;
    }

    public void setAmountHigh(Long amountHigh) {
        this.amountHigh = amountHigh;
    }

    public String getAssetType() {
        return assetType;
    }

    public void setAssetType(String assetType) {
        this.assetType = assetType;
    }

    public boolean isSuspiciousDate() {
        return suspiciousDate;
    }

    public void setSuspiciousDate(boolean suspiciousDate) {
        this.suspiciousDate = suspiciousDate;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getDedupKey() {
        return dedupKey;
    }

    public void setDedupKey(String dedupKey) {
        this.dedupKey = dedupKey;
    }

    public String getMember() {
        return member;
    }

    public void setMember(String member) {
        this.member = member;
    }

    public String getChamber() {
        return chamber;
    }

    public void setChamber(String chamber) {
        this.chamber = chamber;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }

    public String getParty() {
        return party;
    }

    public void setParty(String party) {
        this.party = party;
    }

    public String getTicker() {
        return ticker;
    }

    public void setTicker(String ticker) {
        this.ticker = ticker;
    }

    public String getAssetDescription() {
        return assetDescription;
    }

    public void setAssetDescription(String assetDescription) {
        this.assetDescription = assetDescription;
    }

    public String getTransactionType() {
        return transactionType;
    }

    public void setTransactionType(String transactionType) {
        this.transactionType = transactionType;
    }

    public String getAmountRange() {
        return amountRange;
    }

    public void setAmountRange(String amountRange) {
        this.amountRange = amountRange;
    }

    public LocalDate getTransactionDate() {
        return transactionDate;
    }

    public void setTransactionDate(LocalDate transactionDate) {
        this.transactionDate = transactionDate;
    }

    public LocalDate getDisclosureDate() {
        return disclosureDate;
    }

    public void setDisclosureDate(LocalDate disclosureDate) {
        this.disclosureDate = disclosureDate;
    }

    public String getPtrLink() {
        return ptrLink;
    }

    public void setPtrLink(String ptrLink) {
        this.ptrLink = ptrLink;
    }

    public String getSector() {
        return sector;
    }

    public void setSector(String sector) {
        this.sector = sector;
    }

    public Integer getDisclosureLagDays() {
        return disclosureLagDays;
    }

    public void setDisclosureLagDays(Integer disclosureLagDays) {
        this.disclosureLagDays = disclosureLagDays;
    }

    public boolean isLateDisclosure() {
        return lateDisclosure;
    }

    public void setLateDisclosure(boolean lateDisclosure) {
        this.lateDisclosure = lateDisclosure;
    }

    public String getCommitteeConflict() {
        return committeeConflict;
    }

    public void setCommitteeConflict(String committeeConflict) {
        this.committeeConflict = committeeConflict;
    }

    public boolean isNearEarnings() {
        return nearEarnings;
    }

    public void setNearEarnings(boolean nearEarnings) {
        this.nearEarnings = nearEarnings;
    }
}
