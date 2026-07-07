import { supabase } from "/js/auth.js";
import { renderPortalLayout } from "/js/portal-layout.js";

renderPortalLayout("admin");

const DEFAULT_AVATAR = "../../nsw.png";
const ADMIN_EMAILS = ["evans@navy.mil", "carver@navy.mil"];

const memberList = document.getElementById("member-list");
const adminWarning = document.getElementById("admin-warning");
const adminContent = document.getElementById("admin-content");
const statusLine = document.getElementById("status-line");
const sessionLabel = document.getElementById("session-label");
const sidebarName = document.getElementById("sidebar-name");
const sidebarRole = document.getElementById("sidebar-role");
const navAvatar = document.getElementById("nav-avatar");

const form = document.getElementById("admin-profile-form");
const deleteBtn = document.getElementById("delete-profile-btn");
const profileIdInput = document.getElementById("profile-id");
const displayNameInput = document.getElementById("display-name");
const roleInput = document.getElementById("role");
const statusInput = document.getElementById("status");
const navalRankInput = document.getElementById("naval-rank");
const callsignInput = document.getElementById("callsign");
const steamNameInput = document.getElementById("steam-name");
const steamIdInput = document.getElementById("steam-id");
const discordNameInput = document.getElementById("discord-name");
const discordIdInput = document.getElementById("discord-id");
const profileNotesInput = document.getElementById("profile-notes");

const attendancePanel = document.getElementById("attendance-panel");
const attendanceSummary = document.getElementById("attendance-summary");
const attendanceDetails = document.getElementById("attendance-details");
const attendanceSessionFilter = document.getElementById("attendance-session-filter");
const attendanceStatusFilter = document.getElementById("attendance-status-filter");
const refreshAttendanceBtn = document.getElementById("refresh-attendance-btn");

const trainingHistoryPanel = document.getElementById("training-history-panel");

let authUser = null;
let currentProfile = null;
let members = [];
let selectedProfile = null;
let attendanceSummaryRows = [];
let attendanceDetailRows = [];
let trainingHistoryRows = [];

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || "").trim().toLowerCase());
}

function showSharedAdminNavigation() {
  document.querySelectorAll(".admin-only-link").forEach(link => { link.style.display = ""; });
}

function setStatus(message, type = "ok") {
  statusLine.textContent = message;
  statusLine.className = `status-line visible ${type}`;
}

function clearStatus() {
  statusLine.textContent = "";
  statusLine.className = "status-line";
}

function fallbackUserId(email) {
  if (!email || !email.includes("@")) return "unknown";
  return email.split("@")[0];
}

function setChrome(profile) {
  const displayName = profile.display_name || profile.user_id || fallbackUserId(authUser.email);
  if (sessionLabel) sessionLabel.textContent = displayName;
  if (sidebarName) sidebarName.textContent = displayName;
  if (sidebarRole) sidebarRole.textContent = profile.role || "MEMBER";
  if (navAvatar) navAvatar.src = profile.avatar_url || DEFAULT_AVATAR;
}

function showAccessDenied() {
  adminWarning.style.display = "block";
  adminContent.style.display = "none";
}

function showAdminContent() {
  adminWarning.style.display = "none";
  adminContent.style.display = "grid";
}

function renderMemberList() {
  if (!members.length) {
    memberList.innerHTML = `<div class="notice-box">No profiles found.</div>`;
    return;
  }

  memberList.innerHTML = members.map(member => {
    const activeClass = selectedProfile && selectedProfile.id === member.id ? "active" : "";
    const summary = attendanceSummaryRows.find(row => row.profile_id === member.id);
    const compliance = summary ? summary.compliance_status : "NO_DATA";
    const percent = summary ? formatPercent(summary.overall_percent) : "N/A";

    return `
      <div class="member-row ${activeClass}" data-profile-id="${escapeHtml(member.id)}">
        <strong>${escapeHtml(member.display_name || member.user_id)}</strong>
        <span>${escapeHtml(member.naval_rank || "Candidate")} | ${escapeHtml(member.callsign || "Candidate")}</span><br>
        <span class="muted">${escapeHtml(member.status || "ACTIVE")} | Attendance ${escapeHtml(percent)} | ${escapeHtml(compliance)}</span>
      </div>
    `;
  }).join("");

  memberList.querySelectorAll("[data-profile-id]").forEach(row => {
    row.addEventListener("click", () => {
      const member = members.find(item => item.id === row.dataset.profileId);
      if (member) selectProfile(member);
    });
  });
}

