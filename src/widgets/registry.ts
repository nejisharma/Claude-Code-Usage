// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Layout = any;

export interface WidgetDef {
  id: string;
  name: string;
  tooltip?: string;
  defaultW: number;
  defaultH: number;
  minW?: number;
  minH?: number;
}

export const WIDGET_DEFS: WidgetDef[] = [
  { id: "quick-stats",     name: "Quick Stats",         tooltip: "Overview of your total Claude Code usage across all projects and sessions.", defaultW: 12, defaultH: 2, minW: 6, minH: 2 },
  { id: "rate-limits",     name: "Rate Limits",         tooltip: "Estimated plan usage based on API pricing. Session resets on a rolling 5-hour window. Weekly resets every Friday at 1 PM.", defaultW: 4,  defaultH: 5, minW: 3, minH: 4 },
  { id: "session",         name: "Current Session",     tooltip: "Live token usage for your active Claude Code session. Updates every 10 seconds.", defaultW: 4,  defaultH: 5, minW: 3, minH: 4 },
  { id: "cache-efficiency",name: "Cache Efficiency",    tooltip: "Cache hit rate measures how much input Claude reads from cache vs. sending fresh. Higher is better \u2014 cache reads cost 10x less ($1.50/M vs $15/M). 'Est. Saved' shows money saved by hitting cache.", defaultW: 4,  defaultH: 5, minW: 2, minH: 3 },
  { id: "weekly-activity", name: "Weekly Activity",     tooltip: "Messages and sessions per day over the last 7 days.", defaultW: 6,  defaultH: 5, minW: 4, minH: 4 },
  { id: "token-dist",      name: "Token Distribution",  tooltip: "Breakdown of all tokens by type: input (sent to Claude), output (Claude's responses), cache read (reused context), and cache write (new context stored).", defaultW: 6,  defaultH: 5, minW: 4, minH: 4 },
  { id: "cost-breakdown",  name: "Cost by Project",     tooltip: "Estimated API-equivalent cost per project, based on Opus pricing.", defaultW: 6,  defaultH: 5, minW: 4, minH: 4 },
  { id: "top-projects",    name: "Top Projects",        tooltip: "Top 5 projects ranked by total token consumption.", defaultW: 6,  defaultH: 5, minW: 4, minH: 4 },
  { id: "daily-tokens",    name: "Daily Token Types",   tooltip: "Messages and tool calls per day over the last 7 days.", defaultW: 6,  defaultH: 5, minW: 4, minH: 4 },
  { id: "session-timeline",name: "Session Timeline",    tooltip: "Sessions and tool call activity over the last 7 days.", defaultW: 6,  defaultH: 5, minW: 4, minH: 4 },
  { id: "projects",        name: "Projects",            tooltip: "All projects with usage stats. Click column headers to sort. Deleting a folder from ~/.claude/projects/ only removes history, not your code.", defaultW: 12, defaultH: 7, minW: 6, minH: 4 },
  { id: "model-breakdown", name: "Model Breakdown",     tooltip: "Token usage broken down by Claude model (Opus, Sonnet, Haiku).", defaultW: 12, defaultH: 4, minW: 4, minH: 3 },
];

export function getDefaultLayout(): Layout[] {
  let y = 0;
  const layout: Layout[] = [];

  // Row 1: Quick Stats (full width)
  layout.push({ i: "quick-stats", x: 0, y, w: 12, h: 2 });
  y += 2;

  // Row 2: Rate Limits + Session + Cache Efficiency
  layout.push({ i: "rate-limits", x: 0, y, w: 4, h: 5 });
  layout.push({ i: "session", x: 4, y, w: 4, h: 5 });
  layout.push({ i: "cache-efficiency", x: 8, y, w: 4, h: 5 });
  y += 5;

  // Row 3: Weekly Activity + Token Distribution
  layout.push({ i: "weekly-activity", x: 0, y, w: 6, h: 5 });
  layout.push({ i: "token-dist", x: 6, y, w: 6, h: 5 });
  y += 5;

  // Row 4: Cost Breakdown + Top Projects
  layout.push({ i: "cost-breakdown", x: 0, y, w: 6, h: 5 });
  layout.push({ i: "top-projects", x: 6, y, w: 6, h: 5 });
  y += 5;

  // Row 5: Daily Tokens + Session Timeline
  layout.push({ i: "daily-tokens", x: 0, y, w: 6, h: 5 });
  layout.push({ i: "session-timeline", x: 6, y, w: 6, h: 5 });
  y += 5;

  // Row 6: Projects table (full width)
  layout.push({ i: "projects", x: 0, y, w: 12, h: 7 });
  y += 7;

  // Row 7: Model Breakdown (full width)
  layout.push({ i: "model-breakdown", x: 0, y, w: 12, h: 4 });

  return layout;
}

export function getDefaultVisibleWidgets(): string[] {
  return WIDGET_DEFS.map((w) => w.id);
}

const LAYOUT_VERSION = "v3"; // bump this to invalidate old layouts
const LAYOUT_KEY = `dashboard-layout-${LAYOUT_VERSION}`;
const VISIBLE_KEY = `dashboard-visible-${LAYOUT_VERSION}`;

export function saveLayout(_layout: Layout[] | null, visible: string[]) {
  localStorage.setItem(VISIBLE_KEY, JSON.stringify(visible));
}

export function loadLayout(): { layout: null; visible: string[] | null } {
  try {
    const visibleStr = localStorage.getItem(VISIBLE_KEY);
    return {
      layout: null,
      visible: visibleStr ? JSON.parse(visibleStr) : null,
    };
  } catch {
    return { layout: null, visible: null };
  }
}

export function clearLayout() {
  localStorage.removeItem(LAYOUT_KEY);
  localStorage.removeItem(VISIBLE_KEY);
  // Also clean up old version keys
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith("dashboard-") && !key.includes(LAYOUT_VERSION)) {
      localStorage.removeItem(key);
    }
  }
}
