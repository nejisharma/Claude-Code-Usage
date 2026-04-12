import type { SessionInfo } from "../types";

interface Props {
  session: SessionInfo | null;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatModel(model: string): string {
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model;
}

export default function SessionUsage({ session }: Props) {
  if (!session) {
    return (
      <div className="session-inner inactive">
        <span className="badge badge-inactive">No Active Session</span>
        <p className="no-session-text">
          Start a Claude Code session to see live usage here.
        </p>
      </div>
    );
  }

  return (
    <div className="session-inner">
      <span className="badge badge-active" style={{ alignSelf: "flex-end" }}>Live</span>
      <div className="session-meta">
        <span className="project-name">{session.project}</span>
        <span className="session-model">{formatModel(session.model)}</span>
        <span className="session-duration">{formatDuration(session.durationMs)}</span>
      </div>
      <div className="token-grid">
        <div className="token-item">
          <span className="token-label">Input</span>
          <span className="token-value input">{formatTokens(session.inputTokens)}</span>
        </div>
        <div className="token-item">
          <span className="token-label">Output</span>
          <span className="token-value output">{formatTokens(session.outputTokens)}</span>
        </div>
        <div className="token-item">
          <span className="token-label">Cache Read</span>
          <span className="token-value cache">{formatTokens(session.cacheReadTokens)}</span>
        </div>
        <div className="token-item">
          <span className="token-label">Cache Write</span>
          <span className="token-value cache">{formatTokens(session.cacheCreationTokens)}</span>
        </div>
      </div>
      <div className="session-footer">
        <span>{session.messageCount} messages</span>
      </div>
    </div>
  );
}
