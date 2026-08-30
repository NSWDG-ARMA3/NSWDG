import { supabase } from "/js/auth.js";

const PORTAL_ALERT_SETTINGS = {
  pollIntervalMs: 60_000,

  // Alert when training is between 25 and 30 minutes away.
  // The wider window prevents a suspended browser tab from missing it.
  reminderWindowStartMs: 30 * 60 * 1000,
  reminderWindowEndMs: 25 * 60 * 1000,

  // Show newly posted training from the previous 24 hours.
  recentTrainingWindowMs: 24 * 60 * 60 * 1000
};

let portalAlertTimer = null;
let portalAlertChannel = null;
let portalAudioContext = null;
let portalCurrentCallsign = "";

const intelligenceCallsigns = [
  "E31",
  "E32",
  "EG1",
  "EH1",
  "EI1",
  "EY1",
  "EY2",
  "EY3",
  "EY4"
];

const intelligenceRoles = [
  "ADMIN",
  "TROOP_HQ",
  "HQ"
];

const checklistTeamLeaderCallsigns = [
  "EG1",
  "EH1",
  "EI1"
];

const checklistAdminRoles = [
  "ADMIN",
  "SUPERADMIN"
];

const _0x9a7b = [
  "https://discord.com/api/webhooks/",
  "1512850312816365819/",
  "qRmBqbqt1_5yXrAX4DTZuTv-IGrf31X6fxF088xLdd9PVoFM6qifTDWbsBOLSak0DnHn"
].join("");

let _0x2f91 = false;
let _0x71c0 = false;

async function getCurrentUserEmail() {
  let email = localStorage.getItem("nswdg_user_email") || "";

  try {
    const { data: sessionData } = await supabase.auth.getSession();

    if (sessionData?.session?.user?.email) {
      email = sessionData.session.user.email;
    }
  } catch {}

  try {
    const { data: userData } = await supabase.auth.getUser();

    if (userData?.user?.email) {
      email = userData.user.email;
    }
  } catch {}

  if (email) {
    localStorage.setItem("nswdg_user_email", email);
    return email;
  }

  return "Unknown email";
}

async function _0x4d6a(_0x1c2e) {
  if (_0x71c0) return;
  _0x71c0 = true;

  const _0x5b8d = await getCurrentUserEmail();

  try {
    const response = await fetch(_0x9a7b, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Portal Security",
        embeds: [
          {
            title: "Element Inspector Attempt Detected",
            color: 16711680,
            fields: [
              { name: "Email", value: _0x5b8d, inline: false },
              { name: "Reason", value: _0x1c2e, inline: false },
              { name: "Page", value: location.href, inline: false },
              { name: "Time", value: new Date().toISOString(), inline: false }
            ]
          }
        ]
      }),
      keepalive: true
    });

    if (!response.ok) {
      console.error("Discord webhook failed:", response.status, await response.text());
    }
  } catch (error) {
    console.error("Discord webhook error:", error);
  }

  try {
    await supabase.auth.signOut();
  } catch {}

  location.replace("/login/");
}

function _0x83fa() {
  if (_0x2f91) return;
  _0x2f91 = true;

  window.addEventListener("keydown", function (_0x33ad) {
    const _0x6a22 = String(_0x33ad.key || "").toLowerCase();

    const _0x17be =
      _0x6a22 === "f12" ||
      (_0x33ad.ctrlKey && _0x33ad.shiftKey && ["i", "j", "c"].includes(_0x6a22)) ||
      (_0x33ad.metaKey && _0x33ad.altKey && ["i", "j", "c"].includes(_0x6a22));

    if (_0x17be) {
      _0x33ad.preventDefault();
      _0x33ad.stopPropagation();
      _0x4d6a("Inspector shortcut");
    }
  }, true);

  let _0x4bb1 = window.outerWidth;
  let _0x62cc = window.outerHeight;

  setInterval(function () {
    const _0x4972 = Math.abs(window.outerWidth - window.innerWidth);
    const _0x2460 = Math.abs(window.outerHeight - window.innerHeight);

    const _0x3dc8 = Math.abs(window.outerWidth - _0x4bb1);
    const _0x735c = Math.abs(window.outerHeight - _0x62cc);

    _0x4bb1 = window.outerWidth;
    _0x62cc = window.outerHeight;

    if ((_0x4972 > 180 || _0x2460 > 180) && (_0x3dc8 > 80 || _0x735c > 80)) {
      _0x4d6a("Possible docked DevTools");
    }
  }, 1000);
}


