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

const state = {
  authUser: null,
  currentProfile: null,
  members: [],
  blocks: [],
  categories: [],
  items: [],
  progressRows: [],
  selectedMemberId: null,
  selectedBlockId: null,
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

  const allowed =
    await loadCurrentUser();

  if (!allowed) {
    return;
  }

  revealChecklistNavigation();

  await loadChecklistData();
}

function cacheElements() {
  elements.accessDenied =
    document.getElementById(
      "access-denied"
    );

  elements.checklistContent =
    document.getElementById(
      "checklist-content"
    );

  elements.memberSearch =
    document.getElementById(
      "member-search"
    );

  elements.memberList =
    document.getElementById(
      "member-list"
    );

  elements.memberCount =
    document.getElementById(
      "member-count"
    );

  elements.selectedMember =
    document.getElementById(
      "selected-member"
    );

  elements.selectedMemberMeta =
    document.getElementById(
      "selected-member-meta"
    );

  elements.progressSummary =
    document.getElementById(
      "progress-summary"
    );

  elements.checklistRows =
    document.getElementById(
      "checklist-rows"
    );

  elements.statusLine =
    document.getElementById(
      "status-line"
    );

  elements.refreshButton =
    document.getElementById(
      "refresh-button"
    );

  elements.blockNavigation =
    document.getElementById(
      "block-navigation"
    );

  elements.blockTabs =
    document.getElementById(
      "block-tabs"
    );
}

