package com.insiderflow.trades;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Guards the ticker charset used before building outbound price-history URLs (SSRF prevention). */
class TickerValidationTest {

    @Test
    void acceptsRealTickers() {
        assertTrue(AnalyticsService.VALID_TICKER.matcher("AAPL").matches());
        assertTrue(AnalyticsService.VALID_TICKER.matcher("BRK.B").matches());
        assertTrue(AnalyticsService.VALID_TICKER.matcher("BF-B").matches());
        assertTrue(AnalyticsService.VALID_TICKER.matcher("PMM").matches());
    }

    @Test
    void rejectsInjectionAndJunk() {
        assertFalse(AnalyticsService.VALID_TICKER.matcher("AAPL/../../etc").matches());
        assertFalse(AnalyticsService.VALID_TICKER.matcher("AAPL?symbol=x").matches());
        assertFalse(AnalyticsService.VALID_TICKER.matcher("a@evil.com").matches());
        assertFalse(AnalyticsService.VALID_TICKER.matcher("").matches());
        assertFalse(AnalyticsService.VALID_TICKER.matcher("TOOLONGTICKER").matches());
        assertFalse(AnalyticsService.VALID_TICKER.matcher("AAPL AAPL").matches());
    }
}
