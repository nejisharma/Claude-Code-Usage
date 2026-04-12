export default function NotInstalled() {
  return (
    <div className="app not-installed">
      <div className="not-installed-content">
        <div className="not-installed-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1>Claude Code Not Found</h1>
        <p className="subtitle">
          This app requires Claude Code to be installed on your machine.
        </p>
        <p className="description">
          Claude Code stores usage data in <code>~/.claude/</code> which this app reads to display your statistics.
        </p>
        <a
          href="https://docs.anthropic.com/en/docs/claude-code/overview"
          target="_blank"
          rel="noopener noreferrer"
          className="install-link"
        >
          Learn how to install Claude Code
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </a>
      </div>
    </div>
  );
}
