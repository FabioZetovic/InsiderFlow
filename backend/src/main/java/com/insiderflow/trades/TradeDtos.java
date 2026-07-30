package com.insiderflow.trades;

import java.util.List;

public class TradeDtos {

    public record PagedResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {
    }

    public record MemberStats(String member, String chamber, String state, String party,
                              long tradeCount, long buyCount, long sellCount, long estimatedVolume) {
    }

    public record SectorStats(String sector, long tradeCount, long buyCount, long sellCount,
                              long estimatedVolume) {
    }

    public record TickerCount(String ticker, long count) {
    }

    public record SectorCount(String sector, long count) {
    }

    public record MemberSummary(String member, String chamber, String state, String party,
                                long tradeCount, long buyCount, long sellCount,
                                long estimatedVolume,
                                List<TickerCount> topTickers,
                                List<SectorCount> sectorBreakdown) {
    }

    public record TimelinePoint(String period, long buyCount, long sellCount) {
    }

    /**
     * A ticker traded (bought or sold) more than the hot threshold in the recent window.
     * highlight is BUY (bought >5x) or SELL (sold >5x); when both, the larger side wins.
     */
    public record HotTicker(String ticker, long buyCount, long sellCount, String highlight) {
    }

    public record SpotlightMember(String name, boolean found, String chamber, String state, String party,
                                  long tradeCount, long buyCount, long sellCount,
                                  List<Trade> recentTrades) {
    }

    /**
     * One trader's estimated return: for each BUY, we compare the stock price at the trade date
     * against its latest price. Aggregated to a simple average return across their buys.
     */
    public record LeaderboardEntry(String member, String chamber, String state, String party,
                                   long scoredBuys, double avgReturnPercent, double avgAlphaPercent,
                                   double bestReturnPercent, String bestTicker) {
    }

    // ---------- Digest (F1) ----------

    /** New filings since a cutoff: headline counts plus notable trades and tickers. */
    public record Digest(String since, long newTrades, long newBuys, long newSells,
                         long estimatedVolume,
                         List<Trade> notableTrades,
                         List<TickerActivity> topTickers,
                         List<MemberActivity> topMembers) {
    }

    public record TickerActivity(String ticker, String sector, long buyCount, long sellCount,
                                 long estimatedVolume) {
    }

    public record MemberActivity(String member, String party, String chamber, long tradeCount,
                                 long estimatedVolume) {
    }

    // ---------- Late filers (F2) ----------

    public record LateFiler(String member, String party, String chamber, String state,
                            long lateCount, long totalDisclosed, double lateRate,
                            double avgLagDays, long maxLagDays) {
    }

    // ---------- Buy clusters (F5) ----------

    /** Several members buying (or selling) the same ticker within a short window. */
    public record Cluster(String ticker, String sector, String direction, int memberCount,
                          long tradeCount, long estimatedVolume, String firstDate, String lastDate,
                          List<ClusterMember> members) {
    }

    public record ClusterMember(String member, String party, String date, String amountRange) {
    }

    // ---------- Member comparison (F8) ----------

    public record MemberComparison(List<MemberSummary> members) {
    }

    /** Ticker detail: which members traded it, with counts and the price series for the chart. */
    public record TickerDetail(String ticker, String sector, String companyName,
                               long tradeCount, long buyCount, long sellCount,
                               List<TickerMemberActivity> members,
                               List<Trade> recentTrades,
                               List<PricePoint> priceHistory) {
    }

    public record TickerMemberActivity(String member, String party, long buyCount, long sellCount) {
    }

    public record PricePoint(String date, double close) {
    }
}
