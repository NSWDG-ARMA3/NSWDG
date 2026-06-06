import { supabase } from "/js/auth.js";

import { renderPortalLayout } from "/js/portal-layout.js";

renderPortalLayout("operational");

const SETTINGS = {
  bucketName: "operational-files",
  adminEmails: ["carver@navy.mil", "evans@navy.mil"]
};

const DOCUMENT_TYPES = [
  { value: "WARNO", label: "WARNO" },
  { value: "OPORD", label: "OPORD" },
  { value: "INTPACK", label: "INTPACK" }
];

const DOCUMENT_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "ARCHIVED", label: "Archived" }
];

const JPEL_PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" }
];

const JPEL_STATUSES = [
  { value: "OPEN", label: "Open" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "CLOSED", label: "Closed" },
  { value: "ARCHIVED", label: "Archived" }
];

const ASSET_LIST = [
  "MH-6",
  "MH-60",
  "MH-60-DAP",
  "HH-60 Pedro",
  "CH-47",
  "MRZR2",
  "MRZR4",
  "MV850",
  "Toyota Landcruiser",
  "C-130",
  "C-17",
  "CCA",
  "Jetski"
];

const QUESTION_SETS = {
  WARNO: [
    {
      title: "1. Situation",
      fields: [
        { id: "situation-overview", label: "Situation Overview", target: "situation" },
        { id: "enemy-summary", label: "Enemy / Threat Summary", target: "enemy_forces" },
        { id: "friendly-summary", label: "Friendly Forces Summary", target: "friendly_forces" },
        { id: "terrain-weather", label: "Terrain / Weather", target: "terrain_weather" }
      ]
    },
    {
      title: "2. Mission Preview",
      fields: [
        { id: "mission-statement", label: "Initial Mission Statement", target: "mission" },
        { id: "operation-purpose", label: "Purpose / Intent", target: "free_text" },
        { id: "known-constraints", label: "Known Constraints", target: "coordinating_instructions" },
        { id: "initial-risks", label: "Initial Risks", target: "risks" }
      ]
    },
    {
      title: "3. Timeline And Coordination",
      fields: [
        { id: "timeline", label: "Known Timeline", target: "timeline" },
        { id: "task-org", label: "Initial Task Organization", target: "task_org" },
        { id: "coordination", label: "Coordination Requirements", target: "command_signal" },
        { id: "support-needs", label: "Support Requirements", target: "sustainment" }
      ]
    }
  ],

  OPORD: [
    {
      title: "1. Situation",
      fields: [
        { id: "situation", label: "General Situation", target: "situation" },
        { id: "enemy-forces", label: "Enemy Forces", target: "enemy_forces" },
        { id: "friendly-forces", label: "Friendly Forces", target: "friendly_forces" },
        { id: "terrain-weather", label: "Terrain / Weather", target: "terrain_weather" }
      ]
    },
    {
      title: "2. Mission And Execution",
      fields: [
        { id: "mission", label: "Mission Statement", target: "mission" },
        { id: "commander-intent", label: "Commander Intent", target: "execution" },
        { id: "concept-of-operation", label: "Concept Of Operation", target: "execution", append: true },
        { id: "tasks-to-subordinate-units", label: "Tasks To Subordinate Units", target: "task_org" }
      ]
    },
    {
      title: "3. Sustainment And Command",
      fields: [
        { id: "sustainment", label: "Sustainment", target: "sustainment" },
        { id: "medical", label: "Medical / CASEVAC", target: "sustainment", append: true },
        { id: "command-signal", label: "Command And Signal", target: "command_signal" },
        { id: "coordinating-instructions", label: "Coordinating Instructions", target: "coordinating_instructions" }
      ]
    },
    {
      title: "4. Timeline And Risk",
      fields: [
        { id: "timeline", label: "Timeline", target: "timeline" },
        { id: "risk-controls", label: "Risk Controls / Mitigation", target: "risks" },
        { id: "additional-notes", label: "Additional Free Notes", target: "free_text" },
        { id: "intel-summary", label: "Intel Summary", target: "intel_summary" }
      ]
    }
  ],

  INTPACK: [
    {
      title: "1. Intelligence Overview",
      fields: [
        { id: "intel-summary", label: "Executive Intelligence Summary", target: "intel_summary" },
        { id: "situation", label: "Operational Context", target: "situation" },
        { id: "collection-gaps", label: "Collection Gaps", target: "free_text" },
        { id: "confidence-level", label: "Assessment Confidence", target: "free_text", append: true }
      ]
    },
    {
      title: "2. Threat And Environment",
      fields: [
        { id: "enemy-forces", label: "Threat / Enemy Forces", target: "enemy_forces" },
        { id: "friendly-forces", label: "Friendly / Partner Forces", target: "friendly_forces" },
        { id: "terrain-weather", label: "Terrain / Weather / Civil Considerations", target: "terrain_weather" },
        { id: "pattern-of-life", label: "Pattern Of Life Notes", target: "timeline" }
      ]
    },
    {
      title: "3. Intelligence Product Details",
      fields: [
        { id: "priority-intelligence-requirements", label: "Priority Intelligence Requirements", target: "coordinating_instructions" },
        { id: "recommended-actions", label: "Recommended Non-Lethal Follow-Up", target: "mission" },
        { id: "risk-notes", label: "Risks / Source Reliability Concerns", target: "risks" },
        { id: "distribution-notes", label: "Distribution / Handling Notes", target: "command_signal" }
      ]
    }
  ]
};

const state = {
  authUser: null,
  profile: null,
  documents: [],
  jpelEntries: [],
  selectedAssets: [],
  activeDocumentId: null,
  documentSort: { field: "created_at", asc: false },
  jpelSort: { field: "priority", asc: false }
};

const elements = {};

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  cacheElements();
  populateStaticDropdowns();
  bindEvents();

  const hasSession = await loadSessionAndProfile();

  if (!hasSession) {
    return;
  }

  applyPermissions();
  renderDynamicQuestions();
  renderSelectedAssets();

  await loadJpelEntries();
  await loadDocuments();

  elements.linkedJpelSearch?.addEventListener("input", () => {
    renderLinkedJpelSelect(
        getSelectedLinkedJpelIds()
    );
    });

    elements.selectAllJpel?.addEventListener("click", () => {
    renderLinkedJpelSelect(
        state.jpelEntries.map(entry => Number(entry.id))
    );
    });

    elements.clearAllJpel?.addEventListener("click", () => {
    renderLinkedJpelSelect([]);
    });

  renderLinkedJpelSelect([]);
}