function renderTrainingHistory() {
  if (!selectedProfile || !trainingHistoryPanel) return;

  const rows = trainingHistoryRows
    .filter(row => row.profile_id === selectedProfile.id)
    .sort((a, b) => new Date(b.start_at) - new Date(a.start_at));

  const total = rows.length;

  const attended = rows.filter(row => {
    return ["PRESENT", "LATE", "LEFT_EARLY", "PARTIAL"].includes(row.resolved_status);
  }).length;

  const lateRows = rows.filter(row => row.resolved_status === "LATE");
  const lateCount = lateRows.length;
  const totalLateMinutes = lateRows.reduce((sum, row) => sum + Number(row.minutes_late || 0), 0);

  const loa = rows.filter(row => row.resolved_status === "LOA").length;
  const percent = total > 0 ? ((attended / total) * 100).toFixed(1) : "0.0";
  const lastTen = rows.slice(0, 10);

  trainingHistoryPanel.innerHTML = `
    <h3>Training History</h3>

    <div class="training-history-cards">
      <div class="training-history-card">
        <span>Total Trainings</span>
        <strong>${escapeHtml(total)}</strong>
      </div>

      <div class="training-history-card">
        <span>Attendance</span>
        <strong>${escapeHtml(percent)}%</strong>
      </div>

      <div class="training-history-card">
        <span>Times Late</span>
        <strong>${escapeHtml(lateCount)}</strong>
      </div>

      <div class="training-history-card">
        <span>Late Minutes</span>
        <strong>${escapeHtml(totalLateMinutes)}</strong>
      </div>

      <div class="training-history-card">
        <span>LOA</span>
        <strong>${escapeHtml(loa)}</strong>
      </div>
    </div>

    <div class="training-history-last10">
      ${lastTen.length ? lastTen.map(renderHistoryPill).join("") : `<span class="muted">No completed training history.</span>`}
    </div>
  `;
}

function renderHistoryPill(row) {
  const status = row.resolved_status || "NO_RESPONSE";

  let label = "✕";
  let cls = "bad";

  if (status === "PRESENT") {
    label = "✓";
    cls = "good";
  } else if (status === "LATE") {
    label = `LATE ${Number(row.minutes_late || 0)}m`;
    cls = "late";
  } else if (["LEFT_EARLY", "PARTIAL"].includes(status)) {
    label = "PARTIAL";
    cls = "neutral";
  } else if (status === "LOA") {
    label = "LOA";
    cls = "loa";
  } else if (status === "NO_RESPONSE") {
    label = "-";
    cls = "neutral";
  }

  return `
    <span class="history-pill ${cls}" title="${escapeHtml(row.title)} | ${escapeHtml(formatDateTime(row.start_at))} | ${escapeHtml(status)}">
      ${escapeHtml(label)}
    </span>
  `;
}

function selectProfile(profile) {
  selectedProfile = profile;
  profileIdInput.value = profile.id;
  displayNameInput.value = profile.display_name || "";
  roleInput.value = profile.role || "MEMBER";
  statusInput.value = profile.status || "ACTIVE";
  navalRankInput.value = profile.naval_rank || "Candidate";
  callsignInput.value = profile.callsign || "";
  steamNameInput.value = profile.steam_name || "";
  steamIdInput.value = profile.steam_id || "";
  discordNameInput.value = profile.discord_name || "";
  discordIdInput.value = profile.discord_id || "";
  profileNotesInput.value = profile.profile_notes || "";
  clearStatus();
  renderMemberList();
  renderAttendancePanel();
  renderTrainingHistory();
}

