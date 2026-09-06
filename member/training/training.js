import { supabase } from "/js/auth.js";
import { renderPortalLayout } from "/js/portal-layout.js";

const TRAINING_DISCORD_WEBHOOK =
  "https://discord.com/api/webhooks/1530732785390850099/VL4qWIFgveFl7JBwkAg7k8zvjLLFRmoRAM9P7GH_aPe8zl4OiSlPmX8X2pOqBPMTvvZ0";

const INNER_TEAM_DISCORD_WEBHOOK =
  "https://discordapp.com/api/webhooks/1543740021511819315/KV5iMJwoe6lyQxj2IwusGSNsyyqfFdMBapNkdVAom5wn436Xc6T89d6iGGgIdq4O4RXw";

const PORTAL_BASE_URL = "https://www.rsqdn.com";

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
  sessionMembers: [],
  activeSessionId: null,
  hasNswMedicQualification: false,
};

const el = {};

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  cacheElements();
  bindEvents();
  updateAudienceField();

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
  el.targetClass = document.getElementById("training-target-class");
  el.status = document.getElementById("training-status");
  el.title = document.getElementById("training-title");
  el.start = document.getElementById("training-start");
  el.end = document.getElementById("training-end");
  el.location = document.getElementById("training-location");
  el.description = document.getElementById("training-description");
  el.discordPing = document.getElementById("training-discord-ping");

  el.saveButton = document.getElementById("save-training-button");
  el.resetButton = document.getElementById("reset-training-button");
  el.statusLine = document.getElementById("training-status-line");

  el.search = document.getElementById("training-search");
  el.categoryFilter = document.getElementById("training-category-filter");
  el.statusFilter = document.getElementById("training-status-filter");
  el.refreshButton = document.getElementById("refresh-training-button");

  el.search = document.getElementById("training-search");

  el.categoryFilter = document.getElementById("training-category-filter");

  el.statusFilter = document.getElementById("training-status-filter");

  el.refreshButton = document.getElementById("refresh-training-button");

  el.output = document.getElementById("training-output");

  el.viewer = document.getElementById("training-viewer");

  el.composeToggle = document.getElementById("training-compose-toggle");

  el.composeClose = document.getElementById("training-compose-close");

  el.composer = document.getElementById("training-composer");

  el.sessionCount = document.getElementById("training-session-count");
}

function bindEvents() {
  el.logoutButton?.addEventListener("click", doLogout);

  el.saveButton?.addEventListener("click", saveTraining);

  el.resetButton?.addEventListener("click", resetForm);

  el.refreshButton?.addEventListener("click", loadData);

  el.search?.addEventListener("input", renderSessions);

  el.categoryFilter?.addEventListener("change", renderSessions);

  el.statusFilter?.addEventListener("change", renderSessions);

  el.category?.addEventListener("change", updateAudienceField);

  bindTrainingComposer();
}

function bindTrainingComposer() {
  if (!el.composeToggle || !el.composeClose || !el.composer) {
    return;
  }

  el.composeToggle.addEventListener("click", () => {
    el.composer.classList.remove("hidden");

    el.composeToggle.classList.add("active");

    if (el.title) {
      el.title.focus();
    }
  });

  el.composeClose.addEventListener("click", () => {
    el.composer.classList.add("hidden");

    el.composeToggle.classList.remove("active");
  });
}

function updateAudienceField() {
  const isInnerTeam = el.category.value === "INNER_TEAM";

  el.targetClass.disabled = isInnerTeam;

  if (isInnerTeam) {
    el.targetClass.value = "";
  }

  if (el.discordPing) {
    el.discordPing.checked = true;
    el.discordPing.disabled = isInnerTeam;

    const pingContainer = el.discordPing.closest(".form-group");

    if (pingContainer) {
      pingContainer.style.display = isInnerTeam ? "none" : "";
    }
  }
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
    naval_rank: null,
  };

  const [profileResult, qualificationResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id,user_id,display_name,role,status,avatar_url,callsign,naval_rank,account_created_at",
      )
      .eq("id", state.authUser.id)
      .single(),

    supabase
      .from("user_qualifications")
      .select(
        `
        qualification_id,
        qualifications!inner (
          qualification_code,
          qualification_name
        )
      `,
      )
      .eq("user_id", state.authUser.id),
  ]);

  if (profileResult.data) {
    state.profile = {
      ...state.profile,
      ...profileResult.data,
    };
  }

  if (qualificationResult.error) {
    console.error(
      "Failed to load user qualifications:",
      qualificationResult.error,
    );

    state.hasNswMedicQualification = false;
  } else {
    state.hasNswMedicQualification = (qualificationResult.data || []).some(
      (row) => {
        const qualification = row.qualifications;

        const name = String(qualification?.qualification_name || "")
          .trim()
          .toUpperCase();

        const code = String(qualification?.qualification_code || "")
          .trim()
          .toUpperCase();

        return name === "NSW MEDIC" || code === "NSW MEDIC";
      },
    );
  }

  if (el.sessionLabel) {
    el.sessionLabel.textContent = state.profile.display_name;
  }

  if (el.sidebarName) {
    el.sidebarName.textContent = state.profile.display_name;
  }

  if (el.sidebarRole) {
    el.sidebarRole.textContent = state.profile.role;
  }

  if (el.navAvatar && state.profile.avatar_url) {
    el.navAvatar.src = state.profile.avatar_url;
  }

  showAdminLinksIfAllowed(state.authUser.email);

  return true;
}

async function loadData() {
  const [
    sessionsResult,
    attendanceResult,
    profilesResult,
    loaResult,
    rosterResult,
  ] = await Promise.all([
    supabase.from("training_sessions").select("*").order("start_at", {
      ascending: false,
    }),

    supabase.from("training_attendance").select("*"),

    supabase
      .from("profiles")
      .select(
        "id,user_id,display_name,role,status,avatar_url,callsign,naval_rank,account_created_at,green_team_class",
      )
      .eq("status", "ACTIVE")
      .order("display_name", {
        ascending: true,
      }),

    supabase.from("loa_requests").select("*").eq("status", "APPROVED"),

    supabase.from("training_session_members").select("session_id,user_id"),
  ]);

  if (sessionsResult.error) {
    el.output.innerHTML = `
      <div class="empty-state">
        Failed to load training:
        ${escapeHtml(sessionsResult.error.message)}
      </div>
    `;

    return;
  }

  if (attendanceResult.error) {
    el.output.innerHTML = `
      <div class="empty-state">
        Failed to load attendance:
        ${escapeHtml(attendanceResult.error.message)}
      </div>
    `;

    return;
  }

  if (profilesResult.error) {
    el.output.innerHTML = `
      <div class="empty-state">
        Failed to load profiles:
        ${escapeHtml(profilesResult.error.message)}
      </div>
    `;

    return;
  }

  if (loaResult.error) {
    el.output.innerHTML = `
      <div class="empty-state">
        Failed to load LOA data:
        ${escapeHtml(loaResult.error.message)}
      </div>
    `;

    return;
  }

  if (rosterResult.error) {
    el.output.innerHTML = `
      <div class="empty-state">
        Failed to load training class roster:
        ${escapeHtml(rosterResult.error.message)}
      </div>
    `;

    return;
  }

  state.sessions = (sessionsResult.data || []).filter(canViewSession);

  state.attendance = attendanceResult.data || [];

  state.profiles = profilesResult.data || [];

  state.loaRequests = loaResult.data || [];

  state.sessionMembers = rosterResult.data || [];

  renderSessions();

  if (state.activeSessionId) {
    const active = state.sessions.find(
      (session) => Number(session.id) === Number(state.activeSessionId),
    );

    if (active) {
      renderViewer(active);
    }
  }
}

