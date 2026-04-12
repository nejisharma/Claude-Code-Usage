import { type ReactNode, useState } from "react";

interface Props {
  title: string;
  widgetId: string;
  tooltip?: string;
  editMode: boolean;
  onRemove: (id: string) => void;
  children: ReactNode;
}

export default function WidgetWrapper({ title, widgetId, tooltip, editMode, onRemove, children }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={`widget ${editMode ? "widget-editing" : ""}`}>
      <div className={`widget-header ${editMode ? "drag-handle" : ""}`}>
        <span className="widget-title">
          {title}
          {tooltip && (
            <span
              className="widget-help"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={(e) => {
                e.stopPropagation();
                setShowTooltip((v) => !v);
              }}
            >
              ?
              {showTooltip && (
                <span className="widget-tooltip">{tooltip}</span>
              )}
            </span>
          )}
        </span>
        {editMode && (
          <button
            className="widget-close"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(widgetId);
            }}
            title="Remove widget"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div className="widget-body">{children}</div>
    </div>
  );
}
