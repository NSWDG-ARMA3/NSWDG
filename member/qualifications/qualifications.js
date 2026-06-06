import { supabase } from "/js/auth.js";
import { bootPortalChrome, escapeHtml } from "/js/portal-common.js";
import { renderPortalLayout } from "/js/portal-layout.js";

renderPortalLayout("qualifications");

let authUser = null;
let profile = null;
let canManage = false;

let members = [];
let qualifications = [];
let userQualifications = [];

const memberSelect = document.getElementById("member-select");
const qualificationSelect = document.getElementById("qualification-select");
const awardNotes = document.getElementById("award-notes");
const awardBtn = document.getElementById("award-btn");
const refreshBtn = document.getElementById("refresh-btn");
const awardPanel = document.getElementById("award-panel");
const statusLine = document.getElementById("status-line");

const selectedMemberSummary = document.getElementById("selected-member-summary");
const coreQualifications = document.getElementById("core-qualifications");
const advancedQualifications = document.getElementById("advanced-qualifications");
const qualificationMatrix = document.getElementById("qualification-matrix");

function setStatus(message, ok) {
  statusLine.textContent = message;
  statusLine.className = "status-line visible " + (ok ? "ok" : "err");
}

function clearStatus() {
  statusLine.textContent = "";
  statusLine.className = "status-line";
}

function formatDateTime(value) {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function getSelectedMemberId() {
  return memberSelect.value || "";
}

function getSelectedMember() {
  const selectedId = getSelectedMemberId();
  return members.find(member => member.id === selectedId) || null;
}

function memberLabel(member) {
  const parts = [];

  if (member.naval_rank) parts.push(member.naval_rank);
  if (member.callsign) parts.push(member.callsign);

  const meta = parts.length ? ` (${parts.join(" / ")})` : "";
  return `${member.display_name || member.user_id || "Unknown"}${meta}`;
}

function normalizeRole(value) {
  return String(value || "").trim().toUpperCase().replaceAll(" ", "_");
}

function localCanManageQualifications(user, userProfile) {
  const email = String(user?.email || "").trim().toLowerCase();
  const userId = String(userProfile?.user_id || "").trim().toLowerCase();
  const role = normalizeRole(userProfile?.role);
  const callsign = String(userProfile?.callsign || "").trim().toUpperCase();

  if (email === "evans@navy.mil" || email === "carver@navy.mil") return true;
  if (userId === "evans" || userId === "carver") return true;
  if (userId === "evans@navy.mil" || userId === "carver@navy.mil") return true;

  if (role === "ADMIN" || role === "HQ" || role === "TROOP_HQ" || role === "TROOPHQ") return true;

  if (callsign === "E31" || callsign === "E32") return true;

  return false;
}

async function checkManagePermission() {
  const { data, error } = await supabase.rpc("can_manage_qualifications", {
    check_user_id: authUser.id
  });

  if (!error && data === true) {
    canManage = true;
    return;
  }

  canManage = localCanManageQualifications(authUser, profile);
}

async function loadMembers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, display_name, role, status, naval_rank, callsign")
    .order("display_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  members = data || [];
}

async function loadQualifications() {
  const { data, error } = await supabase
    .from("qualifications")
    .select("*")
    .eq("active", true)
    .order("category", { ascending: true })
    .order("qualification_code", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  qualifications = data || [];
}

async function loadUserQualifications() {
  const selectedMemberId = getSelectedMemberId();

  if (!selectedMemberId) {
    userQualifications = [];
    return;
  }

  const { data, error } = await supabase
    .from("user_qualifications")
    .select(`
      id,
      user_id,
      qualification_id,
      awarded_by,
      awarded_at,
      notes,
      qualifications (
        id,
        qualification_code,
        qualification_name,
        category
      )
    `)
    .eq("user_id", selectedMemberId)
    .order("awarded_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  userQualifications = data || [];
}

function renderMembers() {
  if (!members.length) {
    memberSelect.innerHTML = `<option value="">No members found</option>`;
    return;
  }

  memberSelect.innerHTML = members.map(member => {
    return `<option value="${escapeHtml(member.id)}">${escapeHtml(memberLabel(member))}</option>`;
  }).join("");

  if (!memberSelect.value && authUser) {
    memberSelect.value = authUser.id;
  }
}

function renderQualificationSelect() {
  const selectedIds = new Set(userQualifications.map(row => row.qualification_id));

  const available = qualifications.filter(qualification => {
    return !selectedIds.has(qualification.id);
  });

  if (!available.length) {
    qualificationSelect.innerHTML = `<option value="">No qualifications available</option>`;
    awardBtn.disabled = true;
    return;
  }

  qualificationSelect.innerHTML = available.map(qualification => {
    return `
      <option value="${qualification.id}">
        ${escapeHtml(qualification.qualification_code)} - ${escapeHtml(qualification.qualification_name)}
      </option>
    `;
  }).join("");

  awardBtn.disabled = false;
}

function renderSummary() {
  const member = getSelectedMember();

  if (!member) {
    selectedMemberSummary.textContent = "Select a member to view qualifications.";
    return;
  }

  const coreCount = userQualifications.filter(row => row.qualifications?.category === "CORE").length;
  const advancedCount = userQualifications.filter(row => row.qualifications?.category === "ADVANCED").length;

  selectedMemberSummary.innerHTML = `
    <strong>${escapeHtml(member.display_name || member.user_id || "Unknown")}</strong><br>
    ${escapeHtml(member.naval_rank || "No rank")} / ${escapeHtml(member.callsign || "No callsign")}<br>
    Core Qualifications: ${coreCount}<br>
    Advanced Qualifications: ${advancedCount}<br>
    Total Qualifications: ${userQualifications.length}
  `;
}

function renderQualificationCards(targetEl, category) {
  const rows = userQualifications.filter(row => row.qualifications?.category === category);

  if (!rows.length) {
    targetEl.innerHTML = `<span class="badge badge-empty">None Assigned</span>`;
    return;
  }

  targetEl.innerHTML = rows.map(row => {
    const qualification = row.qualifications;
    const badgeClass = category === "CORE" ? "badge-core" : "badge-advanced";

    const removeButton = canManage
      ? `<button class="btn btn-danger" type="button" data-remove-id="${row.id}">Remove</button>`
      : "";

    return `
      <div class="qual-card">
        <div class="qual-card-title">${escapeHtml(qualification.qualification_name)}</div>
        <div class="qual-card-code">
          <span class="badge ${badgeClass}">${escapeHtml(qualification.qualification_code)}</span>
        </div>
        <div class="small-muted">
          Awarded: ${escapeHtml(formatDateTime(row.awarded_at))}
          ${row.notes ? `<br>Notes: ${escapeHtml(row.notes)}` : ""}
        </div>
        ${removeButton ? `<div class="btn-row" style="margin-top:6px;">${removeButton}</div>` : ""}
      </div>
    `;
  }).join("");
}

function renderMatrix() {
  const selectedIds = new Set(userQualifications.map(row => row.qualification_id));

  if (!qualifications.length) {
    qualificationMatrix.innerHTML = `<tr><td colspan="4">No qualifications found.</td></tr>`;
    return;
  }

  qualificationMatrix.innerHTML = qualifications.map(qualification => {
    const hasQualification = selectedIds.has(qualification.id);
    const badgeClass = qualification.category === "CORE" ? "badge-core" : "badge-advanced";

    return `
      <tr>
        <td><strong>${escapeHtml(qualification.qualification_code)}</strong></td>
        <td>${escapeHtml(qualification.qualification_name)}</td>
        <td><span class="badge ${badgeClass}">${escapeHtml(qualification.category)}</span></td>
        <td>${hasQualification ? "Assigned" : "Not Assigned"}</td>
      </tr>
    `;
  }).join("");
}

function bindRemoveButtons() {
  document.querySelectorAll("[data-remove-id]").forEach(button => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.removeId);
      await removeQualification(id);
    });
  });
}