async function loadSessionAndProfile() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    window.location.href = "/login/";
    return false;
  }

  authUser = sessionData.session.user;
  const fallbackProfile = {
    id: authUser.id,
    user_id: fallbackUserId(authUser.email),
    display_name: fallbackUserId(authUser.email),
    role: "MEMBER",
    avatar_url: null
  };

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, user_id, display_name, role, status, avatar_url")
    .eq("id", authUser.id)
    .single();

  currentProfile = profileData || fallbackProfile;
  setChrome(currentProfile);

  if (!isAdminEmail(authUser.email)) {
    showAccessDenied();
    return false;
  }

  showSharedAdminNavigation();
  showAdminContent();
  return true;
}

async function loadMembers() {
  clearStatus();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,user_id,display_name,role,status,avatar_url,naval_rank,callsign,steam_name,steam_id,discord_name,discord_id,profile_notes")
    .order("display_name", { ascending: true });

  if (error) {
    console.error(error);
    setStatus("Failed to load members.", "err");
    return;
  }

  members = data || [];
  await loadAttendanceData();

  if (members.length) selectProfile(selectedProfile ? members.find(m => m.id === selectedProfile.id) || members[0] : members[0]);
  else renderMemberList();
}

async function loadAttendanceData() {
  attendanceSummaryRows = [];
  attendanceDetailRows = [];
  trainingHistoryRows = [];

  const [detailsResult, historyResult] = await Promise.all([
    supabase
      .from("member_training_history")
      .select("*")
      .order("start_at", { ascending: false }),

    supabase
      .from("member_training_history")
      .select("*")
      .order("start_at", { ascending: false })
  ]);

  if (detailsResult.error) {
    console.error("Attendance details failed:", detailsResult.error);
    attendanceDetailRows = [];
  } else {
    attendanceDetailRows = detailsResult.data || [];
  }

  if (historyResult.error) {
    console.error("Training history failed:", historyResult.error);
    trainingHistoryRows = [];
  } else {
    trainingHistoryRows = historyResult.data || [];
  }
}

function renderAttendancePanel() {
  if (!selectedProfile || !attendancePanel || !attendanceDetails) return;

  const statusFilter = attendanceStatusFilter?.value || "";

  let rows = attendanceDetailRows
    .filter(row => row.profile_id === selectedProfile.id)
    .sort((a, b) => new Date(b.start_at) - new Date(a.start_at));

  if (statusFilter) {
    rows = rows.filter(row => row.resolved_status === statusFilter);
  }

  const lateRows = rows.filter(row => row.resolved_status === "LATE");
  const totalLateMinutes = lateRows.reduce((sum, row) => sum + Number(row.minutes_late || 0), 0);

  if (attendanceSummary) {
    attendanceSummary.innerHTML = `
      <div class="attendance-cards">
        ${metricCard("Rows", rows.length)}
        ${metricCard("Times Late", lateRows.length)}
        ${metricCard("Late Minutes", totalLateMinutes)}
        ${metricCard("Selected", selectedProfile.display_name || selectedProfile.user_id)}
      </div>
    `;
  }

  if (!rows.length) {
    attendanceDetails.innerHTML = `<div class="notice-box">No completed training rows for this member.</div>`;
    return;
  }

  attendanceDetails.innerHTML = `
    <div class="attendance-table-wrap">
      <table class="attendance-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Training</th>
            <th>Current</th>
            <th>Mark As</th>
            <th>Late Minutes</th>
            <th>Admin Note</th>
            <th>Save</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(renderAttendanceRow).join("")}
        </tbody>
      </table>
    </div>
  `;

  attendanceDetails.querySelectorAll("[data-save-attendance]").forEach(button => {
    button.addEventListener("click", () => saveAttendanceMark(button.dataset.saveAttendance));
  });
}

