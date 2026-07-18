import { supabase } from "/js/auth.js";
import { bootPortalChrome, escapeHtml, avatarUrl } from "/js/portal-common.js";
import { renderPortalLayout } from "/js/portal-layout.js";

renderPortalLayout("scheduling");

const SLOT_MINUTES = 60;
const SLOTS_PER_DAY = 24;
const SCHEDULE_TIMEZONE = "UTC";

const ORBAT = [
  { title: "Green Team", slots: ["Candidate"] },
  { title: "Red Squadron, 3 Troop, Golf, Assault", slots: ["EG1", "EG2", "EG3", "EG4", "EG5", "EG6"] },
  { title: "Red Squadron, 3 Troop, Hotel, Assault", slots: ["EH1", "EH2", "EH3", "EH4", "EH5", "EH6"] },
  { title: "Red Squadron, 3 Troop, India, Recce", slots: ["EI1", "EI2", "EI3", "EI4", "EI5", "EI6"] },
  { title: "Red Squadron, 3 Troop, Troop Headquarters", slots: ["E31", "E32"] },
  {
    title: "Red Squadron, 3 Troop, Enablers",
    slots: [
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
    ]
  }
];

let authUser = null;
let profile = null;
let profilesById = new Map();
let members = [];
let allResponses = [];
let mySlots = new Map();
let selectedOrbatDay = 0;
let currentView = "heatmap";
let realtimeChannel = null;
let isDraggingAvailability = false;
let dragAvailabilityValue = null;
let dragChangedAvailability = false;

const weekInput = document.getElementById("week-start");
const timezoneSelect = document.getElementById("timezone-select");
const saveBtn = document.getElementById("save-btn");
const refreshBtn = document.getElementById("refresh-btn");
const clearBtn = document.getElementById("clear-btn");

function zp(n) { return String(n).padStart(2, "0"); }
function isoDate(d) { return d.toISOString().split("T")[0]; }
function normalizeAvailability(value) { return String(value || "").trim().toLowerCase(); }
function availabilityLabel(value) { value = normalizeAvailability(value); if (value === "available") return "Available"; if (value === "maybe") return "Maybe"; if (value === "unavailable") return "Unavailable"; return ""; }
function compactAvailabilityLabel(value) { value = normalizeAvailability(value); if (value === "available") return "AVAIL"; if (value === "maybe") return "MAYBE"; if (value === "unavailable") return "NO"; return ""; }
function myClass(value) { value = normalizeAvailability(value); if (value === "available") return "mine-available"; if (value === "maybe") return "mine-maybe"; if (value === "unavailable") return "mine-unavailable"; return "mine-empty"; }
function cycleAvailability(current) { if (!current) return "available"; if (current === "available") return "maybe"; if (current === "maybe") return "unavailable"; return null; }
function slotKey(date) { return date.toISOString(); }

function setStatus(message, ok) {
  const el = document.getElementById("status-line");
  el.textContent = message;
  el.className = "status-line visible " + (ok ? "ok" : "err");
}

function utcNowLabel() {
  const d = new Date();
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${zp(d.getUTCHours())}${zp(d.getUTCMinutes())}Z ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function getNextMonday() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return isoDate(monday);
}

function addDaysToIsoDate(iso, days) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function changeWeek(days) {
  weekInput.value = addDaysToIsoDate(weekInput.value, days);
  loadResponses();
}

function getFormatter(timeZone, options) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, ...options });
}

function getZonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const out = {};
  for (const p of parts) if (p.type !== "literal") out[p.type] = p.value;
  return { year: Number(out.year), month: Number(out.month), day: Number(out.day), hour: Number(out.hour), minute: Number(out.minute) };
}

function zonedTimeToUtc(year, month, day, hour, minute, timeZone) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const parts = getZonedParts(guess, timeZone);
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute);
  const actualUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return new Date(guess.getTime() + (targetUtc - actualUtc));
}

