import { supabase } from "/js/auth.js";
import { renderPortalLayout } from "/js/portal-layout.js";

renderPortalLayout("checklist");

const TEAM_LEADER_CALLSIGNS = new Set([
  "EG1",
  "EH1",
  "EI1"
]);

const ADMIN_ROLES = new Set([
  "ADMIN",
  "SUPERADMIN"
]);

const CQB_ITEMS = [
  {
    key: "basic_warmups",

    title: "Basic CQB Warm-Ups",

    standard:
      "Demonstrates safe weapon handling, controlled movement, " +
      "muzzle awareness, communication, and correct entry " +
      "fundamentals during introductory repetitions."
  },

  {
    key: "small_team_no_flanks",

    title: "2-4 Person Runs: No Flanks",

    standard:
      "Completes deliberate 2-4 person clearance runs in " +
      "uncomplicated layouts without exposed flank problems, " +
      "while maintaining spacing, sectors, and team flow."
  },

  {
    key: "small_team_furniture_barricades",

    title: "2-4 Person Runs: Furniture and Barricades",

    standard:
      "Maintains safe and effective clearance procedures while " +
      "negotiating furniture, barricades, restricted movement, " +
      "and altered room geometry."
  },

  {
    key: "six_person_live_fire_breaching",

    title: "6-Person Runs: Live Fire and Breaching",

    standard:
      "Operates safely and effectively as part of a six-person " +
      "element during live-fire clearance and integrated " +
      "breaching iterations."
  },

  {
    key: "small_team_flanks",

    title: "2-4 Person Runs: Flank Exposure",

    standard:
      "Identifies, communicates, and controls exposed flanks " +
      "during 2-4 person clearance runs without losing momentum " +
      "or sector responsibility."
  },

  {
    key: "friendly_hot_wall",

    title: "Up to 6-Person Friendly Hot-Wall Drill",

    standard:
      "Recognizes and manages friendly hot-wall conditions, " +
      "prevents crossfire, and maintains positive identification " +
      "and disciplined sectors with up to six personnel."
  },

  {
    key: "slot_one_integration",

    title: "Slot-One Integration",

    standard:
      "Performs the slot-one position when appropriate, making " +
      "sound entry, movement, threat-prioritization, and " +
      "communication decisions."
  },

  {
    key: "dynamic_final_evaluations",

    title: "Final Dynamic Evaluations",

    standard:
      "Completes instructor-led dynamic environments and " +
      "force-on-force evaluations while adapting to uncertainty, " +
      "opposition, and changing tactical problems."
  },

  {
    key: "bounding_and_range_shooting",

    title: "Basic Bounding and Range Shooting",

    standard:
      "Demonstrates proficient basic bounding, communication, " +
      "movement, and shooting standards across a minimum of two " +
      "separate training sessions.",

    minimumSessions: 2
  }
];

const state = {
  authUser: null,

  currentProfile: null,

  members: [],

  progressRows: [],

  selectedMemberId: null,

  search: "",

  saving: new Set()
};

const elements = {};

document.addEventListener(
  "DOMContentLoaded",
  initialize
);

async function initialize() {
  cacheElements();

  bindEvents();

  const allowed = await loadCurrentUser();

  if (!allowed) {
    return;
  }

  revealChecklistNavigation();

  await loadChecklistData();
}

function cacheElements() {
  elements.accessDenied =
    document.getElementById("access-denied");

  elements.checklistContent =
    document.getElementById("checklist-content");

  elements.memberSearch =
    document.getElementById("member-search");

  elements.memberList =
    document.getElementById("member-list");

  elements.memberCount =
    document.getElementById("member-count");

  elements.selectedMember =
    document.getElementById("selected-member");

  elements.selectedMemberMeta =
    document.getElementById("selected-member-meta");

  elements.progressSummary =
    document.getElementById("progress-summary");

  elements.checklistRows =
    document.getElementById("checklist-rows");

  elements.statusLine =
    document.getElementById("status-line");

  elements.refreshButton =
    document.getElementById("refresh-button");
}

