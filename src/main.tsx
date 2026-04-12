import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

// One-time migration: clear stale layout data from older versions.
// Remove this block after all users have upgraded past v3.
const CURRENT_LAYOUT_VERSION = "v3";
if (localStorage.getItem("_layout_version") !== CURRENT_LAYOUT_VERSION) {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith("dashboard-")) {
      localStorage.removeItem(key);
    }
  }
  localStorage.setItem("_layout_version", CURRENT_LAYOUT_VERSION);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
