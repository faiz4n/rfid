import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { socket } from "../socket.js";

function StatCard({ label, value, tone }) {
  return (
    <article className={`stat-card ${tone}`}>
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalScans: 0,
    validScans: 0,
    unknownScans: 0,
    blockedScans: 0,
    uniquePeopleToday: 0,
  });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
  });

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [statsRes, recentRes] = await Promise.all([
        api.get(`/attendance/stats/today?date=${selectedDate}`),
        api.get(`/attendance/recent?status=valid&limit=15&date=${selectedDate}`),
      ]);

      setStats(statsRes.data);
      setRecent(recentRes.data);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    function onNewScan(payload) {
      const d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      const todayString = d.toISOString().split("T")[0];
      
      if (selectedDate !== todayString) return;

      if (payload.status === "entered" || payload.status === "exited") {
        setRecent(prev => [payload, ...prev].slice(0, 15));
      }
      
      setStats(s => ({
        ...s,
        totalScans: s.totalScans + 1,
        validScans: (payload.status === "entered" || payload.status === "exited") ? s.validScans + 1 : s.validScans,
        unknownScans: payload.status === "unknown" ? s.unknownScans + 1 : s.unknownScans,
        blockedScans: payload.status === "blocked" ? s.blockedScans + 1 : s.blockedScans,
      }));
    }

    socket.on("new_scan", onNewScan);
    return () => socket.off("new_scan", onNewScan);
  }, [selectedDate]);

  const successRate = useMemo(() => {
    if (!stats.totalScans) return "0%";
    return `${Math.round((stats.validScans / stats.totalScans) * 100)}%`;
  }, [stats.validScans, stats.totalScans]);

  return (
    <section className="dashboard-grid">
      <div className="stats-grid">
        <StatCard
          label="Total Scans Today"
          value={stats.totalScans}
          tone="neutral"
        />
        <StatCard label="Valid Scans" value={stats.validScans} tone="good" />
        <StatCard label="Unknown Cards" value={stats.unknownScans} tone="bad" />
        <StatCard
          label="Blocked Card Hits"
          value={stats.blockedScans}
          tone="bad"
        />
        <StatCard
          label="Unique People"
          value={stats.uniquePeopleToday}
          tone="neutral"
        />
      </div>

      <section className="panel flex-panel">
        <div className="panel-header">
          <h2>Live Validated Attendance</h2>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: "0.25rem" }}
            />
            <button onClick={loadData} className="btn ghost" type="button">
              Refresh
            </button>
          </div>
        </div>

        {loading && <p className="muted">Loading scans...</p>}
        {error && <p className="error">{error}</p>}

        {!loading && !error && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Name</th>
                  <th>UID</th>
                  <th>Status</th>
                  <th>Device</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((entry) => (
                  <tr key={entry._id}>
                    <td>{new Date(entry.scannedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}</td>
                    <td>
                      {entry.status === "blocked"
                        ? entry.user?.name || "Blocked Card"
                        : entry.user?.name || "Unknown Card"}
                    </td>
                    <td>{entry.uid}</td>
                    <td>
                      <span className={`badge ${entry.status}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td>{entry.deviceId}</td>
                  </tr>
                ))}
                {!recent.length && (
                  <tr>
                    <td colSpan="5" className="muted">
                      No scans available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