function cacheElements() {
  elements.sessionLabel = document.getElementById("session-label");
  elements.sidebarName = document.getElementById("sidebar-name");
  elements.sidebarRole = document.getElementById("sidebar-role");
  elements.navAvatar = document.getElementById("nav-avatar");
  elements.logoutButton = document.getElementById("logout-button");

  elements.documentsTabButton = document.getElementById("documents-tab-button");
  elements.jpelTabButton = document.getElementById("jpel-tab-button");
  elements.documentsScreen = document.getElementById("documents-screen");
  elements.jpelScreen = document.getElementById("jpel-screen");

  elements.documentFormPanel = document.getElementById("document-form-panel");
  elements.documentType = document.getElementById("document-type");
  elements.documentStatus = document.getElementById("document-status");
  elements.documentTitle = document.getElementById("document-title");
  elements.documentClassification = document.getElementById("document-classification");
  elements.documentOperationName = document.getElementById("document-operation-name");
  elements.assetType = document.getElementById("asset-type");
  elements.assetQuantity = document.getElementById("asset-quantity");
  elements.addAssetButton = document.getElementById("add-asset-button");
  elements.selectedAssetsOutput = document.getElementById("selected-assets-output");

    elements.linkedJpelSearch = document.getElementById("linked-jpel-search");
    elements.linkedJpelCheckboxes = document.getElementById("linked-jpel-checkboxes");
    elements.linkedJpelCount = document.getElementById("linked-jpel-count");
    elements.selectAllJpel = document.getElementById("select-all-jpel");
    elements.clearAllJpel = document.getElementById("clear-all-jpel");
    elements.linkedJpelHelp = document.getElementById("linked-jpel-help");

  elements.documentFile = document.getElementById("document-file");
  elements.dynamicQuestionContainer = document.getElementById("dynamic-question-container");
  elements.saveDocumentButton = document.getElementById("save-document-button");
  elements.resetDocumentButton = document.getElementById("reset-document-button");
  elements.documentStatusLine = document.getElementById("document-status-line");

  elements.documentSearch = document.getElementById("document-search");
  elements.documentTypeFilter = document.getElementById("document-type-filter");
  elements.documentStatusFilter = document.getElementById("document-status-filter");
  elements.refreshDocumentsButton = document.getElementById("refresh-documents-button");
  elements.documentsOutput = document.getElementById("documents-output");
  elements.documentViewer = document.getElementById("document-viewer");

  elements.jpelFormPanel = document.getElementById("jpel-form-panel");
  elements.jpelTargetName = document.getElementById("jpel-target-name");
  elements.jpelPriority = document.getElementById("jpel-priority");
  elements.jpelStatus = document.getElementById("jpel-status");
  elements.jpelCategory = document.getElementById("jpel-category");
  elements.jpelLocationText = document.getElementById("jpel-location-text");
  elements.jpelDescription = document.getElementById("jpel-description");
  elements.jpelIntelligenceNotes = document.getElementById("jpel-intelligence-notes");
  elements.jpelImages = document.getElementById("jpel-images");
  elements.saveJpelButton = document.getElementById("save-jpel-button");
  elements.resetJpelButton = document.getElementById("reset-jpel-button");
  elements.jpelStatusLine = document.getElementById("jpel-status-line");

  elements.jpelSearch = document.getElementById("jpel-search");
  elements.jpelPriorityFilter = document.getElementById("jpel-priority-filter");
  elements.jpelStatusFilter = document.getElementById("jpel-status-filter");
  elements.refreshJpelButton = document.getElementById("refresh-jpel-button");
  elements.jpelOutput = document.getElementById("jpel-output");
  elements.jpelViewer = document.getElementById("jpel-viewer");
}

function populateStaticDropdowns() {
  setOptions(elements.documentType, DOCUMENT_TYPES);
  setOptions(elements.documentStatus, DOCUMENT_STATUSES);
  setOptions(elements.documentTypeFilter, [{ value: "", label: "All Types" }, ...DOCUMENT_TYPES]);
  setOptions(elements.documentStatusFilter, [{ value: "", label: "All Status" }, ...DOCUMENT_STATUSES]);

  setOptions(elements.jpelPriority, JPEL_PRIORITIES);
  setOptions(elements.jpelStatus, JPEL_STATUSES);
  setOptions(elements.jpelPriorityFilter, [{ value: "", label: "All Priority" }, ...JPEL_PRIORITIES]);
  setOptions(elements.jpelStatusFilter, [{ value: "", label: "All Status" }, ...JPEL_STATUSES]);

  setOptions(elements.assetType, ASSET_LIST.map(asset => ({ value: asset, label: asset })));
}

function setOptions(selectElement, options) {
  if (!selectElement) {
    return;
  }

  selectElement.innerHTML = options.map(option => {
    return `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`;
  }).join("");
}

function bindEvents() {
  elements.logoutButton.addEventListener("click", doLogout);

  elements.documentsTabButton.addEventListener("click", function () {
    showTab("documents");
  });

  elements.jpelTabButton.addEventListener("click", function () {
    showTab("jpel");
  });

  elements.documentType.addEventListener("change", renderDynamicQuestions);
  elements.addAssetButton.addEventListener("click", addSelectedAsset);

  elements.saveDocumentButton.addEventListener("click", saveDocument);
  elements.resetDocumentButton.addEventListener("click", resetDocumentForm);
  elements.refreshDocumentsButton.addEventListener("click", loadDocuments);

  elements.documentSearch.addEventListener("input", renderDocuments);
  elements.documentTypeFilter.addEventListener("change", renderDocuments);
  elements.documentStatusFilter.addEventListener("change", renderDocuments);

  elements.saveJpelButton.addEventListener("click", saveJpelEntry);
  elements.resetJpelButton.addEventListener("click", resetJpelForm);
  elements.refreshJpelButton.addEventListener("click", loadJpelEntries);

  elements.jpelSearch.addEventListener("input", renderJpelEntries);
  elements.jpelPriorityFilter.addEventListener("change", renderJpelEntries);
  elements.jpelStatusFilter.addEventListener("change", renderJpelEntries);
}

function showAdminLinksIfAllowed(email) {
  const normalized = String(email || "").trim().toLowerCase();

  if (
    normalized !== "evans@navy.mil" &&
    normalized !== "carver@navy.mil"
  ) {
    return;
  }

  document.querySelectorAll(".admin-only-link").forEach(link => {
    link.style.display = "";
  });

  document.getElementById("system-section")?.style.removeProperty("display");
}

