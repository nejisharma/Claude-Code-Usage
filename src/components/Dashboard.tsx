import { useState, useCallback, useMemo } from "react";

import type { UsageData } from "../types";
import {
  WIDGET_DEFS,
  getDefaultVisibleWidgets,
  saveLayout,
  loadLayout,
} from "../widgets/registry";
import WidgetWrapper from "../widgets/WidgetWrapper";
import AddWidgetModal from "./AddWidgetModal";

import RateLimitsCard from "./RateLimits";
import SessionUsage from "./SessionUsage";
import WeeklyUsage from "./WeeklyUsage";
import TokenDistribution from "./TokenDistribution";
import ProjectsTable from "./ProjectsTable";
import ModelBreakdown from "./ModelBreakdown";
import QuickStats from "./QuickStats";
import CostBreakdown from "./CostBreakdown";
import DailyTokens from "./DailyTokens";
import SessionTimeline from "./SessionTimeline";
import CacheEfficiency from "./CacheEfficiency";
import TopProjects from "./TopProjects";
import ModelCostComparison from "./ModelCostComparison";

interface Props {
  data: UsageData;
  onRefresh: () => void;
  loading: boolean;
}

export default function Dashboard({ data, onRefresh, loading }: Props) {
  const saved = useMemo(() => loadLayout(), []);
  const [visibleWidgets, setVisibleWidgets] = useState<string[]>(
    saved.visible ?? getDefaultVisibleWidgets()
  );
  const [editMode, setEditMode] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [snapshot, setSnapshot] = useState<string[] | null>(null);

  const enterEditMode = useCallback(() => {
    setSnapshot([...visibleWidgets]);
    setEditMode(true);
  }, [visibleWidgets]);

  const saveAndExit = useCallback(() => {
    saveLayout(null, visibleWidgets);
    setEditMode(false);
    setSnapshot(null);
  }, [visibleWidgets]);

  const cancelEdit = useCallback(() => {
    if (snapshot) setVisibleWidgets(snapshot);
    setEditMode(false);
    setSnapshot(null);
  }, [snapshot]);

  const handleRemoveWidget = useCallback((id: string) => {
    setVisibleWidgets((prev) => prev.filter((w) => w !== id));
  }, []);

  const handleToggleWidget = useCallback((id: string) => {
    setVisibleWidgets((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    );
  }, []);

  const handleResetLayout = useCallback(() => {
    setVisibleWidgets(getDefaultVisibleWidgets());
  }, []);

  function renderWidget(id: string) {
    switch (id) {
      case "quick-stats": return <QuickStats data={data} />;
      case "rate-limits": return <RateLimitsCard limits={data.rateLimits} />;
      case "session": return <SessionUsage session={data.currentSession} />;
      case "cache-efficiency": return <CacheEfficiency models={data.modelUsage} />;
      case "weekly-activity": return <WeeklyUsage weekly={data.weekly} />;
      case "token-dist": return <TokenDistribution models={data.modelUsage} />;
      case "cost-breakdown": return <CostBreakdown projects={data.projects} />;
      case "top-projects": return <TopProjects projects={data.projects} />;
      case "daily-tokens": return <DailyTokens weekly={data.weekly} />;
      case "session-timeline": return <SessionTimeline weekly={data.weekly} />;
      case "projects": return <ProjectsTable projects={data.projects} />;
      case "model-breakdown": return <ModelBreakdown models={data.modelUsage} />;
      case "model-cost": return <ModelCostComparison models={data.modelUsage} />;
      default: return null;
    }
  }

  // Classify widgets by size for CSS grid placement
  const fullWidthIds = new Set(["quick-stats", "projects", "model-breakdown", "model-cost"]);
  const chartIds = new Set(["weekly-activity", "token-dist", "cost-breakdown", "top-projects", "daily-tokens", "session-timeline"]);

  return (
    <div className={`app dashboard ${editMode ? "edit-mode" : ""}`}>
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Claude Code Usage</h1>
          {editMode ? (
            <span className="subtitle edit-label">Editing — toggle widgets on/off</span>
          ) : (
            <span className="subtitle">Real-time dashboard</span>
          )}
        </div>
        <div className="header-right">
          {editMode ? (
            <>
              <button className="header-btn" onClick={() => setShowModal(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Widgets
              </button>
              <button className="header-btn" onClick={handleResetLayout}>Reset</button>
              <button className="header-btn save-btn" onClick={saveAndExit}>Save</button>
              <button className="header-btn cancel-btn" onClick={cancelEdit}>Cancel</button>
            </>
          ) : (
            <>
              <button className="header-btn edit-btn" onClick={enterEditMode}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
              <button
                className={`refresh-btn ${loading ? "spinning" : ""}`}
                onClick={onRefresh}
                title="Refresh"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 16h5v5" />
                </svg>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Full-width widgets */}
      {visibleWidgets.filter((id) => id === "quick-stats").map((id) => {
        const def = WIDGET_DEFS.find((w) => w.id === id)!;
        return (
          <div key={id} className="widget-slot widget-full">
            <WidgetWrapper title={def.name} tooltip={def.tooltip} widgetId={id} editMode={editMode} onRemove={handleRemoveWidget}>
              {renderWidget(id)}
            </WidgetWrapper>
          </div>
        );
      })}

      {/* 3-column row: Rate Limits + Session + Cache */}
      <div className="widget-row widget-row-3">
        {visibleWidgets.filter((id) => ["rate-limits", "session", "cache-efficiency"].includes(id)).map((id) => {
          const def = WIDGET_DEFS.find((w) => w.id === id)!;
          return (
            <div key={id} className="widget-slot">
              <WidgetWrapper title={def.name} tooltip={def.tooltip} widgetId={id} editMode={editMode} onRemove={handleRemoveWidget}>
                {renderWidget(id)}
              </WidgetWrapper>
            </div>
          );
        })}
      </div>

      {/* 2-column chart rows */}
      <div className="widget-row widget-row-2">
        {visibleWidgets.filter((id) => chartIds.has(id)).map((id) => {
          const def = WIDGET_DEFS.find((w) => w.id === id)!;
          return (
            <div key={id} className="widget-slot widget-chart">
              <WidgetWrapper title={def.name} tooltip={def.tooltip} widgetId={id} editMode={editMode} onRemove={handleRemoveWidget}>
                {renderWidget(id)}
              </WidgetWrapper>
            </div>
          );
        })}
      </div>

      {/* Full-width widgets at bottom */}
      {visibleWidgets.filter((id) => fullWidthIds.has(id) && id !== "quick-stats").map((id) => {
        const def = WIDGET_DEFS.find((w) => w.id === id)!;
        return (
          <div key={id} className="widget-slot widget-full">
            <WidgetWrapper title={def.name} tooltip={def.tooltip} widgetId={id} editMode={editMode} onRemove={handleRemoveWidget}>
              {renderWidget(id)}
            </WidgetWrapper>
          </div>
        );
      })}

      {showModal && (
        <AddWidgetModal
          visible={visibleWidgets}
          onToggle={handleToggleWidget}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
