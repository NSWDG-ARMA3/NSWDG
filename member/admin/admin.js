import { supabase } from "/js/auth.js";

const DEFAULT_AVATAR = "../../nsw.png";

const ADMIN_EMAILS = [
  "evans@navy.mil",
  "carver@navy.mil"
];

const memberList = document.getElementById("member-list");
const adminWarning = document.getElementById("admin-warning");
const adminContent = document.getElementById("admin-content");
const statusLine = document.getElementById("status-line");

const sessionLabel = document.getElementById("session-label");
const sidebarName = document.getElementById("sidebar-name");
const sidebarRole = document.getElementById("sidebar-role");
const navAvatar = document.getElementById("nav-avatar");

const form = document.getElementById("admin-profile-form");
const deleteBtn = document.getElementById("delete-profile-btn");

const profileIdInput = document.getElementById("profile-id");
const displayNameInput = document.getElementById("display-name");
const roleInput = document.getElementById("role");
const statusInput = document.getElementById("status");
const navalRankInput = document.getElementById("naval-rank");
const callsignInput = document.getElementById("callsign");
const steamNameInput = document.getElementById("steam-name");
const steamIdInput = document.getElementById("steam-id");
const discordNameInput = document.getElementById("discord-name");
const discordIdInput = document.getElementById("discord-id");
const profileNotesInput = document.getElementById("profile-notes");

let authUser = null;
let currentProfile = null;
let members = [];
let selectedProfile = null;

function isAdminEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return ADMIN_EMAILS.includes(normalized);
}

function setStatus(message, type = "ok") {
  statusLine.textContent = message;
  statusLine.className = `status-line visible ${type}`;
}

function clearStatus() {
  statusLine.textContent = "";
  statusLine.className = "status-line";
}

function safeText(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "-";
  }

  return String(value);
}

function fallbackUserId(email) {
  if (!email || !email.includes("@")) {
    return "unknown";
  }

  return email.split("@")[0];
}

function setChrome(profile) {
  const displayName = profile.display_name || profile.user_id || fallbackUserId(authUser.email);

  sessionLabel.textContent = displayName;
  sidebarName.textContent = displayName;
  sidebarRole.textContent = profile.role || "MEMBER";

  if (profile.avatar_url) {
    navAvatar.src = profile.avatar_url;
  } else {
    navAvatar.src = DEFAULT_AVATAR;
  }
}

function showAccessDenied() {
  adminWarning.style.display = "block";
  adminContent.style.display = "none";
}

function showAdminContent() {
  adminWarning.style.display = "none";
  adminContent.style.display = "grid";
}

function renderMemberList() {
  if (!members.length) {
    memberList.innerHTML = `<div class="notice-box">No profiles found.</div>`;
    return;
  }

  memberList.innerHTML = members.map(member => {
    const activeClass = selectedProfile && selectedProfile.id === member.id ? "active" : "";
    const callsign = member.callsign || "Candidate";

    return `
      <div class="member-row ${activeClass}" data-profile-id="${member.id}">
        <strong>${escapeHtml(member.display_name || member.user_id)}</strong>
        <span>${escapeHtml(member.naval_rank || "Candidate")} | ${escapeHtml(callsign)}</span><br>
        <span class="muted">${escapeHtml(member.user_id || "-")} | ${escapeHtml(member.status || "ACTIVE")}</span>
      </div>
    `;
  }).join("");

  memberList.querySelectorAll("[data-profile-id]").forEach(row => {
    row.addEventListener("click", () => {
      const profileId = row.dataset.profileId;
      const member = members.find(item => item.id === profileId);

      if (member) {
        selectProfile(member);
      }
    });
  });
}