async function loadSessionAndProfile() {
  const sessionResult = await supabase.auth.getSession();

  if (sessionResult.error || !sessionResult.data.session) {
    window.location.href = "/login/";
    return false;
  }

  state.authUser = sessionResult.data.session.user;

  showAdminLinksIfAllowed(state.authUser.email);

  state.profile = {
    id: state.authUser.id,
    user_id: getUserIdFromEmail(state.authUser.email),
    display_name: state.authUser.email || "User",
    role: "MEMBER",
    status: "ACTIVE",
    avatar_url: null
  };

  const profileResult = await supabase
    .from("profiles")
    .select("id,user_id,display_name,role,status,avatar_url")
    .eq("id", state.authUser.id)
    .single();

  if (profileResult.data) {
    state.profile = { ...state.profile, ...profileResult.data };
  }

  elements.sessionLabel.textContent = state.profile.display_name;
  elements.sidebarName.textContent = state.profile.display_name;
  elements.sidebarRole.textContent = state.profile.role;

  if (elements.navAvatar && state.profile.avatar_url) {
  elements.navAvatar.src = state.profile.avatar_url;
}

  return true;
}

function applyPermissions() {
  const layouts = document.querySelectorAll(".two-column-layout");

  if (canManageOperational()) {
    elements.documentFormPanel.classList.remove("hidden");
    elements.jpelFormPanel.classList.remove("hidden");

    layouts.forEach(layout => {
      layout.classList.remove("viewer-mode");
    });

    return;
  }

  elements.documentFormPanel.classList.add("hidden");
  elements.jpelFormPanel.classList.add("hidden");

  layouts.forEach(layout => {
    layout.classList.add("viewer-mode");
  });
}

function canManageOperational() {
  const email = (state.authUser?.email || "").toLowerCase();
  return SETTINGS.adminEmails.includes(email);
}

function showTab(tabName) {
  const showDocuments = tabName === "documents";

  elements.documentsScreen.classList.toggle("active", showDocuments);
  elements.jpelScreen.classList.toggle("active", !showDocuments);

  elements.documentsTabButton.classList.toggle("active", showDocuments);
  elements.jpelTabButton.classList.toggle("active", !showDocuments);
}

function renderDynamicQuestions() {
  const type = elements.documentType.value;
  const sections = QUESTION_SETS[type] || [];

  elements.dynamicQuestionContainer.innerHTML = sections.map(section => {
    const fieldsHtml = section.fields.map(field => {
      return `
        <div class="form-group">
          <label for="dynamic-${escapeHtml(field.id)}">${escapeHtml(field.label)}</label>
          <textarea id="dynamic-${escapeHtml(field.id)}" data-target="${escapeHtml(field.target)}" data-append="${field.append ? "true" : "false"}"></textarea>
        </div>
      `;
    }).join("");

    return `
      <div class="panel">
        <h3>${escapeHtml(section.title)}</h3>
        <div class="form-grid">
          ${fieldsHtml}
        </div>
      </div>
    `;
  }).join("");
}

function getDynamicFieldValues() {
  const base = {
    task_org: "",
    situation: "",
    mission: "",
    execution: "",
    sustainment: "",
    command_signal: "",
    intel_summary: "",
    enemy_forces: "",
    friendly_forces: "",
    terrain_weather: "",
    timeline: "",
    coordinating_instructions: "",
    risks: "",
    free_text: ""
  };

  const textareas = elements.dynamicQuestionContainer.querySelectorAll("textarea[data-target]");

  textareas.forEach(textarea => {
    const target = textarea.dataset.target;
    const value = textarea.value.trim();

    if (!value || !Object.prototype.hasOwnProperty.call(base, target)) {
      return;
    }

    if (textarea.dataset.append === "true" && base[target]) {
      base[target] += "\n\n" + value;
      return;
    }

    if (base[target]) {
      base[target] += "\n\n" + value;
      return;
    }

    base[target] = value;
  });

  return base;
}

function addSelectedAsset() {
  const assetName = elements.assetType.value;
  const quantity = Math.max(1, Number(elements.assetQuantity.value || 1));

  if (!assetName) {
    return;
  }

  const existing = state.selectedAssets.find(asset => asset.name === assetName);

  if (existing) {
    existing.quantity += quantity;
  } else {
    state.selectedAssets.push({ name: assetName, quantity });
  }

  elements.assetQuantity.value = "1";
  renderSelectedAssets();
}

function removeSelectedAsset(assetName) {
  state.selectedAssets = state.selectedAssets.filter(asset => asset.name !== assetName);
  renderSelectedAssets();
}

function renderSelectedAssets() {
  if (!state.selectedAssets.length) {
    elements.selectedAssetsOutput.innerHTML = "No assets selected.";
    return;
  }

  elements.selectedAssetsOutput.innerHTML = state.selectedAssets.map(asset => {
    const removeButton = canManageOperational()
      ? `<button class="btn btn-danger" type="button" data-remove-asset="${escapeHtml(asset.name)}">Remove</button>`
      : "";

    return `
      <div class="asset-row">
        <span>${escapeHtml(asset.name)} x ${escapeHtml(asset.quantity)}</span>
        ${removeButton}
      </div>
    `;
  }).join("");

  elements.selectedAssetsOutput.querySelectorAll("[data-remove-asset]").forEach(button => {
    button.addEventListener("click", function () {
      removeSelectedAsset(button.dataset.removeAsset);
    });
  });
}

function renderLinkedJpelSelect(selectedIds = []) {
  const selectedSet = new Set(selectedIds.map(Number));

  if (!state.jpelEntries.length) {
    elements.linkedJpelCheckboxes.innerHTML = "";
    elements.linkedJpelHelp.textContent =
      "No register entries have been created yet.";
    updateLinkedJpelCount();
    return;
  }

  const search =
    (elements.linkedJpelSearch?.value || "")
      .trim()
      .toLowerCase();

  const filtered = state.jpelEntries.filter(entry => {
    return (
      entry.target_name?.toLowerCase().includes(search) ||
      String(entry.id).includes(search)
    );
  });

  elements.linkedJpelCheckboxes.innerHTML = filtered.map(entry => `
    <label class="checkbox-row">
      <input
        type="checkbox"
        class="linked-jpel-checkbox"
        value="${entry.id}"
        ${selectedSet.has(Number(entry.id)) ? "checked" : ""}
      >
      ${escapeHtml(entry.target_name)}
      (${escapeHtml(entry.priority)})
    </label>
  `).join("");

  elements.linkedJpelHelp.textContent =
    "Search, select multiple targets, or leave none selected.";

  updateLinkedJpelCount();

  document
    .querySelectorAll(".linked-jpel-checkbox")
    .forEach(box => {
      box.addEventListener("change", updateLinkedJpelCount);
    });
}

