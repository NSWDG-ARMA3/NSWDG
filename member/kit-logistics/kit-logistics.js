import {
  supabase
} from "/js/auth.js";

import {
  bootPortalChrome,
  escapeHtml
} from "/js/portal-common.js";

import {
  renderPortalLayout
} from "/js/portal-layout.js";


renderPortalLayout("kit-logistics");


const BUCKET = "kit-logistics";

const HELMET_MODELS = [
  "Opscore Maritime",
  "Opscore XP Carbon"
];

const VEST_MODELS = [
  "AVS",
  "AVS Swimmercut",
  "JPC",
  "NJPC",
  "JPC 2.0",
  "Plateframe"
];

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;


let authUser = null;
let profile = null;

let requests = [];
let attachments = [];

let profilesById = new Map();


const el = {
  itemType:
    document.getElementById(
      "item-type"
    ),

  itemModel:
    document.getElementById(
      "item-model"
    ),

  description:
    document.getElementById(
      "setup-description"
    ),

  images:
    document.getElementById(
      "reference-images"
    ),

  submit:
    document.getElementById(
      "submit-request"
    ),

  reset:
    document.getElementById(
      "reset-request"
    ),

  requestStatus:
    document.getElementById(
      "request-status"
    ),

  adminPanel:
    document.getElementById(
      "admin-panel"
    ),

  adminFilter:
    document.getElementById(
      "admin-status-filter"
    ),

  refreshAdmin:
    document.getElementById(
      "refresh-admin"
    ),

  adminOutput:
    document.getElementById(
      "admin-output"
    ),

  refreshMine:
    document.getElementById(
      "refresh-mine"
    ),

  myOutput:
    document.getElementById(
      "my-output"
    )
};


function isAdmin() {
  const role = String(
    profile?.role || ""
  )
    .trim()
    .toUpperCase();

  return (
    role === "ADMIN" ||
    role === "SUPERADMIN"
  );
}


function setStatus(
  message,
  ok = true
) {
  el.requestStatus.textContent =
    message;

  el.requestStatus.className =
    `status-line ${
      ok
        ? "ok"
        : "err"
    }`;
}


function cleanFileName(name) {
  return String(
    name || "image"
  )
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    )
    .slice(
      0,
      120
    );
}


function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(
    new Date(value)
  );
}


function statusBadge(status) {
  const value = String(
    status || "PENDING"
  ).toUpperCase();

  const map = {
    PENDING: [
      "pending",
      "Pending"
    ],

    IN_PROGRESS: [
      "progress",
      "In Progress"
    ],

    COMPLETED: [
      "completed",
      "Completed"
    ],

    DENIED: [
      "denied",
      "Denied"
    ]
  };

  const [
    cls,
    label
  ] =
    map[value] ||
    [
      "pending",
      value
    ];

  return `
    <span class="badge ${cls}">
      ${escapeHtml(label)}
    </span>
  `;
}


function updateModelOptions() {
  const models =
    el.itemType.value === "VEST"
      ? VEST_MODELS
      : HELMET_MODELS;

  el.itemModel.innerHTML =
    models
      .map(
        model => `
          <option value="${escapeHtml(model)}">
            ${escapeHtml(model)}
          </option>
        `
      )
      .join("");
}


function resetForm() {
  el.itemType.value =
    "HELMET";

  updateModelOptions();

  el.description.value =
    "";

  el.images.value =
    "";

  setStatus("");
}


function validateFiles(files) {
  if (
    files.length >
    MAX_IMAGES
  ) {
    throw new Error(
      `Attach no more than ${MAX_IMAGES} images.`
    );
  }

  for (const file of files) {
    if (
      !ALLOWED_TYPES.has(
        file.type
      )
    ) {
      throw new Error(
        `${file.name} is not a supported image type.`
      );
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      throw new Error(
        `${file.name} is larger than 10 MB.`
      );
    }
  }
}