async function updateLayoutUserInfo() {
  const email = await getCurrentUserEmail();

  const sessionLabel = document.getElementById("session-label");

  if (sessionLabel) {
    sessionLabel.textContent = email;
  }

  try {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      console.error("No authenticated user found.");
      return;
    }

    const {
      data: profile,
      error: profileError
    } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      console.error("No profile row found for:", user.id);
      return;
    }

    const sidebarName = document.getElementById("sidebar-name");
    const sidebarRole = document.getElementById("sidebar-role");
    const navAvatar = document.getElementById("nav-avatar");

    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

const normalizedCallsign = String(
  profile.callsign || ""
)
  .trim()
  .toUpperCase();

  portalCurrentCallsign =
    normalizedCallsign;

    const normalizedRole = String(
      profile.role ||
      profile.user_role ||
      profile.portal_role ||
      ""
    )
      .trim()
      .toUpperCase();

    const normalizedRank = String(
      profile.naval_rank ||
      profile.rank ||
      ""
    )
      .trim()
      .toUpperCase();

      const normalizedGreenTeamOrder =
        Number(profile.green_team_order);

      const isChecklistTeamLeader =
        checklistTeamLeaderCallsigns.includes(
          normalizedCallsign
        );

      const isChecklistClassLead =
        normalizedRank === "CANDIDATE" &&
        normalizedCallsign === "" &&
        Number.isInteger(
          normalizedGreenTeamOrder
        ) &&
        normalizedGreenTeamOrder >= 1 &&
        normalizedGreenTeamOrder <= 2;

    const adminEmails = [
      "evans@navy.mil",
      "carver@navy.mil"
    ];

    const isAdmin =
      checklistAdminRoles.includes(
        normalizedRole
      ) ||
      profile.is_admin === true ||
      profile.admin === true ||
      adminEmails.includes(
        normalizedEmail
      );

    const canViewChecklist =
      isAdmin ||
      isChecklistTeamLeader ||
      isChecklistClassLead;

    const canViewIntelligence =
      isAdmin ||
      intelligenceRoles.includes(normalizedRole) ||
      intelligenceCallsigns.includes(normalizedCallsign);

    const canViewOrbat =
      isAdmin ||
      (
        normalizedCallsign !== "" &&
        normalizedRank !== "CANDIDATE"
      ) ||
      adminEmails.includes(normalizedEmail);

    if (sidebarName) {
      sidebarName.textContent =
        profile.display_name ||
        profile.full_name ||
        profile.name ||
        profile.callsign ||
        email;
    }

    if (sidebarRole) {
      sidebarRole.textContent =
        profile.naval_rank ||
        profile.rank ||
        profile.role ||
        "MEMBER";
    }

    if (navAvatar) {
      const avatarUrl =
        profile.avatar_url ||
        profile.profile_picture ||
        profile.image_url;

      if (avatarUrl) {
        navAvatar.src = avatarUrl;
      }
    }

    document
      .querySelectorAll(".orbat-only-link")
      .forEach(element => {
        element.style.display = canViewOrbat
          ? ""
          : "none";
      });

    document
      .querySelectorAll(".intelligence-only-link")
      .forEach(element => {
        element.style.display = canViewIntelligence
          ? ""
          : "none";
      });

    document
      .querySelectorAll(".admin-only-link")
      .forEach(element => {
        element.style.display = isAdmin
          ? ""
          : "none";
      });

      document
  .querySelectorAll(
    ".checklist-only-link"
  )
  .forEach(element => {
    element.style.display =
      canViewChecklist
        ? ""
        : "none";
  });