function isAdmin() {
  return (
    String(state.profile?.role || "")
      .trim()
      .toUpperCase() === "ADMIN"
  );
}

function isTroopHq() {
  const role = String(state.profile?.role || "")
    .trim()
    .toUpperCase();
  const callsign = String(state.profile?.callsign || "")
    .trim()
    .toUpperCase();

  return HQ_ROLES.includes(role) || TROOP_HQ_CALLSIGNS.includes(callsign);
}

function isCandidate() {
  return String(state.profile?.naval_rank || "").trim() === "Candidate";
}

function hasAssignedCallsign() {
  return String(state.profile?.callsign || "").trim() !== "";
}

function canViewSession(session) {
  if (!session) {
    return false;
  }

  if (session.category === "INNER_TEAM") {
    return hasAssignedCallsign();
  }

  return true;
}

function isTeamLeader() {
  const callsign = String(state.profile?.callsign || "")
    .trim()
    .toUpperCase();
  return TEAM_LEADER_CALLSIGNS.includes(callsign);
}

function isEvans() {
  return (
    String(state.authUser?.email || "")
      .trim()
      .toLowerCase() === "evans@navy.mil"
  );
}

function canHostUnitWide() {
  return isTroopHq() || isTeamLeader() || isEvans();
}

function canHostInnerTeam() {
  return canHostUnitWide() || state.hasNswMedicQualification;
}

function canCreateSelectedCategory() {
  const category = el.category.value;

  if (category === "PRO_DEVELOPMENT") {
    return true;
  }

  if (category === "UNIT_WIDE") {
    return canHostUnitWide();
  }

  if (category === "INNER_TEAM") {
    return canHostInnerTeam();
  }

  return false;
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

  const allowedLocations = ["Dam Neck Annex", "Mid-South Institute"];

  if (!allowedLocations.includes(el.location.value)) {
    showStatus("Please select a valid training location.", false);
    return;
  }

  if (!title) {
    showStatus("Title is required.", false);
    return;
  }

  if (!el.start.value) {
    showStatus("Start date and time are required.", false);
    return;
  }

  if (!canCreateSelectedCategory()) {
    if (el.category.value === "INNER_TEAM") {
      showStatus(
        "You do not have permission to host Inner Team Training. An NSW Medic qualification or authorized leadership position is required.",
        false,
      );
    } else if (el.category.value === "UNIT_WIDE") {
      showStatus(
        "You do not have permission to host Unit Wide Training.",
        false,
      );
    } else {
      showStatus("You do not have permission to create this training.", false);
    }

    return;
  }

  const startDate = new Date(el.start.value);

  const endDate = el.end.value ? new Date(el.end.value) : null;

  if (Number.isNaN(startDate.getTime())) {
    showStatus("The selected start time is invalid.", false);
    return;
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    showStatus("The selected end time is invalid.", false);
    return;
  }

  if (endDate && endDate.getTime() <= startDate.getTime()) {
    showStatus("The end time must be after the start time.", false);
    return;
  }

  /*
   * Read this BEFORE resetForm() is called.
   *
   * true:
   * Discord message is posted and the training role is pinged.
   *
   * false:
   * Discord message is still posted, but nobody is pinged.
   */
  const pingDiscordMembers = el.discordPing?.checked !== false;

  const payload = {
    category: el.category.value,

    title,

    description: el.description.value.trim(),

    start_at: startDate.toISOString(),

    end_at: endDate ? endDate.toISOString() : null,

    location: el.location.value.trim(),

    status: el.status.value,

    target_green_team_class:
      el.category.value === "INNER_TEAM" ? null : el.targetClass.value || null,

    host_id: state.authUser.id,

    updated_at: new Date().toISOString(),
  };

  setButtonLoading(el.saveButton, true, "Saving...");

  const result = await supabase
    .from("training_sessions")
    .insert(payload)
    .select("*")
    .single();

  setButtonLoading(el.saveButton, false, "Create Training");

  if (result.error) {
    showStatus("Database save failed: " + result.error.message, false);

    return;
  }

  const createdSession = result.data;

  /*
   * Only scheduled/postponed trainings send
   * the creation notification.
   */
  if (
    createdSession.status === "SCHEDULED" ||
    createdSession.status === "POSTPONED"
  ) {
    try {
      if (createdSession.category === "INNER_TEAM") {
        await sendInnerTeamScheduledWebhook();
      } else {
        await sendTrainingScheduledWebhook(createdSession, pingDiscordMembers);
      }
    } catch (error) {
      console.error("Training webhook failed:", error);
    }

    publishLocalTrainingNotice(createdSession);
  }

  resetForm();

  if (el.composer) {
    el.composer.classList.add("hidden");
  }

  if (el.composeToggle) {
    el.composeToggle.classList.remove("active");
  }

  showStatus("Training session created.", true);

  await loadData();
}

async function sendInnerTeamScheduledWebhook() {
  if (!INNER_TEAM_DISCORD_WEBHOOK) {
    console.warn("Inner Team Discord webhook is not configured.");
    return;
  }

  const response = await fetch(`${INNER_TEAM_DISCORD_WEBHOOK}?wait=true`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      content:
        "@everyone\nA session has been scheduled. Please visit the website to mark attendance.",

      allowed_mentions: {
        parse: ["everyone"],
      },

      username: "NSWDG Training Portal",

      avatar_url: `${PORTAL_BASE_URL}/nsw.png`,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(
      `Inner Team Discord returned ${response.status}: ${responseText}`,
    );
  }

  return response.json();
}

