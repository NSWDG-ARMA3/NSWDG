import { supabase } from "/js/auth.js";
import { bootPortalChrome, escapeHtml } from "/js/portal-common.js";
import { renderPortalLayout } from "/js/portal-layout.js";

renderPortalLayout("loa");

let authUser = null;
let profile = null;
let profilesById = new Map();

const loaForm = document.getElementById("loa-form");
const startDateInput = document.getElementById("start-date");
const endDateInput = document.getElementById("end-date");
const reasonInput = document.getElementById("reason");
const refreshBtn = document.getElementById("refresh-btn");
const tableBody = document.getElementById("loa-table-body");
const calendarEl = document.getElementById("loa-calendar");
const calendarSummaryEl = document.getElementById("loa-calendar-summary");
const calendarMonthInput = document.getElementById("loa-calendar-month");
const prevMonthBtn = document.getElementById("loa-prev-month");
const nextMonthBtn = document.getElementById("loa-next-month");
const currentMonthBtn = document.getElementById("loa-current-month");
const leadershipLoaPanel = document.getElementById("leadership-loa-panel");
const leadershipLoaForm = document.getElementById("leadership-loa-form");
const leadershipLoaMemberInput = document.getElementById("leadership-loa-member");
const leadershipLoaStartDateInput = document.getElementById("leadership-loa-start-date");
const leadershipLoaEndDateInput = document.getElementById("leadership-loa-end-date");
const leadershipLoaReasonInput = document.getElementById("leadership-loa-reason");
const leadershipLoaSubmitBtn = document.getElementById("leadership-loa-submit");
const leadershipLoaStatus = document.getElementById("leadership-loa-status");

let loaRows = [];

function setStatus(message, ok) {
  const el = document.getElementById("status-line");
  el.textContent = message;
  el.className = "status-line visible " + (ok ? "ok" : "err");
}

function setLeadershipLoaStatus(message, ok) {
  if (!leadershipLoaStatus) return;

  leadershipLoaStatus.textContent = message;
  leadershipLoaStatus.className =
    "status-line visible " + (ok ? "ok" : "err");
}

function normalizedRole(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizedCallsign(value) {
  return String(value || "").trim().toUpperCase();
}

function hasUnitWideLoaCreationAccess() {
  if (!profile) return false;

  const role = normalizedRole(profile.role);
  const callsign = normalizedCallsign(profile.callsign);

  const unitWideRoles = [
    "ADMIN",
    "SUPERADMIN",
    "HQ",
    "TROOP_HQ",
    "TROOPHQ"
  ];

  return unitWideRoles.includes(role)
    || callsign === "E31"
    || callsign === "E32";
}

function leadershipTeamPrefix() {
  if (!profile) return null;

  const callsign = normalizedCallsign(profile.callsign);

  if (callsign === "EG1") return "EG";
  if (callsign === "EH1") return "EH";
  if (callsign === "EI1") return "EI";

  return null;
}

function canCreateLoaForMembers() {
  return hasUnitWideLoaCreationAccess()
    || leadershipTeamPrefix() !== null;
}

function canCreateLoaForProfile(targetProfile) {
  if (!authUser || !profile || !targetProfile) return false;

  if (targetProfile.id === authUser.id) {
    return false;
  }

  if (normalizedRole(targetProfile.status) !== "ACTIVE") {
    return false;
  }

  if (hasUnitWideLoaCreationAccess()) {
    return true;
  }

  const teamPrefix = leadershipTeamPrefix();

  if (!teamPrefix) {
    return false;
  }

  const targetCallsign = normalizedCallsign(targetProfile.callsign);

  return targetCallsign.startsWith(teamPrefix);
}

function statusBadge(status) {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "APPROVED") {
    return `<span class="badge badge-approved">Approved</span>`;
  }

  if (normalized === "DECLINED") {
    return `<span class="badge badge-declined">Declined</span>`;
  }

  if (normalized === "CANCELLED") {
    return `<span class="badge badge-cancelled">Cancelled</span>`;
  }

  return `<span class="badge badge-pending">Pending</span>`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value + "T00:00:00Z");
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function profileName(userId) {
  const row = profilesById.get(userId);
  return row?.display_name || "Unknown member";
}

function profileMeta(userId) {
  const row = profilesById.get(userId);
  if (!row) return "";

  const parts = [];
  if (row.naval_rank) parts.push(row.naval_rank);
  if (row.callsign) parts.push(row.callsign);

  return parts.join(" / ");
}