function getWeekRangeUtc() {
  const startIso = weekInput.value;
  const y = Number(startIso.slice(0, 4));
  const m = Number(startIso.slice(5, 7));
  const d = Number(startIso.slice(8, 10));
  const start = zonedTimeToUtc(y, m, d, 0, 0, SCHEDULE_TIMEZONE);
  const endIso = addDaysToIsoDate(startIso, 7);
  const ey = Number(endIso.slice(0, 4));
  const em = Number(endIso.slice(5, 7));
  const ed = Number(endIso.slice(8, 10));
  const end = zonedTimeToUtc(ey, em, ed, 0, 0, SCHEDULE_TIMEZONE);
  return { start, end };
}

function localSlotToUtc(dayIndex, slotIndex) {
  const baseIso = addDaysToIsoDate(weekInput.value, dayIndex);
  const y = Number(baseIso.slice(0, 4));
  const m = Number(baseIso.slice(5, 7));
  const d = Number(baseIso.slice(8, 10));
  const totalMinutes = slotIndex * SLOT_MINUTES;
  return zonedTimeToUtc(y, m, d, Math.floor(totalMinutes / 60), totalMinutes % 60, SCHEDULE_TIMEZONE);
}

function labelForSlot(dayIndex, slotIndex) {
  return getFormatter(timezoneSelect.value, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(localSlotToUtc(dayIndex, slotIndex));
}

function labelForDateTime(utcIso) {
  return getFormatter(timezoneSelect.value, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(utcIso));
}

function labelForUpdateTime(utcIso) {
  return getFormatter(timezoneSelect.value, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(utcIso));
}

function dayHeader(dayIndex) {
  const utcDate = localSlotToUtc(dayIndex, 12);
  const weekday = getFormatter(displayTimezone(), { weekday: "short" }).format(utcDate);
  const dateLabel = getFormatter(displayTimezone(), { day: "2-digit", month: "short" }).format(utcDate);
  return `${escapeHtml(weekday)}<small>${escapeHtml(dateLabel)}</small>`;
}

function getProfileName(userId) {
  const prof = profilesById.get(userId);
  return prof ? prof.display_name : userId;
}

function responsesForSlot(key) {
  return allResponses.filter(row => new Date(row.slot_start).toISOString() === key);
}

function scoreToGrade(score, responseCount) {
  if (responseCount === 0) return "gray";
  if (score < 0.25) return "red";
  if (score < 0.50) return "orange";
  if (score < 0.75) return "yellow";
  return "green";
}

function aggregateSlot(key) {
  let available = 0, maybe = 0, unavailable = 0;
  const peopleAvailable = [], peopleMaybe = [], peopleUnavailable = [];
  const rows = responsesForSlot(key);

  for (const row of rows) {
    const name = getProfileName(row.user_id);
    if (row.availability === "available") { available++; peopleAvailable.push(name); }
    else if (row.availability === "maybe") { maybe++; peopleMaybe.push(name); }
    else if (row.availability === "unavailable") { unavailable++; peopleUnavailable.push(name); }
  }

  if (mySlots.has(key) && !rows.some(r => r.user_id === authUser.id)) {
    const ownValue = mySlots.get(key);
    if (ownValue === "available") { available++; peopleAvailable.push(profile.display_name); }
    else if (ownValue === "maybe") { maybe++; peopleMaybe.push(profile.display_name); }
    else if (ownValue === "unavailable") { unavailable++; peopleUnavailable.push(profile.display_name); }
  }

  const totalMembers = Math.max(members.length, 1);
  const responseCount = available + maybe + unavailable;
  const score = (available + maybe * 0.5) / totalMembers;
  return { available, maybe, unavailable, responseCount, totalMembers, score, grade: scoreToGrade(score, responseCount), peopleAvailable, peopleMaybe, peopleUnavailable };
}

function updateAvailabilityCellDisplay(cell, value) {
  cell.className = myClass(value);
  cell.textContent = compactAvailabilityLabel(value);
  cell.title = `Click or drag to change. Current: ${availabilityLabel(value) || "Empty"}`;
}

function setAvailabilityCell(cell, value) {
  const key = slotKey(localSlotToUtc(Number(cell.dataset.day), Number(cell.dataset.slot)));
  const current = mySlots.get(key) || null;
  if (current === value) return;
  if (value) mySlots.set(key, value); else mySlots.delete(key);
  updateAvailabilityCellDisplay(cell, value);
  dragChangedAvailability = true;
}

function finishAvailabilityDrag() {
  if (!isDraggingAvailability) return;
  isDraggingAvailability = false;
  dragAvailabilityValue = null;
  if (dragChangedAvailability) {
    dragChangedAvailability = false;
    buildHeatmap();
    buildBestList();
    buildOrbatView();
  }
}

function buildMyTable() {
  const table = document.getElementById("my-table");
  let html = "<tr><th class='time-col'>Time</th>";
  for (let d = 0; d < 7; d++) html += `<th>${dayHeader(d)}</th>`;
  html += "</tr>";

  for (let s = 0; s < SLOTS_PER_DAY; s++) {
    html += `<tr><td class="time-col">${escapeHtml(labelForSlot(0, s))}</td>`;
    for (let d = 0; d < 7; d++) {
      const key = slotKey(localSlotToUtc(d, s));
      const value = mySlots.get(key) || null;
      html += `<td class="${myClass(value)}" data-day="${d}" data-slot="${s}" title="Click or drag to change. Current: ${escapeHtml(availabilityLabel(value) || "Empty")}">${escapeHtml(compactAvailabilityLabel(value))}</td>`;
    }
    html += "</tr>";
  }

  table.innerHTML = html;
  table.querySelectorAll("td[data-day]").forEach(cell => {
    cell.addEventListener("mousedown", event => {
      if (event.button !== 0) return;
      event.preventDefault();
      const key = slotKey(localSlotToUtc(Number(cell.dataset.day), Number(cell.dataset.slot)));
      isDraggingAvailability = true;
      dragAvailabilityValue = cycleAvailability(mySlots.get(key));
      dragChangedAvailability = false;
      setAvailabilityCell(cell, dragAvailabilityValue);
    });
    cell.addEventListener("mouseenter", () => {
      if (isDraggingAvailability) setAvailabilityCell(cell, dragAvailabilityValue);
    });
  });
}

function buildHoverTitle(ag, slotIso) {
  return [labelForDateTime(slotIso), "", "Available:", ag.peopleAvailable.length ? ag.peopleAvailable.join(", ") : "None", "", "Maybe:", ag.peopleMaybe.length ? ag.peopleMaybe.join(", ") : "None", "", "Unavailable:", ag.peopleUnavailable.length ? ag.peopleUnavailable.join(", ") : "None"].join("\n");
}

function buildHeatmap() {
  const table = document.getElementById("heatmap-table");
  let html = "<tr><th class='time-col'>Time</th>";
  for (let d = 0; d < 7; d++) html += `<th>${dayHeader(d)}</th>`;
  html += "</tr>";

  for (let s = 0; s < SLOTS_PER_DAY; s++) {
    html += `<tr><td class="time-col">${escapeHtml(labelForSlot(0, s))}</td>`;
    for (let d = 0; d < 7; d++) {
      const key = slotKey(localSlotToUtc(d, s));
      const ag = aggregateSlot(key);
      html += `<td class="heat-cell grade-${ag.grade}" title="${escapeHtml(buildHoverTitle(ag, key))}">${Math.round(ag.score * 100)}%<small>${ag.available}Y ${ag.maybe}M ${ag.unavailable}N</small></td>`;
    }
    html += "</tr>";
  }
  table.innerHTML = html;
}

function buildBestList() {
  const entries = [];
  for (let d = 0; d < 7; d++) for (let s = 0; s < SLOTS_PER_DAY; s++) {
    const key = slotKey(localSlotToUtc(d, s));
    const ag = aggregateSlot(key);
    if (ag.responseCount > 0) entries.push({ slotIso: key, score: ag.score, available: ag.available, maybe: ag.maybe, unavailable: ag.unavailable });
  }

  entries.sort((a, b) => b.score - a.score || b.available - a.available || a.unavailable - b.unavailable);
  const list = document.getElementById("best-list");
  if (!entries.length) { list.innerHTML = "<li>No availability submitted yet.</li>"; return; }
  list.innerHTML = entries.slice(0, 8).map(e => `<li><strong>${escapeHtml(labelForDateTime(e.slotIso))}</strong><br>${Math.round(e.score * 100)}% fit - ${e.available} available, ${e.maybe} maybe, ${e.unavailable} unavailable</li>`).join("");
}

function buildChangesList() {
  const list = document.getElementById("changes-list");
  if (!allResponses.length) { list.innerHTML = "<li>No changes yet.</li>"; return; }
  const latest = [...allResponses].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 12);
  list.innerHTML = latest.map(row => `<li><strong>${escapeHtml(getProfileName(row.user_id))}</strong> set <strong>${escapeHtml(row.availability)}</strong><br><span class="muted">${escapeHtml(labelForDateTime(row.slot_start))} - updated ${escapeHtml(labelForUpdateTime(row.updated_at || row.slot_start))}</span></li>`).join("");
}