function metricCard(label, value) {
  return `<div class="attendance-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function populateSessionFilter() {
  if (!attendanceSessionFilter || attendanceSessionFilter.dataset.loaded === "1") return;

  const seen = new Set();
  const options = [`<option value="">All sessions</option>`];
  attendanceDetailRows.forEach(row => {
    if (seen.has(row.session_id)) return;
    seen.add(row.session_id);
    options.push(`<option value="${escapeHtml(row.session_id)}">${escapeHtml(formatDateTime(row.start_at))} - ${escapeHtml(row.title)}</option>`);
  });
  attendanceSessionFilter.innerHTML = options.join("");
  attendanceSessionFilter.dataset.loaded = "1";
}

function renderAttendanceDetails() {
  if (!selectedProfile) return;

  const sessionFilter = attendanceSessionFilter?.value || "";
  const statusFilter = attendanceStatusFilter?.value || "";
  let rows = attendanceDetailRows.filter(row => row.profile_id === selectedProfile.id);

  if (sessionFilter) rows = rows.filter(row => String(row.session_id) === String(sessionFilter));
  if (statusFilter) rows = rows.filter(row => row.resolved_status === statusFilter);

  if (!rows.length) {
    attendanceDetails.innerHTML = `<div class="notice-box">No matching attendance rows.</div>`;
    return;
  }

  attendanceDetails.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Session</th>
          <th>Mandatory</th>
          <th>RSVP</th>
          <th>Actual</th>
          <th>Late</th>
          <th>Left Early</th>
          <th>Note</th>
          <th>Save</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => renderAttendanceRow(row)).join("")}
      </tbody>
    </table>
  `;

  attendanceDetails.querySelectorAll("[data-save-attendance]").forEach(button => {
    button.addEventListener("click", () => saveAttendanceMark(button.dataset.saveAttendance));
  });
}

function renderAttendanceRow(row) {
  const id = `${row.session_id}-${row.profile_id}`;
  const currentStatus = row.resolved_status || "NO_RESPONSE";

  return `
    <tr data-attendance-row="${escapeHtml(id)}">
      <td>${escapeHtml(formatDateTime(row.start_at))}</td>

      <td>
        <strong>${escapeHtml(row.title)}</strong><br>
        <span class="muted">${escapeHtml(row.category || "-")}</span>
      </td>

      <td>
        <strong>${escapeHtml(currentStatus)}</strong>
        ${Number(row.minutes_late || 0) > 0 ? `<br><span class="muted">${escapeHtml(row.minutes_late)} min late</span>` : ""}
      </td>

      <td>
        <select data-field="actual_status">
          ${statusOption("PRESENT", currentStatus)}
          ${statusOption("LATE", currentStatus)}
          ${statusOption("LEFT_EARLY", currentStatus)}
          ${statusOption("PARTIAL", currentStatus)}
          ${statusOption("EXCUSED", currentStatus)}
          ${statusOption("LOA", currentStatus)}
          ${statusOption("ABSENT", currentStatus)}
          ${statusOption("NO_SHOW", currentStatus)}
        </select>
      </td>

      <td>
        <input
          class="attendance-late-input"
          data-field="minutes_late"
          type="number"
          min="0"
          step="1"
          value="${escapeHtml(row.minutes_late || 0)}">
      </td>

      <td>
        <input
          class="attendance-note-input"
          data-field="admin_note"
          type="text"
          value="${escapeHtml(row.admin_note || "")}"
          maxlength="1000">
      </td>

      <td>
        <button
          class="btn btn-primary btn-small"
          type="button"
          data-save-attendance="${escapeHtml(id)}"
          data-session-id="${escapeHtml(row.session_id)}"
          data-profile-id="${escapeHtml(row.profile_id)}">
          Save
        </button>
      </td>
    </tr>
  `;
}

function statusOption(value, selected) {
  return `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value)}</option>`;
}