function selectProfile(profile) {
  selectedProfile = profile;

  profileIdInput.value = profile.id;
  displayNameInput.value = profile.display_name || "";
  roleInput.value = profile.role || "MEMBER";
  statusInput.value = profile.status || "ACTIVE";
  navalRankInput.value = profile.naval_rank || "Candidate";
  callsignInput.value = profile.callsign || "";
  steamNameInput.value = profile.steam_name || "";
  steamIdInput.value = profile.steam_id || "";
  discordNameInput.value = profile.discord_name || "";
  discordIdInput.value = profile.discord_id || "";
  profileNotesInput.value = profile.profile_notes || "";

  clearStatus();
  renderMemberList();
}

async function loadSessionAndProfile() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !sessionData.session) {
    window.location.href = "/login/";
    return false;
  }

  authUser = sessionData.session.user;

  const fallbackProfile = {
    id: authUser.id,
    user_id: fallbackUserId(authUser.email),
    display_name: fallbackUserId(authUser.email),
    role: "MEMBER",
    avatar_url: null
  };

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, user_id, display_name, role, status, avatar_url")
    .eq("id", authUser.id)
    .single();

  currentProfile = profileData || fallbackProfile;
  setChrome(currentProfile);

  if (profileError) {
    console.error(profileError);
  }

  if (!isAdminEmail(authUser.email)) {
    showAccessDenied();
    return false;
  }

  showAdminContent();
  return true;
}

async function loadMembers() {
  clearStatus();

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
      steam_id,
      discord_name,
      discord_id,
      profile_notes
    `)
    .order("display_name", { ascending: true });

  if (error) {
    console.error(error);
    setStatus("Failed to load members.", "err");
    return;
  }

  members = data || [];

  if (members.length) {
    selectProfile(members[0]);
  } else {
    renderMemberList();
  }
}

async function saveSelectedProfile(event) {
  event.preventDefault();
  clearStatus();

  if (!selectedProfile) {
    setStatus("Select a member first.", "err");
    return;
  }

  const { data, error } = await supabase.rpc("admin_update_profile", {
    target_profile_id: profileIdInput.value,
    new_display_name: displayNameInput.value,
    new_status: statusInput.value,
    new_role: roleInput.value,
    new_naval_rank: navalRankInput.value,
    new_callsign: callsignInput.value,
    new_steam_name: steamNameInput.value,
    new_steam_id: steamIdInput.value,
    new_discord_name: discordNameInput.value,
    new_discord_id: discordIdInput.value,
    new_profile_notes: profileNotesInput.value
  });

  if (error) {
    console.error(error);
    setStatus(error.message || "Failed to save profile.", "err");
    return;
  }

  const updatedProfile = data;

  members = members.map(member => {
    if (member.id === updatedProfile.id) {
      return updatedProfile;
    }

    return member;
  });

  selectProfile(updatedProfile);
  setStatus("Profile updated.", "ok");
}

async function deleteSelectedProfile() {
  clearStatus();

  if (!selectedProfile) {
    setStatus("Select a member first.", "err");
    return;
  }

  const confirmed = window.confirm(
    `Delete profile for ${selectedProfile.display_name || selectedProfile.user_id}? This removes the public.profiles row only.`
  );

  if (!confirmed) {
    return;
  }

  const { error } = await supabase.rpc("admin_delete_profile", {
    target_profile_id: selectedProfile.id
  });

  if (error) {
    console.error(error);
    setStatus(error.message || "Failed to delete profile.", "err");
    return;
  }

  members = members.filter(member => member.id !== selectedProfile.id);
  selectedProfile = null;

  if (members.length) {
    selectProfile(members[0]);
  } else {
    form.reset();
    renderMemberList();
  }

  setStatus("Profile deleted. Supabase Auth user was not deleted.", "ok");
}

async function doLogout() {
  await supabase.auth.signOut();
  window.location.href = "/login/";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

form.addEventListener("submit", saveSelectedProfile);
deleteBtn.addEventListener("click", deleteSelectedProfile);

window.doLogout = doLogout;

const allowed = await loadSessionAndProfile();

if (allowed) {
  await loadMembers();
}