function memberCallsign(member) {
  const callsign = String(member.callsign || "").trim().toUpperCase();
  return callsign || "Candidate";
}

function membersForCallsign(callsign) {
  return members.filter(m => {
    if (callsign === "Candidate") return !String(m.callsign || "").trim();
    return memberCallsign(m) === callsign;
  });
}

function availabilityForMemberSlot(memberId, key) {
  if (memberId === authUser.id && mySlots.has(key)) return mySlots.get(key);
  const row = allResponses.find(r => r.user_id === memberId && new Date(r.slot_start).toISOString() === key);
  return row?.availability || null;
}

function availableMembersForCallsign(callsign, key) {
  return membersForCallsign(callsign).filter(m => availabilityForMemberSlot(m.id, key) === "available");
}

function buildOrbatDayTabs() {
  const tabs = document.getElementById("orbat-day-tabs");
  tabs.innerHTML = "";
  for (let d = 0; d < 7; d++) {
    const btn = document.createElement("button");
    btn.className = "btn btn-secondary" + (d === selectedOrbatDay ? " active" : "");
    btn.innerHTML = dayHeader(d).replace("<small>", " ").replace("</small>", "");
    btn.addEventListener("click", () => { selectedOrbatDay = d; buildOrbatView(); });
    tabs.appendChild(btn);
  }
}

