import { supabase } from "/js/auth.js";

const DEFAULT_AVATAR = "../../nsw.png";

const navAvatar = document.getElementById("nav-avatar");
const profileAvatar = document.getElementById("profile-avatar");

const sessionLabel = document.getElementById("session-label");
const sidebarName = document.getElementById("sidebar-name");
const sidebarRole = document.getElementById("sidebar-role");

const statusLine = document.getElementById("status-line");

const avatarForm = document.getElementById("avatar-form");
const avatarFile = document.getElementById("avatar-file");

const passwordForm = document.getElementById("password-form");
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");

let currentUser = null;
let currentProfile = null;

function setStatus(message, type = "ok") {
  statusLine.textContent = message;
  statusLine.className = `status-line visible ${type}`;
}

function clearStatus() {
  statusLine.textContent = "";
  statusLine.className = "status-line";
}

function textOrDash(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "-";
  }

  return String(value);
}

function getFallbackUserId(email) {
  if (!email || !email.includes("@")) return "unknown";
  return email.split("@")[0];
}

function setAvatar(url) {
  const finalUrl = url || DEFAULT_AVATAR;

  if (navAvatar) navAvatar.src = finalUrl;
  if (profileAvatar) profileAvatar.src = finalUrl;
}

function fillProfileTable(profile, user) {
  document.getElementById("profile-display-name").textContent = textOrDash(profile.display_name);
  document.getElementById("profile-user-id").textContent = textOrDash(profile.user_id);
  document.getElementById("profile-role").textContent = textOrDash(profile.role);
  document.getElementById("profile-status").textContent = textOrDash(profile.status);
  document.getElementById("profile-rank").textContent = textOrDash(profile.naval_rank);
  document.getElementById("profile-callsign").textContent = textOrDash(profile.callsign);

  const steamValue = profile.steam_name || profile.steam_id;
  const discordValue = profile.discord_name || profile.discord_id;

  document.getElementById("profile-steam").textContent = textOrDash(steamValue);
  document.getElementById("profile-discord").textContent = textOrDash(discordValue);

  sessionLabel.textContent = profile.display_name || getFallbackUserId(user.email);
  sidebarName.textContent = profile.display_name || getFallbackUserId(user.email);
  sidebarRole.textContent = profile.role || "MEMBER";

  setAvatar(profile.avatar_url);
}

async function loadProfile() {
  clearStatus();

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !sessionData.session) {
    window.location.href = "/login/";
    return;
  }

  currentUser = sessionData.session.user;

  const fallbackUserId = getFallbackUserId(currentUser.email);

  const fallbackProfile = {
    user_id: fallbackUserId,
    display_name: fallbackUserId,
    role: "MEMBER",
    status: "ACTIVE",
    naval_rank: "Candidate",
    callsign: null,
    steam_name: null,
    steam_id: null,
    discord_name: null,
    discord_id: null,
    avatar_url: null
  };

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(`
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
      discord_id
    `)
    .eq("id", currentUser.id)
    .single();

  if (profileError && profileError.code !== "PGRST116") {
    console.error(profileError);
    currentProfile = fallbackProfile;
    fillProfileTable(currentProfile, currentUser);
    setStatus("Profile loaded with fallback data. Supabase profile read failed.", "err");
    return;
  }

  currentProfile = profileData || fallbackProfile;
  fillProfileTable(currentProfile, currentUser);
}

async function uploadAvatar(event) {
  event.preventDefault();
  clearStatus();

  if (!currentUser) {
    setStatus("You are not logged in.", "err");
    return;
  }

  const file = avatarFile.files && avatarFile.files[0];

  if (!file) {
    setStatus("Select an image first.", "err");
    return;
  }

  const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    setStatus("Only PNG, JPG, and WEBP images are allowed.", "err");
    return;
  }

  const maxBytes = 2 * 1024 * 1024;

  if (file.size > maxBytes) {
    setStatus("Image is too large. Maximum size is 2 MB.", "err");
    return;
  }

  const extension = file.name.split(".").pop().toLowerCase();
  const filePath = `${currentUser.id}/avatar-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true
    });

  if (uploadError) {
    console.error(uploadError);
    setStatus("Avatar upload failed. Check the avatars storage bucket and policies.", "err");
    return;
  }

  const { data: publicData } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  const avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", currentUser.id);

  if (updateError) {
    console.error(updateError);
    setStatus("Image uploaded, but saving avatar URL to your profile failed.", "err");
    return;
  }

  currentProfile.avatar_url = avatarUrl;
  setAvatar(avatarUrl);

  avatarFile.value = "";
  setStatus("Profile picture updated.", "ok");
}

async function changePassword(event) {
  event.preventDefault();
  clearStatus();

  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (newPassword.length < 8) {
    setStatus("Password must be at least 8 characters.", "err");
    return;
  }

  if (newPassword !== confirmPassword) {
    setStatus("Passwords do not match.", "err");
    return;
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    console.error(error);
    setStatus(error.message || "Password update failed.", "err");
    return;
  }

  passwordForm.reset();
  setStatus("Password updated.", "ok");
}

async function doLogout() {
  await supabase.auth.signOut();
  window.location.href = "/login/";
}

avatarForm.addEventListener("submit", uploadAvatar);
passwordForm.addEventListener("submit", changePassword);

window.doLogout = doLogout;

loadProfile();