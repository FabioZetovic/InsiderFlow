package com.insiderflow.trades;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class TradeMapperTest {

    // ---------- normalizeType ----------

    @Test
    void normalizesAllSourceTypeSpellings() {
        assertEquals("BUY", TradeMapper.normalizeType("Purchase"));
        assertEquals("BUY", TradeMapper.normalizeType("purchase"));
        assertEquals("SELL", TradeMapper.normalizeType("Sale (Full)"));
        assertEquals("SELL", TradeMapper.normalizeType("Sale (Partial)"));
        assertEquals("SELL", TradeMapper.normalizeType("sale_full"));
        assertEquals("EXCHANGE", TradeMapper.normalizeType("Exchange"));
        assertNull(TradeMapper.normalizeType("received"));
        assertNull(TradeMapper.normalizeType(null));
    }

    // ---------- normalizeTicker ----------

    @Test
    void normalizesTickerPlaceholders() {
        assertEquals("AAPL", TradeMapper.normalizeTicker(" aapl "));
        assertNull(TradeMapper.normalizeTicker("--"));
        assertNull(TradeMapper.normalizeTicker("N/A"));
        assertNull(TradeMapper.normalizeTicker(""));
        assertNull(TradeMapper.normalizeTicker(null));
    }

    // ---------- recoverTicker ----------

    @Test
    void recoversTickerFromDescriptionForStocks() {
        assertEquals("C", TradeMapper.recoverTicker("Citigroup New Inc (C)", "Stock"));
        assertEquals("BRK.B", TradeMapper.recoverTicker("Berkshire Hathaway (BRK.B)", "Stock"));
        assertNull(TradeMapper.recoverTicker("UBS AG LONDON (matures 2029)", "Corporate Bond"));
        assertNull(TradeMapper.recoverTicker("No parens here", "Stock"));
        assertNull(TradeMapper.recoverTicker(null, "Stock"));
    }

    // ---------- parseDate ----------

    @Test
    void parsesBothDateFormats() {
        assertEquals(LocalDate.of(2026, 6, 16), TradeMapper.parseDate("06/16/2026"));
        assertEquals(LocalDate.of(2026, 6, 16), TradeMapper.parseDate("2026-06-16"));
        assertNull(TradeMapper.parseDate("16.06.2026"));
        assertNull(TradeMapper.parseDate(""));
        assertNull(TradeMapper.parseDate(null));
    }

    // ---------- parseAmount ----------

    @Test
    void parsesStandardAmountRange() {
        TradeMapper.AmountBounds b = TradeMapper.parseAmount("$1,001 - $15,000");
        assertEquals(1001L, b.low());
        assertEquals(8000L, b.mid());
        assertEquals(15000L, b.high());
    }

    @Test
    void parsesLargeRangeAndOpenEnded() {
        TradeMapper.AmountBounds big = TradeMapper.parseAmount("$1,000,001 - $5,000,000");
        assertEquals(1000001L, big.low());
        assertEquals(5000000L, big.high());

        TradeMapper.AmountBounds open = TradeMapper.parseAmount("$1,000,000 +");
        assertEquals(1000000L, open.low());
        assertEquals(1000000L, open.mid());
    }

    @Test
    void parsesUnusableAmounts() {
        assertNull(TradeMapper.parseAmount("Unknown").low());
        assertNull(TradeMapper.parseAmount(null).low());
        assertNull(TradeMapper.parseAmount("").mid());
    }

    // ---------- classifyNonEquity ----------

    @Test
    void classifiesBondsAndFunds() {
        assertEquals(TradeMapper.FIXED_INCOME,
                TradeMapper.classifyNonEquity("Municipal Security", "City of Austin GO Bonds"));
        assertEquals(TradeMapper.FIXED_INCOME,
                TradeMapper.classifyNonEquity("Corporate Bond", "UBS AG LONDON BRH"));
        assertEquals(TradeMapper.FUND,
                TradeMapper.classifyNonEquity("Other Securities", "Vanguard Total Stock Market Index Fund"));
        assertEquals(TradeMapper.CRYPTO,
                TradeMapper.classifyNonEquity(null, "Bitcoin - BTC"));
    }

    @Test
    void leavesPlainStocksToGicsResolution() {
        assertNull(TradeMapper.classifyNonEquity("Stock", "Apple Inc. Common Stock"));
        assertNull(TradeMapper.classifyNonEquity(null, "Apple Inc."));
    }

    @Test
    void classifiesOtherNamedAssetTypes() {
        assertEquals(TradeMapper.OTHER_ASSET,
                TradeMapper.classifyNonEquity("Stock Option", "AAPL Call 2027"));
    }

    // ---------- isSuspiciousDate ----------

    @Test
    void flagsTransactionAfterDisclosure() {
        LocalDate today = LocalDate.of(2026, 7, 8);
        assertTrue(TradeMapper.isSuspiciousDate(
                LocalDate.of(2026, 12, 26), LocalDate.of(2026, 1, 21), today));
        assertFalse(TradeMapper.isSuspiciousDate(
                LocalDate.of(2026, 1, 10), LocalDate.of(2026, 1, 21), today));
    }

    @Test
    void flagsFarFutureDatesEvenWithoutDisclosure() {
        LocalDate today = LocalDate.of(2026, 7, 8);
        assertTrue(TradeMapper.isSuspiciousDate(LocalDate.of(2027, 1, 1), null, today));
        assertFalse(TradeMapper.isSuspiciousDate(LocalDate.of(2026, 7, 10), null, today));
    }

    // ---------- dedupKey ----------

    @Test
    void dedupKeyIsStableAndNullSafe() {
        String key = TradeMapper.dedupKey("Nancy Pelosi", "NVDA",
                LocalDate.of(2026, 1, 16), "$500,001 - $1,000,000", "BUY");
        assertEquals("Nancy Pelosi|NVDA|2026-01-16|$500,001 - $1,000,000|BUY", key);
        assertEquals("|||" + "|", TradeMapper.dedupKey(null, null, null, null, null));
    }

    // ---------- isLateDisclosure (STOCK Act 45-day rule) ----------

    @Test
    void flagsDisclosuresBeyond45Days() {
        // 60 days late
        assertTrue(TradeMapper.isLateDisclosure(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 3, 2)));
        // exactly 45 days — on time
        assertFalse(TradeMapper.isLateDisclosure(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 2, 15)));
        // same day
        assertFalse(TradeMapper.isLateDisclosure(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 1)));
        // typo (disclosed before transaction) — not counted as late
        assertFalse(TradeMapper.isLateDisclosure(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 1, 1)));
        assertFalse(TradeMapper.isLateDisclosure(null, LocalDate.of(2026, 1, 1)));
    }
}