function canReviewLocally(row) {
  if (!authUser || !profile) return false;
  if (row.requester_id === authUser.id) return false;
  if (String(row.status || "").trim().toUpperCase() !== "PENDING") return false;

  const email = String(authUser.email || "").trim().toLowerCase();
  const reviewerCallsign = String(profile.callsign || "").trim().toUpperCase();

  if (email === "evans@navy.mil") return true;

  if (reviewerCallsign === "E31" || reviewerCallsign === "E32") return true;

  const requester = profilesById.get(row.requester_id);
  const requesterCallsign = String(requester?.callsign || "").trim().toUpperCase();

  const enablerCallsigns = [
    "EX1",
    "EN1",
    "ER1",
    "EY1",
    "EY2",
    "EY3",
    "EY4",
    "EU1",
    "EU2",
    "EP1",
    "EP2"
  ];
  if (enablerCallsigns.includes(requesterCallsign)) return false;

  const teamLeaders = ["EG1", "EH1", "EI1"];

  if (!teamLeaders.includes(reviewerCallsign)) return false;

  return reviewerCallsign.slice(0, 2) === requesterCallsign.slice(0, 2)
    && reviewerCallsign !== requesterCallsign;
}

function canCancelLocally(row) {
  return authUser && row.requester_id === authUser.id && row.status === "PENDING";
}

async function loadProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, naval_rank, callsign, role, status");

  if (error) {
    profilesById = new Map();
    return;
  }

  profilesById = new Map((data || []).map(row => [row.id, row]));

  populateLeadershipLoaMembers();
}

