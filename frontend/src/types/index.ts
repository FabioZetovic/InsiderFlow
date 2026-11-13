export interface UserInfo {
  id: string;
  email: string;
  username: string;
}

export interface AuthResponse {
  token: string;
  user: UserInfo;
}

export interface ApiError {
  status: number;
  error: string;
  message: string;
  timestamp: string;
  fieldErrors: Record<string, string> | null;
}

export type Chamber = 'HOUSE' | 'SENATE' | 'EXECUTIVE';

export function chamberLabel(chamber: Chamber | null | undefined): string {
  if (chamber === 'HOUSE') return 'House';
  if (chamber === 'SENATE') return 'Senate';
  if (chamber === 'EXECUTIVE') return 'President';
  return '';
}
export type TransactionType = 'BUY' | 'SELL' | 'EXCHANGE';

export type Party = 'Democrat' | 'Republican' | 'Independent' | string;

export function partyColor(party: Party | null | undefined): string {
  if (party === 'Democrat') return 'text-blue-400';
  if (party === 'Republican') return 'text-down-400';
  if (party === 'Independent') return 'text-ink-200';
  return 'text-ink-500';
}

export function partyInitial(party: Party | null | undefined): string {
  if (party === 'Democrat') return 'D';
  if (party === 'Republican') return 'R';
  if (party === 'Independent') return 'I';
  return '';
}

export interface Trade {
  id: string;
  member: string;
  chamber: Chamber;
  state: string | null;
  party: Party | null;
  ticker: string | null;
  assetDescription: string | null;
  assetType: string | null;
  transactionType: TransactionType;
  amountRange: string | null;
  amountLow: number | null;
  amountMid: number | null;
  amountHigh: number | null;
  transactionDate: string;
  disclosureDate: string | null;
  suspiciousDate: boolean;
  disclosureLagDays: number | null;
  lateDisclosure: boolean;
  committeeConflict: string | null;
  nearEarnings: boolean;
  ptrLink: string | null;
  sector: string;
}

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface MemberStats {
  member: string;
  chamber: Chamber;
  state: string | null;
  party: Party | null;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  estimatedVolume: number;
}

export interface SectorStats {
  sector: string;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  estimatedVolume: number;
}

export interface TickerCount {
  ticker: string;
  count: number;
}

export interface SectorCount {
  sector: string;
  count: number;
}

export interface MemberSummary {
  member: string;
  chamber: Chamber;
  state: string | null;
  party: Party | null;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  estimatedVolume: number;
  topTickers: TickerCount[];
  sectorBreakdown: SectorCount[];
}

export interface TimelinePoint {
  period: string;
  buyCount: number;
  sellCount: number;
}

export interface SectorFlow {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  updatedAt: string;
}

export type MarketEventType = 'FED' | 'CPI' | 'PPI' | 'JOBS' | 'GDP';

export interface MarketEvent {
  date: string;
  type: MarketEventType;
  title: string;
}

export interface SpxResponse {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  sparkline: number[];
  updatedAt: string;
}

export interface EarningsEvent {
  id: string;
  symbol: string;
  date: string;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  hour: string | null;
  quarter: number | null;
  year: number | null;
  fetchedAt: string;
}

export interface SectorWeekly {
  symbol: string;
  name: string;
  lastClose: number;
  weekAgoClose: number;
  weeklyChangePercent: number;
  lastDate: string;
  updatedAt: string;
}

export interface HotTicker {
  ticker: string;
  buyCount: number;
  sellCount: number;
  highlight: 'BUY' | 'SELL';
}

export interface SpotlightMember {
  name: string;
  found: boolean;
  chamber: Chamber | null;
  state: string | null;
  party: Party | null;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  recentTrades: Trade[];
}