function renderAll() {
  renderSummary();
  renderQualificationSelect();
  renderQualificationCards(coreQualifications, "CORE");
  renderQualificationCards(advancedQualifications, "ADVANCED");
  renderMatrix();
  bindRemoveButtons();

  if (canManage) {
    awardPanel.classList.remove("hidden");
  } else {
    awardPanel.classList.add("hidden");
  }
}

async function refreshSelectedMember() {
  clearStatus();

  try {
    await loadUserQualifications();
    renderAll();
  } catch (error) {
    setStatus(error.message, false);
  }
}

async function refreshAll() {
  clearStatus();

  try {
    await loadMembers();
    await loadQualifications();
    renderMembers();
    await loadUserQualifications();
    renderAll();
  } catch (error) {
    setStatus(error.message, false);
  }
}

async function awardQualification() {
  const selectedMemberId = getSelectedMemberId();
  const qualificationId = Number(qualificationSelect.value);
  const notes = awardNotes.value.trim();

  if (!canManage) {
    setStatus("You are not authorized to award qualifications.", false);
    return;
  }

  if (!selectedMemberId) {
    setStatus("Select a member first.", false);
    return;
  }

  if (!qualificationId) {
    setStatus("Select a qualification first.", false);
    return;
  }

  const payload = {
    user_id: selectedMemberId,
    qualification_id: qualificationId,
    awarded_by: authUser.id,
    notes: notes || null
  };

  const { error } = await supabase
    .from("user_qualifications")
    .insert(payload);

  if (error) {
    setStatus(error.message, false);
    return;
  }

  awardNotes.value = "";
  setStatus("Qualification awarded.", true);
  await refreshSelectedMember();
}

async function removeQualification(userQualificationId) {
  if (!canManage) {
    setStatus("You are not authorized to remove qualifications.", false);
    return;
  }

  const { error } = await supabase
    .from("user_qualifications")
    .delete()
    .eq("id", userQualificationId);

  if (error) {
    setStatus(error.message, false);
    return;
  }

  setStatus("Qualification removed.", true);
  await refreshSelectedMember();
}

async function init() {
  const boot = await bootPortalChrome();
  if (!boot) return;

  authUser = boot.user;
  profile = boot.profile;

  await checkManagePermission();

  memberSelect.addEventListener("change", refreshSelectedMember);
  refreshBtn.addEventListener("click", refreshAll);
  awardBtn.addEventListener("click", awardQualification);

  await refreshAll();
}

init();