function populateLeadershipLoaMembers() {
  if (!leadershipLoaPanel || !leadershipLoaMemberInput) {
    return;
  }

  if (!canCreateLoaForMembers()) {
    leadershipLoaPanel.style.display = "none";
    leadershipLoaMemberInput.innerHTML =
      `<option value="">Select member...</option>`;
    return;
  }

  const eligibleMembers = Array.from(profilesById.values())
    .filter(canCreateLoaForProfile)
    .sort((a, b) => {
      const callsignA = normalizedCallsign(a.callsign);
      const callsignB = normalizedCallsign(b.callsign);

      if (callsignA !== callsignB) {
        return callsignA.localeCompare(callsignB);
      }

      return String(a.display_name || "").localeCompare(
        String(b.display_name || "")
      );
    });

  leadershipLoaPanel.style.display = "";

  const options = eligibleMembers.map(member => {
    const callsign = normalizedCallsign(member.callsign);
    const rank = String(member.naval_rank || "").trim();
    const name = String(member.display_name || "Unknown member").trim();

    const meta = [callsign, rank]
      .filter(Boolean)
      .join(" / ");

    const label = meta
      ? `${meta} - ${name}`
      : name;

    return `
      <option value="${escapeHtml(member.id)}">
        ${escapeHtml(label)}
      </option>
    `;
  }).join("");

  leadershipLoaMemberInput.innerHTML = `
    <option value="">Select member...</option>
    ${options}
  `;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function monthValue(date) {
  return date.toISOString().slice(0, 7);
}

function parseUtcDate(value) {
  return new Date(value + "T00:00:00Z");
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonthsToValue(value, amount) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return monthValue(date);
}

function requestOverlapsDate(row, dateKey) {
  return row.start_date <= dateKey && row.end_date >= dateKey;
}

function visibleCalendarRows() {
  return loaRows.filter(row => {
    const status = String(row.status || "").toUpperCase();
    return status === "APPROVED" || status === "PENDING";
  });
}

function renderLeaveCalendar() {
  if (!calendarEl || !calendarMonthInput) {
    return;
  }

  const value = calendarMonthInput.value || monthValue(new Date());
  const [year, month] = value.split("-").map(Number);

  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const lastOfMonth = new Date(Date.UTC(year, month, 0));

  const startOffset = firstOfMonth.getUTCDay();
  const gridStart = addDays(firstOfMonth, -startOffset);

  const rows = visibleCalendarRows();

  const monthStartKey = isoDate(firstOfMonth);
  const monthEndKey = isoDate(lastOfMonth);

  const monthRows = rows.filter(row => {
    return row.start_date <= monthEndKey && row.end_date >= monthStartKey;
  });

  const uniqueMembers = new Set(monthRows.map(row => row.requester_id));

  calendarSummaryEl.textContent =
    `${monthRows.length} active LOA request(s), ${uniqueMembers.size} member(s) affected this month.`;

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let html = dayNames.map(day => `
    <div class="loa-calendar-head">${day}</div>
  `).join("");

  for (let i = 0; i < 42; i++) {
    const current = addDays(gridStart, i);
    const dateKey = isoDate(current);
    const outside = current.getUTCMonth() !== firstOfMonth.getUTCMonth();

    const dayRows = rows
      .filter(row => requestOverlapsDate(row, dateKey))
      .sort((a, b) => {
        const nameA = profileName(a.requester_id);
        const nameB = profileName(b.requester_id);
        return nameA.localeCompare(nameB);
      });

    const entries = dayRows.length
      ? dayRows.map(row => {
        const status = String(row.status || "").toLowerCase();
        const meta = profileMeta(row.requester_id);
        const label = meta
          ? `${profileName(row.requester_id)} · ${meta}`
          : profileName(row.requester_id);

        return `
          <span class="loa-calendar-entry ${escapeHtml(status)}" title="${escapeHtml(row.reason)}">
            ${escapeHtml(label)}
          </span>
        `;
      }).join("")
      : `<div class="loa-calendar-empty">No LOA</div>`;

    html += `
      <div class="loa-calendar-day ${outside ? "outside" : ""}">
        <div class="loa-calendar-date">${current.getUTCDate()}</div>
        ${entries}
      </div>
    `;
  }

  calendarEl.innerHTML = html;
}

function renderRows(rows) {
  if (!rows.length) {
    tableBody.innerHTML = `<tr><td colspan="5">No LOA requests found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = rows.map(row => {
    const reviewer = row.reviewer_id ? profileName(row.reviewer_id) : "";
    const reviewerNote = row.reviewer_note ? escapeHtml(row.reviewer_note) : "";

    let reviewHtml = `<div class="small-muted">No action available.</div>`;

    if (canReviewLocally(row)) {
      reviewHtml = `
        <div class="review-box">
          <textarea id="review-note-${row.id}" placeholder="Approval or decline reason" maxlength="2000"></textarea>
          <div class="btn-row">
            <button class="btn btn-primary" type="button" data-review-id="${row.id}" data-review-status="APPROVED">Approve</button>
            <button class="btn btn-danger" type="button" data-review-id="${row.id}" data-review-status="DECLINED">Decline</button>
          </div>
        </div>
      `;
    } else if (canCancelLocally(row)) {
      reviewHtml = `
        <button class="btn btn-secondary" type="button" data-cancel-id="${row.id}">Cancel Request</button>
      `;
    } else if (row.reviewer_id) {
      reviewHtml = `
        <div class="small-muted">
          Reviewed by ${escapeHtml(reviewer)}<br>
          ${reviewerNote}
        </div>
      `;
    }

    return `
      <tr>
        <td>
          <strong>${escapeHtml(profileName(row.requester_id))}</strong><br>
          <span class="small-muted">${escapeHtml(profileMeta(row.requester_id))}</span>
        </td>
        <td>
          ${escapeHtml(formatDate(row.start_date))}<br>
          to<br>
          ${escapeHtml(formatDate(row.end_date))}
        </td>
        <td>${escapeHtml(row.reason)}</td>
        <td>${statusBadge(row.status)}</td>
        <td>${reviewHtml}</td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll("[data-review-id]").forEach(button => {
    button.addEventListener("click", () => {
      reviewLoa(
        Number(button.dataset.reviewId),
        button.dataset.reviewStatus
      );
    });
  });

  document.querySelectorAll("[data-cancel-id]").forEach(button => {
    button.addEventListener("click", () => {
      cancelLoa(Number(button.dataset.cancelId));
    });
  });
}

async function loadLoas() {
  tableBody.innerHTML = `<tr><td colspan="5">Loading...</td></tr>`;

  await loadProfiles();

  const { data, error } = await supabase
    .from("loa_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    tableBody.innerHTML = `<tr><td colspan="5">Failed to load LOA requests.</td></tr>`;
    setStatus(error.message, false);
    return;
  }

  loaRows = data || [];
  renderRows(loaRows);
  renderLeaveCalendar();
}

async function submitLoa(event) {
  event.preventDefault();

  const startDate = startDateInput.value;
  const endDate = endDateInput.value;
  const reason = reasonInput.value.trim();

  if (!startDate || !endDate || !reason) {
    setStatus("Start date, end date, and reason are required.", false);
    return;
  }

  if (endDate < startDate) {
    setStatus("End date cannot be before start date.", false);
    return;
  }

  const { error } = await supabase
    .from("loa_requests")
    .insert({
      requester_id: authUser.id,
      start_date: startDate,
      end_date: endDate,
      reason
    });

  if (error) {
    setStatus(error.message, false);
    return;
  }

  loaForm.reset();
  setStatus("LOA submitted.", true);
  await loadLoas();
}

async function submitLeadershipLoa(event) {
  event.preventDefault();

  if (!canCreateLoaForMembers()) {
    setLeadershipLoaStatus(
      "You do not have permission to create an LOA for another member.",
      false
    );
    return;
  }

  const requesterId = leadershipLoaMemberInput.value;
  const startDate = leadershipLoaStartDateInput.value;
  const endDate = leadershipLoaEndDateInput.value;
  const reason = leadershipLoaReasonInput.value.trim();

  if (!requesterId) {
    setLeadershipLoaStatus("Select a member.", false);
    return;
  }

  const targetProfile = profilesById.get(requesterId);

  if (!targetProfile || !canCreateLoaForProfile(targetProfile)) {
    setLeadershipLoaStatus(
      "You are not authorized to create an LOA for this member.",
      false
    );
    return;
  }

  if (!startDate || !endDate) {
    setLeadershipLoaStatus(
      "Start date and end date are required.",
      false
    );
    return;
  }

  if (endDate < startDate) {
    setLeadershipLoaStatus(
      "End date cannot be before start date.",
      false
    );
    return;
  }

  if (reason.length < 3) {
    setLeadershipLoaStatus(
      "Reason must contain at least 3 characters.",
      false
    );
    return;
  }

  leadershipLoaSubmitBtn.disabled = true;
  leadershipLoaSubmitBtn.textContent = "Creating...";

  const { error } = await supabase.rpc("create_loa_for_member", {
    target_requester_id: requesterId,
    target_start_date: startDate,
    target_end_date: endDate,
    target_reason: reason
  });

  leadershipLoaSubmitBtn.disabled = false;
  leadershipLoaSubmitBtn.textContent = "Create Member LOA";

  if (error) {
    setLeadershipLoaStatus(error.message, false);
    return;
  }

  leadershipLoaForm.reset();

  setLeadershipLoaStatus(
    `LOA created for ${targetProfile.display_name}.`,
    true
  );

  await loadLoas();
}

async function reviewLoa(id, newStatus) {
  const noteEl = document.getElementById(`review-note-${id}`);
  const reviewerNote = noteEl ? noteEl.value.trim() : "";

  if (reviewerNote.length < 3) {
    setStatus("Approval or decline reason is required.", false);
    return;
  }

  const { error } = await supabase.rpc("review_loa_request", {
    target_loa_id: id,
    new_status: newStatus,
    new_reviewer_note: reviewerNote
  });

  if (error) {
    setStatus(error.message, false);
    return;
  }

  setStatus(`LOA ${newStatus.toLowerCase()}.`, true);
  await loadLoas();
}

async function cancelLoa(id) {
  const { error } = await supabase
    .from("loa_requests")
    .update({
      status: "CANCELLED",
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    setStatus(error.message, false);
    return;
  }

  setStatus("LOA request cancelled.", true);
  await loadLoas();
}

async function init() {
  const boot = await bootPortalChrome();
  if (!boot) return;

  authUser = boot.user;
  profile = boot.profile;

  loaForm.addEventListener("submit", submitLoa);
  refreshBtn.addEventListener("click", loadLoas);

  if (leadershipLoaForm) {
    leadershipLoaForm.addEventListener(
      "submit",
      submitLeadershipLoa
    );
  }
  calendarMonthInput.value = monthValue(new Date());

  calendarMonthInput.addEventListener("change", renderLeaveCalendar);

  prevMonthBtn.addEventListener("click", () => {
    calendarMonthInput.value = addMonthsToValue(calendarMonthInput.value, -1);
    renderLeaveCalendar();
  });

  nextMonthBtn.addEventListener("click", () => {
    calendarMonthInput.value = addMonthsToValue(calendarMonthInput.value, 1);
    renderLeaveCalendar();
  });

  currentMonthBtn.addEventListener("click", () => {
    calendarMonthInput.value = monthValue(new Date());
    renderLeaveCalendar();
  });

  await loadLoas();
}

init();