import { supabase } from "/js/auth.js";
import { bootPortalChrome, escapeHtml, avatarUrl } from "/js/portal-common.js";
import { renderPortalLayout } from "/js/portal-layout.js";

renderPortalLayout("orbat");

const SPECIAL_ACCESS_EMAILS = ["carver@navy.mil", "evans@navy.mil"];
const OFFICER_RANKS = new Set(["Ensign", "Lieutenant Junior Grade", "Lieutenant", "Lieutenant Commander", "Commander",
"Captain"]);
const SPECIALIST_ROLES = {
EX1: "Master-at-Arms (Military Working Dog Handler/MWDH)",
EN1: "Explosive Ordnance Disposal Technician (EOD)",
ER1: "Information Systems Technician (IST)",
EY1: "Cryptologic Technician (CT)",
EU1: "Combat Controller (CCT)",
EU2: "Combat Controller (CCT)",
EP1: "Pararescueman (PJ)",
EP2: "Pararescueman (PJ)"
};

function getBillet(callsign) {
if (!callsign) return "";

if (callsign === "E31") return "Troop Commander";
if (callsign === "E32") return "Troop Chief";

if (SPECIALIST_ROLES[callsign]) {
return SPECIALIST_ROLES[callsign];
}

const slot = Number(callsign.slice(-1));

if (callsign.startsWith("EG")) {
return [
"",
"Golf Team Leader",
"Golf Assistant Team Leader",
"Golf Team Assaulter",
"Golf Team Assaulter",
"Golf Team Assaulter",
"Golf Team Assaulter"
][slot];
}

if (callsign.startsWith("EH")) {
return [
"",
"Hotel Team Leader",
"Hotel Assistant Team Leader",
"Hotel Team Assaulter",
"Hotel Team Assaulter",
"Hotel Team Assaulter",
"Hotel Team Assaulter"
][slot];
}

if (callsign.startsWith("EI")) {
return [
"",
"India Team Leader",
"India Assistant Team Leader",
"Reconnaissance Operator",
"Reconnaissance Operator",
"Reconnaissance Operator",
"Reconnaissance Operator"
][slot];
}

return "";
}

let authUser = null;
let currentProfile = null;
let members = [];

const accessDenied = document.getElementById("access-denied");
const content = document.getElementById("orbat-content");
const board = document.getElementById("orbat-board");
const statusLine = document.getElementById("status-line");
const searchInput = document.getElementById("search-input");
const refreshBtn = document.getElementById("refresh-btn");
const statTotal = document.getElementById("stat-total");
const statGroups = document.getElementById("stat-groups");
const statOfficers = document.getElementById("stat-officers");
const statEnlisted = document.getElementById("stat-enlisted");

function canViewOrbat(user, profile) {
const email = String(user?.email || "").trim().toLowerCase();
const callsign = String(profile?.callsign || "").trim();
const rank = String(profile?.naval_rank || "").trim().toLowerCase();
if (SPECIAL_ACCESS_EMAILS.includes(email)) return true;
if (rank === "candidate") return false;
return callsign.length > 0;
}

function isOrbatMember(profile) {
const callsign = String(profile?.callsign || "").trim();
const rank = String(profile?.naval_rank || "").trim().toLowerCase();
const status = String(profile?.status || "ACTIVE").trim().toUpperCase();
return status === "ACTIVE" && rank !== "candidate" && callsign.length > 0;
}

function callsignGroup(callsign) {
const value = String(callsign || "").trim().toUpperCase();
if (value.startsWith("E3")) return "E3";
return value.slice(0, 2) || "OTHER";
}

function callsignSortValue(callsign) {
const value = String(callsign || "").toUpperCase();
const match = value.match(/^([A-Z]+)(\d+)$/);
if (!match) return value;
return `${match[1]}-${String(Number(match[2])).padStart(3, "0")}`;
}

function memberSearchText(member) {
return [member.display_name, member.user_id, member.role, member.naval_rank, member.callsign, member.steam_name,
member.discord_name].join(" ").toLowerCase();
}

function setStatus(message) {
statusLine.textContent = message;
}

