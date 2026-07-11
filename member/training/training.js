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
  loaRequests: [],
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
  const [sessionsResult, attendanceResult, profilesResult, loaResult] = await Promise.all([
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
      .order("display_name", { ascending: true }),

    supabase
      .from("loa_requests")
      .select("*")
      .eq("status", "APPROVED")
  ]);

  if (sessionsResult.error) {
    el.output.innerHTML = `<div class="empty-state">Failed to load training: ${escapeHtml(sessionsResult.error.message)}</div>`;
    return;
  }

  if (attendanceResult.error) {
    el.output.innerHTML = `<div class="empty-state">Failed to load attendance: ${escapeHtml(attendanceResult.error.message)}</div>`;
    return;
  }

  state.sessions = (sessionsResult.data || []).filter(canViewSession);
  state.attendance = attendanceResult.data || [];
  state.profiles = profilesResult.data || [];
  state.loaRequests = loaResult.data || [];

  renderSessions();

  if (state.activeSessionId) {
    const active = state.sessions.find(s => Number(s.id) === Number(state.activeSessionId));
    if (active) renderViewer(active);
  }
}

function isAdmin() {
  return String(state.profile?.role || "").trim().toUpperCase() === "ADMIN";
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
          const counts = getAttendanceCounts(session);

          return `
            <tr>
              <td>${escapeHtml(formatDateTime(session.start_at))}</td>
              <td>${categoryBadge(session.category)}</td>
              <td>
                <strong>${escapeHtml(session.title)}</strong><br>
                <span class="muted">${escapeHtml(session.location || "-")}</span>
              </td>
              <td>${renderSessionStatusControl(session)}</td>
                <td>
                  <span class="badge badge-green">${counts.attending} Attending</span>
                  <span class="badge badge-red">${counts.notAttending} Not Attending</span>
                  <span class="badge badge-yellow">${counts.loaAbsent} LOA Absent</span>
                </td>
              <td>${escapeHtml(getProfileName(session.host_id))}</td>
              <td>
                <button
  class="btn btn-secondary"
  type="button"
  data-open-session="${session.id}"
>
  ${Number(state.activeSessionId) === Number(session.id) ? "Close" : "Open"}
</button>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  el.output.querySelectorAll("[data-open-session]").forEach(button => {
  button.addEventListener("click", () => {
    const sessionId = Number(button.dataset.openSession);

    if (Number(state.activeSessionId) === sessionId) {
      state.activeSessionId = null;

      el.viewer.className = "empty-state";
      el.viewer.textContent =
        "Select a training session to view attendance and AAR.";

      renderSessions();
      return;
    }

    const session = state.sessions.find(
      item => Number(item.id) === sessionId
    );

    if (!session) return;

    state.activeSessionId = session.id;
    renderViewer(session);
    renderSessions();
  });
});

  el.output.querySelectorAll("[data-session-status]").forEach(select => {
    select.addEventListener("change", async () => {
      const sessionId = Number(select.dataset.sessionStatus);
      const newStatus = select.value;

      await updateSessionStatusFromList(
        sessionId,
        newStatus,
        select
      );
    });
  });
}

function renderAdminMarkingTable(session, attendanceRows) {
  const rows = state.profiles
    .slice()
    .sort((a, b) => String(a.display_name || "").localeCompare(String(b.display_name || "")));

  return `
    <div class="admin-marking-note">
      Mark final attendance for this training. Late minutes only apply when status is set to LATE.
    </div>

    <div class="admin-marking-table-wrap">
      <table class="admin-marking-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>RSVP</th>
            <th>Final Status</th>
            <th>Late Min</th>
            <th>Left Early Min</th>
            <th>Note</th>
            <th>Save</th>
          </tr>
        </thead>

        <tbody>
          ${rows.map(profile => {
            const row = attendanceRows.find(a => a.user_id === profile.id);
            return renderAdminMarkingRow(session, profile, row);
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminMarkingRow(session, profile, row) {
  const rsvp = row?.attendance || "NO_RESPONSE";
  const actual = row?.actual_status || guessActualStatusFromRsvp(rsvp);

  return `
    <tr data-admin-mark-row="${escapeHtml(profile.id)}">
      <td>
        <strong>${escapeHtml(profile.display_name || profile.user_id || profile.id)}</strong><br>
        <span class="muted">${escapeHtml(profile.naval_rank || "Candidate")}${profile.callsign ? ` | ${escapeHtml(profile.callsign)}` : ""}</span>
      </td>

      <td>${escapeHtml(rsvp)}</td>

      <td>
        <select data-field="actual_status">
          ${adminStatusOption("PRESENT", actual)}
          ${adminStatusOption("LATE", actual)}
          ${adminStatusOption("LEFT_EARLY", actual)}
          ${adminStatusOption("PARTIAL", actual)}
          ${adminStatusOption("EXCUSED", actual)}
          ${adminStatusOption("LOA", actual)}
          ${adminStatusOption("ABSENT", actual)}
          ${adminStatusOption("NO_SHOW", actual)}
        </select>
      </td>

      <td>
        <input data-field="minutes_late" type="number" min="0" step="1" value="${escapeHtml(row?.minutes_late || 0)}">
      </td>

      <td>
        <input data-field="minutes_left_early" type="number" min="0" step="1" value="${escapeHtml(row?.minutes_left_early || 0)}">
      </td>

      <td>
        <input data-field="admin_note" type="text" maxlength="1000" value="${escapeHtml(row?.admin_note || "")}">
      </td>

      <td>
        <button
          class="btn btn-primary btn-small"
          type="button"
          data-admin-save-mark
          data-session-id="${escapeHtml(session.id)}"
          data-user-id="${escapeHtml(profile.id)}">
          Save
        </button>
      </td>
    </tr>
  `;
}

function guessActualStatusFromRsvp(rsvp) {
  if (rsvp === "ATTENDING") return "PRESENT";
  if (rsvp === "NOT_ATTENDING") return "ABSENT";
  return "NO_SHOW";
}

function adminStatusOption(value, selected) {
  return `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value)}</option>`;
}

function bindAdminMarkingTable() {
  document.querySelectorAll("[data-admin-save-mark]").forEach(button => {
    button.addEventListener("click", () => saveAdminMarkingRow(button));
  });
}

async function saveAdminMarkingRow(button) {
  const row = button.closest("[data-admin-mark-row]");
  if (!row) return;

  const actualStatus = row.querySelector('[data-field="actual_status"]').value;
  const minutesLate = Number(row.querySelector('[data-field="minutes_late"]').value || 0);
  const minutesLeftEarly = Number(row.querySelector('[data-field="minutes_left_early"]').value || 0);
  const adminNote = row.querySelector('[data-field="admin_note"]').value.trim();

  button.disabled = true;
  button.textContent = "Saving";

  const { error } = await supabase.rpc("admin_mark_training_attendance", {
    target_session_id: Number(button.dataset.sessionId),
    target_profile_id: button.dataset.userId,
    new_actual_status: actualStatus,
    new_minutes_late: actualStatus === "LATE" ? minutesLate : 0,
    new_minutes_left_early: actualStatus === "LEFT_EARLY" ? minutesLeftEarly : 0,
    new_excused: actualStatus === "EXCUSED" || actualStatus === "LOA",
    new_admin_note: adminNote
  });

  button.disabled = false;
  button.textContent = "Save";

  if (error) {
    alert("Failed to save attendance: " + error.message);
    return;
  }

  await loadData();
}

function renderViewer(session) {
  const attendanceRows = state.attendance.filter(a => Number(a.session_id) === Number(session.id));

  const attending = attendanceRows.filter(a => a.attendance === "ATTENDING");
  const notAttending = attendanceRows.filter(a => a.attendance === "NOT_ATTENDING");

  const noResponse = state.profiles.filter(profile => {
    return !attendanceRows.some(a => a.user_id === profile.id);
  });

  const loaRows = getLoaForSession(session);
  const loaUserIds = new Set(loaRows.map(loa => loa.requester_id));

  const showingUp = attending.filter(row => !loaUserIds.has(row.user_id));
  const blockedByLoa = state.profiles.filter(profile => loaUserIds.has(profile.id));

  const myAttendance = attendanceRows.find(a => a.user_id === state.authUser.id);
  const canManage = canManageSession(session);
  const canAar = canAarSession(session);
  const admin = isAdmin();

  el.viewer.className = "viewer";

  el.viewer.innerHTML = `
    <div class="training-v2-card">
      <div class="training-v2-header">
        <div>
          <div class="training-eyebrow">Training Session</div>
          <h2>${escapeHtml(session.title)}</h2>

          <div class="training-badges">
            ${categoryBadge(session.category)}
            ${renderSessionStatusControl(session)}
          </div>
        </div>

<div class="training-v2-time">
  <span>Start Time</span>

  <strong>
    ${escapeHtml(formatDateTime(session.start_at))}
  </strong>

  <small>
    Eastern Time
    <br>
    (Your time: ${escapeHtml(formatViewerLocalTime(session.start_at))})
  </small>
</div>
      </div>

      <div class="training-v2-meta">
        <div>
          <span>End</span>
          <strong>${escapeHtml(session.end_at ? formatDateTime(session.end_at) : "-")}</strong>
        </div>

        <div>
          <span>Location</span>
          <strong>${escapeHtml(session.location || "-")}</strong>
        </div>

        <div>
          <span>Host</span>
          <strong>${escapeHtml(getProfileName(session.host_id))}</strong>
        </div>

        <div>
          <span>Your Response</span>
          <strong>${escapeHtml(myAttendance ? attendanceLabel(myAttendance.attendance) : "No Response")}</strong>
        </div>
      </div>

      ${admin ? renderAdminTrainingControls(session) : ""}

      <div class="training-v2-section">
        <div class="training-v2-section-head">
          <h3>Quick Overview</h3>
        </div>

        <div class="training-v2-stats">
          <div class="stat-card green">
            <b>${showingUp.length}</b>
            <span>Showing Up</span>
          </div>

          <div class="stat-card red">
            <b>${notAttending.length}</b>
            <span>Not Attending</span>
          </div>

          <div class="stat-card yellow">
            <b>${noResponse.length}</b>
            <span>No Response</span>
          </div>

          <div class="stat-card blue">
            <b>${blockedByLoa.length}</b>
            <span>Approved LOA</span>
          </div>

          <div class="stat-card dark">
            <b>${state.profiles.length}</b>
            <span>Total Members</span>
          </div>
        </div>
      </div>

      <div class="training-v2-section">
        <div class="training-v2-section-head">
          <h3>Your Response</h3>
        </div>

        <div class="response-buttons">
          <button class="response-btn response-attending" type="button" id="attending-button">
            ✓ Attending
          </button>

          <button class="response-btn response-not-attending" type="button" id="not-attending-button">
            ✕ Not Attending
          </button>
        </div>
      </div>

      <details class="training-v2-details" open>
        <summary>Attendance Roster</summary>

        ${canManage ? `
          <div class="admin-attendance-note">
            Admin mode: drag members between columns to manually set their response.
          </div>
        ` : ""}

        <div class="training-roster-grid ${canManage ? "admin-attendance-board" : ""}">
          <div class="roster-column green ${canManage ? "admin-drop-zone" : ""}" data-admin-attendance="ATTENDING">
            <div class="roster-column-head">
              <strong>Showing Up</strong>
              <span>${showingUp.length}</span>
            </div>
            ${canManage ? renderDraggableAttendanceRows(showingUp, "ATTENDING") : renderNameList(showingUp)}
          </div>

          <div class="roster-column red ${canManage ? "admin-drop-zone" : ""}" data-admin-attendance="NOT_ATTENDING">
            <div class="roster-column-head">
              <strong>Not Attending</strong>
              <span>${notAttending.length}</span>
            </div>
            ${canManage ? renderDraggableAttendanceRows(notAttending, "NOT_ATTENDING") : renderNameList(notAttending)}
          </div>

          <div class="roster-column yellow ${canManage ? "admin-drop-zone" : ""}" data-admin-attendance="">
            <div class="roster-column-head">
              <strong>No Response</strong>
              <span>${noResponse.length}</span>
            </div>
            ${canManage ? renderDraggableProfiles(noResponse) : renderProfileList(noResponse)}
          </div>
        </div>
      </details>

      ${canManage ? `
        <details class="training-v2-details" open>
          <summary>Admin Attendance Marking</summary>

          <div class="admin-marking-panel">
            ${renderAdminMarkingTable(session, attendanceRows)}
          </div>
        </details>
      ` : ""}    

      <details class="training-v2-details">
        <summary>LOA Coverage</summary>

        <div class="training-v2-description">
          ${blockedByLoa.length
            ? renderProfileCards(blockedByLoa)
            : `<span class="muted">No approved LOA found for this training date.</span>`
          }
        </div>
      </details>

      <details class="training-v2-details" open>
        <summary>Description</summary>

        <div class="training-v2-description">
          ${escapeHtml(session.description || "-").replaceAll("\n", "<br>")}
        </div>
      </details>

      <details class="training-v2-details">
        <summary>After Action Review</summary>

        <div class="training-v2-aar">

          ${renderAar(session, canAar)}

          ${canAar ? `
            <div class="button-row aar-actions">
              <button class="btn btn-primary" type="button" id="save-aar-button">Save AAR</button>
            </div>
          ` : ""}

        </div>
      </details>

      ${canManage ? `
        <details class="training-v2-details danger-details">
          <summary>Danger Zone</summary>

          <div class="danger-zone">
            <div>
              <strong>Delete Training</strong>
              <span>This permanently deletes the training session.</span>
            </div>

            <button class="btn btn-danger" type="button" id="delete-training-button">Delete Training</button>
          </div>
        </details>
      ` : ""}
    </div>
  `;
document.getElementById("attending-button").addEventListener("click", () => saveAttendance(session.id, "ATTENDING"));
document.getElementById("not-attending-button").addEventListener("click", () => saveAttendance(session.id, "NOT_ATTENDING"));

el.viewer.querySelectorAll("[data-session-status]").forEach(select => {
  select.addEventListener("change", async () => {
    const sessionId = Number(select.dataset.sessionStatus);
    const newStatus = select.value;

    await updateSessionStatusFromList(
      sessionId,
      newStatus,
      select
    );
  });
});

if (admin) {
  bindAdminTrainingControls(session);
}

  if (canManage) {
    bindAdminAttendanceBoard(session.id);
    bindAdminMarkingTable();

    const deleteButton = document.getElementById("delete-training-button");
    if (deleteButton) {
      deleteButton.addEventListener("click", () => deleteTraining(session.id));
    }
  }

  if (canAar) {
    document.getElementById("save-aar-button").addEventListener("click", () => saveAar(session.id));
  }
}

function renderAdminTrainingControls(session) {
  return `
    <details class="training-v2-details" open>
      <summary>Administrator Training Controls</summary>

      <div class="admin-training-controls">
        <div class="admin-warning">
          These controls are restricted to active profiles with the ADMIN role.
          Postponing a training shifts both the start time and end time by the selected amount.
        </div>

        <div class="admin-control-section">
          <h4>Edit Training</h4>

          <div class="form-grid">
            <div class="form-group">
              <label for="admin-edit-category">Category</label>
              <select id="admin-edit-category">
                <option value="PRO_DEVELOPMENT" ${session.category === "PRO_DEVELOPMENT" ? "selected" : ""}>
                  Pro Development
                </option>

                <option value="UNIT_WIDE" ${session.category === "UNIT_WIDE" ? "selected" : ""}>
                  Unit Wide Training
                </option>

                <option value="INNER_TEAM" ${session.category === "INNER_TEAM" ? "selected" : ""}>
                  Inner Team
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>Current Status</label>
              <input
                type="text"
                value="${escapeHtml(formatStatusLabel(session.status))}"
                disabled
              >
            </div>

            <div class="form-group full">
              <label for="admin-edit-title">Title</label>
              <input
                id="admin-edit-title"
                type="text"
                maxlength="250"
                value="${escapeHtml(session.title || "")}"
              >
            </div>

            <div class="form-group">
              <label for="admin-edit-start">Start</label>
              <input
                id="admin-edit-start"
                type="datetime-local"
                value="${escapeHtml(toDateTimeLocalValue(session.start_at))}"
              >
            </div>

            <div class="form-group">
              <label for="admin-edit-end">End</label>
              <input
                id="admin-edit-end"
                type="datetime-local"
                value="${escapeHtml(toDateTimeLocalValue(session.end_at))}"
              >
            </div>

            <div class="form-group full">
              <label for="admin-edit-location">Location</label>
              <input
                id="admin-edit-location"
                type="text"
                maxlength="500"
                value="${escapeHtml(session.location || "")}"
              >
            </div>

            <div class="form-group full">
              <label for="admin-edit-description">Description</label>
              <textarea id="admin-edit-description">${escapeHtml(session.description || "")}</textarea>
            </div>
          </div>

          <div class="button-row">
            <button
              id="admin-save-training-edit"
              class="btn btn-primary"
              type="button"
            >
              Save Training Changes
            </button>
          </div>
        </div>

        <div class="admin-control-section">
          <h4>Postpone Training</h4>

          <div class="postpone-grid">
            <div class="form-group">
              <label for="admin-postpone-amount">Amount</label>
              <input
                id="admin-postpone-amount"
                type="number"
                min="1"
                step="1"
                inputmode="numeric"
                placeholder="Example: 2"
              >
            </div>

            <div class="form-group">
              <label for="admin-postpone-unit">Unit</label>
              <select id="admin-postpone-unit">
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
              </select>
            </div>

            <div class="form-group">
              <button
                id="admin-postpone-training"
                class="btn btn-secondary"
                type="button"
              >
                Postpone
              </button>
            </div>
          </div>

          <div class="muted">
            Current start: ${escapeHtml(formatDateTime(session.start_at))}
          </div>
        </div>

        <div class="admin-control-section">
          <h4>Cancel Training</h4>

          <div class="admin-cancel-row">
            <span>
              This marks the training as cancelled. It does not delete the session or its attendance records.
            </span>

            <button
              id="admin-cancel-training"
              class="btn btn-danger"
              type="button"
              ${session.status === "CANCELLED" ? "disabled" : ""}
            >
              ${session.status === "CANCELLED" ? "Training Cancelled" : "Cancel Training"}
            </button>
          </div>
        </div>

        <div id="admin-training-action-status" class="admin-action-status"></div>
      </div>
    </details>
  `;
}

function bindAdminTrainingControls(session) {
  if (!isAdmin()) return;

  const saveEditButton = document.getElementById("admin-save-training-edit");
  const postponeButton = document.getElementById("admin-postpone-training");
  const cancelButton = document.getElementById("admin-cancel-training");

  saveEditButton?.addEventListener("click", () => {
    saveAdminTrainingEdit(session.id);
  });

  postponeButton?.addEventListener("click", () => {
    postponeAdminTraining(session.id);
  });

  cancelButton?.addEventListener("click", () => {
    cancelAdminTraining(session.id);
  });
}

async function saveAdminTrainingEdit(sessionId) {
  if (!isAdmin()) {
    showAdminActionStatus("Only administrators may edit training sessions.", false);
    return;
  }

  const categoryInput = document.getElementById("admin-edit-category");
  const titleInput = document.getElementById("admin-edit-title");
  const startInput = document.getElementById("admin-edit-start");
  const endInput = document.getElementById("admin-edit-end");
  const locationInput = document.getElementById("admin-edit-location");
  const descriptionInput = document.getElementById("admin-edit-description");
  const saveButton = document.getElementById("admin-save-training-edit");

  const title = titleInput.value.trim();
  const startValue = startInput.value;
  const endValue = endInput.value;

  if (!title) {
    showAdminActionStatus("Training title is required.", false);
    titleInput.focus();
    return;
  }

  if (!startValue) {
    showAdminActionStatus("Training start time is required.", false);
    startInput.focus();
    return;
  }

  const startDate = new Date(startValue);
  const endDate = endValue ? new Date(endValue) : null;

  if (Number.isNaN(startDate.getTime())) {
    showAdminActionStatus("The selected start time is invalid.", false);
    return;
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    showAdminActionStatus("The selected end time is invalid.", false);
    return;
  }

  if (endDate && endDate < startDate) {
    showAdminActionStatus("The end time cannot be before the start time.", false);
    return;
  }

  setButtonLoading(saveButton, true, "Saving...");

  const { error } = await supabase.rpc("admin_update_training_session", {
    p_session_id: Number(sessionId),
    p_category: categoryInput.value,
    p_title: title,
    p_description: descriptionInput.value.trim(),
    p_start_at: startDate.toISOString(),
    p_end_at: endDate ? endDate.toISOString() : null,
    p_location: locationInput.value.trim()
  });

  setButtonLoading(saveButton, false, "Save Training Changes");

  if (error) {
    showAdminActionStatus(
      "Training update failed: " + error.message,
      false
    );
    return;
  }

  showAdminActionStatus("Training session updated.", true);
  await loadData();
}

async function postponeAdminTraining(sessionId) {
  if (!isAdmin()) {
    showAdminActionStatus("Only administrators may postpone training sessions.", false);
    return;
  }

  const amountInput = document.getElementById("admin-postpone-amount");
  const unitInput = document.getElementById("admin-postpone-unit");
  const postponeButton = document.getElementById("admin-postpone-training");

  const amount = Number(amountInput.value);
  const unit = unitInput.value;

  if (!Number.isInteger(amount) || amount <= 0) {
    showAdminActionStatus(
      "Enter a whole number greater than zero.",
      false
    );
    amountInput.focus();
    return;
  }

  if (unit !== "minutes" && unit !== "hours") {
    showAdminActionStatus(
      "Postponement unit must be minutes or hours.",
      false
    );
    return;
  }

  const session = state.sessions.find(
    item => Number(item.id) === Number(sessionId)
  );

  if (!session) {
    showAdminActionStatus("Training session could not be found.", false);
    return;
  }

  const amountLabel = `${amount} ${unit}`;
  const currentStart = formatDateTime(session.start_at);

  const confirmed = confirm(
    `Postpone "${session.title}" by ${amountLabel}?\n\n`
    + `Current start: ${currentStart}\n\n`
    + "The start and end times will both be moved."
  );

  if (!confirmed) return;

  setButtonLoading(postponeButton, true, "Postponing...");

  const { error } = await supabase.rpc(
    "admin_postpone_training_session",
    {
      p_session_id: Number(sessionId),
      p_amount: amount,
      p_unit: unit
    }
  );

  setButtonLoading(postponeButton, false, "Postpone");

  if (error) {
    showAdminActionStatus(
      "Postponement failed: " + error.message,
      false
    );
    return;
  }

  showAdminActionStatus(
    `Training postponed by ${amountLabel}.`,
    true
  );

  await loadData();
}

async function cancelAdminTraining(sessionId) {
  if (!isAdmin()) {
    showAdminActionStatus("Only administrators may cancel training sessions.", false);
    return;
  }

  const session = state.sessions.find(
    item => Number(item.id) === Number(sessionId)
  );

  if (!session) {
    showAdminActionStatus("Training session could not be found.", false);
    return;
  }

  if (session.status === "CANCELLED") {
    showAdminActionStatus("This training is already cancelled.", false);
    return;
  }

  const confirmed = confirm(
    `Cancel "${session.title}"?\n\n`
    + "The session will remain in the database and its attendance records will not be deleted."
  );

  if (!confirmed) return;

  const cancelButton = document.getElementById("admin-cancel-training");

  setButtonLoading(cancelButton, true, "Cancelling...");

  const { error } = await supabase.rpc(
    "admin_cancel_training_session",
    {
      p_session_id: Number(sessionId)
    }
  );

  setButtonLoading(cancelButton, false, "Cancel Training");

  if (error) {
    showAdminActionStatus(
      "Cancellation failed: " + error.message,
      false
    );
    return;
  }

  showAdminActionStatus("Training session cancelled.", true);
  await loadData();
}

function showAdminActionStatus(message, ok) {
  const statusElement = document.getElementById(
    "admin-training-action-status"
  );

  if (!statusElement) {
    if (!ok) alert(message);
    return;
  }

  statusElement.textContent = message;
  statusElement.className = `admin-action-status visible ${ok ? "ok" : "err"}`;
}

function toDateTimeLocalValue(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const pad = number => String(number).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes())
  ].join("");
}

function formatStatusLabel(status) {
  if (status === "PRO_DEVELOPMENT") return "Pro Development";
  if (status === "UNIT_WIDE") return "Unit Wide Training";
  if (status === "INNER_TEAM") return "Inner Team";

  return String(status || "")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function getLoaForSession(session) {
  if (!session?.start_at) return [];

  const sessionDate = new Date(session.start_at).toISOString().slice(0, 10);

  return state.loaRequests.filter(loa => {
    return loa.start_date <= sessionDate && loa.end_date >= sessionDate;
  });
}

function renderProfileCards(profiles) {
  if (!profiles.length) return `<span class="muted">None</span>`;

  return profiles.map(profile => `
    <div class="profile-mini-card">
      <strong>${escapeHtml(profile.display_name)}</strong>
      <span>${escapeHtml(profile.naval_rank || "No rank")}${profile.callsign ? ` [${escapeHtml(profile.callsign)}]` : ""}</span>
    </div>
  `).join("");
}

function renderDraggableAttendanceRows(rows, attendance) {
  if (!rows.length) return `<span class="muted">None</span>`;

  return rows.map(row => {
    const profile = state.profiles.find(p => p.id === row.user_id);

    return `
      <div
        class="admin-attendance-user"
        draggable="true"
        data-user-id="${escapeHtml(row.user_id)}"
        data-current-attendance="${escapeHtml(attendance)}"
      >
        ${escapeHtml(profileLabel(profile, row.user_id))}
      </div>
    `;
  }).join("");
}

function renderDraggableProfiles(profiles) {
  if (!profiles.length) return `<span class="muted">None</span>`;

  return profiles.map(profile => `
    <div
      class="admin-attendance-user"
      draggable="true"
      data-user-id="${escapeHtml(profile.id)}"
      data-current-attendance=""
    >
      ${escapeHtml(profileLabel(profile, profile.id))}
    </div>
  `).join("");
}

function bindAdminAttendanceBoard(sessionId) {
  document.querySelectorAll(".admin-attendance-user").forEach(card => {
    card.addEventListener("dragstart", event => {
      event.dataTransfer.setData("text/plain", card.dataset.userId);
      event.dataTransfer.effectAllowed = "move";
    });
  });

  document.querySelectorAll(".admin-drop-zone").forEach(zone => {
    zone.addEventListener("dragover", event => {
      event.preventDefault();
      zone.classList.add("drag-over");
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("drag-over");
    });

    zone.addEventListener("drop", async event => {
      event.preventDefault();
      zone.classList.remove("drag-over");

      const userId = event.dataTransfer.getData("text/plain");
      const attendance = zone.dataset.adminAttendance || null;

      if (!userId) return;

      await adminSetAttendance(sessionId, userId, attendance);
    });
  });
}

async function adminSetAttendance(sessionId, userId, attendance) {
  const result = await supabase.rpc("admin_set_training_response", {
    p_session_id: Number(sessionId),
    p_user_id: userId,
    p_attendance: attendance
  });

  if (result.error) {
    alert("Admin attendance update failed: " + result.error.message);
    return;
  }

  await loadData();
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

function getAttendanceCounts(session) {
  const rows = state.attendance.filter(
    attendanceRow =>
      Number(attendanceRow.session_id) === Number(session.id)
  );

  const loaUserIds = new Set(
    getLoaForSession(session)
      .map(loa => loa.requester_id)
      .filter(Boolean)
  );

  return {
    attending: rows.filter(
      attendanceRow => attendanceRow.attendance === "ATTENDING"
    ).length,

    notAttending: rows.filter(
      attendanceRow => attendanceRow.attendance === "NOT_ATTENDING"
    ).length,

    loaAbsent: loaUserIds.size
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

function renderSessionStatusControl(session) {
  if (!isAdmin()) {
    return statusBadge(session.status);
  }

  const badgeClass = getStatusBadgeClass(session.status);

  return `
    <select
      class="session-status-select badge ${badgeClass}"
      data-session-status="${escapeHtml(session.id)}"
      aria-label="Change status for ${escapeHtml(session.title || "training session")}"
    >
      <option
        value="SCHEDULED"
        ${session.status === "SCHEDULED" ? "selected" : ""}
      >
        Scheduled
      </option>

      <option
        value="DRAFT"
        ${session.status === "DRAFT" ? "selected" : ""}
      >
        Draft
      </option>

      <option
        value="COMPLETED"
        ${session.status === "COMPLETED" ? "selected" : ""}
      >
        Completed
      </option>

      <option
        value="CANCELLED"
        ${session.status === "CANCELLED" ? "selected" : ""}
      >
        Cancelled
      </option>
    </select>
  `;
}

function getStatusBadgeClass(status) {
  if (status === "COMPLETED") return "badge-green";
  if (status === "CANCELLED") return "badge-red";
  if (status === "POSTPONED") return "badge-yellow";
  if (status === "DRAFT") return "badge-yellow";

  return "badge-blue";
}

async function updateSessionStatusFromList(
  sessionId,
  newStatus,
  selectElement
) {
  if (!isAdmin()) {
    alert("Only administrators may change training status.");
    await loadData();
    return;
  }

  const allowedStatuses = [
    "SCHEDULED",
    "DRAFT",
    "COMPLETED",
    "CANCELLED"
  ];

  if (!allowedStatuses.includes(newStatus)) {
    alert("Invalid training status.");
    await loadData();
    return;
  }

  const session = state.sessions.find(
    item => Number(item.id) === Number(sessionId)
  );

  if (!session) {
    alert("Training session could not be found.");
    await loadData();
    return;
  }

  const previousStatus = session.status;

  selectElement.disabled = true;

  const { error } = await supabase
    .from("training_sessions")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString()
    })
    .eq("id", sessionId);

  if (error) {
    selectElement.value = previousStatus;
    selectElement.disabled = false;

    alert(
      "Training status update failed: " + error.message
    );

    return;
  }

  session.status = newStatus;
  selectElement.disabled = false;

  await loadData();
}

function statusBadge(status) {
  if (status === "COMPLETED") {
    return `<span class="badge badge-green">Completed</span>`;
  }

  if (status === "CANCELLED") {
    return `<span class="badge badge-red">Cancelled</span>`;
  }

  if (status === "POSTPONED") {
    return `<span class="badge badge-yellow">Postponed</span>`;
  }

  if (status === "DRAFT") {
    return `<span class="badge badge-yellow">Draft</span>`;
  }

  return `<span class="badge badge-blue">Scheduled</span>`;
}

function attendanceLabel(value) {
  if (value === "ATTENDING") return "Attending";
  if (value === "NOT_ATTENDING") return "Not Attending";

  return "No response";
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);

  return `${formatted} ET`;
}

function formatViewerLocalTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(date);
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