async function submitRequest() {
  const description =
    el.description.value
      .trim();

  const files =
    Array.from(
      el.images.files || []
    );

  if (
    description.length < 3
  ) {
    setStatus(
      "Describe the requested setup and placement.",
      false
    );

    return;
  }

  try {
    validateFiles(files);
  } catch (error) {
    setStatus(
      error.message,
      false
    );

    return;
  }

  el.submit.disabled = true;
  el.submit.textContent =
    "Submitting...";

  setStatus(
    "Creating request..."
  );

  const requestResult =
    await supabase
      .from(
        "kit_logistics_requests"
      )
      .insert({
        requester_id:
          authUser.id,

        item_type:
          el.itemType.value,

        item_model:
          el.itemModel.value,

        setup_description:
          description
      })
      .select("*")
      .single();

  if (
    requestResult.error
  ) {
    el.submit.disabled =
      false;

    el.submit.textContent =
      "Submit Request";

    setStatus(
      `Request failed: ${requestResult.error.message}`,
      false
    );

    return;
  }

  const request =
    requestResult.data;

  try {
    for (
      const file
      of files
    ) {
      const path =
        `${authUser.id}/${request.id}/${crypto.randomUUID()}_${cleanFileName(file.name)}`;

      const upload =
        await supabase.storage
          .from(BUCKET)
          .upload(
            path,
            file,
            {
              cacheControl:
                "3600",

              upsert:
                false,

              contentType:
                file.type
            }
          );

      if (
        upload.error
      ) {
        throw upload.error;
      }

      const attachmentResult =
        await supabase
          .from(
            "kit_logistics_attachments"
          )
          .insert({
            request_id:
              request.id,

            storage_path:
              path,

            file_name:
              file.name,

            mime_type:
              file.type,

            size_bytes:
              file.size,

            uploaded_by:
              authUser.id
          });

      if (
        attachmentResult.error
      ) {
        await supabase.storage
          .from(BUCKET)
          .remove([
            path
          ]);

        throw attachmentResult.error;
      }
    }

    resetForm();

    setStatus(
      "Kit Logistics request submitted.",
      true
    );
  } catch (error) {
    setStatus(
      `The request was created, but at least one reference image failed to attach: ${error.message}`,
      false
    );
  } finally {
    el.submit.disabled =
      false;

    el.submit.textContent =
      "Submit Request";

    await loadData();
  }
}


async function loadData() {
  const requestQuery =
    supabase
      .from(
        "kit_logistics_requests"
      )
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  const [
    requestResult,
    attachmentResult,
    profileResult
  ] = await Promise.all([
    requestQuery,

    supabase
      .from(
        "kit_logistics_attachments"
      )
      .select("*")
      .order(
        "created_at",
        {
          ascending: true
        }
      ),

    isAdmin()
      ? supabase
          .from("profiles")
          .select(
            "id,display_name,naval_rank,callsign"
          )
          .order(
            "display_name"
          )

      : Promise.resolve({
          data: [
            profile
          ],
          error: null
        })
  ]);

  if (
    requestResult.error
  ) {
    el.myOutput.innerHTML = `
      <div class="notice-box">
        Failed to load requests:
        ${escapeHtml(
          requestResult.error.message
        )}
      </div>
    `;

    return;
  }

  requests =
    requestResult.data || [];

  attachments =
    attachmentResult.error
      ? []
      : (
          attachmentResult.data ||
          []
        );

  profilesById =
    new Map(
      (
        profileResult.data ||
        []
      ).map(
        row => [
          row.id,
          row
        ]
      )
    );

  renderMine();

  if (
    isAdmin()
  ) {
    renderAdmin();
  }
}


function requestAttachments(
  requestId
) {
  return attachments.filter(
    row => {
      return (
        Number(
          row.request_id
        ) ===
        Number(
          requestId
        )
      );
    }
  );
}


