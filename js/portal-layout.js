import { supabase } from "/js/auth.js";

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
}

export function renderPortalLayout(activePage = "") {
  _0x83fa();

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
      <a class="orbat-only-link ${activePage === "orbat" ? "active" : ""}" href="/member/orbat/" style="display:none;">ORBAT</a>
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
      <a class="sidebar-link orbat-only-link ${activePage === "orbat" ? "active" : ""}" href="/member/orbat/" style="display:none;">ORBAT</a>

      <div class="sidebar-section admin-only-link" style="display:none;">System</div>
      <a class="sidebar-link admin-only-link ${activePage === "admin" ? "active" : ""}" href="/member/admin/" style="display:none;">Admin</a>
    `;
  }

  updateLayoutUserInfo();
}

export function showOrbatLinks() {
  document.querySelectorAll(".orbat-only-link").forEach(el => {
    el.style.display = "";
  });
}