async function sendTrainingScheduledWebhook(session, pingMembers = true) {
  if (
    !TRAINING_DISCORD_WEBHOOK ||
    TRAINING_DISCORD_WEBHOOK.includes("PASTE_YOUR")
  ) {
    console.warn("Training Discord webhook is not configured.");

    return;
  }

  const startTimestamp = Math.floor(
    new Date(session.start_at).getTime() / 1000,
  );

  const endTimestamp = session.end_at
    ? Math.floor(new Date(session.end_at).getTime() / 1000)
    : null;

  const category = formatWebhookCategory(session.category);

  const hostName =
    state.profile?.callsign ||
    state.profile?.display_name ||
    state.authUser?.email ||
    "Portal Staff";

  const description =
    String(session.description || "").trim() ||
    "No additional instructions were issued.";

  const location = String(session.location || "").trim() || "To be confirmed";

  const fields = [
    {
      name: "Start",

      value: `<t:${startTimestamp}:F>\n` + `<t:${startTimestamp}:R>`,

      inline: true,
    },

    {
      name: "Location",
      value: location,
      inline: true,
    },

    {
      name: "Category",
      value: category,
      inline: true,
    },

    {
      name: "Host",
      value: hostName,
      inline: true,
    },

    {
      name: "Attendance",

      value: session.mandatory === false ? "Optional" : "Required",

      inline: true,
    },
  ];

  if (endTimestamp) {
    fields.splice(1, 0, {
      name: "End",
      value: `<t:${endTimestamp}:t>`,
      inline: true,
    });
  }

  /*
   * This is your existing Discord training
   * notification role.
   *
   * ON:
   * content contains the role mention.
   *
   * OFF:
   * content is empty.
   */
  const TRAINING_ROLE_ID = "1424715895015739516";

  const discordContent = pingMembers ? `<@&${TRAINING_ROLE_ID}>` : "";

  /*
   * allowed_mentions is important.
   *
   * We explicitly allow the training role
   * when the checkbox is enabled.
   *
   * When disabled, Discord is instructed
   * to parse zero mentions.
   */
  const allowedMentions = pingMembers
    ? {
      parse: [],
      roles: [TRAINING_ROLE_ID],
    }
    : {
      parse: [],
    };

  const response = await fetch(`${TRAINING_DISCORD_WEBHOOK}?wait=true`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      content: discordContent,

      allowed_mentions: allowedMentions,

      username: "NSWDG Training Portal",

      avatar_url: `${PORTAL_BASE_URL}/nsw.png`,

      embeds: [
        {
          title: "TRAINING NOTICE",

          description: `**${session.title}**\n\n` + description,

          url: `${PORTAL_BASE_URL}/member/training/`,

          color: 1207352,

          fields,

          footer: {
            text: "NAVADMIN, Naval Administrative Message",
          },

          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(`Discord returned ${response.status}: ${responseText}`);
  }

  return response.json();
}

function formatWebhookCategory(category) {
  switch (category) {
    case "PRO_DEVELOPMENT":
      return "Professional Development";

    case "UNIT_WIDE":
      return "Unit Wide";

    case "INNER_TEAM":
      return "Inner Team";

    default:
      return String(category || "Training").replaceAll("_", " ");
  }
}

function publishLocalTrainingNotice(session) {
  const payload = {
    type: "TRAINING_CREATED",
    session,
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem("nswdg_latest_training_notice", JSON.stringify(payload));

  window.dispatchEvent(
    new CustomEvent("nswdg-training-notice", {
      detail: payload,
    }),
  );

  try {
    const channel = new BroadcastChannel("nswdg-portal-notifications");

    channel.postMessage(payload);
    channel.close();
  } catch {
    // BroadcastChannel is not available
    // in every browser.
  }
}

function resetForm() {
  el.category.value = "PRO_DEVELOPMENT";

  el.status.value = "SCHEDULED";

  el.title.value = "";

  el.start.value = "";

  el.end.value = "";

  el.location.value = "Dam Neck Annex";

  el.description.value = "";

  el.targetClass.value = "";

  if (el.discordPing) {
    el.discordPing.checked = true;
  }

  updateAudienceField();
  clearStatus();
}

function renderSessions() {
  const search = el.search ? el.search.value.trim().toLowerCase() : "";

  const category = el.categoryFilter ? el.categoryFilter.value : "";

  const status = el.statusFilter ? el.statusFilter.value : "";

  let rows = [...state.sessions];

  if (search) {
    rows = rows.filter((session) => {
      return (
        String(session.title || "")
          .toLowerCase()
          .includes(search) ||
        String(session.description || "")
          .toLowerCase()
          .includes(search) ||
        String(session.location || "")
          .toLowerCase()
          .includes(search)
      );
    });
  }

  if (category) {
    rows = rows.filter((session) => session.category === category);
  }

  if (status) {
    rows = rows.filter((session) => session.status === status);
  }

  if (!hasAssignedCallsign()) {
    rows = rows.filter((session) => session.category !== "INNER_TEAM");
  }

  rows.sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );

  const now = Date.now();

  const upcoming = rows.filter((session) => {
    const sessionTime = new Date(session.start_at).getTime();

    return (
      sessionTime >= now &&
      session.status !== "COMPLETED" &&
      session.status !== "CANCELLED"
    );
  });

  const history = rows
    .filter((session) => !upcoming.includes(session))
    .sort(
      (a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime(),
    );

  if (el.sessionCount) {
    el.sessionCount.textContent = `${rows.length} ${rows.length === 1 ? "SESSION" : "SESSIONS"
      }`;
  }

  el.output.innerHTML = `
    ${renderTrainingGroup(
    "UPCOMING",
    upcoming,
    "No upcoming training sessions.",
  )}

    ${renderTrainingGroup("HISTORY", history, "No previous training sessions.")}
  `;

  el.output.querySelectorAll("[data-open-session]").forEach((button) => {
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
        (item) => Number(item.id) === sessionId,
      );

      if (!session) {
        return;
      }

      state.activeSessionId = sessionId;

      renderViewer(session);

      renderSessions();

      const viewerSection = document.getElementById("training-viewer-section");

      if (viewerSection) {
        viewerSection.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });

  bindSessionStatusControls();
}

function bindSessionStatusControls() {
  el.output.querySelectorAll("[data-session-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      const sessionId = Number(select.dataset.sessionStatus);

      const newStatus = select.value;

      await updateSessionStatusFromList(sessionId, newStatus, select);
    });
  });
}

function renderTrainingGroup(label, rows, emptyMessage) {
  return `
    <section class="training-group">

      <div class="training-group-heading">

        <span>
          ${escapeHtml(label)}
        </span>

        <strong>
          ${rows.length}
        </strong>

      </div>

      ${rows.length
      ? `
            <div class="training-records">

              ${rows.map((session) => renderTrainingRecord(session)).join("")}

            </div>
          `
      : `
            <div class="training-group-empty">
              ${escapeHtml(emptyMessage)}
            </div>
          `
    }

    </section>
  `;
}

