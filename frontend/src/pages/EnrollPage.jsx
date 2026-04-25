import { useEffect, useState } from "react";
import { api } from "../api/client";
import { socket } from "../socket.js";

const initialAddForm = { name: "", uid: "", department: "", role: "student" };
const initialEditForm = { name: "", uid: "", department: "", role: "student" };

const formatUID = (val) => {
  const hex = val.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  return hex.match(/.{1,2}/g)?.join(" ") || "";
};

export default function EnrollPage() {
  const [activeTab, setActiveTab] = useState("directory");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Add form state
  const [addForm, setAddForm] = useState(initialAddForm);
  const [addScanning, setAddScanning] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState(initialEditForm);
  const [editingId, setEditingId] = useState("");
  const [editScanning, setEditScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.uid && u.uid.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Card controls state
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferUid, setTransferUid] = useState("");
  const [transferScanning, setTransferScanning] = useState(false);

  const [scanHint, setScanHint] = useState("");

  const stats = {
    total: users.length,
    active: users.filter((u) => u.cardStatus !== "blocked").length,
    blocked: users.filter((u) => u.cardStatus === "blocked").length,
  };

  async function loadUsers() {
    try {
      const res = await api.get("/users");
      setUsers(res.data);
    } catch {
      setUsers([]);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  // Socket effects for scanning forms
  useEffect(() => {
    if (!addScanning && !transferScanning) return;
    
    function onCapture(payload) {
      if (payload.uid) {
        if (addScanning) {
          setAddForm((p) => ({ ...p, uid: payload.uid }));
          setScanHint(`UID: ${payload.uid}`);
          setAddScanning(false);
        } else if (transferScanning) {
          setTransferUid(payload.uid);
          setScanHint(`UID: ${payload.uid}`);
          setTransferScanning(false);
        }
        api.post("/attendance/capture/stop").catch(() => {});
      }
    }

    socket.on("scan_captured", onCapture);
    return () => socket.off("scan_captured", onCapture);
  }, [addScanning, transferScanning]);

  async function startScan(mode) {
    try {
      setScanHint("Scan mode active...");
      await api.post("/attendance/capture/start", { timeoutMs: 30000 });
      if (mode === "add") setAddScanning(true);
      else if (mode === "transfer") setTransferScanning(true);
    } catch {
      setScanHint("Scan failed");
    }
  }

  async function stopScan() {
    try {
      await api.post("/attendance/capture/stop");
    } catch {}
    setAddScanning(false);
    setTransferScanning(false);
    setScanHint("");
  }

  async function addStudent(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.post("/users", addForm);
      setMessage("✓ Added");
      setAddForm(initialAddForm);
      loadUsers();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function updateStudent(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.patch(`/users/${editingId}`, editForm);
      setMessage("✓ Updated");
      setEditingId("");
      setEditForm(initialEditForm);
      loadUsers();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  function selectEdit(user) {
    setEditingId(user._id);
    setEditForm({
      name: user.name,
      uid: user.uid || "",
      department: user.department || "",
      role: user.role || "student",
    });
  }

  async function toggleBlock(user) {
    setError("");
    setMessage("");
    try {
      if (user.cardStatus === "blocked") {
        await api.post(`/users/${user._id}/unblock`);
        setMessage(`✓ Unblocked ${user.name}`);
      } else {
        await api.post(`/users/${user._id}/block`);
        setMessage(`✓ Blocked ${user.name}`);
      }
      loadUsers();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed");
    }
  }

  async function transferCard(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.post(`/users/${transferTarget._id}/transfer-card`, {
        newUid: transferUid,
      });
      setMessage(`✓ Transferred`);
      setTransferTarget(null);
      setTransferUid("");
      loadUsers();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function cleanCard(user) {
    if (!window.confirm(`Are you sure you want to completely remove ${user.name}?`)) return;
    setError("");
    setMessage("");
    try {
      await api.post(`/users/${user._id}/clean-card`);
      setMessage(`✓ Removed ${user.name}`);
      if (editingId === user._id) {
        setEditingId("");
        setEditForm(initialEditForm);
      }
      loadUsers();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed");
    }
  }

  return (
    <section className="enroll-container">
      {/* Header */}
      <div className="enroll-header">
        <div className="enroll-title-row">
          <h2>Student Management</h2>
          <div className="stats-row">
            <span className="stat-item">
              <strong>{stats.total}</strong> total
            </span>
            <span className="stat-item good">
              <strong>{stats.active}</strong> active
            </span>
            <span className="stat-item bad">
              <strong>{stats.blocked}</strong> blocked
            </span>
          </div>
        </div>

        <div className="tabs-row">
          {["directory", "add", "edit", "controls"].map((tab) => (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? "active" : ""}`}
              onClick={() => {
                setActiveTab(tab);
                setEditingId("");
                setSearchQuery("");
                setError("");
                setMessage("");
              }}
            >
              {tab === "directory"
                ? "Directory"
                : tab === "add"
                  ? "Add Student"
                  : tab === "edit"
                    ? "Edit Student"
                    : "Controls"}
            </button>
          ))}
        </div>

        {message && <p className="msg-success">{message}</p>}
        {error && <p className="msg-error">{error}</p>}
      </div>

      {/* Directory Tab */}
      {activeTab === "directory" && (
        <div className="enroll-section directory-section">
          <table className="student-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>UID</th>
                <th>Dept</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ width: "100px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>{user.name}</td>
                  <td className="uid-cell">{user.uid || "—"}</td>
                  <td>{user.department || "—"}</td>
                  <td>{user.role}</td>
                  <td>
                    <span
                      className={`badge ${user.cardStatus === "blocked" ? "blocked" : "present"}`}
                    >
                      {user.cardStatus || "active"}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-mini"
                        onClick={() => {
                          selectEdit(user);
                          setActiveTab("edit");
                        }}
                      >
                        Edit →
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!users.length && <p className="empty-msg">No students yet</p>}
        </div>
      )}

      {/* Add Tab */}
      {activeTab === "add" && (
        <div className="enroll-section add-section">
          <div className="id-card-layout">
            <div className="id-card-preview-wrapper">
              <div className={`digital-id-card ${addForm.role}`}>
                <div className="id-card-header">
                  <div className="chip-icon"></div>
                  <span className="university-label">UNIVERSITY ID</span>
                </div>
                <div className="id-card-body">
                  <div className="id-avatar-large">
                    {addForm.name ? addForm.name.charAt(0).toUpperCase() : "?"}
                  </div>
                  <div className="id-info">
                    <h2>{addForm.name || "Student Name"}</h2>
                    <p className="role-text">{addForm.role.toUpperCase()}</p>
                    <p className="dept-text">{addForm.department || "Department"}</p>
                  </div>
                </div>
                <div className="id-card-footer">
                  <span className="uid-label">CARD UID</span>
                  <span className="uid-value">{addForm.uid || "TAP TO SCAN"}</span>
                </div>
              </div>
            </div>

            <div className="id-card-form-wrapper panel">
              <h3>Enroll New Student</h3>
              <form onSubmit={addStudent} className="compact-form">
                <input
                  placeholder="Full Name"
                  value={addForm.name}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, name: e.target.value }))
                  }
                  required
                />
                <div className="uid-input-group">
                  <input
                    placeholder="e.g. 93 35 6A 1D"
                    value={addForm.uid}
                    onChange={(e) =>
                      setAddForm((p) => ({ ...p, uid: formatUID(e.target.value) }))
                    }
                    required
                  />
                  {!addScanning ? (
                    <button
                      type="button"
                      className="btn-scan"
                      onClick={() => startScan("add")}
                    >
                      Scan
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-scan danger"
                      onClick={stopScan}
                    >
                      Stop
                    </button>
                  )}
                </div>
                {scanHint && <span className="hint">{scanHint}</span>}
                <input
                  placeholder="Department"
                  value={addForm.department}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, department: e.target.value }))
                  }
                />
                <select
                  value={addForm.role}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, role: e.target.value }))
                  }
                >
                  <option value="student">Student</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Enrolling..." : "Enroll Student"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tab */}
      {activeTab === "edit" && (
        <div className="enroll-section edit-section">
          {!editingId ? (
            <div className="edit-directory">
              <div className="search-bar-wrap">
                <input 
                  type="text" 
                  placeholder="Search students to edit..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
              <div className="student-grid-premium">
                {filteredUsers.map(user => (
                  <div key={user._id} className="premium-user-card" onClick={() => selectEdit(user)}>
                    <div className="avatar-circle">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="user-details-mini">
                      <h4>{user.name}</h4>
                      <p>{user.role} • {user.department || "No Dept"}</p>
                    </div>
                    <div className="card-hover-action">Edit ✨</div>
                  </div>
                ))}
                {!filteredUsers.length && <p className="muted">No students found.</p>}
              </div>
            </div>
          ) : (
            <div className="edit-detail-view">
              <button 
                className="btn ghost" 
                style={{ marginBottom: '16px' }}
                onClick={() => { setEditingId(""); setMessage(""); setError(""); }}
              >
                ← Back to Selection
              </button>
              
              <div className="id-card-layout">
                <div className="id-card-preview-wrapper">
                  <div className={`digital-id-card ${editForm.role}`}>
                    <div className="id-card-header">
                      <div className="chip-icon"></div>
                      <span className="university-label">UNIVERSITY ID</span>
                    </div>
                    <div className="id-card-body">
                      <div className="id-avatar-large">
                        {editForm.name ? editForm.name.charAt(0).toUpperCase() : "?"}
                      </div>
                      <div className="id-info">
                        <h2>{editForm.name || "Student Name"}</h2>
                        <p className="role-text">{editForm.role.toUpperCase()}</p>
                        <p className="dept-text">{editForm.department || "Department"}</p>
                      </div>
                    </div>
                    <div className="id-card-footer">
                      <span className="uid-label">CARD UID</span>
                      <span className="uid-value">{editForm.uid || "NO CARD"}</span>
                    </div>
                  </div>
                </div>

                <div className="id-card-form-wrapper panel">
                  <h3>Update Identity</h3>
                  <form onSubmit={updateStudent} className="compact-form">
                    <label>
                      Full Name
                      <input
                        placeholder="Name"
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, name: e.target.value }))
                        }
                        required
                      />
                    </label>

                    <label>
                      Department
                      <input
                        placeholder="Department"
                        value={editForm.department}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, department: e.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Role Status
                      <select
                        value={editForm.role}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, role: e.target.value }))
                        }
                      >
                        <option value="student">Student</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                    <div className="btn-group" style={{ marginTop: '10px' }}>
                      <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => { setEditingId(""); setMessage(""); setError(""); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Controls Tab */}
      {activeTab === "controls" && (
        <div className="enroll-section controls-section">
          <div className="control-col">
            <h3>Transfer Card</h3>
            {transferTarget ? (
              <div className="transfer-info">
                <p>
                  Student: <strong>{transferTarget.name}</strong>
                </p>
              </div>
            ) : (
              <p className="hint-text">Select a student from Directory</p>
            )}
            <form onSubmit={transferCard} className="compact-form">
              <div className="uid-input-group">
                <input
                  placeholder="e.g. 93 35 6A 1D"
                  value={transferUid}
                  onChange={(e) => setTransferUid(formatUID(e.target.value))}
                  required
                  disabled={!transferTarget}
                />
                {!transferScanning ? (
                  <button
                    type="button"
                    className="btn-scan"
                    onClick={() => startScan("transfer")}
                    disabled={!transferTarget}
                  >
                    Scan
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-scan danger"
                    onClick={stopScan}
                  >
                    Stop
                  </button>
                )}
              </div>
              {scanHint && <span className="hint">{scanHint}</span>}
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !transferTarget}
              >
                {loading ? "Transferring..." : "Transfer"}
              </button>
              {transferTarget && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setTransferTarget(null)}
                >
                  Clear
                </button>
              )}
            </form>
          </div>

          <div className="control-col">
            <h3>Block / Unblock</h3>
            <div className="user-list-compact">
              {users.map((user) => (
                <div className="user-item-compact" key={user._id}>
                  <div>
                    <strong>{user.name}</strong>
                    <p className="uid-small">{user.uid || "NO CARD"}</p>
                  </div>
                  <div className="compact-actions">
                    <button
                      className={`btn-mini ${user.cardStatus === "blocked" ? "" : "danger"}`}
                      onClick={() => toggleBlock(user)}
                    >
                      {user.cardStatus === "blocked" ? "Unblock" : "Block"}
                    </button>
                    <button
                      className="btn-mini"
                      onClick={() => {
                        setTransferTarget(user);
                      }}
                    >
                      Xfer
                    </button>
                    <button
                      className="btn-mini danger"
                      onClick={() => cleanCard(user)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
