package com.insiderflow.market;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public class MarketDtos {

    public record MarketEvent(LocalDate date, String type, String title) {
    }

    public record SpxResponse(String symbol, double price, double change, double changePercent,
                              List<Double> sparkline, Instant updatedAt) {
    }
}
