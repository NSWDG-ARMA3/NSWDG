import { supabase } from "/js/auth.js";
import { showOrbatLinks } from "/js/portal-layout.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function avatarUrl(pathOrUrl) {
  if (!pathOrUrl) return null;

  if (
    pathOrUrl.startsWith("http://") ||
    pathOrUrl.startsWith("https://") ||
    pathOrUrl.startsWith("/")
  ) {
    return pathOrUrl;
  }

  return pathOrUrl;
}

function fallbackUserId(email) {
  if (!email || !email.includes("@")) return "unknown";
  return email.split("@")[0];
}

function isAdminProfile(profile) {
  const role = String(profile?.role || "").toUpperCase();
  return role === "ADMIN" || role === "TROOP_HQ" || role === "HQ";
}

export async function bootPortalChrome() {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError || !sessionData.session) {
    window.location.href = "/login/";
    return null;
  }

  const user = sessionData.session.user;

  /*
   * Resolve the canonical profile ID.
   *
   * Normally this is exactly the same UUID as user.id.
   *
   * For an account which was recreated and has a compatibility
   * mapping in profile_auth_aliases, this returns the original
   * canonical profiles.id instead.
   */
  const {
    data: canonicalProfileId,
    error: canonicalProfileError
  } = await supabase.rpc("current_profile_id");

  if (canonicalProfileError) {
    console.error(
      "Failed to resolve canonical profile ID:",
      canonicalProfileError
    );

    return null;
  }

  if (!canonicalProfileId) {
    console.error(
      "Authenticated account has no matching member profile.",
      {
        authUserId: user.id,
        email: user.email
      }
    );

    await supabase.auth.signOut();
    window.location.href = "/login/?error=missing_profile";
    return null;
  }

  const {
    data: profileData,
    error: profileError
  } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", canonicalProfileId)
    .maybeSingle();

  if (profileError) {
    console.error(
      "Failed to load member profile:",
      profileError
    );

    return null;
  }

  if (!profileData) {
    console.error(
      "Canonical member profile does not exist.",
      {
        authUserId: user.id,
        canonicalProfileId,
        email: user.email
      }
    );

    await supabase.auth.signOut();
    window.location.href = "/login/?error=missing_profile";
    return null;
  }

  const profile = {
    ...profileData,
    avatar_path: profileData.avatar_url,
    discord: profileData.discord_name,
    steam: profileData.steam_name
  };

  const sessionLabel = document.getElementById("session-label");

  if (sessionLabel) {
    sessionLabel.textContent = profile.display_name;
  }

  const sidebarName = document.getElementById("sidebar-name");

  if (sidebarName) {
    sidebarName.textContent = profile.display_name;
  }

  const sidebarRole = document.getElementById("sidebar-role");

  if (sidebarRole) {
    sidebarRole.textContent = profile.role;
  }

  const navAvatar = document.getElementById("nav-avatar");

  if (navAvatar) {
    navAvatar.src =
      avatarUrl(profile.avatar_url) || "/nsw.png";
  }

  if (isAdminProfile(profile)) {
    document
      .querySelectorAll(".admin-only-link")
      .forEach((link) => {
        link.style.display = "";
      });
  }

  const email =
    String(user.email || "")
      .trim()
      .toLowerCase();

  const canViewOrbat =
    (
      profile.callsign &&
      String(profile.callsign).trim() !== "" &&
      profile.naval_rank !== "Candidate"
    ) ||
    [
      "carver@navy.mil",
      "evans@navy.mil"
    ].includes(email);

  if (canViewOrbat) {
    showOrbatLinks();
  }

  window.doLogout = async function doLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login/";
  };

  return {
    user,
    profile
  };
}