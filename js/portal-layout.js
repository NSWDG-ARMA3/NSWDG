export function renderPortalLayout(activePage = "") {
  const navMount = document.getElementById("portal-nav");
  const sidebarMount = document.getElementById("portal-sidebar");

  if (navMount) {
    navMount.innerHTML = `
      <a class="${activePage === "home" ? "active" : ""}" href="/member/">Home</a>
      <a class="${activePage === "scheduling" ? "active" : ""}" href="/member/scheduling/">Scheduling</a>
      <a class="${activePage === "loa" ? "active" : ""}" href="/member/loa/">LOA</a>
      <a class="${activePage === "documentation" ? "active" : ""}" href="/member/documentation/">Documentation</a>
      <a class="${activePage === "operational" ? "active" : ""}" href="/member/operational/">Operational</a>
      <a class="${activePage === "profile" ? "active" : ""}" href="/member/profile/">Profile</a>
      <a class="admin-only-link ${activePage === "admin" ? "active" : ""}" href="/member/admin/" style="${activePage === "admin" ? "" : "display:none;"}">Admin</a>

      <div class="nav-right">
        <img id="nav-avatar" class="nav-avatar" src="/nsw.png" alt="Profile picture">
        <span>Logged in as: <span id="session-label">Loading...</span></span>
        <a onclick="doLogout()" style="cursor:pointer">Log Out</a>
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

        <div class="sidebar-section">Operations</div>
        <a class="sidebar-link ${activePage === "operational" ? "active" : ""}" href="/member/operational/">Operational</a>

        <div class="sidebar-section">Resources</div>
        <a class="sidebar-link ${activePage === "documentation" ? "active" : ""}" href="/member/documentation/">Documentation</a>

        <div class="sidebar-section">System</div>
        <a class="sidebar-link admin-only-link ${activePage === "admin" ? "active" : ""}" href="/member/admin/" style="${activePage === "admin" ? "" : "display:none;"}">Admin</a>
    `;
  }
}