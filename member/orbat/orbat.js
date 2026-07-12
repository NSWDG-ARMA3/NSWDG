import { supabase } from "/js/auth.js";
import { bootPortalChrome, escapeHtml, avatarUrl } from "/js/portal-common.js";
import { renderPortalLayout } from "/js/portal-layout.js";

renderPortalLayout("orbat");

const SPECIAL_ACCESS_EMAILS = ["carver@navy.mil", "evans@navy.mil"];
const OFFICER_RANKS = new Set(["Ensign", "Lieutenant Junior Grade", "Lieutenant", "Lieutenant Commander", "Commander",
"Captain"]);
const GREEN_TEAM_EDITOR_ROLES = new Set([
  "ADMIN",
  "SUPERADMIN",
  "TROOP_HQ",
  "HQ"
]);
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

function getGreenTeamBillet(index) {
  if (index === 0) return "Green Team Candidate";
  return "Green Team Candidate";
}

let authUser = null;
let currentProfile = null;
let members = [];

let draggedGreenTeamId = null;
let greenTeamSaving = false;

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
  const status = String(profile?.status || "ACTIVE").trim().toUpperCase();

  if (status !== "ACTIVE") return false;

  // Regular ORBAT member or Green Team member without a callsign
  return callsign.length > 0 || callsign.length === 0;
}
function callsignGroup(callsign, rank = "") {
  const normalizedRank = String(rank || "").trim().toLowerCase();

  if (normalizedRank === "candidate") {
    return "GREEN";
  }

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

function canEditGreenTeam() {
  const role = String(currentProfile?.role || "")
    .trim()
    .toUpperCase();

  return GREEN_TEAM_EDITOR_ROLES.has(role);
}

function isGreenTeamMember(member) {
  const callsign = String(member?.callsign || "").trim();

  const status = String(member?.status || "ACTIVE")
    .trim()
    .toUpperCase();

  return status === "ACTIVE" && callsign.length === 0;
}

function greenTeamLabel(index) {
  return index < 2 ? "CLASSLEAD" : "CANDIDATE";
}

function greenTeamPositionText(index) {
  return index < 2
    ? "Green Team Class Lead"
    : "Green Team Candidate";
}

function greenTeamSort(a, b) {
  const aOrder = Number(a.green_team_order);
  const bOrder = Number(b.green_team_order);

  const aHasOrder =
    Number.isFinite(aOrder) && aOrder > 0;

  const bHasOrder =
    Number.isFinite(bOrder) && bOrder > 0;

  if (aHasOrder && bHasOrder && aOrder !== bOrder) {
    return aOrder - bOrder;
  }

  if (aHasOrder !== bHasOrder) {
    return aHasOrder ? -1 : 1;
  }

  return String(a.display_name || "").localeCompare(
    String(b.display_name || "")
  );
}

function memberSearchText(member) {
return [member.display_name, member.user_id, member.role, member.naval_rank, member.callsign, member.steam_name,
member.discord_name].join(" ").toLowerCase();
}

function setStatus(message) {
statusLine.textContent = message;
}

async function saveGreenTeamOrder(orderedIds) {
  if (greenTeamSaving) return;

  if (!canEditGreenTeam()) {
    throw new Error(
      "You are not authorized to reorder Green Team."
    );
  }

  if (!Array.isArray(orderedIds)) {
    throw new Error("Invalid Green Team order.");
  }

  greenTeamSaving = true;
  setStatus("Saving Green Team order...");

  try {
    const { error } = await supabase.rpc(
      "set_green_team_order",
      {
        ordered_profile_ids: orderedIds
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    const orderMap = new Map(
      orderedIds.map((profileId, index) => [
        profileId,
        index + 1
      ])
    );

    members.forEach(member => {
      if (orderMap.has(member.id)) {
        member.green_team_order = orderMap.get(member.id);
      }
    });

    setStatus("Green Team order saved.");
  } finally {
    greenTeamSaving = false;
  }
}

function updateGreenTeamLabels(container) {
  const cards = Array.from(
    container.querySelectorAll(
      ".green-team-card[data-profile-id]"
    )
  );

  cards.forEach((card, index) => {
    const badge = card.querySelector(
      ".green-team-position-badge"
    );

    const billet = card.querySelector(
      ".green-team-position-text"
    );

    if (badge) {
      badge.textContent = greenTeamLabel(index);
    }

    if (billet) {
      billet.textContent = greenTeamPositionText(index);
    }
  });
}

function bindGreenTeamDragEvents() {
  const container = document.getElementById(
    "green-team-members"
  );

  if (!container || !canEditGreenTeam()) {
    return;
  }

  const cards = Array.from(
    container.querySelectorAll(
      ".green-team-card[data-profile-id]"
    )
  );

  cards.forEach(card => {
    card.addEventListener("dragstart", event => {
      draggedGreenTeamId = card.dataset.profileId;

      card.classList.add("dragging");

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";

        event.dataTransfer.setData(
          "text/plain",
          draggedGreenTeamId
        );
      }
    });

    card.addEventListener("dragover", event => {
      event.preventDefault();

      if (!draggedGreenTeamId) {
        return;
      }

      if (
        draggedGreenTeamId === card.dataset.profileId
      ) {
        return;
      }

      const draggedCard = Array.from(
        container.querySelectorAll(
          ".green-team-card[data-profile-id]"
        )
      ).find(element => {
        return (
          element.dataset.profileId === draggedGreenTeamId
        );
      });

      if (!draggedCard) {
        return;
      }

      const cardBounds = card.getBoundingClientRect();

      const insertAfter =
        event.clientY >
        cardBounds.top + cardBounds.height / 2;

      if (insertAfter) {
        card.after(draggedCard);
      } else {
        card.before(draggedCard);
      }

      updateGreenTeamLabels(container);
    });

    card.addEventListener("dragend", async () => {
      card.classList.remove("dragging");

      const orderedIds = Array.from(
        container.querySelectorAll(
          ".green-team-card[data-profile-id]"
        )
      ).map(element => element.dataset.profileId);

      draggedGreenTeamId = null;

      updateGreenTeamLabels(container);

      try {
        await saveGreenTeamOrder(orderedIds);
      } catch (error) {
        console.error(error);

        setStatus(
          `Failed to save Green Team order: ${error.message}`
        );

        await loadMembers();
        renderBoard();
      }
    });
  });
}

async function loadMembers() {
setStatus("Loading ORBAT...");

const { data, error } = await supabase
.from("profiles")
.select(`
  id,
  user_id,
  display_name,
  role,
  status,
  avatar_url,
  naval_rank,
  callsign,
  steam_name,
  discord_name,
  green_team_order
`)
.order("callsign", { ascending: true });

if (error) throw new Error(error.message);

members = (data || [])
  .filter(isOrbatMember)
  .sort((a, b) => {
    const aCandidate =
      String(a.naval_rank || "").trim().toLowerCase() === "candidate";
    const bCandidate =
      String(b.naval_rank || "").trim().toLowerCase() === "candidate";

    if (aCandidate !== bCandidate) {
      return aCandidate ? 1 : -1;
    }

    return (
      callsignSortValue(a.callsign).localeCompare(
        callsignSortValue(b.callsign)
      ) ||
      String(a.display_name || "").localeCompare(
        String(b.display_name || "")
      )
    );
  });
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
  const groups = new Set(
    rows
      .map(row => {
        const callsign = String(row.callsign || "").trim();

        if (!callsign) {
          return "GREEN";
        }

        return callsignGroup(callsign);
      })
      .filter(Boolean)
  );

  const officers = rows.filter(row =>
    OFFICER_RANKS.has(row.naval_rank)
  ).length;

  statTotal.textContent = rows.length;
  statGroups.textContent = groups.size;
  statOfficers.textContent = officers;
  statEnlisted.textContent = rows.length - officers;
}

function renderBoard() {
  const personnel = filteredMembers();

  renderStats(personnel);

  const greenTeam = personnel
    .filter(isGreenTeamMember)
    .sort(greenTeamSort);

  const assignedPersonnel = personnel.filter(member => {
    return String(member.callsign || "").trim().length > 0;
  });

  const slotMap = new Map();

  assignedPersonnel.forEach(member => {
    const callsign = String(member.callsign || "")
      .trim()
      .toUpperCase();

    slotMap.set(callsign, member);
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

  const regularSectionsHtml = sections.map(section => `
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
              <article class="member-card vacant-card">
                <div class="vacant-avatar">?</div>

                <div>
                  <div class="member-name">Vacant</div>
                  <div class="member-meta">Unassigned</div>

                  <div class="member-billet">
                    ${escapeHtml(
                      getBillet(callsign) || "Position Unfilled"
                    )}
                  </div>
                </div>

                <span class="badge">
                  ${escapeHtml(callsign)}
                </span>
              </article>
            `;
          }

          return `
            <article class="member-card">
              <img
                class="avatar"
                src="${escapeHtml(
                  avatarUrl(member.avatar_url) || "../../nsw.png"
                )}"
                alt=""
              >

              <div>
                <div class="member-name">
                  ${escapeHtml(member.display_name)}
                </div>

                <div class="member-meta">
                  ${escapeHtml(member.naval_rank || "")}
                </div>

                <div class="member-billet">
                  ${escapeHtml(getBillet(member.callsign))}
                </div>
              </div>

              <span class="badge">
                ${escapeHtml(member.callsign)}
              </span>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `).join("");

  const greenTeamEditable =
  canEditGreenTeam() &&
  !String(searchInput.value || "").trim();

const greenTeamHtml = `
  <section class="unit-panel green-team-panel">
    <div class="unit-title">
      <span>Green Team</span>

      ${
        greenTeamEditable
          ? `<span class="unit-title-hint">Drag to reorder</span>`
          : ""
      }
    </div>

    <div class="unit-body">
      <div class="muted green-team-description">
        ${
          greenTeamEditable
            ? "Drag members into order. The top two are Class Leads."
            : "The top two members are Class Leads."
        }
      </div>

      <div id="green-team-members">
        ${
          greenTeam.length > 0
            ? greenTeam.map((member, index) => `
                <article
                  class="member-card green-team-card"
                  data-profile-id="${escapeHtml(member.id)}"
                  draggable="${
                    greenTeamEditable ? "true" : "false"
                  }"
                >
                  <div class="drag-handle">
                    ${greenTeamEditable ? "⋮⋮" : ""}
                  </div>

                  <img
                    class="avatar"
                    src="${escapeHtml(
                      avatarUrl(member.avatar_url) ||
                      "../../nsw.png"
                    )}"
                    alt=""
                  >

                  <div>
                    <div class="member-name">
                      ${escapeHtml(member.display_name)}
                    </div>

                    <div class="member-meta">
                      ${escapeHtml(
                        member.naval_rank || "Candidate"
                      )}
                    </div>

                    <div
                      class="member-billet green-team-position-text"
                    >
                      ${escapeHtml(
                        greenTeamPositionText(index)
                      )}
                    </div>
                  </div>

                  <span
                    class="badge green-team-position-badge"
                  >
                    ${escapeHtml(greenTeamLabel(index))}
                  </span>
                </article>
              `).join("")
            : `
              <article class="member-card vacant-card">
                <div class="vacant-avatar">?</div>

                <div>
                  <div class="member-name">Vacant</div>

                  <div class="member-meta">
                    No candidate assigned
                  </div>

                  <div class="member-billet">
                    Green Team Candidate
                  </div>
                </div>

                <span class="badge">
                  CANDIDATE
                </span>
              </article>
            `
        }
      </div>
    </div>
  </section>
`;

  board.innerHTML = regularSectionsHtml + greenTeamHtml;
  bindGreenTeamDragEvents();
  setStatus(
    `${personnel.length} personnel displayed. ` +
    `${greenTeam.length} Green Team candidate${greenTeam.length === 1 ? "" : "s"}.`
  );
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