function buildOrbatView() {
  document.getElementById("orbat-week-label").textContent = `Week of ${weekInput.value} - ${timezoneSelect.value}`;
  buildOrbatDayTabs();
  const root = document.getElementById("orbat-day-detail");
  let html = "";

  for (let s = 0; s < SLOTS_PER_DAY; s++) {
    const key = slotKey(localSlotToUtc(selectedOrbatDay, s));
    const anyAvailable = ORBAT.some(section => section.slots.some(cs => availableMembersForCallsign(cs, key).length));
    if (!anyAvailable) continue;

    html += `<div class="orbat-slot"><h4>${escapeHtml(labelForDateTime(key))}</h4>`;
    for (const section of ORBAT) {
      const teamLines = section.slots.map(cs => {
        const list = availableMembersForCallsign(cs, key);
        if (!list.length) return "";
        const people = list.map(m => `<span class="orbat-person" data-user-id="${escapeHtml(m.id)}" data-slot="${escapeHtml(key)}">${escapeHtml(cs)} - ${escapeHtml(m.display_name)}</span>`).join("");
        return `<div class="orbat-team"><div class="orbat-team-title">${escapeHtml(cs)}</div>${people}</div>`;
      }).filter(Boolean).join("");
      if (teamLines) html += `<div class="orbat-section"><h3>${escapeHtml(section.title)}</h3><div class="orbat-slots">${teamLines}</div></div>`;
    }
    html += "</div>";
  }

  root.innerHTML = html || `<div class="orbat-slot"><span class="orbat-empty">No available members for ${dayHeader(selectedOrbatDay).replace(/<[^>]+>/g, " ")}.</span></div>`;
  root.querySelectorAll(".orbat-person").forEach(el => el.addEventListener("click", () => openPersonModal(el.dataset.userId, el.dataset.slot)));
}

