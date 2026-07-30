package com.insiderflow.trades;

import com.insiderflow.common.StatusService;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Reacts to completed ingest runs: refresh freshness metadata, drop aggregate caches, kick off
 * the (slow, async) leaderboard recomputation, and enrich the earnings-proximity flags.
 */
@Component
public class IngestListeners {

    private final StatusService statusService;
    private final TradeService tradeService;
    private final AnalyticsService analyticsService;
    private final InsightsService insightsService;

    public IngestListeners(StatusService statusService, TradeService tradeService,
                           AnalyticsService analyticsService, InsightsService insightsService) {
        this.statusService = statusService;
        this.tradeService = tradeService;
        this.analyticsService = analyticsService;
        this.insightsService = insightsService;
    }

    @Async
    @EventListener
    public void onIngestCompleted(TradeIngestionService.IngestCompletedEvent event) {
        statusService.markIngestCompleted();
        tradeService.invalidateAggregateCaches();
        analyticsService.computeLeaderboardAsync();
        insightsService.enrichNearEarnings();
    }
}