function bindEvents() {
  elements.memberSearch.addEventListener(
    "input",
    event => {
      state.search = String(
        event.target.value || ""
      )
        .trim()
        .toLowerCase();

      renderMemberList();
    }
  );

  elements.refreshButton.addEventListener(
    "click",
    loadChecklistData
  );

  elements.memberList.addEventListener(
    "click",
    event => {
      const button = event.target.closest(
        "[data-member-id]"
      );

      if (!button) {
        return;
      }

      state.selectedMemberId =
        button.dataset.memberId;

      renderMemberList();

      renderSelectedMember();
    }
  );

  elements.checklistRows.addEventListener(
    "change",
    handleChecklistChange
  );

  elements.checklistRows.addEventListener(
    "input",
    handleChecklistInput
  );
}

async function loadCurrentUser() {
  setStatus(
    "Confirming checklist access..."
  );

  const {
    data: sessionData,
    error: sessionError
  } = await supabase.auth.getSession();

  if (
    sessionError ||
    !sessionData.session
  ) {
    window.location.href = "/login/";

    return false;
  }

  state.authUser =
    sessionData.session.user;

  const {
    data: profile,
    error: profileError
  } = await supabase
    .from("profiles")
    .select(
      [
        "id",
        "user_id",
        "display_name",
        "role",
        "status",
        "avatar_url",
        "callsign",
        "naval_rank",
        "green_team_order"
      ].join(",")
    )
    .eq(
      "id",
      state.authUser.id
    )
    .maybeSingle();

  if (
    profileError ||
    !profile
  ) {
    showAccessDenied(
      "Your member profile could not be loaded."
    );

    return false;
  }

  state.currentProfile = profile;

  if (
    !canManageChecklist(profile)
  ) {
    showAccessDenied(
      "This page is restricted to administrators, " +
      "team leaders, and Green Team class leads."
    );

    return false;
  }

  elements.accessDenied.style.display =
    "none";

  elements.checklistContent.style.display =
    "grid";

  clearStatus();

  return true;
}

function canManageChecklist(profile) {
  const role = normalize(
    profile?.role
  );

  const callsign = normalize(
    profile?.callsign
  );

  const rank = normalize(
    profile?.naval_rank
  );

  const greenTeamOrder = Number(
    profile?.green_team_order
  );

  const isAdmin =
    ADMIN_ROLES.has(role);

  const isTeamLeader =
    TEAM_LEADER_CALLSIGNS.has(callsign);

  const isClassLead =
    rank === "CANDIDATE" &&
    callsign === "" &&
    Number.isInteger(greenTeamOrder) &&
    greenTeamOrder >= 1 &&
    greenTeamOrder <= 2;

  return (
    isAdmin ||
    isTeamLeader ||
    isClassLead
  );
}

function revealChecklistNavigation() {
  document
    .querySelectorAll(
      ".checklist-only-link"
    )
    .forEach(element => {
      element.style.display = "";
    });

  document
    .querySelectorAll(
      ".management-only-link"
    )
    .forEach(element => {
      element.style.display = "";
    });
}

async function loadChecklistData() {
  setStatus(
    "Loading members and CQB records..."
  );

  elements.refreshButton.disabled = true;

  const [
    membersResult,
    progressResult
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        [
          "id",
          "user_id",
          "display_name",
          "role",
          "status",
          "avatar_url",
          "callsign",
          "naval_rank",
          "green_team_order"
        ].join(",")
      )
      .eq(
        "status",
        "ACTIVE"
      )
      .order(
        "display_name",
        {
          ascending: true
        }
      ),

    supabase
      .from(
        "cqb_checklist_progress"
      )
      .select(
        [
          "id",
          "member_id",
          "item_key",
          "completed",
          "session_count",
          "best_run",
          "notes",
          "updated_by",
          "updated_at"
        ].join(",")
      )
  ]);

  elements.refreshButton.disabled = false;

  if (membersResult.error) {
    setStatus(
      "Could not load members: " +
      membersResult.error.message,
      "error"
    );

    return;
  }

  if (progressResult.error) {
    setStatus(
      "Could not load CQB records: " +
      progressResult.error.message,
      "error"
    );

    return;
  }

  state.members =
    membersResult.data || [];

  state.progressRows =
    progressResult.data || [];

  const selectedMemberStillExists =
    state.members.some(
      member =>
        member.id ===
        state.selectedMemberId
    );

  if (
    !state.selectedMemberId ||
    !selectedMemberStillExists
  ) {
    state.selectedMemberId =
      state.members[0]?.id || null;
  }

  renderMemberList();

  renderSelectedMember();

  clearStatus();
}

