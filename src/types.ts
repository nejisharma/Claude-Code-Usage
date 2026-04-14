export interface UsageData {
  installed: boolean;
  currentSession: SessionInfo | null;
  weekly: WeeklyData;
  rateLimits: RateLimits;
  projects: ProjectStats[];
  modelUsage: Record<string, ModelTokens>;
  timeline: TimelineData;
  totalSessions: number;
  totalMessages: number;
}

export interface TimelineData {
  dailyActivity: HeatmapDay[];
  dailyByModel: DailyModelTokens[];
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  peakHour: number;
  favoriteModel: string;
}

export interface HeatmapDay {
  date: string;
  count: number;
}

export interface DailyModelTokens {
  date: string;
  tokensByModel: Record<string, number>;
}

export interface RateLimits {
  planName: string;
  isReal: boolean;
  sessionPct: number;
  sessionResetsInSecs: number;
  weeklyPct: number;
  weeklyResetsInSecs: number;
  weeklyResetsAt: string;
}

export interface SessionInfo {
  sessionId: string;
  project: string;
  startedAt: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  messageCount: number;
  durationMs: number;
  model: string;
  contextTokensUsed: number;
  contextWindow: number;
}

export interface WeeklyData {
  days: DailyActivity[];
  totalMessages: number;
  totalSessions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
}

export interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
  tokens: number;
}

export interface ModelTokens {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
}

export interface ProjectStats {
  name: string;
  path: string;
  totalMessages: number;
  totalTokens: number;
  totalCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  sessionCount: number;
  lastActiveAt: string;
}