async function openAttachment(
  path
) {
  const result =
    await supabase.storage
      .from(BUCKET)
      .createSignedUrl(
        path,
        600
      );

  if (
    result.error
  ) {
    alert(
      `Could not open image: ${result.error.message}`
    );

    return;
  }

  window.open(
    result.data.signedUrl,
    "_blank",
    "noopener,noreferrer"
  );
}


function attachmentButtons(
  requestId
) {
  const rows =
    requestAttachments(
      requestId
    );

  if (
    !rows.length
  ) {
    return `
      <span class="muted">
        No images
      </span>
    `;
  }

  return `
    <div class="attachment-list">

      ${
        rows
          .map(
            (
              row,
              index
            ) => `
              <button
                class="btn"
                type="button"
                data-open-attachment="${escapeHtml(row.storage_path)}"
              >
                Image ${
                  index + 1
                }
              </button>
            `
          )
          .join("")
      }

    </div>
  `;
}


function renderMine() {
  const mine =
    requests.filter(
      row => {
        return (
          row.requester_id ===
          authUser.id
        );
      }
    );

  if (
    !mine.length
  ) {
    el.myOutput.innerHTML = `
      <div class="notice-box">
        You have not submitted
        any Kit Logistics requests.
      </div>
    `;

    return;
  }

  el.myOutput.innerHTML =
    renderRequestTable(
      mine,
      false
    );

  bindAttachmentButtons(
    el.myOutput
  );
}


function renderAdmin() {
  const filter =
    el.adminFilter.value;

  const rows =
    filter
      ? requests.filter(
          row => {
            return (
              row.status ===
              filter
            );
          }
        )
      : requests;

  if (
    !rows.length
  ) {
    el.adminOutput.innerHTML = `
      <div class="notice-box">
        No matching requests.
      </div>
    `;

    return;
  }

  el.adminOutput.innerHTML =
    renderRequestTable(
      rows,
      true
    );

  bindAttachmentButtons(
    el.adminOutput
  );

  bindAdminActions();
}


function renderRequestTable(
  rows,
  adminMode
) {
  return `
    <div class="table-wrap">

      <table>

        <thead>
          <tr>

            ${
              adminMode
                ? "<th>Requester</th>"
                : ""
            }

            <th>Created</th>
            <th>Item</th>
            <th>Details</th>
            <th>Images</th>
            <th>Status</th>

            ${
              adminMode
                ? "<th>Admin Actions</th>"
                : ""
            }

          </tr>
        </thead>

        <tbody>

          ${
            rows
              .map(
                row => {
                  const requester =
                    profilesById.get(
                      row.requester_id
                    );

                  const requesterName =
                    requester?.display_name ||
                    row.requester_id;

                  const requesterMeta =
                    [
                      requester?.naval_rank,
                      requester?.callsign
                    ]
                      .filter(Boolean)
                      .join(" / ");

                  return `
                    <tr>

                      ${
                        adminMode
                          ? `
                            <td>

                              <strong>
                                ${escapeHtml(
                                  requesterName
                                )}
                              </strong>

                              ${
                                requesterMeta
                                  ? `
                                    <br>

                                    <span class="muted">
                                      ${escapeHtml(
                                        requesterMeta
                                      )}
                                    </span>
                                  `
                                  : ""
                              }

                            </td>
                          `
                          : ""
                      }

                      <td>
                        ${escapeHtml(
                          formatDate(
                            row.created_at
                          )
                        )}
                      </td>

                      <td>

                        <strong>
                          ${escapeHtml(
                            row.item_model
                          )}
                        </strong>

                        <br>

                        <span class="muted">
                          ${escapeHtml(
                            row.item_type
                          )}
                        </span>

                      </td>

                      <td>

                        ${
                          escapeHtml(
                            row.setup_description
                          )
                            .replaceAll(
                              "\n",
                              "<br>"
                            )
                        }

                        ${
                          row.denial_reason
                            ? `
                              <div
                                style="
                                  margin-top:6px;
                                  color:#7b1c1c;
                                "
                              >
                                <strong>
                                  Denied:
                                </strong>

                                ${escapeHtml(
                                  row.denial_reason
                                )}
                              </div>
                            `
                            : ""
                        }

                      </td>

                      <td>
                        ${attachmentButtons(
                          row.id
                        )}
                      </td>

                      <td>
                        ${statusBadge(
                          row.status
                        )}
                      </td>

                      ${
                        adminMode
                          ? `
                            <td>
                              ${adminActionButtons(
                                row
                              )}
                            </td>
                          `
                          : ""
                      }

                    </tr>
                  `;
                }
              )
              .join("")
          }

        </tbody>

      </table>

    </div>
  `;
}


