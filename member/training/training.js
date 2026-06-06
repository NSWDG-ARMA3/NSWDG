import { supabase } from "/js/auth.js";
import { renderPortalLayout } from "/js/portal-layout.js";

renderPortalLayout("training");

const TEAM_LEADER_CALLSIGNS = ["EG1", "EH1", "EI1"];
const TROOP_HQ_CALLSIGNS = ["E31", "E32"];
const HQ_ROLES = ["ADMIN", "HQ", "TROOP_HQ"];
const SPECIAL_UNIT_WIDE_EMAILS = ["evans@navy.mil"];

const state = {
  authUser: null,
  profile: null,
  sessions: [],
  attendance: [],
  profiles: [],
  activeSessionId: null
};

const el = {};

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  cacheElements();
  bindEvents();

  const ok = await loadSessionAndProfile();
  if (!ok) return;

  await loadData();
}

function cacheElements() {
  el.sessionLabel = document.getElementById("session-label");
  el.sidebarName = document.getElementById("sidebar-name");
  el.sidebarRole = document.getElementById("sidebar-role");
  el.navAvatar = document.getElementById("nav-avatar");
  el.logoutButton = document.getElementById("logout-button");

  el.category = document.getElementById("training-category");
  el.status = document.getElementById("training-status");
  el.title = document.getElementById("training-title");
  el.start = document.getElementById("training-start");
  el.end = document.getElementById("training-end");
  el.location = document.getElementById("training-location");
  el.description = document.getElementById("training-description");

  el.saveButton = document.getElementById("save-training-button");
  el.resetButton = document.getElementById("reset-training-button");
  el.statusLine = document.getElementById("training-status-line");

  el.search = document.getElementById("training-search");
  el.categoryFilter = document.getElementById("training-category-filter");
  el.statusFilter = document.getElementById("training-status-filter");
  el.refreshButton = document.getElementById("refresh-training-button");

  el.output = document.getElementById("training-output");
  el.viewer = document.getElementById("training-viewer");
}

function bindEvents() {
  el.logoutButton?.addEventListener("click", doLogout);
  el.saveButton.addEventListener("click", saveTraining);
  el.resetButton.addEventListener("click", resetForm);
  el.refreshButton.addEventListener("click", loadData);

  el.search.addEventListener("input", renderSessions);
  el.categoryFilter.addEventListener("change", renderSessions);
  el.statusFilter.addEventListener("change", renderSessions);
}

async function loadSessionAndProfile() {
  const sessionResult = await supabase.auth.getSession();

  if (sessionResult.error || !sessionResult.data.session) {
    window.location.href = "/login/";
    return false;
  }

  state.authUser = sessionResult.data.session.user;

  state.profile = {
    id: state.authUser.id,
    user_id: getUserIdFromEmail(state.authUser.email),
    display_name: state.authUser.email || "User",
    role: "MEMBER",
    status: "ACTIVE",
    avatar_url: null,
    callsign: null,
    naval_rank: null
  };

  const profileResult = await supabase
    .from("profiles")
    .select("id,user_id,display_name,role,status,avatar_url,callsign,naval_rank")
    .eq("id", state.authUser.id)
    .single();

  if (profileResult.data) {
    state.profile = { ...state.profile, ...profileResult.data };
  }

  if (el.sessionLabel) el.sessionLabel.textContent = state.profile.display_name;
  if (el.sidebarName) el.sidebarName.textContent = state.profile.display_name;
  if (el.sidebarRole) el.sidebarRole.textContent = state.profile.role;

  if (el.navAvatar && state.profile.avatar_url) {
    el.navAvatar.src = state.profile.avatar_url;
  }

  showAdminLinksIfAllowed(state.authUser.email);

  return true;
}

