import type { ModelTokens } from "../types";

interface Props {
  models: Record<string, ModelTokens>;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function CacheEfficiency({ models }: Props) {
  let totalInput = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  let totalOutput = 0;

  for (const m of Object.values(models)) {
    totalInput += m.inputTokens;
    totalOutput += m.outputTokens;
    totalCacheRead += m.cacheReadInputTokens;
    totalCacheWrite += m.cacheCreationInputTokens;
  }

  const totalAllInput = totalInput + totalCacheRead + totalCacheWrite;
  const hitRate = totalAllInput > 0 ? (totalCacheRead / totalAllInput) * 100 : 0;

  // Cost saved: cache reads cost 10x less than regular input
  const costWithoutCache = (totalCacheRead * 15) / 1_000_000; // if these were regular input
  const costWithCache = (totalCacheRead * 1.5) / 1_000_000;   // actual cache read cost
  const costSaved = costWithoutCache - costWithCache;

  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (hitRate / 100) * circumference;

  const ringColor = hitRate > 80 ? "#34d399" : hitRate > 50 ? "#fb923c" : "#f87171";

  return (
    <div className="cache-eff">
      <div className="cache-eff-gauge">
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r="54" fill="none" stroke="#1a1a24" strokeWidth="10" />
          <circle
            cx="65"
            cy="65"
            r="54"
            fill="none"
            stroke={ringColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 65 65)"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
          <text x="65" y="60" textAnchor="middle" fill="#e8e8f0" fontSize="22" fontWeight="700">
            {hitRate.toFixed(0)}%
          </text>
          <text x="65" y="78" textAnchor="middle" fill="#8888a0" fontSize="10">
            HIT RATE
          </text>
        </svg>
      </div>
      <div className="cache-eff-stats">
        <div className="cache-eff-row">
          <span className="cache-eff-label">Cache Reads</span>
          <span className="cache-eff-val">{formatTokens(totalCacheRead)}</span>
        </div>
        <div className="cache-eff-row">
          <span className="cache-eff-label">Cache Writes</span>
          <span className="cache-eff-val">{formatTokens(totalCacheWrite)}</span>
        </div>
        <div className="cache-eff-row">
          <span className="cache-eff-label">Direct Input</span>
          <span className="cache-eff-val">{formatTokens(totalInput)}</span>
        </div>
        <div className="cache-eff-row highlight">
          <span className="cache-eff-label">Est. Saved</span>
          <span className="cache-eff-val green">${costSaved.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}
