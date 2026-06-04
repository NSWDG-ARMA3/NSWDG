import { supabase } from "/js/auth.js";

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
  "MH-6 Little Bird",
  "AH-6 Little Bird",
  "MH-60 Transport",
  "MH-60 DAP",
  "HH-60 Pedro",
  "C-130 Hercules",
  "C-17 Globemaster III",
  "CCA Boat",
  "RHIB",
  "SOC-R",
  "MRZR",
  "MV850 ATV",
  "GMV",
  "JLTV",
  "HMMWV",
  "MATV",
  "LMTV",
  "MTV",
  "Fuel Truck",
  "Ammo Truck",
  "Medical Evacuation Vehicle",
  "UAS ISR Platform",
  "JTAC Team",
  "K9 Team",
  "EOD Team",
  "Boat Crew",
  "Ground Mobility Team",
  "Sniper / Overwatch Team",
  "Communications Relay Team",
  "CASEVAC Package",
  "QRF Element"
];

const QUESTION_SETS = {
  WARNO: [
    {
      title: "1. Situation",
      fields: [
        { id: "situation-overview", label: "Situation Overview", target: "situation", type: "textarea" },
        { id: "enemy-summary", label: "Enemy / Threat Summary", target: "enemy_forces", type: "textarea" },
        { id: "friendly-summary", label: "Friendly Forces Summary", target: "friendly_forces", type: "textarea" },
        { id: "terrain-weather", label: "Terrain / Weather", target: "terrain_weather", type: "textarea" }
      ]
    },
    {
      title: "2. Mission Preview",
      fields: [
        { id: "mission-statement", label: "Initial Mission Statement", target: "mission", type: "textarea" },
        { id: "operation-purpose", label: "Purpose / Intent", target: "free_text", type: "textarea" },
        { id: "known-constraints", label: "Known Constraints", target: "coordinating_instructions", type: "textarea" },
        { id: "initial-risks", label: "Initial Risks", target: "risks", type: "textarea" }
      ]
    },
    {
      title: "3. Timeline And Coordination",
      fields: [
        { id: "timeline", label: "Known Timeline", target: "timeline", type: "textarea" },
        { id: "task-org", label: "Initial Task Organization", target: "task_org", type: "textarea" },
        { id: "coordination", label: "Coordination Requirements", target: "command_signal", type: "textarea" },
        { id: "support-needs", label: "Support Requirements", target: "sustainment", type: "textarea" }
      ]
    }
  ],

  OPORD: [
    {
      title: "1. Situation",
      fields: [
        { id: "situation", label: "General Situation", target: "situation", type: "textarea" },
        { id: "enemy-forces", label: "Enemy Forces", target: "enemy_forces", type: "textarea" },
        { id: "friendly-forces", label: "Friendly Forces", target: "friendly_forces", type: "textarea" },
        { id: "terrain-weather", label: "Terrain / Weather", target: "terrain_weather", type: "textarea" }
      ]
    },
    {
      title: "2. Mission And Execution",
      fields: [
        { id: "mission", label: "Mission Statement", target: "mission", type: "textarea" },
        { id: "commander-intent", label: "Commander Intent", target: "execution", type: "textarea" },
        { id: "concept-of-operation", label: "Concept Of Operation", target: "execution", type: "textarea", append: true },
        { id: "tasks-to-subordinate-units", label: "Tasks To Subordinate Units", target: "task_org", type: "textarea" }
      ]
    },
    {
      title: "3. Sustainment And Command",
      fields: [
        { id: "sustainment", label: "Sustainment", target: "sustainment", type: "textarea" },
        { id: "medical", label: "Medical / CASEVAC", target: "sustainment", type: "textarea", append: true },
        { id: "command-signal", label: "Command And Signal", target: "command_signal", type: "textarea" },
        { id: "coordinating-instructions", label: "Coordinating Instructions", target: "coordinating_instructions", type: "textarea" }
      ]
    },
    {
      title: "4. Timeline And Risk",
      fields: [
        { id: "timeline", label: "Timeline", target: "timeline", type: "textarea" },
        { id: "risk-controls", label: "Risk Controls / Mitigation", target: "risks", type: "textarea" },
        { id: "additional-notes", label: "Additional Free Notes", target: "free_text", type: "textarea" },
        { id: "intel-summary", label: "Intel Summary", target: "intel_summary", type: "textarea" }
      ]
    }
  ],

  INTPACK: [
    {
      title: "1. Intelligence Overview",
      fields: [
        { id: "intel-summary", label: "Executive Intelligence Summary", target: "intel_summary", type: "textarea" },
        { id: "situation", label: "Operational Context", target: "situation", type: "textarea" },
        { id: "collection-gaps", label: "Collection Gaps", target: "free_text", type: "textarea" },
        { id: "confidence-level", label: "Assessment Confidence", target: "free_text", type: "textarea", append: true }
      ]
    },
    {
      title: "2. Threat And Environment",
      fields: [
        { id: "enemy-forces", label: "Threat / Enemy Forces", target: "enemy_forces", type: "textarea" },
        { id: "friendly-forces", label: "Friendly / Partner Forces", target: "friendly_forces", type: "textarea" },
        { id: "terrain-weather", label: "Terrain / Weather / Civil Considerations", target: "terrain_weather", type: "textarea" },
        { id: "pattern-of-life", label: "Pattern Of Life Notes", target: "timeline", type: "textarea" }
      ]
    },
    {
      title: "3. Intelligence Product Details",
      fields: [
        { id: "priority-intelligence-requirements", label: "Priority Intelligence Requirements", target: "coordinating_instructions", type: "textarea" },
        { id: "recommended-actions", label: "Recommended Non-Lethal Follow-Up", target: "mission", type: "textarea" },
        { id: "risk-notes", label: "Risks / Source Reliability Concerns", target: "risks", type: "textarea" },
        { id: "distribution-notes", label: "Distribution / Handling Notes", target: "command_signal", type: "textarea" }
      ]
    }
  ]
};

