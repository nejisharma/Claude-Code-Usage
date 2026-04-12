import type { ModelTokens } from "../types";

interface Props {
  models: Record<string, ModelTokens>;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function prettyModelName(model: string): string {
  if (model.includes("opus")) return "Claude Opus";
  if (model.includes("sonnet")) return "Claude Sonnet";
  if (model.includes("haiku")) return "Claude Haiku";
  return model;
}

function getModelColor(model: string): string {
  if (model.includes("opus")) return "#c084fc";
  if (model.includes("sonnet")) return "#60a5fa";
  if (model.includes("haiku")) return "#34d399";
  return "#94a3b8";
}

export default function ModelBreakdown({ models }: Props) {
  const entries = Object.entries(models);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="model-inner">
      <div className="model-list">
        {entries.map(([model, tokens]) => {
          const total =
            tokens.inputTokens +
            tokens.outputTokens +
            tokens.cacheReadInputTokens +
            tokens.cacheCreationInputTokens;

          return (
            <div key={model} className="model-row">
              <div className="model-name-row">
                <span
                  className="model-dot"
                  style={{ backgroundColor: getModelColor(model) }}
                />
                <span className="model-name">{prettyModelName(model)}</span>
                <span className="model-total">{formatTokens(total)} total</span>
              </div>
              <div className="model-details">
                <span>In: {formatTokens(tokens.inputTokens)}</span>
                <span>Out: {formatTokens(tokens.outputTokens)}</span>
                <span>Cache: {formatTokens(tokens.cacheReadInputTokens)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