function renderTrainingRecord(session) {
  const counts = getAttendanceCounts(session);

  const sessionDate = new Date(session.start_at);

  const month = sessionDate
    .toLocaleDateString("en-US", {
      month: "short",
    })
    .toUpperCase();

  const day = sessionDate.toLocaleDateString("en-US", {
    day: "2-digit",
  });

  const localTime = formatTrainingListLocalTime(session.start_at);

  const easternTime = formatTrainingListEasternTime(session.start_at);

  const localZone = getLocalTimeZoneLabel();
  const selected = Number(state.activeSessionId) === Number(session.id);

  return `
    <article
      class="
        training-record
        training-record-${String(session.category || "")
      .toLowerCase()
      .replaceAll("_", "-")}
        ${selected ? "active" : ""}
      "
    >

      <div class="training-record-date">

        <span>
          ${escapeHtml(month)}
        </span>

        <strong>
          ${escapeHtml(day)}
        </strong>

      </div>


<div class="training-record-main">

  <div class="training-record-heading">

    <div class="training-record-heading-left">

      <div class="training-record-topline">

        ${categoryBadge(
          session.category
        )}

        <span class="training-record-location">
          ${escapeHtml(
            session.location || "-"
          )}
        </span>

      </div>

      <h3>
        ${escapeHtml(
          session.title
        )}
      </h3>

    </div>


    <div class="training-record-host">

      <span>
        HOST
      </span>

      <strong>
        ${escapeHtml(
          getProfileName(
            session.host_id
          )
        )}
      </strong>

    </div>

  </div>


  <div class="training-record-timebar">

    <div class="training-record-time local">

      <span>
        YOUR TIME
      </span>

      <strong>
        ${escapeHtml(
          localTime
        )}
      </strong>

      <small>
        ${escapeHtml(
          localZone
        )}
      </small>

    </div>


    <div class="training-record-time eastern">

      <span>
        EASTERN TIME
      </span>

      <strong>
        ${escapeHtml(
          easternTime
        )}
      </strong>

      <small>
        ET
      </small>

    </div>

  </div>

</div>


      <div class="training-record-attendance">

        <div class="training-attendance-value attending">

          <strong>
            ${counts.attending}
          </strong>

          <span>
            Attending
          </span>

        </div>


        <div class="training-attendance-value declined">

          <strong>
            ${counts.notAttending}
          </strong>

          <span>
            Declined
          </span>

        </div>


        <div class="training-attendance-value loa">

          <strong>
            ${counts.loaAbsent}
          </strong>

          <span>
            LOA
          </span>

        </div>

      </div>


      <div class="training-record-status">

        ${renderSessionStatusControl(session)}

      </div>


      <div class="training-record-action">

        <button
          type="button"
          class="training-open-button"
          data-open-session="${session.id}"
        >
          ${selected ? "Close" : "Open"}
        </button>

      </div>

    </article>
  `;
}

function renderAdminMarkingTable(session, attendanceRows) {
  const rows = getEligibleProfilesForSession(session)
    .slice()
    .sort((a, b) =>
      String(a.display_name || "").localeCompare(String(b.display_name || "")),
    );

  return `
    <div class="final-marking-console">

      <div class="final-marking-command">
        <div>
          <span class="session-v3-kicker">
            FINAL ATTENDANCE
          </span>

          <strong>
            Personnel Attendance Ledger
          </strong>
        </div>

        <div class="final-marking-total">
          ${rows.length} PERSONNEL
        </div>
      </div>

      <div class="final-marking-notice">
        Record final attendance after the training has concluded.
        RSVP is shown for reference only. Personnel covered by an
        approved LOA remain locked.
      </div>

      <div class="final-marking-head">
        <span>Member</span>
        <span>RSVP</span>
        <span>Final Status</span>
        <span>Timing</span>
        <span>Administrative Note</span>
        <span>Action</span>
      </div>

      <div class="final-marking-list">
        ${rows
      .map((profile) => {
        const row = attendanceRows.find(
          (attendanceRow) => attendanceRow.user_id === profile.id,
        );

        return renderAdminMarkingRow(session, profile, row);
      })
      .join("")}
      </div>

    </div>
  `;
}