const state = {
  authUser: null,
  profile: null,
  documents: [],
  jpelEntries: [],
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
  updateSelectedAssetsOutput();

  await loadDocuments();
  await loadJpelEntries();
}

function cacheElements() {
  elements.sessionLabel = document.getElementById("session-label");
  elements.sidebarName = document.getElementById("sidebar-name");
  elements.sidebarRole = document.getElementById("sidebar-role");
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
  elements.documentAssets = document.getElementById("document-assets");
  elements.selectedAssetsOutput = document.getElementById("selected-assets-output");
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

  elements.documentAssets.innerHTML = ASSET_LIST.map(asset => {
    return `<option value="${escapeHtml(asset)}">${escapeHtml(asset)}</option>`;
  }).join("");
}

function setOptions(selectElement, options) {
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

  elements.documentType.addEventListener("change", function () {
    renderDynamicQuestions();
  });

  elements.documentAssets.addEventListener("change", updateSelectedAssetsOutput);

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
    status: "ACTIVE"
  };

  const profileResult = await supabase
    .from("profiles")
    .select("id,user_id,display_name,role,status")
    .eq("id", state.authUser.id)
    .single();

  if (profileResult.data) {
    state.profile = {
      ...state.profile,
      ...profileResult.data
    };
  }

  elements.sessionLabel.textContent = state.profile.display_name;
  elements.sidebarName.textContent = state.profile.display_name;
  elements.sidebarRole.textContent = state.profile.role;

  return true;
}