function getSelectedLinkedJpelIds() {
  return Array.from(
    document.querySelectorAll(".linked-jpel-checkbox:checked")
  )
    .map(box => Number(box.value))
    .filter(id => Number.isFinite(id));
}

function updateLinkedJpelCount() {
  const count = getSelectedLinkedJpelIds().length;

  if (elements.linkedJpelCount) {
    elements.linkedJpelCount.textContent =
      `${count} Selected`;
  }
}

function buildOperationalMeta(extra = {}) {
  return {
    version: 2,
    assets: state.selectedAssets.map(asset => ({
      name: asset.name,
      quantity: Number(asset.quantity || 1)
    })),
    linked_jpel_ids: getSelectedLinkedJpelIds(),
    aar: null,
    ...extra
  };
}

function normalizeOperationalMeta(rawAssets) {
  if (Array.isArray(rawAssets)) {
    return {
      version: 1,
      assets: rawAssets.map(asset => {
        if (typeof asset === "string") {
          return { name: asset, quantity: 1 };
        }

        return {
          name: String(asset.name || "Unknown"),
          quantity: Number(asset.quantity || 1)
        };
      }),
      linked_jpel_ids: [],
      aar: null
    };
  }

  if (rawAssets && typeof rawAssets === "object") {
    return {
      version: Number(rawAssets.version || 2),
      assets: Array.isArray(rawAssets.assets) ? rawAssets.assets.map(asset => ({
        name: String(asset.name || "Unknown"),
        quantity: Number(asset.quantity || 1)
      })) : [],
      linked_jpel_ids: Array.isArray(rawAssets.linked_jpel_ids) ? rawAssets.linked_jpel_ids.map(Number).filter(Number.isFinite) : [],
      aar: rawAssets.aar || null
    };
  }

  return {
    version: 2,
    assets: [],
    linked_jpel_ids: [],
    aar: null
  };
}

function getLinkedJpelEntries(meta) {
  const ids = Array.isArray(meta.linked_jpel_ids) ? meta.linked_jpel_ids : [];
  return state.jpelEntries.filter(entry => ids.includes(Number(entry.id)));
}

function resetDocumentForm() {
  elements.documentType.value = "WARNO";
  elements.documentStatus.value = "DRAFT";
  elements.documentTitle.value = "";
  elements.documentClassification.value = "UNCLASSIFIED";
  elements.documentOperationName.value = "";
  elements.documentFile.value = "";
  state.selectedAssets = [];

  renderDynamicQuestions();
  renderSelectedAssets();
  renderLinkedJpelSelect([]);
  clearStatusLine(elements.documentStatusLine);
}

async function saveDocument() {
  if (!canManageOperational()) {
    showStatusLine(elements.documentStatusLine, "You do not have permission to create operational documents.", false);
    return;
  }

  const title = elements.documentTitle.value.trim();

  if (!title) {
    showStatusLine(elements.documentStatusLine, "Title is required.", false);
    return;
  }

  setButtonLoading(elements.saveDocumentButton, true, "Saving...");

  let uploadedFilePath = null;
  let uploadedFileName = null;
  let uploadedFileType = null;

  const file = elements.documentFile.files[0];

  if (file) {
    uploadedFileName = file.name;
    uploadedFileType = getFileType(file);
    uploadedFilePath = `${state.authUser.id}/${Date.now()}_${cleanFileName(file.name)}`;

    const uploadResult = await supabase.storage
      .from(SETTINGS.bucketName)
      .upload(uploadedFilePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined
      });

    if (uploadResult.error) {
      showStatusLine(elements.documentStatusLine, "File upload failed: " + uploadResult.error.message, false);
      setButtonLoading(elements.saveDocumentButton, false, "Save Document");
      return;
    }
  }

  const dynamicValues = getDynamicFieldValues();

  const payload = {
    doc_type: elements.documentType.value,
    title,
    status: elements.documentStatus.value,
    classification: elements.documentClassification.value.trim() || "UNCLASSIFIED",
    operation_name: elements.documentOperationName.value.trim(),
    task_org: dynamicValues.task_org,
    situation: dynamicValues.situation,
    mission: dynamicValues.mission,
    execution: dynamicValues.execution,
    sustainment: dynamicValues.sustainment,
    command_signal: dynamicValues.command_signal,
    intel_summary: dynamicValues.intel_summary,
    enemy_forces: dynamicValues.enemy_forces,
    friendly_forces: dynamicValues.friendly_forces,
    terrain_weather: dynamicValues.terrain_weather,
    timeline: dynamicValues.timeline,
    coordinating_instructions: dynamicValues.coordinating_instructions,
    risks: dynamicValues.risks,
    free_text: dynamicValues.free_text,
    assets: buildOperationalMeta(),
    file_path: uploadedFilePath,
    file_name: uploadedFileName,
    file_type: uploadedFileType,
    created_by: state.authUser.id,
    updated_at: new Date().toISOString()
  };

  const insertResult = await supabase
    .from("operational_documents")
    .insert(payload);

  if (insertResult.error) {
    if (uploadedFilePath) {
      await supabase.storage.from(SETTINGS.bucketName).remove([uploadedFilePath]);
    }

    showStatusLine(elements.documentStatusLine, "Database save failed: " + insertResult.error.message, false);
    setButtonLoading(elements.saveDocumentButton, false, "Save Document");
    return;
  }

  resetDocumentForm();
  showStatusLine(elements.documentStatusLine, "Operational document saved.", true);
  setButtonLoading(elements.saveDocumentButton, false, "Save Document");
  await loadDocuments();
}

async function loadDocuments() {
  const result = await supabase
    .from("operational_documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (result.error) {
    elements.documentsOutput.innerHTML = `<div class="empty-state">Failed to load documents: ${escapeHtml(result.error.message)}</div>`;
    return;
  }

  state.documents = result.data || [];
  renderDocuments();
}

