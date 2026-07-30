import { client } from './client';
import type {
  AppStatus,
  AuthResponse,
  Cluster,
  Digest,
  EarningsEvent,
  HotTicker,
  InsiderTrade,
  LateFiler,
  LeaderboardResponse,
  MarketEvent,
  MemberComparison,
  MemberStats,
  MemberSummary,
  PagedInsiders,
  PagedResponse,
  SectorFlow,
  SectorStats,
  SectorWeekly,
  SpotlightMember,
  SpxResponse,
  TickerDetail,
  TimelinePoint,
  Trade,
  TradeFilters,
  WatchlistDto,
} from '../types';

// ---------- Auth ----------

export interface AuthConfig {
  demoMode: boolean;
  registrationEnabled: boolean;
}

export async function getAuthConfig(): Promise<AuthConfig> {
  const { data } = await client.get<AuthConfig>('/auth/config');
  return data;
}

export async function register(email: string, username: string, password: string): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>('/auth/register', { email, username, password });
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

// ---------- Trades ----------

export async function getTrades(filters: TradeFilters): Promise<PagedResponse<Trade>> {
  const params: Record<string, string | number> = {};
  if (filters.member) params.member = filters.member;
  if (filters.sector) params.sector = filters.sector;
  if (filters.chamber) params.chamber = filters.chamber;
  if (filters.type) params.type = filters.type;
  if (filters.search) params.search = filters.search;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  params.page = filters.page ?? 0;
  params.size = filters.size ?? 50;
  if (filters.sort) params.sort = filters.sort;
  const { data } = await client.get<PagedResponse<Trade>>('/trades', { params });
  return data;
}

export async function getTickerDetail(ticker: string): Promise<TickerDetail> {
  const { data } = await client.get<TickerDetail>(`/trades/ticker/${encodeURIComponent(ticker)}`);
  return data;
}

export async function getLeaderboard(): Promise<LeaderboardResponse> {
  const { data } = await client.get<LeaderboardResponse>('/trades/leaderboard');
  return data;
}

export async function getStatus(): Promise<AppStatus> {
  const { data } = await client.get<AppStatus>('/status');
  return data;
}

export async function getMembers(): Promise<MemberStats[]> {
  const { data } = await client.get<MemberStats[]>('/trades/members');
  return data;
}

export async function getSectors(): Promise<SectorStats[]> {
  const { data } = await client.get<SectorStats[]>('/trades/sectors');
  return data;
}

export async function getMemberSummary(member: string): Promise<MemberSummary> {
  const { data } = await client.get<MemberSummary>(`/trades/members/${encodeURIComponent(member)}/summary`);
  return data;
}

export async function getSectorTimeline(sector: string): Promise<TimelinePoint[]> {
  const { data } = await client.get<TimelinePoint[]>(`/trades/sectors/${encodeURIComponent(sector)}/timeline`);
  return data;
}

export async function getHotTickers(): Promise<HotTicker[]> {
  const { data } = await client.get<HotTicker[]>('/trades/hot-tickers');
  return data;
}

export async function getSpotlight(): Promise<SpotlightMember[]> {
  const { data } = await client.get<SpotlightMember[]>('/trades/spotlight');
  return data;
}

// ---------- Market ----------

export async function getSectorWeekly(): Promise<SectorWeekly[]> {
  const { data } = await client.get<SectorWeekly[]>('/market/sector-weekly');
  return data;
}

export async function getSectorFlow(): Promise<SectorFlow[]> {
  const { data } = await client.get<SectorFlow[]>('/market/sector-flow');
  return data;
}

export async function getMarketEvents(from?: string, to?: string): Promise<MarketEvent[]> {
  const { data } = await client.get<MarketEvent[]>('/market/events', { params: { from, to } });
  return data;
}

export async function getSpx(): Promise<SpxResponse> {
  const { data } = await client.get<SpxResponse>('/market/spx');
  return data;
}

export async function getEarnings(): Promise<EarningsEvent[]> {
  const { data } = await client.get<EarningsEvent[]>('/market/earnings');
  return data;
}

// ---------- Insights (F1, F2, F5) ----------

export async function getDigest(since?: string): Promise<Digest> {
  const { data } = await client.get<Digest>('/trades/digest', { params: since ? { since } : {} });
  return data;
}

export async function getLateFilers(): Promise<LateFiler[]> {
  const { data } = await client.get<LateFiler[]>('/trades/late-filers');
  return data;
}

export async function getClusters(days = 30, direction: 'BUY' | 'SELL' = 'BUY'): Promise<Cluster[]> {
  const { data } = await client.get<Cluster[]>('/trades/clusters', { params: { days, direction } });
  return data;
}

// ---------- Comparison (F8) ----------

export async function compareMembers(members: string[]): Promise<MemberComparison> {
  const { data } = await client.get<MemberComparison>('/trades/compare', {
    params: { members },
    paramsSerializer: { indexes: null }, // members=A&members=B
  });
  return data;
}

// ---------- Corporate insiders / Form 4 (F10) ----------

export async function getCorporateInsiders(params: {
  ticker?: string;
  type?: string;
  page?: number;
  size?: number;
}): Promise<PagedInsiders> {
  const { data } = await client.get<PagedInsiders>('/corporate', { params });
  return data;
}

export async function getCorporateForTicker(ticker: string): Promise<InsiderTrade[]> {
  const { data } = await client.get<InsiderTrade[]>(`/corporate/ticker/${encodeURIComponent(ticker)}`);
  return data;
}

// ---------- Watchlist (F6) ----------

export async function getWatchlist(): Promise<WatchlistDto> {
  const { data } = await client.get<WatchlistDto>('/watchlist');
  return data;
}

export async function toggleWatch(type: 'member' | 'ticker', value: string): Promise<WatchlistDto> {
  const { data } = await client.post<WatchlistDto>('/watchlist/toggle', { type, value });
  return data;
}

export async function getFeed(page = 0, size = 50): Promise<PagedResponse<Trade>> {
  const { data } = await client.get<PagedResponse<Trade>>('/watchlist/feed', { params: { page, size } });
  return data;
}
