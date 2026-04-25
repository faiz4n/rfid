import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { RiRfidFill } from "react-icons/ri";
import DashboardPage from "./pages/DashboardPage";
import EnrollPage from "./pages/EnrollPage";
import LogsPage from "./pages/LogsPage";

export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <RiRfidFill size={40} />
          </div>
          <div className="brand-text">
            <h2>Smart RFID</h2>
            <p>Admin Portal</p>
          </div>
        </div>
        <p className="sidebar-label">Navigation</p>
        <nav className="sidebar-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/students"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            Student Management
          </NavLink>
          <NavLink
            to="/logs"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            System Logs
          </NavLink>
        </nav>
      </aside>

      <div className="layout-shell">
        <header className="topbar">
          <div>
            <h1>Attendance Management System</h1>
            <p className="eyebrow">Smart RFID Project Database</p>
          </div>
        </header>
        
        <main className="content-shell">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/students" element={<EnrollPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route
              path="/enroll"
              element={<Navigate to="/students" replace />}
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}