function renderDocuments() {
  const rows = getFilteredDocuments();

  if (!rows.length) {
    elements.documentsOutput.innerHTML = `<div class="empty-state">No operational documents found.</div>`;
    return;
  }

  elements.documentsOutput.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th data-document-sort="doc_type">Type</th>
            <th data-document-sort="title">Title</th>
            <th data-document-sort="status">Status</th>
            <th data-document-sort="operation_name">Operation</th>
            <th>Assets</th>
            <th>Linked Entries</th>
            <th data-document-sort="created_at">Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(renderDocumentRow).join("")}
        </tbody>
      </table>
    </div>
  `;

  elements.documentsOutput.querySelectorAll("[data-document-sort]").forEach(header => {
    header.addEventListener("click", function () {
      updateDocumentSort(header.dataset.documentSort);
    });
  });

  elements.documentsOutput.querySelectorAll("[data-view-document-id]").forEach(button => {
    button.addEventListener("click", function () {
      viewDocument(Number(button.dataset.viewDocumentId));
    });
  });

  elements.documentsOutput.querySelectorAll("[data-open-file-path]").forEach(button => {
    button.addEventListener("click", function () {
      openDocumentFile(button.dataset.openFilePath);
    });
  });

  elements.documentsOutput.querySelectorAll("[data-delete-document-id]").forEach(button => {
    button.addEventListener("click", function () {
      deleteDocument(Number(button.dataset.deleteDocumentId), button.dataset.deleteFilePath || "");
    });
  });

  elements.documentsOutput.querySelectorAll("[data-update-document-status-id]").forEach(button => {
    button.addEventListener("click", function () {
      const id = Number(button.dataset.updateDocumentStatusId);
      const select = elements.documentsOutput.querySelector(`[data-document-status-select="${id}"]`);
      updateDocumentStatus(id, select.value);
    });
  });
}

function renderDocumentRow(documentRecord) {
  const meta = normalizeOperationalMeta(documentRecord.assets);
  const linkedEntries = getLinkedJpelEntries(meta);
  const assetsText = meta.assets.length ? meta.assets.map(asset => `${asset.name} x ${asset.quantity}`).join(", ") : "None";
  const linkedText = linkedEntries.length ? linkedEntries.map(entry => entry.target_name).join(", ") : "None";

  const fileButton = documentRecord.file_path
    ? `<button class="btn btn-secondary" type="button" data-open-file-path="${escapeHtml(documentRecord.file_path)}">File</button>`
    : "";

  const deleteButton = canManageOperational()
    ? `<button class="btn btn-danger" type="button" data-delete-document-id="${documentRecord.id}" data-delete-file-path="${escapeHtml(documentRecord.file_path || "")}">Delete</button>`
    : "";

  const statusControls = canManageOperational()
    ? `
      <div class="inline-status-controls">
        <select data-document-status-select="${documentRecord.id}">
          ${DOCUMENT_STATUSES.map(status => `<option value="${status.value}" ${documentRecord.status === status.value ? "selected" : ""}>${status.label}</option>`).join("")}
        </select>
        <button class="btn btn-secondary" type="button" data-update-document-status-id="${documentRecord.id}">Update</button>
      </div>
      <div class="mini-status" data-document-status-message="${documentRecord.id}"></div>
    `
    : `<span class="badge ${getStatusBadgeClass(documentRecord.status)}">${escapeHtml(documentRecord.status)}</span>`;

  return `
    <tr>
      <td><span class="badge badge-blue">${escapeHtml(documentRecord.doc_type)}</span></td>
      <td>
        <strong>${escapeHtml(documentRecord.title)}</strong><br>
        <span class="muted">${escapeHtml(documentRecord.classification || "UNCLASSIFIED")}</span>
      </td>
      <td>${statusControls}</td>
      <td>${escapeHtml(documentRecord.operation_name || "N/A")}</td>
      <td>${escapeHtml(assetsText)}</td>
      <td>${escapeHtml(linkedText)}</td>
      <td>${escapeHtml(formatDate(documentRecord.created_at))}</td>
      <td>
        <button class="btn btn-secondary" type="button" data-view-document-id="${documentRecord.id}">View</button>
        ${fileButton}
        ${deleteButton}
      </td>
    </tr>
  `;
}

function getFilteredDocuments() {
  const query = elements.documentSearch.value.trim().toLowerCase();
  const type = elements.documentTypeFilter.value;
  const status = elements.documentStatusFilter.value;

  const filtered = state.documents.filter(documentRecord => {
    const meta = normalizeOperationalMeta(documentRecord.assets);
    const assetsText = meta.assets.map(asset => `${asset.name} ${asset.quantity}`).join(" ");
    const linkedText = getLinkedJpelEntries(meta).map(entry => entry.target_name).join(" ");

    const combinedText = [
      documentRecord.doc_type,
      documentRecord.title,
      documentRecord.status,
      documentRecord.classification,
      documentRecord.operation_name,
      documentRecord.task_org,
      documentRecord.situation,
      documentRecord.mission,
      documentRecord.execution,
      documentRecord.sustainment,
      documentRecord.command_signal,
      documentRecord.intel_summary,
      documentRecord.enemy_forces,
      documentRecord.friendly_forces,
      documentRecord.terrain_weather,
      documentRecord.timeline,
      documentRecord.coordinating_instructions,
      documentRecord.risks,
      documentRecord.free_text,
      documentRecord.file_name,
      assetsText,
      linkedText
    ].join(" ").toLowerCase();

    return (!query || combinedText.includes(query)) &&
      (!type || documentRecord.doc_type === type) &&
      (!status || documentRecord.status === status);
  });

  filtered.sort(function (a, b) {
    return compareRecords(a, b, state.documentSort.field, state.documentSort.asc);
  });

  return filtered;
}

function updateDocumentSort(field) {
  if (state.documentSort.field === field) {
    state.documentSort.asc = !state.documentSort.asc;
  } else {
    state.documentSort.field = field;
    state.documentSort.asc = true;
  }

  renderDocuments();
}

async function updateDocumentStatus(id, status) {
  if (!canManageOperational()) {
    alert("You do not have permission to change document status.");
    return;
  }

  const result = await supabase
    .from("operational_documents")
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (result.error) {
    alert("Status update failed: " + result.error.message);
    return;
  }

  await loadDocuments();

  if (state.activeDocumentId === id) {
    viewDocument(id);
  }

  showTemporaryPageMessage("Document status updated.");
}

function viewDocument(id) {
  const documentRecord = state.documents.find(item => item.id === id);

  if (!documentRecord) {
    return;
  }

  state.activeDocumentId = id;

  const meta = normalizeOperationalMeta(documentRecord.assets);
  const linkedEntries = getLinkedJpelEntries(meta);
  const assetsText = meta.assets.length ? meta.assets.map(asset => `${asset.name} x ${asset.quantity}`).join("\n") : "None";
  const linkedText = linkedEntries.length
    ? linkedEntries.map(entry => `${entry.target_name} | ${entry.priority} | ${entry.status}`).join("\n")
    : "No linked register entries.";

  elements.documentViewer.className = "viewer";
  elements.documentViewer.innerHTML = `
    <h2>${escapeHtml(documentRecord.doc_type)} - ${escapeHtml(documentRecord.title)}</h2>
    <div>
      <strong>Status:</strong> ${escapeHtml(documentRecord.status)}
      |
      <strong>Classification:</strong> ${escapeHtml(documentRecord.classification || "UNCLASSIFIED")}
      |
      <strong>Created:</strong> ${escapeHtml(formatDate(documentRecord.created_at))}
    </div>

    ${viewerSection("Operation Name", documentRecord.operation_name)}
    ${viewerSection("Attached Assets", assetsText)}
    ${viewerSection("Linked Register Entries", linkedText)}
    ${viewerSection("Task Organization", documentRecord.task_org)}
    ${viewerSection("Situation", documentRecord.situation)}
    ${viewerSection("Mission", documentRecord.mission)}
    ${viewerSection("Execution", documentRecord.execution)}
    ${viewerSection("Sustainment", documentRecord.sustainment)}
    ${viewerSection("Command And Signal", documentRecord.command_signal)}
    ${viewerSection("Intel Summary", documentRecord.intel_summary)}
    ${viewerSection("Enemy Forces", documentRecord.enemy_forces)}
    ${viewerSection("Friendly Forces", documentRecord.friendly_forces)}
    ${viewerSection("Terrain / Weather", documentRecord.terrain_weather)}
    ${viewerSection("Timeline", documentRecord.timeline)}
    ${viewerSection("Coordinating Instructions", documentRecord.coordinating_instructions)}
    ${viewerSection("Risk / Mitigation Notes", documentRecord.risks)}
    ${viewerSection("Free Text", documentRecord.free_text)}
    ${renderAarSection(documentRecord, meta)}
  `;

  bindAarEvents(documentRecord, meta);
}

function renderAarSection(documentRecord, meta) {
  if (documentRecord.doc_type !== "OPORD") {
    return `
      <div class="aar-box">
        <h3>AAR</h3>
        <div class="muted">AARs are only enabled for OPORD records.</div>
      </div>
    `;
  }

  const aar = meta.aar || {};

  if (!canManageOperational()) {
    return `
      <div class="aar-box">
        <h3>AAR</h3>
        ${viewerSection("Summary", aar.summary)}
        ${viewerSection("What Went Well", aar.sustains)}
        ${viewerSection("What Needs Improvement", aar.improves)}
        ${viewerSection("Action Items", aar.action_items)}
        ${viewerSection("Submitted By", aar.submitted_by)}
        ${viewerSection("Submitted At", aar.submitted_at ? formatDate(aar.submitted_at) : "")}
      </div>
    `;
  }

  return `
    <div class="aar-box">
      <h3>After Action Review</h3>

      <div class="form-grid">
        <div class="form-group full">
          <label for="aar-summary">Summary</label>
          <textarea id="aar-summary">${escapeHtml(aar.summary || "")}</textarea>
        </div>

        <div class="form-group">
          <label for="aar-sustains">What Went Well</label>
          <textarea id="aar-sustains">${escapeHtml(aar.sustains || "")}</textarea>
        </div>

        <div class="form-group">
          <label for="aar-improves">What Needs Improvement</label>
          <textarea id="aar-improves">${escapeHtml(aar.improves || "")}</textarea>
        </div>

        <div class="form-group full">
          <label for="aar-action-items">Action Items</label>
          <textarea id="aar-action-items">${escapeHtml(aar.action_items || "")}</textarea>
        </div>
      </div>

      <div class="button-row">
        <button id="save-aar-button" class="btn btn-primary" type="button">Save AAR</button>
      </div>

      <div id="aar-status-line" class="status-line"></div>
    </div>
  `;
}

function bindAarEvents(documentRecord, meta) {
  const saveButton = document.getElementById("save-aar-button");

  if (!saveButton) {
    return;
  }

  saveButton.addEventListener("click", function () {
    saveAar(documentRecord, meta);
  });
}

async function saveAar(documentRecord, meta) {
  if (!canManageOperational()) {
    alert("You do not have permission to save AARs.");
    return;
  }

  if (documentRecord.doc_type !== "OPORD") {
    alert("AARs are only enabled for OPORD records.");
    return;
  }

  const line = document.getElementById("aar-status-line");

  const aar = {
    summary: document.getElementById("aar-summary").value.trim(),
    sustains: document.getElementById("aar-sustains").value.trim(),
    improves: document.getElementById("aar-improves").value.trim(),
    action_items: document.getElementById("aar-action-items").value.trim(),
    submitted_by: state.authUser.email || state.authUser.id,
    submitted_at: new Date().toISOString()
  };

  const nextMeta = {
    ...meta,
    version: 2,
    aar
  };

  const result = await supabase
    .from("operational_documents")
    .update({
      assets: nextMeta,
      updated_at: new Date().toISOString()
    })
    .eq("id", documentRecord.id);

  if (result.error) {
    if (line) {
      showStatusLine(line, "AAR save failed: " + result.error.message, false);
    }
    return;
  }

  if (line) {
    showStatusLine(line, "AAR saved.", true);
  }

  await loadDocuments();
  viewDocument(documentRecord.id);
}

async function openDocumentFile(filePath) {
  const result = await supabase.storage
    .from(SETTINGS.bucketName)
    .createSignedUrl(filePath, 600);

  if (result.error || !result.data) {
    alert("Could not open file.");
    return;
  }

  window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
}

async function deleteDocument(id, filePath) {
  if (!canManageOperational()) {
    alert("You do not have permission to delete operational documents.");
    return;
  }

  if (!window.confirm("Delete this operational document?")) {
    return;
  }

  if (filePath) {
    await supabase.storage.from(SETTINGS.bucketName).remove([filePath]);
  }

  const result = await supabase
    .from("operational_documents")
    .delete()
    .eq("id", id);

  if (result.error) {
    alert("Delete failed: " + result.error.message);
    return;
  }

  await loadDocuments();
  showTemporaryPageMessage("Document deleted.");
}

function resetJpelForm() {
  elements.jpelTargetName.value = "";
  elements.jpelPriority.value = "MEDIUM";
  elements.jpelStatus.value = "OPEN";
  elements.jpelCategory.value = "";
  elements.jpelLocationText.value = "";
  elements.jpelDescription.value = "";
  elements.jpelIntelligenceNotes.value = "";

  if (elements.jpelImages) {
    elements.jpelImages.value = "";
  }

  clearStatusLine(elements.jpelStatusLine);
}

async function saveJpelEntry() {
  if (!canManageOperational()) {
    showStatusLine(elements.jpelStatusLine, "You do not have permission to create register entries.", false);
    return;
  }

  const targetName = elements.jpelTargetName.value.trim();

  if (!targetName) {
    showStatusLine(elements.jpelStatusLine, "Name / entity / reference is required.", false);
    return;
  }

  setButtonLoading(elements.saveJpelButton, true, "Saving...");

  let uploadedImages = [];

  try {
    uploadedImages = await uploadJpelImages();
  } catch (error) {
    showStatusLine(elements.jpelStatusLine, "Image upload failed: " + error.message, false);
    setButtonLoading(elements.saveJpelButton, false, "Save Register Entry");
    return;
  }

  const payload = {
    target_name: targetName,
    priority: elements.jpelPriority.value,
    status: elements.jpelStatus.value,
    category: elements.jpelCategory.value.trim(),
    location_text: elements.jpelLocationText.value.trim(),
    description: elements.jpelDescription.value.trim(),
    intelligence_notes: packJpelNotes(elements.jpelIntelligenceNotes.value.trim(), uploadedImages),
    created_by: state.authUser.id,
    updated_at: new Date().toISOString()
  };

  const result = await supabase
    .from("jpel_entries")
    .insert(payload);

  if (result.error) {
    showStatusLine(elements.jpelStatusLine, "Register save failed: " + result.error.message, false);
    setButtonLoading(elements.saveJpelButton, false, "Save Register Entry");
    return;
  }

  resetJpelForm();
  showStatusLine(elements.jpelStatusLine, "Register entry saved.", true);
  setButtonLoading(elements.saveJpelButton, false, "Save Register Entry");

  await loadJpelEntries();
  renderLinkedJpelSelect([]);
}

async function loadJpelEntries() {
  const result = await supabase
    .from("jpel_entries")
    .select("*")
    .order("created_at", { ascending: false });

  if (result.error) {
    elements.jpelOutput.innerHTML = `<div class="empty-state">Failed to load register entries: ${escapeHtml(result.error.message)}</div>`;
    return;
  }

  state.jpelEntries = result.data || [];
  renderJpelEntries();
  renderLinkedJpelSelect([]);
}

function renderJpelEntries() {
  const rows = getFilteredJpelEntries();

  if (!rows.length) {
    elements.jpelOutput.innerHTML = `<div class="empty-state">No register entries found.</div>`;
    return;
  }

  elements.jpelOutput.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th data-jpel-sort="target_name">Name / Entity</th>
            <th data-jpel-sort="priority">Priority</th>
            <th data-jpel-sort="status">Status</th>
            <th data-jpel-sort="category">Category</th>
            <th data-jpel-sort="created_at">Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(renderJpelRow).join("")}
        </tbody>
      </table>
    </div>
  `;

  elements.jpelOutput.querySelectorAll("[data-jpel-sort]").forEach(header => {
    header.addEventListener("click", function () {
      updateJpelSort(header.dataset.jpelSort);
    });
  });

  elements.jpelOutput.querySelectorAll("[data-view-jpel-id]").forEach(button => {
    button.addEventListener("click", function () {
      viewJpelEntry(Number(button.dataset.viewJpelId));
    });
  });

  elements.jpelOutput.querySelectorAll("[data-delete-jpel-id]").forEach(button => {
    button.addEventListener("click", function () {
      deleteJpelEntry(Number(button.dataset.deleteJpelId));
    });
  });

  elements.jpelOutput.querySelectorAll("[data-update-jpel-status-id]").forEach(button => {
    button.addEventListener("click", function () {
      const id = Number(button.dataset.updateJpelStatusId);
      const select = elements.jpelOutput.querySelector(`[data-jpel-status-select="${id}"]`);
      updateJpelStatus(id, select.value);
    });
  });
}

