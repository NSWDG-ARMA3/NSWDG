import { supabase } from "/js/auth.js";

let protectionTriggered = false;
let protectionStarted = false;

async function getCurrentUserEmail() {
  try {
    const { data: userData } = await supabase.auth.getUser();

    if (userData?.user?.email) {
      localStorage.setItem("nswdg_user_email", userData.user.email);
      return userData.user.email;
    }

    const { data: sessionData } = await supabase.auth.getSession();

    if (sessionData?.session?.user?.email) {
      localStorage.setItem("nswdg_user_email", sessionData.session.user.email);
      return sessionData.session.user.email;
    }
  } catch {}

  return localStorage.getItem("nswdg_user_email") || "Unknown email";
}

async function triggerProtection(reason) {
  if (protectionTriggered) return;
  protectionTriggered = true;

  const email = await getCurrentUserEmail();

  try {
    await fetch("/api/security-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        reason,
        page: location.href,
        time: new Date().toISOString()
      }),
      keepalive: true
    });
  } catch {}

  try {
    await supabase.auth.signOut();
  } catch {}

  location.replace("/login/");
}

function startProtection() {
  if (protectionStarted) return;
  protectionStarted = true;

  window.addEventListener("keydown", function (event) {
    const key = String(event.key || "").toLowerCase();

    const blocked =
      key === "f12" ||
      (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key)) ||
      (event.metaKey && event.altKey && ["i", "j", "c"].includes(key));

    if (blocked) {
      event.preventDefault();
      event.stopPropagation();
      triggerProtection("Inspector shortcut");
    }
  }, true);

  let lastOuterWidth = window.outerWidth;
  let lastOuterHeight = window.outerHeight;

  setInterval(function () {
    const widthDiff = Math.abs(window.outerWidth - window.innerWidth);
    const heightDiff = Math.abs(window.outerHeight - window.innerHeight);

    const outerWidthChanged = Math.abs(window.outerWidth - lastOuterWidth);
    const outerHeightChanged = Math.abs(window.outerHeight - lastOuterHeight);

    lastOuterWidth = window.outerWidth;
    lastOuterHeight = window.outerHeight;

    if (
      (widthDiff > 180 || heightDiff > 180) &&
      (outerWidthChanged > 80 || outerHeightChanged > 80)
    ) {
      triggerProtection("Possible docked DevTools");
    }
  }, 1000);
}

async function updateLayoutUserInfo() {
  const email = await getCurrentUserEmail();

  const sessionLabel = document.getElementById("session-label");
  if (sessionLabel) {
    sessionLabel.textContent = email;
  }
}

export function renderPortalLayout(activePage = "") {
  startProtection();

  const navMount = document.getElementById("portal-nav");
  const sidebarMount = document.getElementById("portal-sidebar");

  if (navMount) {
    navMount.innerHTML = `
      <a class="${activePage === "home" ? "active" : ""}" href="/member/">Home</a>
      <a class="${activePage === "scheduling" ? "active" : ""}" href="/member/scheduling/">Scheduling</a>
      <a class="${activePage === "loa" ? "active" : ""}" href="/member/loa/">LOA</a>
      <a class="${activePage === "documentation" ? "active" : ""}" href="/member/documentation/">Documentation</a>
      <a class="${activePage === "operational" ? "active" : ""}" href="/member/operational/">Operational</a>
      <a class="${activePage === "training" ? "active" : ""}" href="/member/training/">Training</a>
      <a class="${activePage === "profile" ? "active" : ""}" href="/member/profile/">Profile</a>
      <a class="admin-only-link ${activePage === "admin" ? "active" : ""}" href="/member/admin/" style="display:none;">Admin</a>

      <div class="nav-right">
        <img id="nav-avatar" class="nav-avatar" src="/nsw.png" alt="Profile picture">
        <span>Logged in as: <span id="session-label">Loading...</span></span>
        <a id="logout-button" onclick="doLogout()" style="cursor:pointer">Log Out</a>
      </div>
    `;
  }

  if (sidebarMount) {
    sidebarMount.innerHTML = `
      <div class="sidebar-user-box">
        <strong id="sidebar-name">Loading...</strong>
        Role: <span id="sidebar-role">Loading...</span>
      </div>

      <div class="sidebar-section">Portal</div>
      <a class="sidebar-link ${activePage === "home" ? "active" : ""}" href="/member/">Home</a>

      <div class="sidebar-section">Personnel</div>
      <a class="sidebar-link ${activePage === "profile" ? "active" : ""}" href="/member/profile/">Profile</a>
      <a class="sidebar-link ${activePage === "scheduling" ? "active" : ""}" href="/member/scheduling/">Scheduling</a>
      <a class="sidebar-link ${activePage === "loa" ? "active" : ""}" href="/member/loa/">LOA</a>
      <a class="sidebar-link ${activePage === "qualifications" ? "active" : ""}" href="/member/qualifications/">Qualifications</a>

      <div class="sidebar-section">Operations & Training</div>
      <a class="sidebar-link ${activePage === "operational" ? "active" : ""}" href="/member/operational/">Operational</a>
      <a class="sidebar-link ${activePage === "training" ? "active" : ""}" href="/member/training/">Training</a>

      <div class="sidebar-section">Resources</div>
      <a class="sidebar-link ${activePage === "documentation" ? "active" : ""}" href="/member/documentation/">Documentation</a>

      <div class="sidebar-section admin-only-link" style="display:none;">System</div>
      <a class="sidebar-link admin-only-link ${activePage === "admin" ? "active" : ""}" href="/member/admin/" style="display:none;">Admin</a>
    `;
  }

  updateLayoutUserInfo();
}