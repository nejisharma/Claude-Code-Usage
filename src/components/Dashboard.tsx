import { useState, useCallback, useMemo } from "react";
import { ResponsiveGridLayout, useContainerWidth, verticalCompactor } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Layout = any;

import type { UsageData } from "../types";
import {
  WIDGET_DEFS,
  getDefaultLayout,
  getDefaultVisibleWidgets,
  saveLayout,
  loadLayout,
  clearLayout,
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
import ActivityHeatmap from "./ActivityHeatmap";
import ModelsTimeline from "./ModelsTimeline";

interface Props {
  data: UsageData;
  onRefresh: () => void;
  loading: boolean;
}

export default function Dashboard({ data, onRefresh, loading }: Props) {
  const { width: containerWidth, containerRef } = useContainerWidth({ initialWidth: 1200 });
  const saved = useMemo(() => loadLayout(), []);

  const [layouts, setLayouts] = useState<{ lg: Layout[] }>({
    lg: saved.layout ?? getDefaultLayout(),
  });
  const [visibleWidgets, setVisibleWidgets] = useState<string[]>(
    saved.visible ?? getDefaultVisibleWidgets()
  );

  const [editMode, setEditMode] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [snapshot, setSnapshot] = useState<{ lg: Layout[]; visible: string[] } | null>(null);

  const enterEditMode = useCallback(() => {
    setSnapshot({ lg: JSON.parse(JSON.stringify(layouts.lg)), visible: [...visibleWidgets] });
    setEditMode(true);
  }, [layouts, visibleWidgets]);

  const saveAndExit = useCallback(() => {
    saveLayout(layouts.lg, visibleWidgets);
    setEditMode(false);
    setSnapshot(null);
  }, [layouts, visibleWidgets]);

  const cancelEdit = useCallback(() => {
    if (snapshot) {
      setLayouts({ lg: snapshot.lg });
      setVisibleWidgets(snapshot.visible);
    }
    setEditMode(false);
    setSnapshot(null);
  }, [snapshot]);

  const handleResetLayout = useCallback(() => {
    clearLayout();
    const defaultLayout = getDefaultLayout();
    const defaultVisible = getDefaultVisibleWidgets();
    setLayouts({ lg: defaultLayout });
    setVisibleWidgets(defaultVisible);
    saveLayout(defaultLayout, defaultVisible);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLayoutChange = useCallback(
    (...args: any[]) => {
      if (!editMode) return;
      const allLayouts = args[1] ?? {};
      const lg = allLayouts.lg ?? args[0] ?? [];
      setLayouts({ lg });
    },
    [editMode]
  );

  const handleRemoveWidget = useCallback(
    (id: string) => {
      if (!editMode) return;
      setVisibleWidgets((prev) => prev.filter((w) => w !== id));
    },
    [editMode]
  );

  const handleToggleWidget = useCallback(
    (id: string) => {
      if (visibleWidgets.includes(id)) {
        setVisibleWidgets((prev) => prev.filter((w) => w !== id));
      } else {
        setVisibleWidgets((prev) => [...prev, id]);
        const def = WIDGET_DEFS.find((w) => w.id === id);
        if (def && !layouts.lg.find((l: Layout) => l.i === id)) {
          setLayouts((prev) => ({
            lg: [
              ...prev.lg,
              { i: id, x: 0, y: Infinity, w: def.defaultW, h: def.defaultH },
            ],
          }));
        }
      }
    },
    [visibleWidgets, layouts]
  );

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
      case "activity-heatmap": {
        const totalTokens = data.projects.reduce((s, p) => s + p.totalTokens, 0);
        return (
          <ActivityHeatmap
            timeline={data.timeline}
            totalMessages={data.totalMessages}
            totalSessions={data.totalSessions}
            totalTokens={totalTokens}
          />
        );
      }
      case "models-timeline": return <ModelsTimeline timeline={data.timeline} />;
      default: return null;
    }
  }

  const widgetMinSizes = useMemo(() => {
    const map: Record<string, { minW: number; minH: number }> = {};
    for (const def of WIDGET_DEFS) {
      map[def.id] = { minW: def.minW ?? 2, minH: def.minH ?? 2 };
    }
    return map;
  }, []);

  return (
    <div className={`app dashboard ${editMode ? "edit-mode" : ""}`}>
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Claude Code Usage</h1>
          {editMode ? (
            <span className="subtitle edit-label">Editing — drag to move, corners to resize, X to remove</span>
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

      <div ref={containerRef} />
      <ResponsiveGridLayout
        className="dashboard-grid-layout"
        width={containerWidth || 1200}
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 900, sm: 600 }}
        cols={{ lg: 12, md: 8, sm: 4 }}
        rowHeight={60}
        compactor={verticalCompactor}
        dragConfig={editMode ? { handle: ".drag-handle" } : { handle: ".no-drag-impossible" }}
        resizeConfig={editMode ? {} : { handles: [] as any }}
        onLayoutChange={handleLayoutChange as any}
        margin={[12, 12] as any}
      >
        {visibleWidgets.map((id) => {
          const def = WIDGET_DEFS.find((w) => w.id === id);
          if (!def) return null;
          const mins = widgetMinSizes[id] ?? { minW: 2, minH: 2 };
          const existingLayout = layouts.lg.find((l: Layout) => l.i === id);
          const gridConfig = existingLayout
            ? { ...existingLayout, minW: mins.minW, minH: mins.minH }
            : { i: id, x: 0, y: Infinity, w: def.defaultW, h: def.defaultH, minW: mins.minW, minH: mins.minH };
          return (
            <div key={id} data-grid={gridConfig}>
              <WidgetWrapper
                title={def.name}
                tooltip={def.tooltip}
                widgetId={id}
                editMode={editMode}
                onRemove={handleRemoveWidget}
              >
                {renderWidget(id)}
              </WidgetWrapper>
            </div>
          );
        })}
      </ResponsiveGridLayout>

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
