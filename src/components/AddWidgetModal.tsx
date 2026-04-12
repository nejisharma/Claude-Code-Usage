import { WIDGET_DEFS } from "../widgets/registry";

interface Props {
  visible: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}

export default function AddWidgetModal({ visible, onToggle, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage Widgets</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          {WIDGET_DEFS.map((w) => {
            const isVisible = visible.includes(w.id);
            return (
              <label key={w.id} className={`widget-toggle ${isVisible ? "active" : ""}`}>
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={() => onToggle(w.id)}
                />
                <span className="widget-toggle-name">{w.name}</span>
                <span className="widget-toggle-size">
                  {w.defaultW}x{w.defaultH}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