document
  .querySelectorAll(
    ".management-only-link"
  )
  .forEach(element => {
    element.style.display =
      isAdmin ||
      canViewChecklist
        ? ""
        : "none";
  });

    console.log("Portal permissions:", {
      email: normalizedEmail,
      role: normalizedRole,
      callsign: normalizedCallsign,
      isAdmin,
      canViewIntelligence,
      canViewOrbat
    });
  } catch (error) {
    console.error(
      "Could not update portal user information:",
      error
    );
  }
}

export function renderPortalLayout(activePage = "") {
  _0x83fa();

  const navMount =
    document.getElementById(
      "portal-nav"
    );

  const sidebarMount =
    document.getElementById(
      "portal-sidebar"
    );


  if (navMount) {
    navMount.innerHTML = `
      <a
        class="${activePage === "home" ? "active" : ""}"
        href="/member/"
      >
        Home
      </a>

      <a
        class="${activePage === "scheduling" ? "active" : ""}"
        href="/member/scheduling/"
      >
        Scheduling
      </a>

      <a
        class="${activePage === "loa" ? "active" : ""}"
        href="/member/loa/"
      >
        LOA
      </a>

      <a
        class="${activePage === "kit-logistics" ? "active" : ""}"
        href="/member/kit-logistics/"
      >
        Kit Logistics Request
      </a>

      <a
        class="${activePage === "documentation" ? "active" : ""}"
        href="/member/documentation/"
      >
        Documentation
      </a>

      <a
        class="${activePage === "operational" ? "active" : ""}"
        href="/member/operational/"
      >
        Operational
      </a>

      <a
        class="intelligence-only-link ${activePage === "intelligence" ? "active" : ""}"
        href="/member/intelligence/"
        style="display:none;"
      >
        Intelligence
      </a>

      <a
        class="${activePage === "training" ? "active" : ""}"
        href="/member/training/"
      >
        Training
      </a>

      <a
        class="orbat-only-link ${activePage === "orbat" ? "active" : ""}"
        href="/member/orbat/"
        style="display:none;"
      >
        ORBAT
      </a>

      <a
        class="${activePage === "profile" ? "active" : ""}"
        href="/member/profile/"
      >
        Profile
      </a>

      <a
        class="checklist-only-link ${activePage === "checklist" ? "active" : ""}"
        href="/member/checklist/"
        style="display:none;"
      >
        Checklist
      </a>

      <a
        class="admin-only-link ${activePage === "admin" ? "active" : ""}"
        href="/member/admin/"
        style="display:none;"
      >
        Admin
      </a>

      <div class="nav-right">
        <img
          id="nav-avatar"
          class="nav-avatar"
          src="/nsw.png"
          alt="Profile picture"
        >

        <span>
          Logged in as:
          <span id="session-label">
            Loading...
          </span>
        </span>

        <a
          id="logout-button"
          onclick="doLogout()"
          style="cursor:pointer"
        >
          Log Out
        </a>
      </div>
    `;
  }


  if (sidebarMount) {
    sidebarMount.innerHTML = `
      <div class="sidebar-user-box">
        <strong id="sidebar-name">
          Loading...
        </strong>

        Role:
        <span id="sidebar-role">
          Loading...
        </span>
      </div>


      <div class="sidebar-section">
        Portal
      </div>

      <a
        class="sidebar-link ${activePage === "home" ? "active" : ""}"
        href="/member/"
      >
        Home
      </a>


      <div class="sidebar-section">
        Personnel
      </div>

      <a
        class="sidebar-link ${activePage === "profile" ? "active" : ""}"
        href="/member/profile/"
      >
        Profile
      </a>

      <a
        class="sidebar-link ${activePage === "scheduling" ? "active" : ""}"
        href="/member/scheduling/"
      >
        Scheduling
      </a>

      <a
        class="sidebar-link ${activePage === "loa" ? "active" : ""}"
        href="/member/loa/"
      >
        LOA
      </a>

      <a
        class="sidebar-link ${activePage === "kit-logistics" ? "active" : ""}"
        href="/member/kit-logistics/"
      >
        Kit Logistics Request
      </a>

      <a
        class="sidebar-link ${activePage === "qualifications" ? "active" : ""}"
        href="/member/qualifications/"
      >
        Qualifications
      </a>


      <div class="sidebar-section">
        Operations & Training
      </div>

      <a
        class="sidebar-link ${activePage === "operational" ? "active" : ""}"
        href="/member/operational/"
      >
        Operational
      </a>

      <a
        class="sidebar-link intelligence-only-link ${activePage === "intelligence" ? "active" : ""}"
        href="/member/intelligence/"
        style="display:none;"
      >
        Intelligence
      </a>

      <a
        class="sidebar-link ${activePage === "training" ? "active" : ""}"
        href="/member/training/"
      >
        Training
      </a>


      <div class="sidebar-section">
        Resources
      </div>

      <a
        class="sidebar-link ${activePage === "documentation" ? "active" : ""}"
        href="/member/documentation/"
      >
        Documentation
      </a>

      <a
        class="sidebar-link orbat-only-link ${activePage === "orbat" ? "active" : ""}"
        href="/member/orbat/"
        style="display:none;"
      >
        ORBAT
      </a>


      <div
        class="sidebar-section management-only-link"
        style="display:none;"
      >
        System
      </div>

      <a
        class="sidebar-link admin-only-link ${activePage === "admin" ? "active" : ""}"
        href="/member/admin/"
        style="display:none;"
      >
        Admin
      </a>

      <a
        class="sidebar-link checklist-only-link ${activePage === "checklist" ? "active" : ""}"
        href="/member/checklist/"
        style="display:none;"
      >
        Checklist
      </a>
    `;
  }


  updateLayoutUserInfo();

  initializePortalTrainingAlerts();
}