function openPersonModal(userId, slotIso) {
  const m = profilesById.get(userId);
  if (!m) return;
  const av = availabilityForMemberSlot(userId, slotIso);
  const img = avatarUrl(m.avatar_path) || "/nsw.png";
  document.getElementById("person-modal-title").textContent = m.display_name || m.user_id;
  document.getElementById("person-modal-body").innerHTML = `
    <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:8px"><img src="${escapeHtml(img)}" alt="" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:1px solid #c8a800"><div><strong>${escapeHtml(memberCallsign(m))}</strong><br><span class="muted">${escapeHtml(m.naval_rank || "Candidate")}</span></div></div>
    <table>
      <tr><td>Availability</td><td>${escapeHtml(availabilityLabel(av) || "No response")}</td></tr>
      <tr><td>Time</td><td>${escapeHtml(labelForDateTime(slotIso))}</td></tr>
      <tr><td>Callsign</td><td>${escapeHtml(memberCallsign(m))}</td></tr>
      <tr><td>Discord</td><td>${escapeHtml(m.discord || "Not set")}</td></tr>
      <tr><td>Steam</td><td>${escapeHtml(m.steam || "Not set")}</td></tr>
      <tr><td>User ID</td><td>${escapeHtml(m.user_id || "")}</td></tr>
    </table>`;
  document.getElementById("person-modal").classList.add("visible");
}

function setView(view) {
  currentView = view;
  document.getElementById("heatmap-panel").style.display = view === "heatmap" ? "block" : "none";
  document.getElementById("orbat-panel").style.display = view === "orbat" ? "block" : "none";
  document.getElementById("heatmap-view-btn").classList.toggle("active", view === "heatmap");
  document.getElementById("orbat-view-btn").classList.toggle("active", view === "orbat");
  if (view === "orbat") buildOrbatView();
}

async function loadSessionAndProfile() {
  const loaded = await bootPortalChrome();
  if (!loaded) return false;
  authUser = loaded.user;
  profile = loaded.profile;
  document.getElementById("dash-user").textContent = profile.display_name;
  document.getElementById("dash-userid").textContent = profile.user_id;
  return true;
}

async function loadProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, display_name, role, status, avatar_path, naval_rank, callsign, discord, steam")
    .eq("status", "ACTIVE")
    .order("display_name", { ascending: true });
  if (error || !data) {
    members = [profile];
    profilesById = new Map([[profile.id, profile]]);
  } else {
    members = data;
    profilesById = new Map(data.map(p => [p.id, p]));
  }
  document.getElementById("dash-members").textContent = String(members.length);
}

async function loadResponses() {
  const { start, end } = getWeekRangeUtc();
  const { data, error } = await supabase
    .from("scheduling_responses")
    .select("user_id, slot_start, availability, note, updated_at")
    .gte("slot_start", start.toISOString())
    .lt("slot_start", end.toISOString());
  if (error) { setStatus("Failed to load scheduling data: " + error.message, false); allResponses = []; return; }
  allResponses = data || [];
  mySlots.clear();
  for (const row of allResponses) if (row.user_id === authUser.id) mySlots.set(new Date(row.slot_start).toISOString(), row.availability);
  document.getElementById("dash-timezone").textContent = timezoneSelect.value;
  document.getElementById("dash-updated").textContent = utcNowLabel();
  buildMyTable();
  buildHeatmap();
  buildBestList();
  buildChangesList();
  if (currentView === "orbat") buildOrbatView();
}