function renderJpelRow(entry) {
  const deleteButton = canManageOperational()
    ? `<button class="btn btn-danger" type="button" data-delete-jpel-id="${entry.id}">Delete</button>`
    : "";

  const statusControls = canManageOperational()
    ? `
      <div class="inline-status-controls">
        <select data-jpel-status-select="${entry.id}">
          ${JPEL_STATUSES.map(status => `<option value="${status.value}" ${entry.status === status.value ? "selected" : ""}>${status.label}</option>`).join("")}
        </select>
        <button class="btn btn-secondary" type="button" data-update-jpel-status-id="${entry.id}">Update</button>
      </div>
      <div class="mini-status" data-jpel-status-message="${entry.id}"></div>
    `
    : `<span class="badge ${getStatusBadgeClass(entry.status)}">${escapeHtml(entry.status)}</span>`;

  return `
    <tr>
      <td>
        <strong>${escapeHtml(entry.target_name)}</strong><br>
        <span class="muted">${escapeHtml(entry.location_text || "No location text")}</span>
      </td>
      <td><span class="badge ${getPriorityBadgeClass(entry.priority)}">${escapeHtml(entry.priority)}</span></td>
      <td>${statusControls}</td>
      <td>${escapeHtml(entry.category || "N/A")}</td>
      <td>${escapeHtml(formatDate(entry.created_at))}</td>
      <td>
        <button class="btn btn-secondary" type="button" data-view-jpel-id="${entry.id}">View</button>
        ${deleteButton}
      </td>
    </tr>
  `;
}