function renderMemberList() {
  const filteredMembers =
    state.members.filter(member => {
      if (!state.search) {
        return true;
      }

      const searchText = [
        member.display_name,
        member.user_id,
        member.callsign,
        member.naval_rank,
        getMemberPosition(member)
      ]
        .join(" ")
        .toLowerCase();

      return searchText.includes(
        state.search
      );
    });

  elements.memberCount.textContent =
    `${filteredMembers.length} of ` +
    `${state.members.length} members`;

  if (!filteredMembers.length) {
    elements.memberList.innerHTML = `
      <div class="empty-state">
        No members match the current search.
      </div>
    `;

    return;
  }

  elements.memberList.innerHTML =
    filteredMembers
      .map(member => {
        const completed =
          countCompletedItems(member.id);

        const percent =
          Math.round(
            (
              completed /
              CQB_ITEMS.length
            ) * 100
          );

        const active =
          member.id ===
          state.selectedMemberId
            ? " active"
            : "";

        const memberName =
          member.display_name ||
          member.user_id ||
          "Unnamed Member";

        return `
          <button
            class="member-row${active}"
            type="button"
            data-member-id="${escapeHtml(member.id)}"
          >
            <img
              class="member-avatar"
              src="${escapeHtml(
                member.avatar_url ||
                "/nsw.png"
              )}"
              alt=""
            >

            <span class="member-row-main">
              <strong>
                ${escapeHtml(memberName)}
              </strong>

              <span>
                ${escapeHtml(
                  getMemberPosition(member)
                )}
              </span>
            </span>

            <span class="member-progress">
              <strong>
                ${completed}/${CQB_ITEMS.length}
              </strong>

              <span>
                ${percent}%
              </span>
            </span>
          </button>
        `;
      })
      .join("");
}

function renderSelectedMember() {
  const member =
    getSelectedMember();

  if (!member) {
    elements.selectedMember.textContent =
      "No member selected";

    elements.selectedMemberMeta.textContent =
      "";

    elements.progressSummary.innerHTML =
      "";

    elements.checklistRows.innerHTML = `
      <div class="empty-state">
        No active members are available.
      </div>
    `;

    return;
  }

  elements.selectedMember.textContent =
    member.display_name ||
    member.user_id ||
    "Unnamed Member";

  elements.selectedMemberMeta.textContent =
    [
      member.callsign || "No callsign",
      member.naval_rank || "No rank",
      getMemberPosition(member)
    ].join(" | ");

  const completed =
    countCompletedItems(member.id);

  const percent =
    Math.round(
      (
        completed /
        CQB_ITEMS.length
      ) * 100
    );

  elements.progressSummary.innerHTML = `
    <div class="summary-stat">
      <span>Completed</span>

      <strong>
        ${completed} / ${CQB_ITEMS.length}
      </strong>
    </div>

    <div class="summary-stat">
      <span>Overall Progress</span>

      <strong>
        ${percent}%
      </strong>
    </div>

    <div
      class="progress-track"
      aria-label="${percent}% complete"
    >
      <div
        class="progress-fill"
        style="width:${percent}%"
      ></div>
    </div>
  `;

  elements.checklistRows.innerHTML =
    CQB_ITEMS
      .map(
        (item, index) => {
          const row = getProgress(
            member.id,
            item.key
          );

          const completedChecked =
            row.completed
              ? " checked"
              : "";

          const completedClass =
            row.completed
              ? " complete"
              : "";

          const minimumText =
            item.minimumSessions
              ? `
                <span class="minimum-standard">
                  Minimum ${item.minimumSessions}
                  sessions required
                </span>
              `
              : "";

          const updatedText =
            row.updated_at
              ? "Last updated " +
                formatDateTime(
                  row.updated_at
                )
              : "No record entered";

          return `
            <article
              class="checklist-item${completedClass}"
              data-item-key="${escapeHtml(item.key)}"
            >
              <div class="item-number">
                ${String(index + 1).padStart(2, "0")}
              </div>

              <div class="item-content">
                <div class="item-heading">
                  <label class="completion-control">
                    <input
                      type="checkbox"
                      data-field="completed"
                      ${completedChecked}
                    >

                    <span>
                      ${escapeHtml(item.title)}
                    </span>
                  </label>

                  ${minimumText}
                </div>

                <p class="item-standard">
                  ${escapeHtml(item.standard)}
                </p>

                <div class="item-fields">
                  <label>
                    <span>
                      Sessions Completed
                    </span>

                    <input
                      type="number"
                      min="0"
                      max="999"
                      step="1"
                      value="${row.session_count}"
                      data-field="session_count"
                    >
                  </label>

                  <label>
                    <span>
                      Best Recorded Run
                    </span>

                    <input
                      type="text"
                      maxlength="120"
                      value="${escapeHtml(row.best_run)}"
                      placeholder="Time, score, date, or short result"
                      data-field="best_run"
                    >
                  </label>

                  <label class="notes-field">
                    <span>
                      Instructor Notes
                    </span>

                    <textarea
                      maxlength="2000"
                      rows="2"
                      placeholder="Performance notes, deficiencies, or retraining requirements"
                      data-field="notes"
                    >${escapeHtml(row.notes)}</textarea>
                  </label>
                </div>

                <div class="item-footer">
                  <span data-save-state>
                    Saved
                  </span>

                  <span>
                    ${escapeHtml(updatedText)}
                  </span>
                </div>
              </div>
            </article>
          `;
        }
      )
      .join("");
}

