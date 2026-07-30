package com.insiderflow.trades;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CommitteeSectorMapTest {

    @Test
    void flagsArmedServicesTradingIndustrials() {
        String conflict = CommitteeSectorMap.conflictFor(
                List.of("Senate Committee on Armed Services"), "Industrials");
        assertEquals("Senate Committee on Armed Services", conflict);
    }

    @Test
    void flagsFinancialServicesTradingFinancials() {
        assertNotNull(CommitteeSectorMap.conflictFor(
                List.of("House Committee on Financial Services"), "Financials"));
    }

    @Test
    void energyCommerceOverseesMultipleSectors() {
        List<String> c = List.of("House Committee on Energy and Commerce");
        assertNotNull(CommitteeSectorMap.conflictFor(c, "Energy"));
        assertNotNull(CommitteeSectorMap.conflictFor(c, "Health Care"));
        assertNotNull(CommitteeSectorMap.conflictFor(c, "Communication Services"));
    }

    @Test
    void noConflictWhenSectorUnrelated() {
        assertNull(CommitteeSectorMap.conflictFor(
                List.of("Senate Committee on Armed Services"), "Consumer Staples"));
        assertNull(CommitteeSectorMap.conflictFor(List.of("Committee on Ethics"), "Industrials"));
    }

    @Test
    void nullSafe() {
        assertNull(CommitteeSectorMap.conflictFor(null, "Industrials"));
        assertNull(CommitteeSectorMap.conflictFor(List.of("Armed Services"), null));
        assertNull(CommitteeSectorMap.conflictFor(List.of(), "Industrials"));
    }
}