async function saveAvailability() {
  const { start, end } = getWeekRangeUtc();
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";
  const { error: deleteError } = await supabase.from("scheduling_responses").delete().eq("user_id", authUser.id).gte("slot_start", start.toISOString()).lt("slot_start", end.toISOString());
  if (deleteError) { setStatus("Failed to clear old availability: " + deleteError.message, false); saveBtn.disabled = false; saveBtn.textContent = "Save"; return; }
  const rows = [...mySlots.entries()].filter(([key]) => { const date = new Date(key); return date >= start && date < end; }).map(([key, value]) => ({ user_id: authUser.id, slot_start: key, availability: value, note: null, updated_at: new Date().toISOString() }));
  if (rows.length) {
    const { error: insertError } = await supabase.from("scheduling_responses").insert(rows);
    if (insertError) { setStatus("Failed to save availability: " + insertError.message, false); saveBtn.disabled = false; saveBtn.textContent = "Save"; return; }
  }
  setStatus("Availability saved successfully.", true);
  saveBtn.disabled = false;
  saveBtn.textContent = "Save";
  await loadResponses();
}

async function clearMyWeek() {
  if (!confirm("Clear all of your availability for this selected week?")) return;
  const { start, end } = getWeekRangeUtc();
  const { error } = await supabase.from("scheduling_responses").delete().eq("user_id", authUser.id).gte("slot_start", start.toISOString()).lt("slot_start", end.toISOString());
  if (error) { setStatus("Failed to clear week: " + error.message, false); return; }
  mySlots.clear();
  setStatus("Your week was cleared.", true);
  await loadResponses();
}

function setupRealtime() {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  let reloadTimer = null;
  realtimeChannel = supabase.channel("scheduling-live").on("postgres_changes", { event: "*", schema: "public", table: "scheduling_responses" }, () => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(loadResponses, 300);
  }).subscribe();
}

async function doLogout() {
  await supabase.auth.signOut();
  window.location.href = "/login/";
}
window.doLogout = doLogout;

saveBtn.addEventListener("click", saveAvailability);
refreshBtn.addEventListener("click", loadResponses);
clearBtn.addEventListener("click", clearMyWeek);
document.getElementById("prev-week-btn").addEventListener("click", () => changeWeek(-7));
document.getElementById("next-week-btn").addEventListener("click", () => changeWeek(7));
document.getElementById("heatmap-view-btn").addEventListener("click", () => setView("heatmap"));
document.getElementById("orbat-view-btn").addEventListener("click", () => setView("orbat"));
document.getElementById("close-person-modal").addEventListener("click", () => document.getElementById("person-modal").classList.remove("visible"));
document.getElementById("person-modal").addEventListener("click", event => { if (event.target.id === "person-modal") event.currentTarget.classList.remove("visible"); });
document.addEventListener("mouseup", finishAvailabilityDrag);
window.addEventListener("blur", finishAvailabilityDrag);
timezoneSelect.addEventListener("change", () => { localStorage.setItem("schedulingTimezone", timezoneSelect.value); document.getElementById("dash-timezone").textContent = timezoneSelect.value; buildMyTable(); buildHeatmap(); buildBestList(); buildChangesList(); buildOrbatView(); });
weekInput.addEventListener("change", loadResponses);

async function init() {
  weekInput.value = getNextMonday();
  const savedTz = localStorage.getItem("schedulingTimezone");
  if (savedTz) timezoneSelect.value = savedTz;
  if (!(await loadSessionAndProfile())) return;
  await loadProfiles();
  await loadResponses();
  setupRealtime();
}

init();