function bindEvents() {
  elements.memberSearch?.addEventListener(
    "input",
    event => {
      state.search =
        String(
          event.target.value || ""
        )
          .trim()
          .toLowerCase();

      renderMemberList();
    }
  );

  elements.blockTabs?.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          "[data-block-id]"
        );

      if (!button) {
        return;
      }

      state.selectedBlockId =
        Number(
          button.dataset.blockId
        );

      renderBlockTabs();
      renderMemberList();
      renderSelectedMember();
    }
  );

  elements.refreshButton?.addEventListener(
    "click",
    loadChecklistData
  );

  elements.memberList?.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
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

  elements.checklistRows?.addEventListener(
    "change",
    handleChecklistChange
  );

  elements.checklistRows?.addEventListener(
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
  } =
    await supabase.auth.getSession();

  if (
    sessionError ||
    !sessionData.session
  ) {
    window.location.href =
      "/login/";

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

  state.currentProfile =
    profile;

  if (
    !canManageChecklist(
      profile
    )
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

function canManageChecklist(
  profile
) {
  const role =
    normalize(
      profile?.role
    );

  const callsign =
    normalize(
      profile?.callsign
    );

  const rank =
    normalize(
      profile?.naval_rank
    );

  const greenTeamOrder =
    Number(
      profile?.green_team_order
    );

  const isAdmin =
    ADMIN_ROLES.has(
      role
    );

  const isTeamLeader =
    TEAM_LEADER_CALLSIGNS.has(
      callsign
    );

  const isClassLead =
    rank === "CANDIDATE" &&
    callsign === "" &&
    Number.isInteger(
      greenTeamOrder
    ) &&
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
    .forEach(
      element => {
        element.style.display =
          "";
      }
    );

  document
    .querySelectorAll(
      ".management-only-link"
    )
    .forEach(
      element => {
        element.style.display =
          "";
      }
    );
}

async function loadChecklistData() {
  setStatus(
    "Loading members and checklist records..."
  );

  elements.refreshButton.disabled =
    true;

  try {
    const [
      membersResult,
      blocksResult,
      categoriesResult,
      itemsResult,
      progressResult
    ] =
      await Promise.all([
        supabase
          .from(
            "profiles"
          )
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
            "checklist_blocks"
          )
          .select(
            [
              "id",
              "block_key",
              "block_number",
              "title",
              "description",
              "display_order",
              "active"
            ].join(",")
          )
          .eq(
            "active",
            true
          )
          .order(
            "display_order",
            {
              ascending: true
            }
          )
          .order(
            "block_number",
            {
              ascending: true
            }
          ),

        supabase
          .from(
            "checklist_categories"
          )
          .select(
            [
              "id",
              "block_id",
              "category_key",
              "title",
              "description",
              "display_order",
              "active"
            ].join(",")
          )
          .eq(
            "active",
            true
          )
          .order(
            "display_order",
            {
              ascending: true
            }
          ),

        supabase
          .from(
            "checklist_items"
          )
          .select(
            [
              "id",
              "category_id",
              "item_key",
              "title",
              "standard",
              "minimum_sessions",
              "track_sessions",
              "track_best_run",
              "track_notes",
              "completion_allowed",
              "display_order",
              "active"
            ].join(",")
          )
          .eq(
            "active",
            true
          )
          .order(
            "display_order",
            {
              ascending: true
            }
          ),

        supabase
          .from(
            "checklist_progress"
          )
          .select(
            [
              "id",
              "member_id",
              "item_id",
              "completed",
              "session_count",
              "best_run",
              "notes",
              "updated_by",
              "completed_by",
              "completed_at",
              "updated_at"
            ].join(",")
          )
      ]);

    const results = [
      [
        "members",
        membersResult
      ],
      [
        "blocks",
        blocksResult
      ],
      [
        "categories",
        categoriesResult
      ],
      [
        "items",
        itemsResult
      ],
      [
        "progress",
        progressResult
      ]
    ];

    const failedResult =
      results.find(
        (
          [
            ,
            result
          ]
        ) =>
          result.error
      );

    if (failedResult) {
      const [
        name,
        result
      ] =
        failedResult;

      setStatus(
        `Could not load ${name}: ` +
        result.error.message,
        "error"
      );

      return;
    }

    state.members =
      membersResult.data ||
      [];

    state.blocks =
      blocksResult.data ||
      [];

    state.categories =
      categoriesResult.data ||
      [];

    state.items =
      itemsResult.data ||
      [];

    state.progressRows =
      progressResult.data ||
      [];

    const selectedMemberExists =
      state.members.some(
        member =>
          member.id ===
          state.selectedMemberId
      );

    if (
      !selectedMemberExists
    ) {
      state.selectedMemberId =
        state.members[0]?.id ||
        null;
    }

    const selectedBlockExists =
      state.blocks.some(
        block =>
          block.id ===
          state.selectedBlockId
      );

    if (
      !selectedBlockExists
    ) {
      state.selectedBlockId =
        state.blocks[0]?.id ||
        null;
    }

    elements.blockNavigation.style.display =
      state.blocks.length
        ? "block"
        : "none";

    renderBlockTabs();
    renderMemberList();
    renderSelectedMember();
    clearStatus();
  } catch (error) {
    setStatus(
      "Could not load checklist data: " +
      error.message,
      "error"
    );
  } finally {
    elements.refreshButton.disabled =
      false;
  }
}

function getSelectedBlock() {
  return (
    state.blocks.find(
      block =>
        block.id ===
        state.selectedBlockId
    ) ||
    null
  );
}

function getSelectedBlockCategories() {
  return state.categories.filter(
    category =>
      category.block_id ===
      state.selectedBlockId
  );
}

function getCategoryItems(
  categoryId
) {
  return state.items.filter(
    item =>
      item.category_id ===
      categoryId
  );
}

function getSelectedBlockItems() {
  const categoryIds =
    new Set(
      getSelectedBlockCategories()
        .map(
          category =>
            category.id
        )
    );

  return state.items.filter(
    item =>
      categoryIds.has(
        item.category_id
      )
  );
}

function renderBlockTabs() {
  if (
    !state.blocks.length
  ) {
    elements.blockTabs.innerHTML =
      "";

    return;
  }

  elements.blockTabs.innerHTML =
    state.blocks
      .map(
        block => {
          const active =
            block.id ===
            state.selectedBlockId
              ? " active"
              : "";

          return `
            <button
              class="block-tab${active}"
              type="button"
              data-block-id="${block.id}"
            >
              <span class="block-tab-number">
                Block ${block.block_number}
              </span>

              <span class="block-tab-title">
                ${escapeHtml(
                  block.title
                )}
              </span>
            </button>
          `;
        }
      )
      .join("");
}

function renderMemberList() {
  const blockItems =
    getSelectedBlockItems();

  const filteredMembers =
    state.members.filter(
      member => {
        if (
          !state.search
        ) {
          return true;
        }

        const searchText =
          [
            member.display_name,
            member.user_id,
            member.callsign,
            member.naval_rank,
            getMemberPosition(
              member
            )
          ]
            .join(" ")
            .toLowerCase();

        return searchText.includes(
          state.search
        );
      }
    );

  elements.memberCount.textContent =
    `${filteredMembers.length} of ` +
    `${state.members.length} members`;

  if (
    !filteredMembers.length
  ) {
    elements.memberList.innerHTML = `
      <div class="empty-state">
        No members match the current search.
      </div>
    `;

    return;
  }

  elements.memberList.innerHTML =
    filteredMembers
      .map(
        member => {
          const completed =
            countCompletedItems(
              member.id,
              blockItems
            );

          const total =
            blockItems.length;

          const percent =
            total > 0
              ? Math.round(
                  (
                    completed /
                    total
                  ) * 100
                )
              : 0;

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
              data-member-id="${escapeHtml(
                member.id
              )}"
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
                  ${escapeHtml(
                    memberName
                  )}
                </strong>

                <span>
                  ${escapeHtml(
                    getMemberPosition(
                      member
                    )
                  )}
                </span>
              </span>

              <span class="member-progress">
                <strong>
                  ${completed}/${total}
                </strong>

                <span>
                  ${percent}%
                </span>
              </span>
            </button>
          `;
        }
      )
      .join("");
}

function renderChecklistItem(
  member,
  item,
  index
) {
  const row =
    getProgress(
      member.id,
      item.id
    );

  const completedChecked =
    row.completed
      ? " checked"
      : "";

  const completedClass =
    row.completed
      ? " complete"
      : "";

  const completionDisabled =
    item.completion_allowed
      ? ""
      : " disabled";

  const minimumText =
    item.minimum_sessions > 0
      ? `
        <span class="minimum-standard">
          Minimum ${item.minimum_sessions}
          session${
            item.minimum_sessions === 1
              ? ""
              : "s"
          } required
        </span>
      `
      : "";

  const sessionsField =
    item.track_sessions
      ? `
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
      `
      : "";

  const bestRunField =
    item.track_best_run
      ? `
        <label>
          <span>
            Best Recorded Run
          </span>

          <input
            type="text"
            maxlength="120"
            value="${escapeHtml(
              row.best_run
            )}"
            placeholder="Time, score, date, or short result"
            data-field="best_run"
          >
        </label>
      `
      : "";

  const notesField =
    item.track_notes
      ? `
        <label class="notes-field">
          <span>
            Instructor Notes
          </span>

          <textarea
            maxlength="2000"
            rows="2"
            placeholder="Performance notes, deficiencies, or retraining requirements"
            data-field="notes"
          >${escapeHtml(
            row.notes
          )}</textarea>
        </label>
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
      data-item-id="${item.id}"
    >
      <div class="item-number">
        ${String(
          index + 1
        ).padStart(
          2,
          "0"
        )}
      </div>

      <div class="item-content">
        <div class="item-heading">
          <label class="completion-control">
            <input
              type="checkbox"
              data-field="completed"
              ${completedChecked}
              ${completionDisabled}
            >

            <span>
              ${escapeHtml(
                item.title
              )}
            </span>
          </label>

          ${minimumText}
        </div>

        ${
          item.standard
            ? `
              <p class="item-standard">
                ${escapeHtml(
                  item.standard
                )}
              </p>
            `
            : ""
        }

        <div class="item-fields">
          ${sessionsField}
          ${bestRunField}
          ${notesField}
        </div>

        <div class="item-footer">
          <span data-save-state>
            Saved
          </span>

          <span>
            ${escapeHtml(
              updatedText
            )}
          </span>
        </div>
      </div>
    </article>
  `;
}

function renderSelectedMember() {
  const member =
    getSelectedMember();

  const block =
    getSelectedBlock();

  if (
    !member
  ) {
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

  if (
    !block
  ) {
    elements.selectedMember.textContent =
      member.display_name ||
      member.user_id ||
      "Unnamed Member";

    elements.selectedMemberMeta.textContent =
      "";

    elements.progressSummary.innerHTML =
      "";

    elements.checklistRows.innerHTML = `
      <div class="empty-state">
        No checklist blocks are currently active.
      </div>
    `;

    return;
  }

  elements.selectedMember.textContent =
    member.display_name ||
    member.user_id ||
    "Unnamed Member";

  elements.selectedMemberMeta.innerHTML = `
    ${escapeHtml(
      [
        member.callsign ||
          "No callsign",

        member.naval_rank ||
          "No rank",

        getMemberPosition(
          member
        )
      ].join(" | ")
    )}

    <div class="block-description">
      Block ${block.block_number}:
      ${escapeHtml(
        block.title
      )}
    </div>
  `;

  const blockItems =
    getSelectedBlockItems();

  const completed =
    countCompletedItems(
      member.id,
      blockItems
    );

  const total =
    blockItems.length;

  const percent =
    total > 0
      ? Math.round(
          (
            completed /
            total
          ) * 100
        )
      : 0;

  elements.progressSummary.innerHTML = `
    <div class="summary-stat">
      <span>
        Completed
      </span>

      <strong>
        ${completed} / ${total}
      </strong>
    </div>

    <div class="summary-stat">
      <span>
        Block Progress
      </span>

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

  const categories =
    getSelectedBlockCategories();

  if (
    !categories.length
  ) {
    elements.checklistRows.innerHTML = `
      <div class="empty-state">
        This block has no active categories.
      </div>
    `;

    return;
  }

  elements.checklistRows.innerHTML =
    categories
      .map(
        category => {
          const items =
            getCategoryItems(
              category.id
            );

          const categoryItemsHtml =
            items.length
              ? items
                  .map(
                    (
                      item,
                      index
                    ) =>
                      renderChecklistItem(
                        member,
                        item,
                        index
                      )
                  )
                  .join("")
              : `
                <div class="empty-state">
                  This category has no active items.
                </div>
              `;

          return `
            <section class="category-section">
              <div class="category-heading">
                <h3>
                  ${escapeHtml(
                    category.title
                  )}
                </h3>

                ${
                  category.description
                    ? `
                      <p>
                        ${escapeHtml(
                          category.description
                        )}
                      </p>
                    `
                    : ""
                }
              </div>

              <div class="category-items">
                ${categoryItemsHtml}
              </div>
            </section>
          `;
        }
      )
      .join("");
}