function getFilteredJpelEntries() {
  const query = elements.jpelSearch.value.trim().toLowerCase();
  const priority = elements.jpelPriorityFilter.value;
  const status = elements.jpelStatusFilter.value;

  const filtered = state.jpelEntries.filter(entry => {
    const unpackedNotes = unpackJpelNotes(entry.intelligence_notes);

    const combinedText = [
      entry.target_name,
      entry.priority,
      entry.status,
      entry.category,
      entry.location_text,
      entry.description,
      unpackedNotes.notes
    ].join(" ").toLowerCase();

    return (!query || combinedText.includes(query)) &&
      (!priority || entry.priority === priority) &&
      (!status || entry.status === status);
  });

  filtered.sort(function (a, b) {
    return compareRecords(a, b, state.jpelSort.field, state.jpelSort.asc);
  });

  return filtered;
}

function updateJpelSort(field) {
  if (state.jpelSort.field === field) {
    state.jpelSort.asc = !state.jpelSort.asc;
  } else {
    state.jpelSort.field = field;
    state.jpelSort.asc = true;
  }

  renderJpelEntries();
}

async function updateJpelStatus(id, status) {
  if (!canManageOperational()) {
    alert("You do not have permission to change register status.");
    return;
  }

  const result = await supabase
    .from("jpel_entries")
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (result.error) {
    alert("Status update failed: " + result.error.message);
    return;
  }

  await loadJpelEntries();
  await loadDocuments();

  showTemporaryPageMessage("Register status updated.");
}