function applyPermissions() {
  if (canManageOperational()) {
    elements.documentFormPanel.classList.remove("hidden");
    elements.jpelFormPanel.classList.remove("hidden");
    return;
  }

  elements.documentFormPanel.classList.add("hidden");
  elements.jpelFormPanel.classList.add("hidden");
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
        <div class="form-group ${field.full ? "full" : ""}">
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

function resetDocumentForm() {
  elements.documentType.value = "WARNO";
  elements.documentStatus.value = "DRAFT";
  elements.documentTitle.value = "";
  elements.documentClassification.value = "UNCLASSIFIED";
  elements.documentOperationName.value = "";
  elements.documentFile.value = "";

  Array.from(elements.documentAssets.options).forEach(option => {
    option.selected = false;
  });

  renderDynamicQuestions();
  updateSelectedAssetsOutput();
  clearStatusLine(elements.documentStatusLine);
}

function getSelectedAssets() {
  return Array.from(elements.documentAssets.selectedOptions).map(option => option.value);
}

function updateSelectedAssetsOutput() {
  const selectedAssets = getSelectedAssets();

  if (!selectedAssets.length) {
    elements.selectedAssetsOutput.textContent = "Selected: None";
    return;
  }

  elements.selectedAssetsOutput.textContent = "Selected: " + selectedAssets.join(", ");
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
    title: title,
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
    assets: getSelectedAssets(),
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
}

function renderDocumentRow(documentRecord) {
  const assets = Array.isArray(documentRecord.assets) ? documentRecord.assets : [];
  const fileButton = documentRecord.file_path
    ? `<button class="btn btn-secondary" type="button" data-open-file-path="${escapeHtml(documentRecord.file_path)}">File</button>`
    : "";

  const deleteButton = canManageOperational()
    ? `<button class="btn btn-danger" type="button" data-delete-document-id="${documentRecord.id}" data-delete-file-path="${escapeHtml(documentRecord.file_path || "")}">Delete</button>`
    : "";

  return `
    <tr>
      <td><span class="badge badge-blue">${escapeHtml(documentRecord.doc_type)}</span></td>
      <td>
        <strong>${escapeHtml(documentRecord.title)}</strong><br>
        <span class="muted">${escapeHtml(documentRecord.classification || "UNCLASSIFIED")}</span>
      </td>
      <td><span class="badge ${getStatusBadgeClass(documentRecord.status)}">${escapeHtml(documentRecord.status)}</span></td>
      <td>${escapeHtml(documentRecord.operation_name || "N/A")}</td>
      <td>${escapeHtml(assets.join(", ") || "None")}</td>
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
    const assets = Array.isArray(documentRecord.assets) ? documentRecord.assets.join(" ") : "";

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
      assets
    ].join(" ").toLowerCase();

    const matchesQuery = !query || combinedText.includes(query);
    const matchesType = !type || documentRecord.doc_type === type;
    const matchesStatus = !status || documentRecord.status === status;

    return matchesQuery && matchesType && matchesStatus;
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

function viewDocument(id) {
  const documentRecord = state.documents.find(item => item.id === id);

  if (!documentRecord) {
    return;
  }

  const assets = Array.isArray(documentRecord.assets) ? documentRecord.assets : [];

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
    ${viewerSection("Attached Assets", assets.join(", ") || "None")}
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
  `;
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

  const confirmed = window.confirm("Delete this operational document?");

  if (!confirmed) {
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
}

function resetJpelForm() {
  elements.jpelTargetName.value = "";
  elements.jpelPriority.value = "MEDIUM";
  elements.jpelStatus.value = "OPEN";
  elements.jpelCategory.value = "";
  elements.jpelLocationText.value = "";
  elements.jpelDescription.value = "";
  elements.jpelIntelligenceNotes.value = "";
  clearStatusLine(elements.jpelStatusLine);
}

async function saveJpelEntry() {
  if (!canManageOperational()) {
    showStatusLine(elements.jpelStatusLine, "You do not have permission to create JPEL entries.", false);
    return;
  }

  const targetName = elements.jpelTargetName.value.trim();

  if (!targetName) {
    showStatusLine(elements.jpelStatusLine, "Name / entity / reference is required.", false);
    return;
  }

  setButtonLoading(elements.saveJpelButton, true, "Saving...");

  const payload = {
    target_name: targetName,
    priority: elements.jpelPriority.value,
    status: elements.jpelStatus.value,
    category: elements.jpelCategory.value.trim(),
    location_text: elements.jpelLocationText.value.trim(),
    description: elements.jpelDescription.value.trim(),
    intelligence_notes: elements.jpelIntelligenceNotes.value.trim(),
    created_by: state.authUser.id,
    updated_at: new Date().toISOString()
  };

  const result = await supabase
    .from("jpel_entries")
    .insert(payload);

  if (result.error) {
    showStatusLine(elements.jpelStatusLine, "JPEL save failed: " + result.error.message, false);
    setButtonLoading(elements.saveJpelButton, false, "Save JPEL Entry");
    return;
  }

  resetJpelForm();
  showStatusLine(elements.jpelStatusLine, "JPEL entry saved.", true);
  setButtonLoading(elements.saveJpelButton, false, "Save JPEL Entry");

  await loadJpelEntries();
}

async function loadJpelEntries() {
  const result = await supabase
    .from("jpel_entries")
    .select("*")
    .order("created_at", { ascending: false });

  if (result.error) {
    elements.jpelOutput.innerHTML = `<div class="empty-state">Failed to load JPEL entries: ${escapeHtml(result.error.message)}</div>`;
    return;
  }

  state.jpelEntries = result.data || [];
  renderJpelEntries();
}

function renderJpelEntries() {
  const rows = getFilteredJpelEntries();

  if (!rows.length) {
    elements.jpelOutput.innerHTML = `<div class="empty-state">No JPEL entries found.</div>`;
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
}

function renderJpelRow(entry) {
  const deleteButton = canManageOperational()
    ? `<button class="btn btn-danger" type="button" data-delete-jpel-id="${entry.id}">Delete</button>`
    : "";

  return `
    <tr>
      <td>
        <strong>${escapeHtml(entry.target_name)}</strong><br>
        <span class="muted">${escapeHtml(entry.location_text || "No location text")}</span>
      </td>
      <td><span class="badge ${getPriorityBadgeClass(entry.priority)}">${escapeHtml(entry.priority)}</span></td>
      <td><span class="badge ${getStatusBadgeClass(entry.status)}">${escapeHtml(entry.status)}</span></td>
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
    const combinedText = [
      entry.target_name,
      entry.priority,
      entry.status,
      entry.category,
      entry.location_text,
      entry.description,
      entry.intelligence_notes
    ].join(" ").toLowerCase();

    const matchesQuery = !query || combinedText.includes(query);
    const matchesPriority = !priority || entry.priority === priority;
    const matchesStatus = !status || entry.status === status;

    return matchesQuery && matchesPriority && matchesStatus;
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

function viewJpelEntry(id) {
  const entry = state.jpelEntries.find(item => item.id === id);

  if (!entry) {
    return;
  }

  elements.jpelViewer.className = "viewer";
  elements.jpelViewer.innerHTML = `
    <h2>JPEL Register Entry - ${escapeHtml(entry.target_name)}</h2>
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
    ${viewerSection("Intelligence Notes", entry.intelligence_notes)}
  `;
}

async function deleteJpelEntry(id) {
  if (!canManageOperational()) {
    alert("You do not have permission to delete JPEL entries.");
    return;
  }

  const confirmed = window.confirm("Delete this JPEL entry?");

  if (!confirmed) {
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}