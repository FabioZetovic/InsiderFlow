package com.insiderflow.trades;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/trades")
public class TradeController {

    private final TradeService tradeService;
    private final AnalyticsService analyticsService;
    private final InsightsService insightsService;
    private final PositionService positionService;

    public TradeController(TradeService tradeService, AnalyticsService analyticsService,
                           InsightsService insightsService, PositionService positionService) {
        this.tradeService = tradeService;
        this.analyticsService = analyticsService;
        this.insightsService = insightsService;
        this.positionService = positionService;
    }

    /** One trade in context: entry price, the member's average buy price, and the chart around it. */
    @GetMapping("/position/{id}")
    public PositionService.TradePosition getPosition(@PathVariable String id) {
        return positionService.position(id);
    }

    @GetMapping
    public TradeDtos.PagedResponse<Trade> getTrades(
            @RequestParam(required = false) String member,
            @RequestParam(required = false) String sector,
            @RequestParam(required = false) String chamber,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String sort) {
        int safeSize = Math.min(Math.max(size, 1), 200);
        int safePage = Math.max(page, 0);
        return tradeService.findTrades(new TradeService.TradeQuery(
                member, sector, chamber, type, search, from, to, safePage, safeSize, sort));
    }

    @GetMapping("/members")
    public List<TradeDtos.MemberStats> getMembers() {
        return tradeService.memberStats();
    }

    @GetMapping("/sectors")
    public List<TradeDtos.SectorStats> getSectors() {
        return tradeService.sectorStats();
    }

    @GetMapping("/hot-tickers")
    public List<TradeDtos.HotTicker> getHotTickers() {
        return tradeService.hotTickers();
    }

    /** Featured members shown in the spotlight section of the Insiders page. */
    private static final List<String> SPOTLIGHT_MEMBERS = List.of("Nancy Pelosi", "Donald Trump");

    @GetMapping("/spotlight")
    public List<TradeDtos.SpotlightMember> getSpotlight() {
        return tradeService.spotlight(SPOTLIGHT_MEMBERS);
    }

    @GetMapping("/members/{member}/summary")
    public TradeDtos.MemberSummary getMemberSummary(@PathVariable String member) {
        return tradeService.memberSummary(member);
    }

    @GetMapping("/sectors/{sector}/timeline")
    public List<TradeDtos.TimelinePoint> getSectorTimeline(@PathVariable String sector) {
        return tradeService.sectorTimeline(sector);
    }

    @GetMapping("/ticker/{ticker}")
    public TradeDtos.TickerDetail getTickerDetail(@PathVariable String ticker) {
        return analyticsService.tickerDetail(ticker);
    }

    @GetMapping("/leaderboard")
    public AnalyticsService.LeaderboardResponse getLeaderboard() {
        return analyticsService.getLeaderboard();
    }

    // ---------- Insights (F1, F2, F5) ----------

    @GetMapping("/digest")
    public TradeDtos.Digest getDigest(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate since) {
        return insightsService.digest(since);
    }

    @GetMapping("/late-filers")
    public List<TradeDtos.LateFiler> getLateFilers() {
        return insightsService.lateFilers();
    }

    @GetMapping("/clusters")
    public List<TradeDtos.Cluster> getClusters(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "BUY") String direction) {
        return insightsService.clusters(days, direction);
    }

    // ---------- Member comparison (F8) ----------

    @GetMapping("/compare")
    public TradeDtos.MemberComparison compare(@RequestParam List<String> members) {
        return tradeService.compare(members);
    }
}