async function saveAttendanceMark(rowId) {
  const button = attendanceDetails.querySelector(`[data-save-attendance="${CSS.escape(rowId)}"]`);
  const row = attendanceDetails.querySelector(`[data-attendance-row="${CSS.escape(rowId)}"]`);

  if (!button || !row) return;

  button.disabled = true;
  button.textContent = "Saving";

  const actualStatusInput = row.querySelector('[data-field="actual_status"]');
  const minutesLateInput = row.querySelector('[data-field="minutes_late"]');
  const adminNoteInput = row.querySelector('[data-field="admin_note"]');

  const actualStatus = actualStatusInput ? actualStatusInput.value : "PRESENT";
  const minutesLate = minutesLateInput ? Number(minutesLateInput.value || 0) : 0;
  const adminNote = adminNoteInput ? adminNoteInput.value.trim() : "";

  const { error } = await supabase.rpc("admin_mark_training_attendance", {
    target_session_id: Number(button.dataset.sessionId),
    target_profile_id: button.dataset.profileId,
    new_actual_status: actualStatus,
    new_minutes_late: actualStatus === "LATE" ? minutesLate : 0,
    new_minutes_left_early: 0,
    new_excused: actualStatus === "EXCUSED" || actualStatus === "LOA",
    new_admin_note: adminNote
  });

  button.disabled = false;
  button.textContent = "Save";

  if (error) {
    setStatus(error.message || "Attendance save failed.", "err");
    return;
  }

  setStatus("Attendance updated.", "ok");

  await loadAttendanceData();
  renderMemberList();
  renderAttendancePanel();
  renderTrainingHistory();
}

async function saveSelectedProfile(event) {
  event.preventDefault();
  clearStatus();
  if (!selectedProfile) {
    setStatus("Select a member first.", "err");
    return;
  }

  const { data, error } = await supabase.rpc("admin_update_profile", {
    target_profile_id: profileIdInput.value,
    new_display_name: displayNameInput.value,
    new_status: statusInput.value,
    new_role: roleInput.value,
    new_naval_rank: navalRankInput.value,
    new_callsign: callsignInput.value,
    new_steam_name: steamNameInput.value,
    new_steam_id: steamIdInput.value,
    new_discord_name: discordNameInput.value,
    new_discord_id: discordIdInput.value,
    new_profile_notes: profileNotesInput.value
  });

  if (error) {
    console.error(error);
    setStatus(error.message || "Failed to save profile.", "err");
    return;
  }

  members = members.map(member => member.id === data.id ? data : member);
  selectProfile(data);
  setStatus("Profile updated.", "ok");
}

async function deleteSelectedProfile() {
  clearStatus();
  if (!selectedProfile) {
    setStatus("Select a member first.", "err");
    return;
  }

  if (!window.confirm(`Delete profile for ${selectedProfile.display_name || selectedProfile.user_id}? This removes the public.profiles row only.`)) return;

  const { error } = await supabase.rpc("admin_delete_profile", { target_profile_id: selectedProfile.id });
  if (error) {
    console.error(error);
    setStatus(error.message || "Failed to delete profile.", "err");
    return;
  }

  members = members.filter(member => member.id !== selectedProfile.id);
  selectedProfile = null;
  if (members.length) selectProfile(members[0]);
  else {
    form.reset();
    renderMemberList();
  }
  setStatus("Profile deleted. Supabase Auth user was not deleted.", "ok");
}

async function doLogout() {
  await supabase.auth.signOut();
  window.location.href = "/login/";
}

function formatPercent(value) {
  if (value === null || value === undefined) return "N/A";
  const number = Number(value);
  if (!Number.isFinite(number)) return "N/A";
  return `${number.toFixed(1)}%`;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "2-digit",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

form.addEventListener("submit", saveSelectedProfile);
deleteBtn.addEventListener("click", deleteSelectedProfile);
refreshAttendanceBtn?.addEventListener("click", async () => {
  await loadAttendanceData();
  renderMemberList();
  renderAttendancePanel();
});
attendanceSessionFilter?.addEventListener("change", renderAttendanceDetails);
attendanceStatusFilter?.addEventListener("change", renderAttendanceDetails);

window.doLogout = doLogout;

const allowed = await loadSessionAndProfile();
if (allowed) await loadMembers();
