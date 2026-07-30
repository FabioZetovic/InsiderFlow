package com.insiderflow.trades;

import java.util.List;
import java.util.Map;

/**
 * Maps congressional committees to the market sectors they legislate over / oversee, so a trade
 * can be flagged when a member sits on a committee with jurisdiction over the traded sector
 * (e.g. an Armed Services member buying a defense/industrials stock). This is a heuristic for
 * *potential* conflict of interest, not proof of wrongdoing.
 *
 * Keys are matched as case-insensitive substrings against a committee's canonical name, so both
 * House and Senate variants ("House Committee on Armed Services", "Senate Committee on Armed
 * Services") hit the same entry. Values are the GICS sector names our trades use.
 */
public final class CommitteeSectorMap {

    private CommitteeSectorMap() {
    }

    private static final Map<String, List<String>> COMMITTEE_SECTORS = Map.ofEntries(
            Map.entry("armed services", List.of("Industrials")),
            Map.entry("financial services", List.of("Financials")),
            Map.entry("banking", List.of("Financials")),
            Map.entry("energy and commerce", List.of("Energy", "Health Care", "Communication Services", "Utilities")),
            Map.entry("energy and natural resources", List.of("Energy", "Utilities")),
            Map.entry("natural resources", List.of("Energy", "Materials")),
            Map.entry("health", List.of("Health Care")),
            Map.entry("agriculture", List.of("Consumer Staples", "Materials")),
            Map.entry("science, space, and technology", List.of("Information Technology")),
            Map.entry("commerce, science", List.of("Information Technology", "Communication Services", "Consumer Discretionary")),
            Map.entry("transportation and infrastructure", List.of("Industrials")),
            Map.entry("homeland security", List.of("Industrials", "Information Technology")),
            Map.entry("intelligence", List.of("Industrials", "Information Technology")),
            Map.entry("veterans", List.of("Health Care")),
            Map.entry("small business", List.of("Financials"))
    );

    /**
     * Returns the committee name responsible for {@code sector} if the member sits on it, else null.
     * When several committees match, the first is returned (order is not significant to callers).
     */
    public static String conflictFor(List<String> memberCommittees, String sector) {
        if (memberCommittees == null || sector == null || sector.isBlank()) {
            return null;
        }
        for (String committee : memberCommittees) {
            String lc = committee.toLowerCase();
            for (Map.Entry<String, List<String>> e : COMMITTEE_SECTORS.entrySet()) {
                if (lc.contains(e.getKey()) && e.getValue().contains(sector)) {
                    return committee;
                }
            }
        }
        return null;
    }
}
