import { useEffect, useState } from "react";
import { api } from "../api/client";
import { socket } from "../socket.js";

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
  });

  async function loadLogs() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/attendance/recent?limit=200&date=${selectedDate}`);
      setLogs(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();

    function onNewScan(payload) {
      const d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      const todayString = d.toISOString().split("T")[0];
      
      if (selectedDate === todayString) {
        setLogs(prev => [payload, ...prev].slice(0, 200));
      }
    }
    
    socket.on("new_scan", onNewScan);
    return () => socket.off("new_scan", onNewScan);
  }, [selectedDate]);

  return (
    <section className="dashboard-grid">
      <section className="panel flex-panel">
        <div className="panel-header">
          <h2>System Logs</h2>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: "0.25rem" }}
            />
            <button onClick={loadLogs} className="btn ghost" type="button">
              Refresh
            </button>
          </div>
        </div>

        {loading && <p className="muted">Loading logs...</p>}
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
                {logs.map((entry) => (
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
                {!logs.length && (
                  <tr>
                    <td colSpan="5" className="muted">
                      No logs available for selected date.
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