async function viewJpelEntry(id) {
  const entry = state.jpelEntries.find(item => item.id === id);

  if (!entry) {
    return;
  }

  const meta = unpackJpelNotes(entry.intelligence_notes);
  const signedImages = await getSignedImageUrls(meta.images);

  const imagesHtml = signedImages.length
    ? `
      <div class="target-image-grid">
        ${signedImages.map(image => `
          <div class="target-image-card">
            <img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.name || "Attached image")}">
            <div>${escapeHtml(image.name || "Attached image")}</div>
          </div>
        `).join("")}
      </div>
    `
    : `<div class="empty-state">No images attached.</div>`;

  elements.jpelViewer.className = "viewer";
  elements.jpelViewer.innerHTML = `
    <h2>Register Entry - ${escapeHtml(entry.target_name)}</h2>
    <div>
      <strong>Priority:</strong> ${escapeHtml(entry.priority)}
      |
      <strong>Status:</strong> ${escapeHtml(entry.status)}
      |
      <strong>Created:</strong> ${escapeHtml(formatDate(entry.created_at))}
    </div>

    ${viewerSection("Category", entry.category)}
    ${viewerSection("Location / Area Text", entry.location_text)}
    ${viewerSection("Description", entry.description)}
    ${viewerSection("Intelligence Notes", meta.notes)}

    <h3>Attached Images</h3>
    ${imagesHtml}
  `;
}

async function deleteJpelEntry(id) {
  if (!canManageOperational()) {
    alert("You do not have permission to delete register entries.");
    return;
  }

  if (!window.confirm("Delete this register entry?")) {
    return;
  }

  const result = await supabase
    .from("jpel_entries")
    .delete()
    .eq("id", id);

  if (result.error) {
    alert("Delete failed: " + result.error.message);
    return;
  }

  await loadJpelEntries();
  await loadDocuments();
  showTemporaryPageMessage("Register entry deleted.");
}

function packJpelNotes(notes, images) {
  return "__JPEL_META__" + JSON.stringify({
    version: 1,
    notes: notes || "",
    images: Array.isArray(images) ? images : []
  });
}

function unpackJpelNotes(rawValue) {
  const raw = String(rawValue || "");

  if (!raw.startsWith("__JPEL_META__")) {
    return {
      notes: raw,
      images: []
    };
  }

  try {
    const parsed = JSON.parse(raw.replace("__JPEL_META__", ""));

    return {
      notes: parsed.notes || "",
      images: Array.isArray(parsed.images) ? parsed.images : []
    };
  } catch {
    return {
      notes: raw,
      images: []
    };
  }
}

async function uploadJpelImages() {
  if (!elements.jpelImages) {
    return [];
  }

  const files = Array.from(elements.jpelImages.files || []);

  if (!files.length) {
    return [];
  }

  const uploaded = [];

  for (const file of files) {
    const filePath = `${state.authUser.id}/jpel-images/${Date.now()}_${Math.random().toString(36).slice(2)}_${cleanFileName(file.name)}`;

    const uploadResult = await supabase.storage
      .from(SETTINGS.bucketName)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined
      });

    if (uploadResult.error) {
      throw new Error(uploadResult.error.message);
    }

    uploaded.push({
      path: filePath,
      name: file.name,
      type: file.type || getFileType(file)
    });
  }

  return uploaded;
}

async function getSignedImageUrls(images) {
  const output = [];

  for (const image of images || []) {
    const result = await supabase.storage
      .from(SETTINGS.bucketName)
      .createSignedUrl(image.path, 600);

    if (!result.error && result.data) {
      output.push({
        ...image,
        url: result.data.signedUrl
      });
    }
  }

  return output;
}

async function doLogout() {
  await supabase.auth.signOut();
  window.location.href = "/login/";
}

function getUserIdFromEmail(email) {
  if (!email || !email.includes("@")) {
    return "unknown";
  }

  return email.split("@")[0];
}

function getFileType(file) {
  if (file.type) {
    return file.type;
  }

  const name = file.name || "";
  const dotIndex = name.lastIndexOf(".");

  if (dotIndex === -1) {
    return "unknown";
  }

  return name.slice(dotIndex + 1).toLowerCase();
}

function cleanFileName(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
}

function formatDate(value) {
  if (!value) {
    return "Unknown";
  }

  return new Date(value).toLocaleString();
}

function compareRecords(a, b, field, asc) {
  const av = a[field] ?? "";
  const bv = b[field] ?? "";

  const result = String(av).localeCompare(String(bv), undefined, {
    numeric: true,
    sensitivity: "base"
  });

  return asc ? result : result * -1;
}

function viewerSection(title, value) {
  return `
    <h3>${escapeHtml(title)}</h3>
    <pre>${escapeHtml(value || "N/A")}</pre>
  `;
}

function getStatusBadgeClass(status) {
  if (status === "ACTIVE" || status === "OPEN") {
    return "badge-green";
  }

  if (status === "DRAFT" || status === "IN_REVIEW") {
    return "badge-yellow";
  }

  if (status === "ARCHIVED" || status === "CLOSED") {
    return "badge-red";
  }

  return "badge-blue";
}

function getPriorityBadgeClass(priority) {
  if (priority === "CRITICAL") {
    return "badge-red";
  }

  if (priority === "HIGH") {
    return "badge-yellow";
  }

  if (priority === "LOW") {
    return "badge-green";
  }

  return "badge-blue";
}

function showStatusLine(element, message, ok) {
  element.textContent = message;
  element.className = "status-line visible " + (ok ? "ok" : "err");
}

function clearStatusLine(element) {
  element.textContent = "";
  element.className = "status-line";
}

function setButtonLoading(button, loading, text) {
  button.disabled = loading;
  button.textContent = text;
}

function showTemporaryPageMessage(message) {
  if (!elements.documentStatusLine) {
    return;
  }

  showStatusLine(elements.documentStatusLine, message, true);

  window.setTimeout(function () {
    clearStatusLine(elements.documentStatusLine);
  }, 3000);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}