async function loadData() {
  const [sessionsResult, attendanceResult, profilesResult] = await Promise.all([
    supabase
      .from("training_sessions")
      .select("*")
      .order("start_at", { ascending: true }),

    supabase
      .from("training_attendance")
      .select("*"),

    supabase
      .from("profiles")
      .select("id,user_id,display_name,role,status,avatar_url,callsign,naval_rank")
      .eq("status", "ACTIVE")
      .order("display_name", { ascending: true })
  ]);

  if (sessionsResult.error) {
    el.output.innerHTML = `<div class="empty-state">Failed to load training: ${escapeHtml(sessionsResult.error.message)}</div>`;
    return;
  }

  if (attendanceResult.error) {
    el.output.innerHTML = `<div class="empty-state">Failed to load attendance: ${escapeHtml(attendanceResult.error.message)}</div>`;
    return;
  }

  state.sessions = sessionsResult.data || [];
  state.attendance = attendanceResult.data || [];
  state.profiles = profilesResult.data || [];
  state.sessions = (sessionsResult.data || []).filter(canViewSession);

  renderSessions();

  if (state.activeSessionId) {
    const active = state.sessions.find(s => Number(s.id) === Number(state.activeSessionId));
    if (active) renderViewer(active);
  }
}

function isTroopHq() {
  const role = String(state.profile?.role || "").trim().toUpperCase();
  const callsign = String(state.profile?.callsign || "").trim().toUpperCase();

  return HQ_ROLES.includes(role) || TROOP_HQ_CALLSIGNS.includes(callsign);
}

function isCandidate() {
  return String(state.profile?.naval_rank || "").trim() === "Candidate";
}

function canViewSession(session) {
  if (!session) return false;
  if (session.category !== "INNER_TEAM") return true;
  return !isCandidate();
}

function isTeamLeader() {
  const callsign = String(state.profile?.callsign || "").trim().toUpperCase();
  return TEAM_LEADER_CALLSIGNS.includes(callsign);
}

function isEvans() {
  return String(state.authUser?.email || "").trim().toLowerCase() === "evans@navy.mil";
}

function canHostUnitWide() {
  return isTroopHq() || isTeamLeader() || isEvans();
}

function canCreateSelectedCategory() {
  if (el.category.value === "PRO_DEVELOPMENT") return true;
  return canHostUnitWide();
}

function canManageSession(session) {
  if (!session) return false;
  return session.host_id === state.authUser.id || isTroopHq() || isEvans();
}

function canAarSession(session) {
  if (!session) return false;
  return session.host_id === state.authUser.id || isTroopHq() || isTeamLeader();
}

async function saveTraining() {
  clearStatus();

  const title = el.title.value.trim();

  if (!title) {
    showStatus("Title is required.", false);
    return;
  }

  if (!el.start.value) {
    showStatus("Start date and time are required.", false);
    return;
  }

  if (!canCreateSelectedCategory()) {
    showStatus("You do not have permission to host Unit Wide Training.", false);
    return;
  }

  const payload = {
    category: el.category.value,
    title,
    description: el.description.value.trim(),
    start_at: new Date(el.start.value).toISOString(),
    end_at: el.end.value ? new Date(el.end.value).toISOString() : null,
    location: el.location.value.trim(),
    status: el.status.value,
    host_id: state.authUser.id,
    updated_at: new Date().toISOString()
  };

  setButtonLoading(el.saveButton, true, "Saving...");

  const result = await supabase
    .from("training_sessions")
    .insert(payload);

  setButtonLoading(el.saveButton, false, "Create Training");

  if (result.error) {
    showStatus("Database save failed: " + result.error.message, false);
    return;
  }

  resetForm();
  showStatus("Training session created.", true);
  await loadData();
}

function resetForm() {
  el.category.value = "PRO_DEVELOPMENT";
  el.status.value = "SCHEDULED";
  el.title.value = "";
  el.start.value = "";
  el.end.value = "";
  el.location.value = "";
  el.description.value = "";
  clearStatus();
}