function adminActionButtons(
  row
) {
  if (
    row.status ===
    "PENDING"
  ) {
    return `
      <div class="request-actions">

        <button
          class="btn btn-success"
          type="button"
          data-kit-action="APPROVE"
          data-request-id="${row.id}"
        >
          Approve
        </button>

        <button
          class="btn btn-danger"
          type="button"
          data-kit-action="DENY"
          data-request-id="${row.id}"
        >
          Deny
        </button>

      </div>
    `;
  }

  if (
    row.status ===
    "IN_PROGRESS"
  ) {
    return `
      <div class="request-actions">

        <button
          class="btn btn-success"
          type="button"
          data-kit-action="COMPLETE"
          data-request-id="${row.id}"
        >
          Complete
        </button>

        <button
          class="btn btn-danger"
          type="button"
          data-kit-action="DENY"
          data-request-id="${row.id}"
        >
          Deny
        </button>

      </div>
    `;
  }

  return `
    <span class="muted">
      No actions
    </span>
  `;
}


function bindAttachmentButtons(
  container
) {
  container
    .querySelectorAll(
      "[data-open-attachment]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            openAttachment(
              button.dataset
                .openAttachment
            );
          }
        );
      }
    );
}


function bindAdminActions() {
  el.adminOutput
    .querySelectorAll(
      "[data-kit-action]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          async () => {
            const action =
              button.dataset
                .kitAction;

            const requestId =
              Number(
                button.dataset
                  .requestId
              );

            let reason = null;

            if (
              action === "DENY"
            ) {
              reason =
                prompt(
                  "Reason for denial:"
                );

              if (
                reason === null
              ) {
                return;
              }

              if (
                reason
                  .trim()
                  .length < 3
              ) {
                alert(
                  "A denial reason is required."
                );

                return;
              }
            }

            const labels = {
              APPROVE:
                "approve and move this request to In Progress",

              COMPLETE:
                "mark this request Completed",

              DENY:
                "deny this request"
            };

            if (
              !confirm(
                `Are you sure you want to ${labels[action]}?`
              )
            ) {
              return;
            }

            button.disabled =
              true;

            const result =
              await supabase.rpc(
                "admin_update_kit_logistics_request",
                {
                  p_request_id:
                    requestId,

                  p_action:
                    action,

                  p_reason:
                    reason
                }
              );

            if (
              result.error
            ) {
              button.disabled =
                false;

              alert(
                `Request update failed: ${result.error.message}`
              );

              return;
            }

            await loadData();
          }
        );
      }
    );
}


async function boot() {
  const loaded =
    await bootPortalChrome();

  if (!loaded) {
    return;
  }

  authUser =
    loaded.user;

  profile =
    loaded.profile;

  if (
    isAdmin()
  ) {
    el.adminPanel
      .classList
      .remove(
        "hidden"
      );
  }

  updateModelOptions();

  await loadData();
}


el.itemType
  .addEventListener(
    "change",
    updateModelOptions
  );


el.submit
  .addEventListener(
    "click",
    submitRequest
  );


el.reset
  .addEventListener(
    "click",
    resetForm
  );


el.refreshMine
  .addEventListener(
    "click",
    loadData
  );


el.refreshAdmin
  .addEventListener(
    "click",
    loadData
  );


el.adminFilter
  .addEventListener(
    "change",
    renderAdmin
  );


boot();