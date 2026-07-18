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

let loaRows = [];

function setStatus(message, ok) {
  const el = document.getElementById("status-line");
  el.textContent = message;
  el.className = "status-line visible " + (ok ? "ok" : "err");
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
    .select("id, display_name, naval_rank, callsign, role");

  if (error) {
    profilesById = new Map();
    return;
  }

  profilesById = new Map(data.map(row => [row.id, row]));
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