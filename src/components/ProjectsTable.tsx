import { useState } from "react";
import type { ProjectStats } from "../types";

interface Props {
  projects: ProjectStats[];
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCost(n: number): string {
  if (n >= 100) return `$${n.toFixed(0)}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n > 0) return `$${n.toFixed(3)}`;
  return "$0";
}

function timeAgo(isoStr: string): string {
  if (!isoStr) return "—";
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

type SortKey = "name" | "totalCostUsd" | "totalMessages" | "totalTokens" | "sessionCount" | "lastActiveAt";

export default function ProjectsTable({ projects }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>("lastActiveAt");
  const [sortDesc, setSortDesc] = useState(true);

  const sorted = [...projects].sort((a, b) => {
    const av = a[sortBy];
    const bv = b[sortBy];
    if (typeof av === "string" && typeof bv === "string") {
      return sortDesc ? bv.localeCompare(av) : av.localeCompare(bv);
    }
    return sortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number);
  });

  function handleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(key);
      setSortDesc(true);
    }
  }

  function sortIcon(key: SortKey) {
    if (sortBy !== key) return "";
    return sortDesc ? " \u25BC" : " \u25B2";
  }

  if (projects.length === 0) return null;

  return (
    <div className="projects-inner">
      <div className="projects-table-wrap">
        <table className="projects-table">
          <thead>
            <tr>
              <th onClick={() => handleSort("name")} className="sortable">
                Project{sortIcon("name")}
              </th>
              <th onClick={() => handleSort("totalCostUsd")} className="sortable num">
                Est. Cost{sortIcon("totalCostUsd")}
              </th>
              <th onClick={() => handleSort("totalTokens")} className="sortable num">
                Tokens{sortIcon("totalTokens")}
              </th>
              <th onClick={() => handleSort("totalMessages")} className="sortable num">
                Messages{sortIcon("totalMessages")}
              </th>
              <th onClick={() => handleSort("sessionCount")} className="sortable num">
                Sessions{sortIcon("sessionCount")}
              </th>
              <th onClick={() => handleSort("lastActiveAt")} className="sortable num">
                Last Active{sortIcon("lastActiveAt")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.path}>
                <td className="project-cell">
                  <span className="project-cell-name">{p.name}</span>
                  <span className="project-cell-path" title={p.path}>
                    {p.path}
                  </span>
                </td>
                <td className="num cost-cell">{formatCost(p.totalCostUsd)}</td>
                <td className="num">{formatTokens(p.totalTokens)}</td>
                <td className="num">{p.totalMessages.toLocaleString()}</td>
                <td className="num">{p.sessionCount}</td>
                <td className="num time-cell">{timeAgo(p.lastActiveAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