async function loadMembers() {
setStatus("Loading ORBAT...");
let { data, error } = await supabase.rpc("get_orbat_profiles");

if (error) {
const fallback = await supabase
.from("profiles")
.select("id,user_id,display_name,role,status,avatar_url,naval_rank,callsign,steam_name,discord_name")
.order("callsign", { ascending: true });

data = fallback.data;
error = fallback.error;
}

if (error) throw new Error(error.message);
members = (data || []).filter(isOrbatMember).sort((a, b) =>
callsignSortValue(a.callsign).localeCompare(callsignSortValue(b.callsign)) || String(a.display_name ||
"").localeCompare(String(b.display_name || "")));
}

function filteredMembers() {
const query = String(searchInput.value || "").trim().toLowerCase();
const group = "ALL";
return members.filter(member => {
if (query && !memberSearchText(member).includes(query)) return false;
return true;
});
}

function renderStats(rows) {
const groups = new Set(rows.map(row => callsignGroup(row.callsign)));
const officers = rows.filter(row => OFFICER_RANKS.has(row.naval_rank)).length;
statTotal.textContent = rows.length;
statGroups.textContent = groups.size;
statOfficers.textContent = officers;
statEnlisted.textContent = rows.length - officers;
}

function renderBoard() {
const personnel = filteredMembers();

renderStats(personnel);

const slotMap = new Map();

personnel.forEach(member => {
slotMap.set(member.callsign, member);
});

const sections = [
{
title: "Troop Headquarters",
subtitle: "Red Squadron • 3 Troop",
slots: ["E31", "E32"]
},
{
title: "3 Troop, Golf Team",
subtitle: "Assault",
slots: ["EG1", "EG2", "EG3", "EG4", "EG5", "EG6"]
},
{
title: "3 Troop, Hotel Team",
subtitle: "Assault",
slots: ["EH1", "EH2", "EH3", "EH4", "EH5", "EH6"]
},
{
title: "3 Troop, India Team",
subtitle: "Reconnaissance",
slots: ["EI1", "EI2", "EI3", "EI4", "EI5", "EI6"]
},
{
title: "Attached Specialists",
subtitle: "Troop Support Assets",
slots: [
"EX1",
"EN1",
"ER1",
"EY1",
"EU1",
"EU2",
"EP1",
"EP2"
]
}
];

board.innerHTML = sections.map(section => `
<section class="unit-panel">
  <div class="unit-title">
    <span>${escapeHtml(section.title)}</span>
  </div>

  <div class="unit-body">
    <div class="muted" style="margin-bottom:8px;">
      ${escapeHtml(section.subtitle)}
    </div>

    ${section.slots.map(callsign => {
    const member = slotMap.get(callsign);

    if (!member) {
    return `
    <article class="member-card">
      <img class="avatar" src="../../nsw.png">
      <div>
        <div class="member-name">Vacant</div>
        <div class="member-meta">
          Position Unfilled
        </div>
        <span class="badge">${callsign}</span>
      </div>
    </article>
    `;
    }

    return `
    <article class="member-card">
      <img class="avatar" src="${escapeHtml(avatarUrl(member.avatar_url) || '../../nsw.png')}">

      <div>
        <div class="member-name">
          ${escapeHtml(member.display_name)}
        </div>

        <div class="member-meta">
          ${escapeHtml(member.naval_rank || '')}
        </div>

        <div class="member-billet">
          ${escapeHtml(getBillet(member.callsign))}
        </div>

        <span class="badge">
          ${escapeHtml(member.callsign)}
        </span>
      </div>
    </article>
    `;
    }).join("")}
  </div>
</section>
`).join("");

setStatus(`${personnel.length} personnel displayed.`);
}

async function boot() {
try {
const boot = await bootPortalChrome();
if (!boot) return;
authUser = boot.user;
currentProfile = boot.profile;

if (!canViewOrbat(authUser, currentProfile)) {
accessDenied.classList.remove("hidden");
content.classList.add("hidden");
return;
}

content.classList.remove("hidden");
await loadMembers();
renderBoard();
} catch (error) {
console.error(error);
accessDenied.classList.add("hidden");
content.classList.remove("hidden");
board.innerHTML = `<div class="notice-box error">Failed to load ORBAT: ${escapeHtml(error.message)}</div>`;
setStatus("Failed to load ORBAT.");
}
}

searchInput.addEventListener("input", renderBoard);
refreshBtn.addEventListener("click", async () => {
try {
await loadMembers();
renderBoard();
} catch (error) {
console.error(error);
board.innerHTML = `<div class="notice-box error">Refresh failed: ${escapeHtml(error.message)}</div>`;
}
});

boot();