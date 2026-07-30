package com.insiderflow.market;

import com.insiderflow.common.ApiException;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/market")
public class MarketController {

    private final MarketService marketService;

    public MarketController(MarketService marketService) {
        this.marketService = marketService;
    }

    @GetMapping("/sector-flow")
    public List<SectorFlow> getSectorFlow() {
        return marketService.getSectorFlow();
    }

    @GetMapping("/sector-weekly")
    public List<SectorWeekly> getSectorWeekly() {
        return marketService.getSectorWeekly();
    }

    @GetMapping("/events")
    public List<MarketDtos.MarketEvent> getEvents(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return marketService.getEvents(from, to);
    }

    @GetMapping("/spx")
    public MarketDtos.SpxResponse getSpx() {
        MarketDtos.SpxResponse spx = marketService.getSpx();
        if (spx == null) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "S&P 500 quote unavailable — check FINNHUB_API_KEY");
        }
        return spx;
    }

    @GetMapping("/earnings")
    public List<EarningsEntry> getEarnings() {
        return marketService.getEarningsThisWeek();
    }
}