export interface TradeFilters {
  member?: string;
  sector?: string;
  chamber?: Chamber | '';
  type?: TransactionType | '';
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export interface LeaderboardEntry {
  member: string;
  chamber: Chamber | null;
  state: string | null;
  party: Party | null;
  scoredBuys: number;
  avgReturnPercent: number;
  avgAlphaPercent: number;
  bestReturnPercent: number;
  bestTicker: string | null;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  computedAt: string | null;
  computing: boolean;
}

export interface TickerMemberActivity {
  member: string;
  party: Party | null;
  buyCount: number;
  sellCount: number;
}

export interface PricePoint {
  date: string;
  close: number;
}

export interface TickerDetail {
  ticker: string;
  sector: string | null;
  companyName: string | null;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  members: TickerMemberActivity[];
  recentTrades: Trade[];
  priceHistory: PricePoint[];
}

export interface SourceStatus {
  source: string;
  detail: string;
  updatedAt: string | null;
  stale: boolean;
}

export interface AppStatus {
  totalTrades: number;
  lastIngestAt: string | null;
  sources: SourceStatus[];
  senateStale: boolean;
  newTrumpFilingDetected: boolean;
  newTrumpFilingDate: string | null;
}

// ---------- Digest (F1) ----------

export interface TickerActivity {
  ticker: string;
  sector: string | null;
  buyCount: number;
  sellCount: number;
  estimatedVolume: number;
}

export interface MemberActivity {
  member: string;
  party: Party | null;
  chamber: Chamber | null;
  tradeCount: number;
  estimatedVolume: number;
}

export interface Digest {
  since: string | null;
  newTrades: number;
  newBuys: number;
  newSells: number;
  estimatedVolume: number;
  notableTrades: Trade[];
  topTickers: TickerActivity[];
  topMembers: MemberActivity[];
}

// ---------- Late filers (F2) ----------

export interface LateFiler {
  member: string;
  party: Party | null;
  chamber: Chamber | null;
  state: string | null;
  lateCount: number;
  totalDisclosed: number;
  lateRate: number;
  avgLagDays: number;
  maxLagDays: number;
}

// ---------- Clusters (F5) ----------

export interface ClusterMember {
  member: string;
  party: Party | null;
  date: string;
  amountRange: string | null;
}

export interface Cluster {
  ticker: string;
  sector: string | null;
  direction: 'BUY' | 'SELL';
  memberCount: number;
  tradeCount: number;
  estimatedVolume: number;
  firstDate: string;
  lastDate: string;
  members: ClusterMember[];
}

// ---------- Comparison (F8) ----------

export interface MemberComparison {
  members: MemberSummary[];
}

// ---------- Corporate insiders / Form 4 (F10) ----------

export type InsiderType = 'BUY' | 'SELL' | 'GRANT' | 'OTHER';

export interface InsiderTrade {
  id: string;
  ticker: string;
  issuerName: string | null;
  insiderName: string;
  insiderTitle: string | null;
  director: boolean;
  officer: boolean;
  tenPercentOwner: boolean;
  transactionType: InsiderType;
  transactionCode: string;
  transactionDate: string;
  shares: number | null;
  pricePerShare: number | null;
  value: number | null;
  filingUrl: string;
}

export interface PagedInsiders {
  content: InsiderTrade[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// ---------- Watchlist (F6) ----------

export interface WatchlistDto {
  members: string[];
  tickers: string[];
}

// ---------- Trade detail / position ----------

export interface PositionTrade {
  id: string;
  transactionDate: string | null;
  transactionType: TransactionType;
  amountRange: string | null;
  amountMid: number | null;
  /** Close on (or just before) the trade date. */
  price: number | null;
}

export interface TradePosition {
  trade: Trade;
  ticker: string | null;
  entryPrice: number | null;
  latestPrice: number | null;
  latestDate: string | null;
  changeSinceTradePercent: number | null;
  /** Estimated: closes on each buy date, weighted by disclosed amount midpoints. */
  avgBuyPrice: number | null;
  avgBuyReturnPercent: number | null;
  buyCount: number;
  sellCount: number;
  pricedBuys: number;
  memberTrades: PositionTrade[];
  priceHistory: PricePoint[];
}

// ---------- Member P&L (estimated) ----------

export interface PnlTrade {
  ticker: string;
  transactionDate: string;
  returnPercent: number;
  estimatedPnl: number;
}

/** Estimated P&L of a member's buys from the last 12 months, weighted by disclosed amount midpoints. */
export interface MemberPnl {
  member: string;
  scoredBuys: number;
  totalBuys: number;
  estimatedInvested: number;
  estimatedPnl: number;
  estimatedPnlPercent: number | null;
  avgReturnPercent: number | null;
  avgAlphaPercent: number | null;
  winRatePercent: number | null;
  best: PnlTrade | null;
  worst: PnlTrade | null;
}
