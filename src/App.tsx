import { useUsageData } from "./hooks/useUsageData";
import Dashboard from "./components/Dashboard";
import NotInstalled from "./components/NotInstalled";

function App() {
  const { data, loading, error, refresh } = useUsageData();

  if (loading && !data) {
    return (
      <div className="app loading-screen">
        <div className="spinner" />
        <p>Loading usage data...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="app error-screen">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={refresh}>Retry</button>
      </div>
    );
  }

  if (data && !data.installed) {
    return <NotInstalled />;
  }

  if (data) {
    return <Dashboard data={data} onRefresh={refresh} loading={loading} />;
  }

  return null;
}

export default App;