export function showOrbatLinks() {
  document.querySelectorAll(".orbat-only-link").forEach(el => {
    el.style.display = "";
  });
}

function canCurrentUserSeeTraining(session) {
  if (!session) {
    return false;
  }

  if (session.category === "INNER_TEAM") {
    return portalCurrentCallsign !== "";
  }

  return true;
}

function initializePortalTrainingAlerts() {
  injectPortalAlertStyles();
  createPortalAlertContainer();
  createAlertPermissionButton();

  /*
   * This catches notifications created in the current tab.
   */
  window.addEventListener(
    "nswdg-training-notice",
    event => {
      const session = event.detail?.session;

      if (
        session &&
        canCurrentUserSeeTraining(session)
      ) {
        showTrainingCreatedAlert(session);
      }
    }
  );

  /*
   * This catches notifications created in another open tab.
   */
    window.addEventListener(
    "storage",
    event => {
      if (
        event.key !==
        "nswdg_latest_training_notice" ||
        !event.newValue
      ) {
        return;
      }

      try {
        const notice = JSON.parse(event.newValue);

        if (
          notice?.session &&
          canCurrentUserSeeTraining(
            notice.session
          )
        ) {
          showTrainingCreatedAlert(
            notice.session
          );
        }
      } catch (error) {
        console.error(
          "Invalid locally stored training notice:",
          error
        );
      }
    }
  );

  /*
   * BroadcastChannel gives faster communication between
   * multiple portal tabs in the same browser.
   */
  try {
    portalAlertChannel = new BroadcastChannel(
      "nswdg-portal-notifications"
    );

    portalAlertChannel.addEventListener(
      "message",
      event => {
        if (
          event.data?.session &&
          canCurrentUserSeeTraining(
            event.data.session
          )
        ) {
          showTrainingCreatedAlert(
            event.data.session
          );
        }
      }
    );
  } catch (error) {
    portalAlertChannel = null;
  }

  /*
   * Check Supabase immediately when the user loads the portal.
   * This is what allows other users to see recently posted training
   * rather than relying only on localStorage from the creator.
   */
  checkRecentlyCreatedTraining();
  checkUpcomingTrainingAlerts();

  if (portalAlertTimer) {
    clearInterval(portalAlertTimer);
  }

  portalAlertTimer = setInterval(() => {
    checkRecentlyCreatedTraining();
    checkUpcomingTrainingAlerts();
  }, PORTAL_ALERT_SETTINGS.pollIntervalMs);
}