function handleChecklistInput(
  event
) {
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
      "[data-item-id]"
    );

  if (
    !itemElement
  ) {
    return;
  }

  setItemSaveState(
    itemElement,
    "Unsaved changes",
    "pending"
  );
}

async function handleChecklistChange(
  event
) {
  const field =
    event.target.dataset.field;

  const itemElement =
    event.target.closest(
      "[data-item-id]"
    );

  if (
    !field ||
    !itemElement
  ) {
    return;
  }

  const itemId =
    Number(
      itemElement.dataset.itemId
    );

  const item =
    state.items.find(
      candidate =>
        candidate.id ===
        itemId
    );

  if (
    !item
  ) {
    return;
  }

  if (
    field === "completed" &&
    event.target.checked &&
    item.minimum_sessions > 0
  ) {
    const sessionsInput =
      itemElement.querySelector(
        '[data-field="session_count"]'
      );

    const sessionCount =
      sanitizeSessionCount(
        sessionsInput?.value
      );

    if (
      sessionCount <
      item.minimum_sessions
    ) {
      event.target.checked =
        false;

      setItemSaveState(
        itemElement,
        "Completion requires at least " +
        `${item.minimum_sessions} ` +
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

  if (
    !member
  ) {
    return;
  }

  const saveKey =
    `${member.id}:${item.id}`;

  if (
    state.saving.has(
      saveKey
    )
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

  const existingProgress =
    getProgress(
      member.id,
      item.id
    );

  const completed =
    completedInput
      ? completedInput.checked
      : existingProgress.completed;

  const sessionCount =
    sessionsInput
      ? sanitizeSessionCount(
          sessionsInput.value
        )
      : existingProgress.session_count;

  const bestRun =
    bestRunInput
      ? (
          bestRunInput.value.trim() ||
          null
        )
      : (
          existingProgress.best_run ||
          null
        );

  const notes =
    notesInput
      ? (
          notesInput.value.trim() ||
          null
        )
      : (
          existingProgress.notes ||
          null
        );

  const now =
    new Date().toISOString();

  const wasJustCompleted =
    completed &&
    !existingProgress.completed;

  const wasReopened =
    !completed &&
    existingProgress.completed;

  const payload = {
    member_id:
      member.id,

    item_id:
      item.id,

    completed,

    session_count:
      sessionCount,

    best_run:
      bestRun,

    notes,

    updated_by:
      state.authUser.id,

    completed_by:
      wasJustCompleted
        ? state.authUser.id
        : wasReopened
          ? null
          : existingProgress.completed_by,

    completed_at:
      wasJustCompleted
        ? now
        : wasReopened
          ? null
          : existingProgress.completed_at
  };

  if (
    item.minimum_sessions > 0 &&
    payload.completed &&
    payload.session_count <
      item.minimum_sessions
  ) {
    if (
      completedInput
    ) {
      completedInput.checked =
        false;
    }

    payload.completed =
      false;

    payload.completed_by =
      null;

    payload.completed_at =
      null;
  }

  state.saving.add(
    saveKey
  );

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
      "checklist_progress"
    )
    .upsert(
      payload,
      {
        onConflict:
          "member_id,item_id"
      }
    )
    .select(
      [
        "id",
        "member_id",
        "item_id",
        "completed",
        "session_count",
        "best_run",
        "notes",
        "updated_by",
        "completed_by",
        "completed_at",
        "updated_at"
      ].join(",")
    )
    .single();

  state.saving.delete(
    saveKey
  );

  setItemDisabled(
    itemElement,
    false
  );

  if (
    error
  ) {
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
        row.item_id ===
          data.item_id
    );

  if (
    existingIndex >= 0
  ) {
    state.progressRows[
      existingIndex
    ] =
      data;
  } else {
    state.progressRows.push(
      data
    );
  }

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
  itemId
) {
  const row =
    state.progressRows.find(
      progress =>
        progress.member_id ===
          memberId &&
        progress.item_id ===
          itemId
    );

  return {
    completed:
      Boolean(
        row?.completed
      ),

    session_count:
      sanitizeSessionCount(
        row?.session_count
      ),

    best_run:
      String(
        row?.best_run ||
        ""
      ),

    notes:
      String(
        row?.notes ||
        ""
      ),

    updated_by:
      row?.updated_by ||
      null,

    completed_by:
      row?.completed_by ||
      null,

    completed_at:
      row?.completed_at ||
      null,

    updated_at:
      row?.updated_at ||
      null
  };
}

function countCompletedItems(
  memberId,
  items = state.items
) {
  return items.reduce(
    (
      total,
      item
    ) => {
      const progress =
        getProgress(
          memberId,
          item.id
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

function getMemberPosition(
  member
) {
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

  if (
    isClassLead
  ) {
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

function sanitizeSessionCount(
  value
) {
  const parsed =
    Number.parseInt(
      value,
      10
    );

  if (
    !Number.isFinite(
      parsed
    ) ||
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
    .forEach(
      input => {
        input.disabled =
          disabled;
      }
    );
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

  if (
    !target
  ) {
    return;
  }

  target.textContent =
    message;

  target.className =
    stateName
      ? `save-state ${stateName}`
      : "save-state";
}

function showAccessDenied(
  message
) {
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

function normalize(
  value
) {
  return String(
    value ||
    ""
  )
    .trim()
    .toUpperCase();
}

function formatDateTime(
  value
) {
  const date =
    new Date(
      value
    );

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
      year:
        "numeric",

      month:
        "short",

      day:
        "2-digit",

      hour:
        "2-digit",

      minute:
        "2-digit"
    }
  ).format(
    date
  );
}

function escapeHtml(
  value
) {
  return String(
    value ??
    ""
  )
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