function renderSessions() {
  const search = el.search.value.trim().toLowerCase();
  const category = el.categoryFilter.value;
  const status = el.statusFilter.value;

  let rows = [...state.sessions];

  if (search) {
    rows = rows.filter(s =>
      String(s.title || "").toLowerCase().includes(search)
      || String(s.description || "").toLowerCase().includes(search)
      || String(s.location || "").toLowerCase().includes(search)
    );
  }

  if (category) rows = rows.filter(s => s.category === category);
  if (status) rows = rows.filter(s => s.status === status);

  if (!rows.length) {
    el.output.innerHTML = `<div class="empty-state">No training sessions found.</div>`;
    return;
  }

  el.output.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Start</th>
          <th>Category</th>
          <th>Title</th>
          <th>Status</th>
          <th>Attendance</th>
          <th>Host</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(session => {
          const counts = getAttendanceCounts(session.id);

          return `
            <tr>
              <td>${escapeHtml(formatDateTime(session.start_at))}</td>
              <td>${categoryBadge(session.category)}</td>
              <td>
                <strong>${escapeHtml(session.title)}</strong><br>
                <span class="muted">${escapeHtml(session.location || "-")}</span>
              </td>
              <td>${statusBadge(session.status)}</td>
              <td>
                <span class="badge badge-green">${counts.attending} Attending</span>
                <span class="badge badge-red">${counts.notAttending} Not Attending</span>
              </td>
              <td>${escapeHtml(getProfileName(session.host_id))}</td>
              <td>
                <button class="btn btn-secondary" type="button" data-open-session="${session.id}">Open</button>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  el.output.querySelectorAll("[data-open-session]").forEach(button => {
    button.addEventListener("click", () => {
      const session = state.sessions.find(s => Number(s.id) === Number(button.dataset.openSession));

      if (session) {
        state.activeSessionId = session.id;
        renderViewer(session);
      }
    });
  });
}

function renderViewer(session) {
  const attendanceRows = state.attendance.filter(a => Number(a.session_id) === Number(session.id));
  const attending = attendanceRows.filter(a => a.attendance === "ATTENDING");
  const notAttending = attendanceRows.filter(a => a.attendance === "NOT_ATTENDING");

  const noResponse = state.profiles.filter(profile => {
    return !attendanceRows.some(a => a.user_id === profile.id);
  });

  const myAttendance = attendanceRows.find(a => a.user_id === state.authUser.id);
  const canManage = canManageSession(session);
  const canAar = canAarSession(session);

  el.viewer.className = "viewer";

  el.viewer.innerHTML = `
    <div class="training-detail-card">
      <div class="training-detail-header">
        <div>
          <div class="training-eyebrow">Training Session</div>
          <h2>${escapeHtml(session.title)}</h2>
          <div class="training-badges">
            ${categoryBadge(session.category)}
            ${statusBadge(session.status)}
          </div>
        </div>

        <div class="training-time-box">
          <span>Start</span>
          <strong>${escapeHtml(formatDateTime(session.start_at))}</strong>
        </div>
      </div>

      <div class="training-info-grid">
        <div class="training-info-item">
          <span>End</span>
          <strong>${escapeHtml(session.end_at ? formatDateTime(session.end_at) : "-")}</strong>
        </div>

        <div class="training-info-item">
          <span>Location</span>
          <strong>${escapeHtml(session.location || "-")}</strong>
        </div>

        <div class="training-info-item">
          <span>Host</span>
          <strong>${escapeHtml(getProfileName(session.host_id))}</strong>
        </div>

        <div class="training-info-item">
          <span>Your Status</span>
          <strong>${escapeHtml(myAttendance ? attendanceLabel(myAttendance.attendance) : "No Response")}</strong>
        </div>
      </div>

      <div class="training-section">
        <h3>Description</h3>
        <div class="training-description">
          ${escapeHtml(session.description || "-").replaceAll("\n", "<br>")}
        </div>
      </div>

      <div class="training-section response-section">
        <h3>Your Response</h3>

        <div class="response-buttons">
          <button class="response-btn response-attending" type="button" id="attending-button">
            <span>✓</span>
            Attending
          </button>

          <button class="response-btn response-not-attending" type="button" id="not-attending-button">
            <span>✕</span>
            Not Attending
          </button>
        </div>
      </div>

      <div class="training-section">
        <h3>Availability Overview</h3>

        <div class="attendance-summary-grid">
          <div class="summary-card green">
            <span>${attending.length}</span>
            <strong>Attending</strong>
          </div>

          <div class="summary-card red">
            <span>${notAttending.length}</span>
            <strong>Not Attending</strong>
          </div>

          <div class="summary-card yellow">
            <span>${noResponse.length}</span>
            <strong>No Response</strong>
          </div>

          <div class="summary-card blue">
            <span>${state.profiles.length}</span>
            <strong>Total Members</strong>
          </div>
        </div>

        <div class="attendance-grid upgraded">
          <div class="attendance-box">
            <strong>Attending</strong>
            ${renderNameList(attending)}
          </div>

          <div class="attendance-box">
            <strong>Not Attending</strong>
            ${renderNameList(notAttending)}
          </div>

          <div class="attendance-box">
            <strong>No Response</strong>
            ${renderProfileList(noResponse)}
          </div>
        </div>
      </div>

      <div class="training-section">
        <h3>After Action Review</h3>
        ${renderAar(session, canAar)}

        ${canAar ? `
          <div class="button-row aar-actions">
            <button class="btn btn-primary" type="button" id="save-aar-button">Save AAR</button>
          </div>
        ` : ""}
      </div>

      ${canManage ? `
        <div class="danger-zone">
          <div>
            <strong>Danger Zone</strong>
            <span>Delete this training session permanently.</span>
          </div>

          <button class="btn btn-danger" type="button" id="delete-training-button">Delete Training</button>
        </div>
      ` : ""}
    </div>
  `;

  document.getElementById("attending-button").addEventListener("click", () => saveAttendance(session.id, "ATTENDING"));
  document.getElementById("not-attending-button").addEventListener("click", () => saveAttendance(session.id, "NOT_ATTENDING"));

  if (canAar) {
    document.getElementById("save-aar-button").addEventListener("click", () => saveAar(session.id));
  }

  if (canManage) {
    document.getElementById("delete-training-button").addEventListener("click", () => deleteTraining(session.id));
  }
}

function renderAar(session, canAar) {
  if (!canAar) {
    return `
      <div class="training-description">
        <div><strong>AAR:</strong><br>${escapeHtml(session.aar_text || "-").replaceAll("\n", "<br>")}</div>
        <br>
        <div><strong>Sustains:</strong><br>${escapeHtml(session.aar_sustains || "-").replaceAll("\n", "<br>")}</div>
        <br>
        <div><strong>Improves:</strong><br>${escapeHtml(session.aar_improves || "-").replaceAll("\n", "<br>")}</div>
        <br>
        <div><strong>Actions:</strong><br>${escapeHtml(session.aar_actions || "-").replaceAll("\n", "<br>")}</div>
      </div>
    `;
  }

  return `
    <div class="form-grid">
      <div class="form-group full">
        <label for="aar-text">AAR Notes</label>
        <textarea id="aar-text">${escapeHtml(session.aar_text || "")}</textarea>
      </div>

      <div class="form-group">
        <label for="aar-sustains">Sustains</label>
        <textarea id="aar-sustains">${escapeHtml(session.aar_sustains || "")}</textarea>
      </div>

      <div class="form-group">
        <label for="aar-improves">Improves</label>
        <textarea id="aar-improves">${escapeHtml(session.aar_improves || "")}</textarea>
      </div>

      <div class="form-group full">
        <label for="aar-actions">Follow Up Actions</label>
        <textarea id="aar-actions">${escapeHtml(session.aar_actions || "")}</textarea>
      </div>
    </div>
  `;
}

async function saveAttendance(sessionId, attendance) {
  const payload = {
    session_id: Number(sessionId),
    user_id: state.authUser.id,
    attendance,
    updated_at: new Date().toISOString()
  };

  const result = await supabase
    .from("training_attendance")
    .upsert(payload, { onConflict: "session_id,user_id" });

  if (result.error) {
    alert("Attendance save failed: " + result.error.message);
    return;
  }

  await loadData();
}

async function saveAar(sessionId) {
  const session = state.sessions.find(s => Number(s.id) === Number(sessionId));

  if (!canAarSession(session)) {
    alert("You do not have permission to save this AAR.");
    return;
  }

  const payload = {
    aar_text: document.getElementById("aar-text").value.trim(),
    aar_sustains: document.getElementById("aar-sustains").value.trim(),
    aar_improves: document.getElementById("aar-improves").value.trim(),
    aar_actions: document.getElementById("aar-actions").value.trim(),
    aar_submitted_at: new Date().toISOString(),
    status: "COMPLETED",
    updated_at: new Date().toISOString()
  };

  const result = await supabase
    .from("training_sessions")
    .update(payload)
    .eq("id", sessionId);

  if (result.error) {
    alert("AAR save failed: " + result.error.message);
    return;
  }

  await loadData();
}

async function deleteTraining(sessionId) {
  const session = state.sessions.find(s => Number(s.id) === Number(sessionId));

  if (!canManageSession(session)) {
    alert("You do not have permission to delete this training.");
    return;
  }

  if (!confirm("Delete this training session?")) return;

  const result = await supabase
    .from("training_sessions")
    .delete()
    .eq("id", sessionId);

  if (result.error) {
    alert("Delete failed: " + result.error.message);
    return;
  }

  state.activeSessionId = null;
  el.viewer.className = "empty-state";
  el.viewer.textContent = "Select a training session to view attendance and AAR.";

  await loadData();
}

function getAttendanceCounts(sessionId) {
  const rows = state.attendance.filter(a => Number(a.session_id) === Number(sessionId));

  return {
    attending: rows.filter(a => a.attendance === "ATTENDING").length,
    notAttending: rows.filter(a => a.attendance === "NOT_ATTENDING").length
  };
}

function renderNameList(rows) {
  if (!rows.length) return `<span class="muted">None</span>`;

  return rows.map(row => {
    const profile = state.profiles.find(p => p.id === row.user_id);
    return `<div>${escapeHtml(profileLabel(profile, row.user_id))}</div>`;
  }).join("");
}

function renderProfileList(profiles) {
  if (!profiles.length) return `<span class="muted">None</span>`;
  return profiles.map(profile => `<div>${escapeHtml(profileLabel(profile, profile.id))}</div>`).join("");
}

function profileLabel(profile, fallback) {
  if (!profile) return fallback;

  const rank = profile.naval_rank ? `${profile.naval_rank} ` : "";
  const callsign = profile.callsign ? ` [${profile.callsign}]` : "";

  return `${rank}${profile.display_name}${callsign}`;
}

function getProfileName(userId) {
  const profile = state.profiles.find(p => p.id === userId);
  return profile ? profile.display_name : userId;
}

function categoryBadge(category) {
  if (category === "UNIT_WIDE") {
    return `<span class="badge badge-blue">Unit Wide Training</span>`;
  }

  if (category === "INNER_TEAM") {
    return `<span class="badge badge-yellow">Inner Team</span>`;
  }

  return `<span class="badge badge-green">Pro Development</span>`;
}

function statusBadge(status) {
  if (status === "COMPLETED") return `<span class="badge badge-green">Completed</span>`;
  if (status === "CANCELLED") return `<span class="badge badge-red">Cancelled</span>`;
  if (status === "DRAFT") return `<span class="badge badge-yellow">Draft</span>`;

  return `<span class="badge badge-blue">Scheduled</span>`;
}

function attendanceLabel(value) {
  if (value === "ATTENDING") return "Attending";
  if (value === "NOT_ATTENDING") return "Not Attending";

  return "No response";
}

function formatDateTime(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(new Date(value));
}

function showStatus(message, ok) {
  el.statusLine.textContent = message;
  el.statusLine.className = `status-line visible ${ok ? "ok" : "err"}`;
}

function clearStatus() {
  el.statusLine.textContent = "";
  el.statusLine.className = "status-line";
}

function setButtonLoading(button, loading, text) {
  button.disabled = loading;
  button.textContent = text;
}

function showAdminLinksIfAllowed(email) {
  const normalized = String(email || "").trim().toLowerCase();

  if (normalized !== "evans@navy.mil" && normalized !== "carver@navy.mil") {
    return;
  }

  document.querySelectorAll(".admin-only-link").forEach(link => {
    link.style.display = "";
  });
}

async function doLogout() {
  await supabase.auth.signOut();
  window.location.href = "/login/";
}

function getUserIdFromEmail(email) {
  if (!email || !email.includes("@")) return "unknown";
  return email.split("@")[0];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}