function handleChecklistInput(event) {
  const field =
    event.target.dataset.field;

  if (
    !field ||
    field === "completed"
  ) {
    return;
  }

  const itemElement =
    event.target.closest(
      "[data-item-key]"
    );

  if (!itemElement) {
    return;
  }

  setItemSaveState(
    itemElement,
    "Unsaved changes",
    "pending"
  );
}

async function handleChecklistChange(event) {
  const field =
    event.target.dataset.field;

  const itemElement =
    event.target.closest(
      "[data-item-key]"
    );

  if (
    !field ||
    !itemElement
  ) {
    return;
  }

  const itemKey =
    itemElement.dataset.itemKey;

  const item =
    CQB_ITEMS.find(
      candidate =>
        candidate.key === itemKey
    );

  if (!item) {
    return;
  }

  if (
    field === "completed" &&
    event.target.checked &&
    item.minimumSessions
  ) {
    const sessionsInput =
      itemElement.querySelector(
        '[data-field="session_count"]'
      );

    const sessionCount =
      sanitizeSessionCount(
        sessionsInput.value
      );

    if (
      sessionCount <
      item.minimumSessions
    ) {
      event.target.checked = false;

      setItemSaveState(
        itemElement,
        "Completion requires at least " +
          `${item.minimumSessions} ` +
          "recorded sessions.",
        "error"
      );

      return;
    }
  }

  await saveChecklistItem(
    itemElement,
    item
  );
}

async function saveChecklistItem(
  itemElement,
  item
) {
  const member =
    getSelectedMember();

  if (!member) {
    return;
  }

  const saveKey =
    `${member.id}:${item.key}`;

  if (
    state.saving.has(saveKey)
  ) {
    return;
  }

  const completedInput =
    itemElement.querySelector(
      '[data-field="completed"]'
    );

  const sessionsInput =
    itemElement.querySelector(
      '[data-field="session_count"]'
    );

  const bestRunInput =
    itemElement.querySelector(
      '[data-field="best_run"]'
    );

  const notesInput =
    itemElement.querySelector(
      '[data-field="notes"]'
    );

  const payload = {
    member_id: member.id,

    item_key: item.key,

    completed:
      completedInput.checked,

    session_count:
      sanitizeSessionCount(
        sessionsInput.value
      ),

    best_run:
      bestRunInput.value.trim() ||
      null,

    notes:
      notesInput.value.trim() ||
      null,

    updated_by:
      state.authUser.id,

    updated_at:
      new Date().toISOString()
  };

  if (
    item.minimumSessions &&
    payload.completed &&
    payload.session_count <
      item.minimumSessions
  ) {
    completedInput.checked = false;

    payload.completed = false;
  }

  state.saving.add(saveKey);

  setItemSaveState(
    itemElement,
    "Saving...",
    "saving"
  );

  setItemDisabled(
    itemElement,
    true
  );

  const {
    data,
    error
  } = await supabase
    .from(
      "cqb_checklist_progress"
    )
    .upsert(
      payload,
      {
        onConflict:
          "member_id,item_key"
      }
    )
    .select(
      [
        "id",
        "member_id",
        "item_key",
        "completed",
        "session_count",
        "best_run",
        "notes",
        "updated_by",
        "updated_at"
      ].join(",")
    )
    .single();

  state.saving.delete(saveKey);

  setItemDisabled(
    itemElement,
    false
  );

  if (error) {
    setItemSaveState(
      itemElement,
      "Save failed: " +
        error.message,
      "error"
    );

    return;
  }

  const existingIndex =
    state.progressRows.findIndex(
      row =>
        row.member_id ===
          data.member_id &&
        row.item_key ===
          data.item_key
    );

  if (
    existingIndex >= 0
  ) {
    state.progressRows[
      existingIndex
    ] = data;
  } else {
    state.progressRows.push(data);
  }

  setItemSaveState(
    itemElement,
    "Saved",
    "saved"
  );

  renderMemberList();

  renderSelectedMember();
}

