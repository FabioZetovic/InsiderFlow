package com.insiderflow.trades;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** The estimate behind "average buy price" and the return figures in the trade detail panel. */
class PositionMathTest {

    @Test
    void weightedAverageUsesAmountMidpoints() {
        // $8K at $100 and $32.5K at $200 -> (100*8000 + 200*32500) / 40500
        Double avg = PositionService.weightedAverage(List.of(new double[]{100, 8_000}, new double[]{200, 32_500}));
        assertEquals(180.25, avg, 0.01);
    }

    @Test
    void weightedAverageIgnoresZeroWeightsAndIsNullWhenEmpty() {
        assertNull(PositionService.weightedAverage(List.of()));
        assertNull(PositionService.weightedAverage(List.<double[]>of(new double[]{100, 0})));
        assertEquals(50.0, PositionService.weightedAverage(List.of(new double[]{50, 1}, new double[]{999, 0})), 1e-9);
    }

    @Test
    void percentChangeHandlesMissingAndZeroBase() {
        assertEquals(25.0, PositionService.percentChange(80.0, 100.0), 1e-9);
        assertEquals(-50.0, PositionService.percentChange(200.0, 100.0), 1e-9);
        assertNull(PositionService.percentChange(null, 100.0));
        assertNull(PositionService.percentChange(100.0, null));
        assertNull(PositionService.percentChange(0.0, 100.0));
    }

    @Test
    void weightFallsBackFromMidToLowToOne() {
        Trade t = new Trade();
        t.setAmountMid(8_000L);
        t.setAmountLow(1_001L);
        assertEquals(8_000, PositionService.weightOf(t));
        t.setAmountMid(null);
        assertEquals(1_001, PositionService.weightOf(t));
        t.setAmountLow(null);
        assertEquals(1, PositionService.weightOf(t));
    }

    @Test
    void tradeIdValidationRejectsJunk() {
        assertTrue(PositionService.VALID_ID.matcher("6730c1f2a9b8e4d3c2b1a090").matches());
        assertFalse(PositionService.VALID_ID.matcher("").matches());
        assertFalse(PositionService.VALID_ID.matcher("{\"$ne\":null}").matches());
        assertFalse(PositionService.VALID_ID.matcher("../../etc").matches());
    }
}