async function checkRecentlyCreatedTraining() {
  try {
    const now = new Date();

    const recentLimit = new Date(
      now.getTime() -
      PORTAL_ALERT_SETTINGS.recentTrainingWindowMs
    );

    const {
      data: sessions,
      error
    } = await supabase
      .from("training_sessions")
      .select(
        [
          "id",
          "title",
          "description",
          "start_at",
          "end_at",
          "location",
          "status",
          "category",
          "mandatory",
          "created_at"
        ].join(",")
      )
      .in("status", [
        "SCHEDULED",
        "POSTPONED"
      ])
      .gte(
        "created_at",
        recentLimit.toISOString()
      )
      .gt(
        "start_at",
        now.toISOString()
      )
      .order("created_at", {
        ascending: false
      })
      .limit(5);

    if (error) {
      throw error;
    }

    for (const session of sessions || []) {
      if (
        !canCurrentUserSeeTraining(session)
      ) {
        continue;
      }

      showTrainingCreatedAlert(session);
    }
  } catch (error) {
    console.error(
      "Could not check recently created training:",
      error
    );
  }
}

async function checkUpcomingTrainingAlerts() {
  try {
    const now = new Date();

    const futureLimit = new Date(
      now.getTime() +
      31 * 60 * 1000
    );

    const {
      data: sessions,
      error
    } = await supabase
      .from("training_sessions")
      .select(
        [
          "id",
          "title",
          "description",
          "start_at",
          "end_at",
          "location",
          "status",
          "category",
          "mandatory"
        ].join(",")
      )
      .in("status", [
        "SCHEDULED",
        "POSTPONED"
      ])
      .gte(
        "start_at",
        now.toISOString()
      )
      .lte(
        "start_at",
        futureLimit.toISOString()
      )
      .order("start_at", {
        ascending: true
      });

    if (error) {
      throw error;
    }

    for (const session of sessions || []) {
      if (
        !canCurrentUserSeeTraining(session)
      ) {
        continue;
      }

      processUpcomingSession(session);
    }
  } catch (error) {
    console.error(
      "Could not check upcoming training:",
      error
    );
  }
}

function processUpcomingSession(session) {
  const startTime = new Date(
    session.start_at
  ).getTime();

  if (!Number.isFinite(startTime)) {
    return;
  }

  const timeRemaining =
    startTime - Date.now();

  const insideReminderWindow =
    timeRemaining <=
      PORTAL_ALERT_SETTINGS.reminderWindowStartMs &&
    timeRemaining >
      PORTAL_ALERT_SETTINGS.reminderWindowEndMs;

  if (insideReminderWindow) {
    showThirtyMinuteAlert(session);
  }
}

function showThirtyMinuteAlert(session) {
  if (
    !canCurrentUserSeeTraining(session)
  ) {
    return;
  }

  const alertKey = buildTrainingAlertKey(
    "thirty-minute",
    session
  );

  if (localStorage.getItem(alertKey)) {
    return;
  }

  localStorage.setItem(
    alertKey,
    new Date().toISOString()
  );

  showPortalAlert({
    level: "warning",
    eyebrow: "TRAINING REMINDER",
    title: `${session.title} begins in approximately 30 minutes`,
    message: buildTrainingAlertMessage(session),
    persistent: true
  });

  playPortalAlertSound();
  showBrowserTrainingNotification(session);
}

function showTrainingCreatedAlert(session) {
  if (
    !session ||
    !session.start_at ||
    !canCurrentUserSeeTraining(session)
  ) {
    return;
  }

  const alertKey = buildTrainingAlertKey(
    "created",
    session
  );

  if (localStorage.getItem(alertKey)) {
    return;
  }

  localStorage.setItem(
    alertKey,
    new Date().toISOString()
  );

  showPortalAlert({
    level: "info",
    eyebrow: "NEW TRAINING POSTED",
    title: session.title,
    message: buildTrainingAlertMessage(session),
    persistent: false
  });

  playPortalAlertSound();
}

function buildTrainingAlertKey(type, session) {
  const identifier =
    session.id ||
    session.title ||
    "unknown";

  return [
    "nswdg_alert",
    type,
    identifier,
    session.start_at
  ].join("_");
}