function getSelectedMember() {
  return (
    state.members.find(
      member =>
        member.id ===
        state.selectedMemberId
    ) ||
    null
  );
}

function getProgress(
  memberId,
  itemKey
) {
  const row =
    state.progressRows.find(
      progress =>
        progress.member_id ===
          memberId &&
        progress.item_key ===
          itemKey
    );

  return {
    completed:
      Boolean(row?.completed),

    session_count:
      sanitizeSessionCount(
        row?.session_count
      ),

    best_run:
      String(
        row?.best_run || ""
      ),

    notes:
      String(
        row?.notes || ""
      ),

    updated_at:
      row?.updated_at || null
  };
}

function countCompletedItems(
  memberId
) {
  return CQB_ITEMS.reduce(
    (total, item) => {
      const progress =
        getProgress(
          memberId,
          item.key
        );

      return (
        total +
        (
          progress.completed
            ? 1
            : 0
        )
      );
    },
    0
  );
}

function getMemberPosition(member) {
  const callsign =
    normalize(
      member?.callsign
    );

  const rank =
    normalize(
      member?.naval_rank
    );

  const greenTeamOrder =
    Number(
      member?.green_team_order
    );

  if (
    TEAM_LEADER_CALLSIGNS.has(
      callsign
    )
  ) {
    return "Team Leader";
  }

  const isClassLead =
    rank === "CANDIDATE" &&
    callsign === "" &&
    Number.isInteger(
      greenTeamOrder
    ) &&
    greenTeamOrder >= 1 &&
    greenTeamOrder <= 2;

  if (isClassLead) {
    return "Green Team Class Lead";
  }

  if (
    rank === "CANDIDATE"
  ) {
    return "Green Team Candidate";
  }

  return (
    member?.role ||
    "Member"
  );
}

function sanitizeSessionCount(value) {
  const parsed =
    Number.parseInt(
      value,
      10
    );

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return 0;
  }

  return Math.min(
    parsed,
    999
  );
}

function setItemDisabled(
  itemElement,
  disabled
) {
  itemElement
    .querySelectorAll(
      "input, textarea"
    )
    .forEach(input => {
      input.disabled = disabled;
    });
}

function setItemSaveState(
  itemElement,
  message,
  stateName = ""
) {
  const target =
    itemElement.querySelector(
      "[data-save-state]"
    );

  if (!target) {
    return;
  }

  target.textContent = message;

  target.className =
    stateName
      ? `save-state ${stateName}`
      : "save-state";
}

function showAccessDenied(message) {
  elements.accessDenied.textContent =
    message;

  elements.accessDenied.style.display =
    "block";

  elements.checklistContent.style.display =
    "none";

  setStatus(
    "Access denied.",
    "error"
  );
}

function setStatus(
  message,
  type = ""
) {
  elements.statusLine.textContent =
    message;

  elements.statusLine.className =
    type
      ? `status-line ${type}`
      : "status-line";
}

function clearStatus() {
  setStatus("");
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function formatDateTime(value) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}