function renderAdminMarkingRow(session, profile, row) {
  const approvedLoa = getApprovedLoaForUserSession(session, profile.id);

  const lockedByLoa = Boolean(approvedLoa) || Boolean(row?.locked_by_loa_id);

  const rsvp = lockedByLoa ? "NOT_ATTENDING" : row?.attendance || "NO_RESPONSE";

  const actual = lockedByLoa
    ? "LOA"
    : row?.actual_status || guessActualStatusFromRsvp(rsvp);

  const displayName = profile.display_name || profile.user_id || profile.id;

  const personnelMeta = [
    profile.naval_rank || "Candidate",
    profile.callsign || null,
  ]
    .filter(Boolean)
    .join(" / ");

  if (lockedByLoa) {
    return `
      <div
        class="
          final-marking-record
          final-marking-record-locked
        "
        data-admin-mark-row="${escapeHtml(profile.id)}"
      >

        <div class="final-personnel">

          <strong>
            ${escapeHtml(displayName)}
          </strong>

          <span>
            ${escapeHtml(personnelMeta)}
          </span>

        </div>


        <div class="final-rsvp">

          <span class="final-rsvp-label">
            RSVP
          </span>

          <strong>
            NOT ATTENDING
          </strong>

        </div>


        <div class="final-status locked">

          <span class="final-field-label">
            Final Status
          </span>

          <strong>
            LOA
          </strong>

          <small>
            Approved Leave
          </small>

        </div>


        <div class="final-timing locked">

          <span>
            LATE
            <strong>0</strong>
          </span>

          <span>
            EARLY
            <strong>0</strong>
          </span>

        </div>


        <div class="final-note locked">

          <span class="final-field-label">
            Administrative Note
          </span>

          <span>
            Locked until approved LOA is revoked
            or ended.
          </span>

        </div>


        <div class="final-action">

          <button
            class="final-save-button locked"
            type="button"
            disabled
          >
            LOCKED
          </button>

        </div>

      </div>
    `;
  }

  return `
    <div
      class="final-marking-record"
      data-admin-mark-row="${escapeHtml(profile.id)}"
    >

      <div class="final-personnel">

        <strong>
          ${escapeHtml(displayName)}
        </strong>

        <span>
          ${escapeHtml(personnelMeta)}
        </span>

      </div>


      <div class="final-rsvp">

        <span class="final-rsvp-label">
          RSVP
        </span>

        <strong>
          ${escapeHtml(rsvp.replaceAll("_", " "))}
        </strong>

      </div>


      <div class="final-status">

        <label>
          Final Status
        </label>

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

      </div>


      <div class="final-timing">

        <label>
          Late
          <span>MIN</span>
        </label>

        <input
          data-field="minutes_late"
          type="number"
          min="0"
          step="1"
          value="${escapeHtml(row?.minutes_late || 0)}"
        >


        <label>
          Left Early
          <span>MIN</span>
        </label>

        <input
          data-field="minutes_left_early"
          type="number"
          min="0"
          step="1"
          value="${escapeHtml(row?.minutes_left_early || 0)}"
        >

      </div>


      <div class="final-note">

        <label>
          Administrative Note
        </label>

        <input
          data-field="admin_note"
          type="text"
          maxlength="1000"
          placeholder="Optional note"
          value="${escapeHtml(row?.admin_note || "")}"
        >

      </div>


      <div class="final-action">

        <button
          class="final-save-button"
          type="button"
          data-admin-save-mark
          data-session-id="${escapeHtml(session.id)}"
          data-user-id="${escapeHtml(profile.id)}"
        >
          SAVE
        </button>

      </div>

    </div>
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
  document.querySelectorAll("[data-admin-save-mark]").forEach((button) => {
    button.addEventListener("click", () => saveAdminMarkingRow(button));
  });
}

async function saveAdminMarkingRow(button) {
  const row = button.closest("[data-admin-mark-row]");
  if (!row) return;

  const actualStatus = row.querySelector('[data-field="actual_status"]').value;
  const minutesLate = Number(
    row.querySelector('[data-field="minutes_late"]').value || 0,
  );
  const minutesLeftEarly = Number(
    row.querySelector('[data-field="minutes_left_early"]').value || 0,
  );
  const adminNote = row.querySelector('[data-field="admin_note"]').value.trim();

  button.disabled = true;
  button.textContent = "Saving";

  const { error } = await supabase.rpc("admin_mark_training_attendance", {
    target_session_id: Number(button.dataset.sessionId),
    target_profile_id: button.dataset.userId,
    new_actual_status: actualStatus,
    new_minutes_late: actualStatus === "LATE" ? minutesLate : 0,
    new_minutes_left_early:
      actualStatus === "LEFT_EARLY" ? minutesLeftEarly : 0,
    new_excused: actualStatus === "EXCUSED" || actualStatus === "LOA",
    new_admin_note: adminNote,
  });

  button.disabled = false;
  button.textContent = "Save";

  if (error) {
    alert("Failed to save attendance: " + error.message);
    return;
  }

  await loadData();
}

function bindTrainingViewerTabs() {
  const tabs = el.viewer.querySelectorAll("[data-viewer-tab]");

  const panels = el.viewer.querySelectorAll("[data-viewer-panel]");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.viewerTab;

      tabs.forEach((item) => {
        item.classList.toggle("active", item === tab);
      });

      panels.forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.viewerPanel === target);
      });
    });
  });
}

function renderViewer(session) {
  const eligibleProfiles = getEligibleProfilesForSession(session);

  const eligibleProfileIds = new Set(
    eligibleProfiles.map((profile) => profile.id),
  );

  const attendanceRows = state.attendance.filter((row) => {
    return (
      Number(row.session_id) === Number(session.id) &&
      eligibleProfileIds.has(row.user_id)
    );
  });

  const loaRows = getLoaForSession(session).filter((loa) => {
    return eligibleProfileIds.has(loa.requester_id);
  });

  const loaUserIds = new Set(loaRows.map((loa) => loa.requester_id));

  const blockedByLoa = eligibleProfiles.filter((profile) => {
    return loaUserIds.has(profile.id);
  });

  const attending = attendanceRows.filter((row) => {
    return row.attendance === "ATTENDING" && !loaUserIds.has(row.user_id);
  });

  const notAttending = attendanceRows.filter((row) => {
    return row.attendance === "NOT_ATTENDING" && !loaUserIds.has(row.user_id);
  });

  const noResponse = eligibleProfiles.filter((profile) => {
    if (loaUserIds.has(profile.id)) {
      return false;
    }

    return !attendanceRows.some((row) => row.user_id === profile.id);
  });

  const showingUp = attending;

  const myAttendance = attendanceRows.find(
    (row) => row.user_id === state.authUser.id,
  );

  const myApprovedLoa = getApprovedLoaForUserSession(
    session,
    state.authUser.id,
  );

  const canManage = canManageSession(session);
  const canAar = canAarSession(session);
  const admin = isAdmin();

  el.viewer.className = "viewer";

  el.viewer.innerHTML = `
  <div class="session-v3">

    <header class="session-v3-header">

      <div class="session-v3-identity">

        <div class="session-v3-document-line">
          <span>
            NSW-TRNG / TRAINING SESSION RECORD
          </span>

          <span>
            SESSION ${escapeHtml(String(session.id))}
          </span>
        </div>

        <h2>
          ${escapeHtml(session.title)}
        </h2>

        <div class="session-v3-badges">
          ${categoryBadge(session.category)}
          ${renderSessionStatusControl(session)}

          ${session.target_green_team_class
      ? `
                <span class="badge badge-yellow">
                  GREEN TEAM CLASS
                  ${escapeHtml(session.target_green_team_class)}
                </span>
              `
      : ""
    }
        </div>

      </div>


      <div class="session-v3-clock">

        <span>
          START
        </span>

        <strong>
          ${escapeHtml(formatDateTime(session.start_at))}
        </strong>

        <small>
          Eastern Time
        </small>

        <div class="session-v3-local-time">
          YOUR TIME
          <b>
            ${escapeHtml(formatViewerLocalTime(session.start_at))}
          </b>
        </div>

      </div>

    </header>


    <nav class="session-v3-tabs">

      <button
        type="button"
        class="session-v3-tab active"
        data-viewer-tab="overview"
      >
        Overview
      </button>

      <button
        type="button"
        class="session-v3-tab"
        data-viewer-tab="attendance"
      >
        Attendance
        <span>
          ${eligibleProfiles.length}
        </span>
      </button>

      ${canManage
      ? `
            <button
              type="button"
              class="session-v3-tab"
              data-viewer-tab="marking"
            >
              Final Marking
            </button>
          `
      : ""
    }

      ${admin
      ? `
            <button
              type="button"
              class="session-v3-tab"
              data-viewer-tab="admin"
            >
              Administration
            </button>
          `
      : ""
    }

      <button
        type="button"
        class="session-v3-tab"
        data-viewer-tab="aar"
      >
        AAR
      </button>

    </nav>


    <div class="session-v3-body">


      <!-- ===============================================
           OVERVIEW
           =============================================== -->

      <section
        class="session-v3-tab-panel active"
        data-viewer-panel="overview"
      >

        <div class="session-v3-overview">

          <div class="session-v3-main-column">


            <section class="session-v3-block">

              <div class="session-v3-block-head">

                <div>
                  <span class="session-v3-kicker">
                    SESSION INFORMATION
                  </span>

                  <strong>
                    Training Details
                  </strong>
                </div>

              </div>


              <div class="session-v3-information-grid">

                <div>
                  <span>Start</span>

                  <strong>
                    ${escapeHtml(formatDateTime(session.start_at))}
                  </strong>
                </div>


                <div>
                  <span>End</span>

                  <strong>
                    ${escapeHtml(
      session.end_at ? formatDateTime(session.end_at) : "-",
    )}
                  </strong>
                </div>


                <div>
                  <span>Location</span>

                  <strong>
                    ${escapeHtml(session.location || "-")}
                  </strong>
                </div>


                <div>
                  <span>Host</span>

                  <strong>
                    ${escapeHtml(getProfileName(session.host_id))}
                  </strong>
                </div>


                <div>
                  <span>Audience</span>

                  <strong>
                    ${escapeHtml(
      session.target_green_team_class
        ? `Green Team Class ${session.target_green_team_class}`
        : "All Personnel",
    )}
                  </strong>
                </div>


                <div>
                  <span>Your Response</span>

                  <strong>
                    ${escapeHtml(
      myApprovedLoa
        ? "Approved LOA"
        : myAttendance
          ? attendanceLabel(myAttendance.attendance)
          : "No Response",
    )}
                  </strong>
                </div>

              </div>

            </section>


            <section class="session-v3-block">

              <div class="session-v3-block-head">

                <div>
                  <span class="session-v3-kicker">
                    TRAINING ORDER
                  </span>

                  <strong>
                    Description
                  </strong>
                </div>

              </div>


              <div class="session-v3-description">

                ${escapeHtml(session.description || "-").replaceAll(
      "\\n",
      "<br>",
    )}

              </div>

            </section>

          </div>


          <aside class="session-v3-side-column">


            <section class="session-v3-block response-console">

              <div class="session-v3-block-head">

                <div>
                  <span class="session-v3-kicker">
                    PERSONNEL RESPONSE
                  </span>

                  <strong>
                    Your Attendance
                  </strong>
                </div>

              </div>


              <div class="response-console-current">

                <span>
                  CURRENT RESPONSE
                </span>

                <strong>
                  ${escapeHtml(
      myApprovedLoa
        ? "APPROVED LOA"
        : myAttendance
          ? attendanceLabel(myAttendance.attendance)
          : "NO RESPONSE",
    )}
                </strong>

              </div>


              ${myApprovedLoa
      ? `
                    <div class="response-console-loa">
                      Approved LOA covers this session.
                      Your attendance response is locked.
                    </div>

                    <button
                      class="
                        session-response-command
                        decline
                      "
                      type="button"
                      disabled
                    >
                      NOT ATTENDING / LOA
                    </button>
                  `
      : `
                    <div class="session-response-actions">

                      <button
                        class="
                          session-response-command
                          attend
                        "
                        type="button"
                        id="attending-button"
                      >
                        <span>
                          ATTENDING
                        </span>

                        <small>
                          Confirm attendance
                        </small>
                      </button>


                      <button
                        class="
                          session-response-command
                          decline
                        "
                        type="button"
                        id="not-attending-button"
                      >
                        <span>
                          NOT ATTENDING
                        </span>

                        <small>
                          Decline session
                        </small>
                      </button>

                    </div>
                  `
    }

            </section>


            <section class="session-v3-block personnel-summary">

              <div class="session-v3-block-head">

                <div>
                  <span class="session-v3-kicker">
                    PERSONNEL STATUS
                  </span>

                  <strong>
                    Attendance Summary
                  </strong>
                </div>

              </div>


              <div class="personnel-summary-list">

                <div class="summary-line attending">
                  <span>Showing Up</span>
                  <strong>${showingUp.length}</strong>
                </div>

                <div class="summary-line declined">
                  <span>Not Attending</span>
                  <strong>${notAttending.length}</strong>
                </div>

                <div class="summary-line pending">
                  <span>No Response</span>
                  <strong>${noResponse.length}</strong>
                </div>

                <div class="summary-line loa">
                  <span>Approved LOA</span>
                  <strong>${blockedByLoa.length}</strong>
                </div>

                <div class="summary-line total">
                  <span>Eligible Personnel</span>
                  <strong>${eligibleProfiles.length}</strong>
                </div>

              </div>

            </section>

          </aside>

        </div>

      </section>



      <!-- ===============================================
           ATTENDANCE
           =============================================== -->

      <section
        class="session-v3-tab-panel"
        data-viewer-panel="attendance"
      >

        <div class="attendance-workspace">

          <div class="attendance-workspace-head">

            <div>
              <span class="session-v3-kicker">
                PERSONNEL RESPONSE BOARD
              </span>

              <h3>
                Attendance Roster
              </h3>
            </div>


            <div class="attendance-inline-counts">

              <span class="green">
                <b>${showingUp.length}</b>
                ATTENDING
              </span>

              <span class="red">
                <b>${notAttending.length}</b>
                DECLINED
              </span>

              <span class="yellow">
                <b>${noResponse.length}</b>
                PENDING
              </span>

              <span class="blue">
                <b>${blockedByLoa.length}</b>
                LOA
              </span>

            </div>

          </div>


          ${canManage
      ? `
                <div class="attendance-admin-instruction">
                  ADMIN RESPONSE MODE /
                  Drag personnel between response
                  categories to modify their RSVP.
                </div>
              `
      : ""
    }


          <div
            class="
              training-roster-grid
              ${canManage ? "admin-attendance-board" : ""}
            "
          >


            <div
              class="
                roster-column
                green
                ${canManage ? "admin-drop-zone" : ""}
              "
              data-admin-attendance="ATTENDING"
            >

              <div class="roster-column-head">

                <div>
                  <span>
                    RESPONSE 01
                  </span>

                  <strong>
                    Showing Up
                  </strong>
                </div>

                <b>
                  ${showingUp.length}
                </b>

              </div>

              <div class="roster-column-body">

                ${canManage
      ? renderDraggableAttendanceRows(showingUp, "ATTENDING")
      : renderNameList(showingUp)
    }

              </div>

            </div>


            <div
              class="
                roster-column
                red
                ${canManage ? "admin-drop-zone" : ""}
              "
              data-admin-attendance="NOT_ATTENDING"
            >

              <div class="roster-column-head">

                <div>
                  <span>
                    RESPONSE 02
                  </span>

                  <strong>
                    Not Attending
                  </strong>
                </div>

                <b>
                  ${notAttending.length}
                </b>

              </div>

              <div class="roster-column-body">

                ${canManage
      ? renderDraggableAttendanceRows(
        notAttending,
        "NOT_ATTENDING",
      )
      : renderNameList(notAttending)
    }

              </div>

            </div>


            <div
              class="
                roster-column
                yellow
                ${canManage ? "admin-drop-zone" : ""}
              "
              data-admin-attendance=""
            >

              <div class="roster-column-head">

                <div>
                  <span>
                    RESPONSE 03
                  </span>

                  <strong>
                    No Response
                  </strong>
                </div>

                <b>
                  ${noResponse.length}
                </b>

              </div>

              <div class="roster-column-body">

                ${canManage
      ? renderDraggableProfiles(noResponse)
      : renderProfileList(noResponse)
    }

              </div>

            </div>

          </div>


          <section class="attendance-loa-register">

            <div class="attendance-loa-head">

              <span>
                LOA REGISTER
              </span>

              <strong>
                ${blockedByLoa.length}
              </strong>

            </div>

            <div class="attendance-loa-body">

              ${blockedByLoa.length
      ? renderProfileCards(blockedByLoa)
      : `
                    <span class="muted">
                      No approved LOA applies to
                      this training session.
                    </span>
                  `
    }

            </div>

          </section>

        </div>

      </section>



      <!-- ===============================================
           FINAL ATTENDANCE MARKING
           =============================================== -->

      ${canManage
      ? `
            <section
              class="session-v3-tab-panel"
              data-viewer-panel="marking"
            >

              ${renderAdminMarkingTable(session, attendanceRows)}

            </section>
          `
      : ""
    }



      <!-- ===============================================
           ADMIN
           =============================================== -->

      ${admin
      ? `
            <section
              class="session-v3-tab-panel"
              data-viewer-panel="admin"
            >

              <div class="admin-workspace">

                <div class="admin-workspace-banner">

                  <div>
                    <span class="session-v3-kicker">
                      RESTRICTED CONTROLS
                    </span>

                    <strong>
                      Session Administration
                    </strong>
                  </div>

                  <span>
                    ADMIN
                  </span>

                </div>


                ${renderAdminTrainingControls(session)}


                ${canManage
        ? `
                      <section class="admin-danger-register">

                        <div>
                          <span class="session-v3-kicker">
                            PERMANENT ACTION
                          </span>

                          <strong>
                            Delete Training Session
                          </strong>

                          <p>
                            Permanently removes this session
                            and associated training data.
                          </p>
                        </div>

                        <button
                          class="admin-delete-command"
                          type="button"
                          id="delete-training-button"
                        >
                          DELETE SESSION
                        </button>

                      </section>
                    `
        : ""
      }

              </div>

            </section>
          `
      : ""
    }



      <!-- ===============================================
           AAR
           =============================================== -->

      <section
        class="session-v3-tab-panel"
        data-viewer-panel="aar"
      >

        <div class="aar-workspace">

          <div class="aar-workspace-head">

            <div>
              <span class="session-v3-kicker">
                AFTER ACTION REVIEW
              </span>

              <h3>
                Session Review
              </h3>
            </div>

            <span>
              POST-TRAINING RECORD
            </span>

          </div>


          <div class="training-v2-aar">

            ${renderAar(session, canAar)}


            ${canAar
      ? `
                  <div class="aar-command-bar">

                    <span>
                      Changes are stored against
                      this training session.
                    </span>

                    <button
                      class="aar-save-command"
                      type="button"
                      id="save-aar-button"
                    >
                      SAVE AAR
                    </button>

                  </div>
                `
      : ""
    }

          </div>

        </div>

      </section>


    </div>

  </div>
`;

  bindTrainingViewerTabs();

  const attendingButton = document.getElementById("attending-button");

  const notAttendingButton = document.getElementById("not-attending-button");

  if (attendingButton) {
    attendingButton.addEventListener("click", () => {
      saveAttendance(session.id, "ATTENDING");
    });
  }

  if (notAttendingButton) {
    notAttendingButton.addEventListener("click", () => {
      saveAttendance(session.id, "NOT_ATTENDING");
    });
  }

  el.viewer.querySelectorAll("[data-session-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      const sessionId = Number(select.dataset.sessionStatus);

      const newStatus = select.value;

      await updateSessionStatusFromList(sessionId, newStatus, select);
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
      deleteButton.addEventListener("click", () => {
        deleteTraining(session.id);
      });
    }
  }

  if (canAar) {
    const saveAarButton = document.getElementById("save-aar-button");

    if (saveAarButton) {
      saveAarButton.addEventListener("click", () => {
        saveAar(session.id);
      });
    }
  }
}

function accountExistedForSession(profile, session) {
  if (!profile || !session) {
    return false;
  }

  if (!profile.account_created_at) {
    /*
     * This fallback keeps older or incomplete profiles visible.
     * After running the SQL migration, every profile should have
     * account_created_at.
     */
    return true;
  }

  const accountCreatedAt = new Date(profile.account_created_at).getTime();

  const sessionStartedAt = new Date(session.start_at).getTime();

  if (
    !Number.isFinite(accountCreatedAt) ||
    !Number.isFinite(sessionStartedAt)
  ) {
    return true;
  }

  return sessionStartedAt >= accountCreatedAt;
}

function sessionRosterUserIds(session) {
  if (!session) {
    return new Set();
  }

  return new Set(
    state.sessionMembers
      .filter((row) => {
        return Number(row.session_id) === Number(session.id);
      })
      .map((row) => {
        return String(row.user_id);
      }),
  );
}

function isProfileEligibleForSession(profile, session) {
  if (!profile || !session) {
    return false;
  }

  if (!accountExistedForSession(profile, session)) {
    return false;
  }

  if (session.category === "INNER_TEAM") {
    return String(profile.callsign || "").trim() !== "";
  }

  if (!session.target_green_team_class) {
    return true;
  }

  const rosterUserIds = sessionRosterUserIds(session);

  return rosterUserIds.has(String(profile.id));
}

function getEligibleProfilesForSession(session) {
  if (!session) {
    return [];
  }

  return state.profiles.filter((profile) =>
    isProfileEligibleForSession(profile, session),
  );
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

              <select id="admin-edit-location">
                <option
                  value="Dam Neck Annex"
                  ${session.location === "Dam Neck Annex" ? "selected" : ""}
                >
                  Dam Neck Annex
                </option>

                <option
                  value="Mid-South Institute"
                  ${session.location === "Mid-South Institute" ? "selected" : ""}
                >
                  Mid-South Institute
                </option>
              </select>
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
    showAdminActionStatus(
      "Only administrators may edit training sessions.",
      false,
    );
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

  const allowedLocations = ["Dam Neck Annex", "Mid-South Institute"];

  if (!allowedLocations.includes(locationInput.value)) {
    showAdminActionStatus("Please select a valid training location.", false);
    return;
  }

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
    showAdminActionStatus(
      "The end time cannot be before the start time.",
      false,
    );
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
    p_location: locationInput.value.trim(),
  });

  setButtonLoading(saveButton, false, "Save Training Changes");

  if (error) {
    showAdminActionStatus("Training update failed: " + error.message, false);
    return;
  }

  showAdminActionStatus("Training session updated.", true);
  await loadData();
}

async function postponeAdminTraining(sessionId) {
  if (!isAdmin()) {
    showAdminActionStatus(
      "Only administrators may postpone training sessions.",
      false,
    );
    return;
  }

  const amountInput = document.getElementById("admin-postpone-amount");
  const unitInput = document.getElementById("admin-postpone-unit");
  const postponeButton = document.getElementById("admin-postpone-training");

  const amount = Number(amountInput.value);
  const unit = unitInput.value;

  if (!Number.isInteger(amount) || amount <= 0) {
    showAdminActionStatus("Enter a whole number greater than zero.", false);
    amountInput.focus();
    return;
  }

  if (unit !== "minutes" && unit !== "hours") {
    showAdminActionStatus("Postponement unit must be minutes or hours.", false);
    return;
  }

  const session = state.sessions.find(
    (item) => Number(item.id) === Number(sessionId),
  );

  if (!session) {
    showAdminActionStatus("Training session could not be found.", false);
    return;
  }

  const amountLabel = `${amount} ${unit}`;
  const currentStart = formatDateTime(session.start_at);

  const confirmed = confirm(
    `Postpone "${session.title}" by ${amountLabel}?\n\n` +
    `Current start: ${currentStart}\n\n` +
    "The start and end times will both be moved.",
  );

  if (!confirmed) return;

  setButtonLoading(postponeButton, true, "Postponing...");

  const { error } = await supabase.rpc("admin_postpone_training_session", {
    p_session_id: Number(sessionId),
    p_amount: amount,
    p_unit: unit,
  });

  setButtonLoading(postponeButton, false, "Postpone");

  if (error) {
    showAdminActionStatus("Postponement failed: " + error.message, false);
    return;
  }

  showAdminActionStatus(`Training postponed by ${amountLabel}.`, true);

  await loadData();
}

async function cancelAdminTraining(sessionId) {
  if (!isAdmin()) {
    showAdminActionStatus(
      "Only administrators may cancel training sessions.",
      false,
    );
    return;
  }

  const session = state.sessions.find(
    (item) => Number(item.id) === Number(sessionId),
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
    `Cancel "${session.title}"?\n\n` +
    "The session will remain in the database and its attendance records will not be deleted.",
  );

  if (!confirmed) return;

  const cancelButton = document.getElementById("admin-cancel-training");

  setButtonLoading(cancelButton, true, "Cancelling...");

  const { error } = await supabase.rpc("admin_cancel_training_session", {
    p_session_id: Number(sessionId),
  });

  setButtonLoading(cancelButton, false, "Cancel Training");

  if (error) {
    showAdminActionStatus("Cancellation failed: " + error.message, false);
    return;
  }

  showAdminActionStatus("Training session cancelled.", true);
  await loadData();
}

function showAdminActionStatus(message, ok) {
  const statusElement = document.getElementById("admin-training-action-status");

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

  const pad = (number) => String(number).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function formatStatusLabel(status) {
  if (status === "PRO_DEVELOPMENT") return "Pro Development";
  if (status === "UNIT_WIDE") return "Unit Wide Training";
  if (status === "INNER_TEAM") return "Inner Team";

  return String(status || "")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getLoaForSession(session) {
  if (!session?.start_at) return [];

  const sessionDate = new Date(session.start_at).toISOString().slice(0, 10);

  return state.loaRequests.filter((loa) => {
    return loa.start_date <= sessionDate && loa.end_date >= sessionDate;
  });
}

function getApprovedLoaForUserSession(session, userId) {
  if (!session || !userId) {
    return null;
  }

  return (
    getLoaForSession(session).find((loa) => loa.requester_id === userId) || null
  );
}

function renderProfileCards(profiles) {
  if (!profiles.length) return `<span class="muted">None</span>`;

  return profiles
    .map(
      (profile) => `
    <div class="profile-mini-card">
      <strong>${escapeHtml(profile.display_name)}</strong>
      <span>${escapeHtml(profile.naval_rank || "No rank")}${profile.callsign ? ` [${escapeHtml(profile.callsign)}]` : ""}</span>
    </div>
  `,
    )
    .join("");
}

function renderDraggableAttendanceRows(rows, attendance) {
  if (!rows.length) return `<span class="muted">None</span>`;

  return rows
    .map((row) => {
      const profile = state.profiles.find((p) => p.id === row.user_id);

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
    })
    .join("");
}

function renderDraggableProfiles(profiles) {
  if (!profiles.length) return `<span class="muted">None</span>`;

  return profiles
    .map(
      (profile) => `
    <div
      class="admin-attendance-user"
      draggable="true"
      data-user-id="${escapeHtml(profile.id)}"
      data-current-attendance=""
    >
      ${escapeHtml(profileLabel(profile, profile.id))}
    </div>
  `,
    )
    .join("");
}

function bindAdminAttendanceBoard(sessionId) {
  document.querySelectorAll(".admin-attendance-user").forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", card.dataset.userId);
      event.dataTransfer.effectAllowed = "move";
    });
  });

  document.querySelectorAll(".admin-drop-zone").forEach((zone) => {
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("drag-over");
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("drag-over");
    });

    zone.addEventListener("drop", async (event) => {
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
    p_attendance: attendance,
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
  const session = state.sessions.find(
    (item) => Number(item.id) === Number(sessionId),
  );

  if (!session) {
    alert("Training session not found.");
    return;
  }

  if (!isProfileEligibleForSession(state.profile, session)) {
    alert(
      session.target_green_team_class
        ? `Hey, this training is only for Green Team Class ${session.target_green_team_class}. It is not assigned to your class.`
        : "This training is not assigned to you.",
    );

    return;
  }

  const approvedLoa = getApprovedLoaForUserSession(session, state.authUser.id);

  if (approvedLoa) {
    alert(
      "Your response is locked because an approved LOA covers this training.",
    );
    return;
  }

  const result = await supabase.rpc("set_my_training_response", {
    p_session_id: Number(sessionId),
    p_attendance: attendance,
  });

  if (result.error) {
    alert("Attendance save failed: " + result.error.message);

    return;
  }

  await loadData();
}

async function saveAar(sessionId) {
  const session = state.sessions.find(
    (s) => Number(s.id) === Number(sessionId),
  );

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
    updated_at: new Date().toISOString(),
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
  const session = state.sessions.find(
    (s) => Number(s.id) === Number(sessionId),
  );

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
  el.viewer.textContent =
    "Select a training session to view attendance and AAR.";

  await loadData();
}

function getAttendanceCounts(session) {
  const eligibleProfiles = getEligibleProfilesForSession(session);

  const eligibleProfileIds = new Set(
    eligibleProfiles.map((profile) => profile.id),
  );

  const loaUserIds = new Set(
    getLoaForSession(session)
      .map((loa) => loa.requester_id)
      .filter((userId) => {
        return Boolean(userId) && eligibleProfileIds.has(userId);
      }),
  );

  const rows = state.attendance.filter((attendanceRow) => {
    return (
      Number(attendanceRow.session_id) === Number(session.id) &&
      eligibleProfileIds.has(attendanceRow.user_id)
    );
  });

  return {
    attending: rows.filter((attendanceRow) => {
      return (
        attendanceRow.attendance === "ATTENDING" &&
        !loaUserIds.has(attendanceRow.user_id)
      );
    }).length,

    notAttending: rows.filter((attendanceRow) => {
      return (
        attendanceRow.attendance === "NOT_ATTENDING" &&
        !loaUserIds.has(attendanceRow.user_id)
      );
    }).length,

    loaAbsent: loaUserIds.size,
  };
}

function renderNameList(rows) {
  if (!rows.length) return `<span class="muted">None</span>`;

  return rows
    .map((row) => {
      const profile = state.profiles.find((p) => p.id === row.user_id);
      return `<div>${escapeHtml(profileLabel(profile, row.user_id))}</div>`;
    })
    .join("");
}

function renderProfileList(profiles) {
  if (!profiles.length) return `<span class="muted">None</span>`;
  return profiles
    .map(
      (profile) =>
        `<div>${escapeHtml(profileLabel(profile, profile.id))}</div>`,
    )
    .join("");
}

function profileLabel(profile, fallback) {
  if (!profile) return fallback;

  const rank = profile.naval_rank ? `${profile.naval_rank} ` : "";
  const callsign = profile.callsign ? ` [${profile.callsign}]` : "";

  return `${rank}${profile.display_name}${callsign}`;
}

function getProfileName(userId) {
  const profile = state.profiles.find((p) => p.id === userId);
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
  selectElement,
) {
  if (!isAdmin()) {
    alert("Only administrators may change training status.");
    await loadData();
    return;
  }

  const allowedStatuses = ["SCHEDULED", "DRAFT", "COMPLETED", "CANCELLED"];

  if (!allowedStatuses.includes(newStatus)) {
    alert("Invalid training status.");
    await loadData();
    return;
  }

  const session = state.sessions.find(
    (item) => Number(item.id) === Number(sessionId),
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    selectElement.value = previousStatus;
    selectElement.disabled = false;

    alert("Training status update failed: " + error.message);

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
    hour12: false,
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
    timeZoneName: "short",
  }).format(date);
}

function formatTrainingListLocalTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatTrainingListEasternTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",

    hour: "2-digit",

    minute: "2-digit",

    hour12: false,
  }).format(date);
}

function getLocalTimeZoneLabel() {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (!timeZone) {
      return "LOCAL";
    }

    const now = new Date();

    const shortName = new Intl.DateTimeFormat(undefined, {
      timeZoneName: "short",
    })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value;

    return shortName || timeZone;
  } catch {
    return "LOCAL";
  }
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
  const normalized = String(email || "")
    .trim()
    .toLowerCase();

  if (normalized !== "evans@navy.mil" && normalized !== "carver@navy.mil") {
    return;
  }

  document.querySelectorAll(".admin-only-link").forEach((link) => {
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