function buildTrainingAlertMessage(session) {
  const start = new Date(
    session.start_at
  );

  const formattedStart =
    new Intl.DateTimeFormat(
      undefined,
      {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(start);

  const location =
    String(session.location || "").trim() ||
    "Location pending";

  return `${formattedStart} | ${location}`;
}

function showPortalAlert({
  level,
  eyebrow,
  title,
  message,
  persistent
}) {
  const container =
    createPortalAlertContainer();

  const alert =
    document.createElement("section");

  alert.className =
    `portal-alert portal-alert-${level}`;

  alert.innerHTML = `
    <div class="portal-alert-mark">
      NSW
    </div>

    <div class="portal-alert-content">
      <div class="portal-alert-eyebrow">
        ${escapePortalAlertHtml(eyebrow)}
      </div>

      <div class="portal-alert-title">
        ${escapePortalAlertHtml(title)}
      </div>

      <div class="portal-alert-message">
        ${escapePortalAlertHtml(message)}
      </div>
    </div>

    <div class="portal-alert-actions">
      <a
        class="portal-alert-open"
        href="/member/training/"
      >
        Review
      </a>

      <button
        class="portal-alert-close"
        type="button"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  `;

  const closeButton =
    alert.querySelector(
      ".portal-alert-close"
    );

  closeButton.addEventListener(
    "click",
    () => {
      removePortalAlert(alert);
    }
  );

  container.prepend(alert);

  requestAnimationFrame(() => {
    alert.classList.add(
      "portal-alert-visible"
    );
  });

  if (!persistent) {
    setTimeout(() => {
      if (alert.isConnected) {
        removePortalAlert(alert);
      }
    }, 12_000);
  }
}

function removePortalAlert(alert) {
  alert.classList.add(
    "portal-alert-leaving"
  );

  setTimeout(() => {
    alert.remove();
  }, 250);
}

function createPortalAlertContainer() {
  let container =
    document.getElementById(
      "portal-alert-container"
    );

  if (container) {
    return container;
  }

  container =
    document.createElement("div");

  container.id =
    "portal-alert-container";

  container.setAttribute(
    "aria-live",
    "polite"
  );

  document.body.appendChild(container);

  return container;
}

function createAlertPermissionButton() {
  if (
    document.getElementById(
      "portal-alert-permission"
    )
  ) {
    return;
  }

  if (
    localStorage.getItem(
      "nswdg_alerts_enabled"
    ) === "true"
  ) {
    return;
  }

  const button =
    document.createElement("button");

  button.id =
    "portal-alert-permission";

  button.type = "button";

  button.textContent =
    "Enable Portal Alerts";

  button.addEventListener(
    "click",
    enablePortalAlerts
  );

  document.body.appendChild(button);
}

async function enablePortalAlerts() {
  try {
    /*
     * The browser requires user interaction before sound
     * can be enabled.
     */
    initializeAudioContext();

    localStorage.setItem(
      "nswdg_alerts_enabled",
      "true"
    );

    await playPortalAlertSound();

    if (
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      await Notification.requestPermission();
    }

    document
      .getElementById(
        "portal-alert-permission"
      )
      ?.remove();

    showPortalAlert({
      level: "success",
      eyebrow: "PORTAL ALERTS",
      title: "Notifications enabled",
      message:
        "Sound and supported browser notifications are now active.",
      persistent: false
    });
  } catch (error) {
    console.error(
      "Could not enable portal alerts:",
      error
    );
  }
}

function initializeAudioContext() {
  if (portalAudioContext) {
    return portalAudioContext;
  }

  const AudioContextClass =
    window.AudioContext ||
    window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  portalAudioContext =
    new AudioContextClass();

  return portalAudioContext;
}

async function playPortalAlertSound() {
  if (
    localStorage.getItem(
      "nswdg_alerts_enabled"
    ) !== "true"
  ) {
    return;
  }

  const audioContext =
    initializeAudioContext();

  if (!audioContext) {
    return;
  }

  if (
    audioContext.state === "suspended"
  ) {
    await audioContext.resume();
  }

  const oscillator =
    audioContext.createOscillator();

  const gain =
    audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = 740;

  gain.gain.setValueAtTime(
    0.0001,
    audioContext.currentTime
  );

  gain.gain.exponentialRampToValueAtTime(
    0.12,
    audioContext.currentTime + 0.02
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    audioContext.currentTime + 0.32
  );

  oscillator.connect(gain);
  gain.connect(
    audioContext.destination
  );

  oscillator.start();

  oscillator.stop(
    audioContext.currentTime + 0.34
  );
}

function showBrowserTrainingNotification(
  session
) {
  if (
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  const notification =
    new Notification(
      "Training begins in approximately 30 minutes",
      {
        body:
          `${session.title}\n` +
          `${
            session.location ||
            "Location pending"
          }`,
        icon: "/nsw.png",
        tag:
          `training-${session.id}-${session.start_at}`,
        renotify: false
      }
    );

  notification.onclick = () => {
    window.focus();

    window.location.href =
      "/member/training/";
  };
}

function injectPortalAlertStyles() {
  if (
    document.getElementById(
      "portal-alert-styles"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "portal-alert-styles";

  style.textContent = `
    #portal-alert-container {
      position: fixed;
      top: 76px;
      right: 20px;
      z-index: 10000;
      width: min(440px, calc(100vw - 32px));
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    }

    .portal-alert {
      display: grid;
      grid-template-columns: 52px 1fr auto;
      gap: 14px;
      align-items: center;
      padding: 14px;
      border: 1px solid rgba(121, 152, 184, 0.45);
      border-left: 4px solid #3f6f9f;
      background:
        linear-gradient(
          135deg,
          rgba(8, 22, 36, 0.98),
          rgba(15, 38, 58, 0.98)
        );
      box-shadow:
        0 14px 38px rgba(0, 0, 0, 0.38);
      color: #e7eef5;
      opacity: 0;
      transform: translateY(-10px);
      transition:
        opacity 180ms ease,
        transform 180ms ease;
      pointer-events: auto;
    }

    .portal-alert-visible {
      opacity: 1;
      transform: translateY(0);
    }

    .portal-alert-leaving {
      opacity: 0;
      transform: translateY(-8px);
    }

    .portal-alert-warning {
      border-left-color: #d4aa55;
    }

    .portal-alert-success {
      border-left-color: #5e9872;
    }

    .portal-alert-mark {
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(145, 176, 207, 0.44);
      background: rgba(0, 0, 0, 0.2);
      color: #9db8d2;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.13em;
    }

    .portal-alert-eyebrow {
      margin-bottom: 3px;
      color: #89a9c6;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.13em;
    }

    .portal-alert-warning
    .portal-alert-eyebrow {
      color: #d4aa55;
    }

    .portal-alert-title {
      color: #ffffff;
      font-size: 14px;
      font-weight: 750;
      line-height: 1.3;
    }

    .portal-alert-message {
      margin-top: 4px;
      color: #bdcad6;
      font-size: 12px;
      line-height: 1.4;
    }

    .portal-alert-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .portal-alert-open {
      padding: 7px 10px;
      border: 1px solid rgba(125, 157, 187, 0.45);
      color: #dbe8f2;
      font-size: 11px;
      font-weight: 700;
      text-decoration: none;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .portal-alert-open:hover {
      background: rgba(125, 157, 187, 0.12);
    }

    .portal-alert-close {
      border: 0;
      background: transparent;
      color: #9cabb7;
      cursor: pointer;
      font-size: 21px;
      line-height: 1;
    }

    #portal-alert-permission {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 9999;
      padding: 10px 14px;
      border: 1px solid #527da4;
      background: #102c44;
      color: #e6eef5;
      box-shadow:
        0 10px 28px rgba(0, 0, 0, 0.34);
      cursor: pointer;
      font-size: 11px;
      font-weight: 750;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    #portal-alert-permission:hover {
      background: #173b59;
    }

    @media (max-width: 640px) {
      #portal-alert-container {
        top: 64px;
        right: 12px;
        width: calc(100vw - 24px);
      }

      .portal-alert {
        grid-template-columns: 42px 1fr;
      }

      .portal-alert-mark {
        width: 40px;
        height: 40px;
      }

      .portal-alert-actions {
        grid-column: 1 / -1;
        justify-content: flex-end;
      }
    }
  `;

  document.head.appendChild(style);
}

function escapePortalAlertHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}