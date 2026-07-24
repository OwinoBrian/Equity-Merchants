const form = document.getElementById("listing-form");
const statusEl = document.getElementById("form-status");
const shareLinkEl = document.getElementById("share-link");
const recordIdEl = document.getElementById("record-id");
const businessIdEl = document.getElementById("business-id");
const navLinks = document.getElementById("nav-links");
const menuToggle = document.getElementById("menu-toggle");
const fileInput = document.getElementById("photo-files");
const cameraInput = document.getElementById("photo-camera");
const photoPickBtn = document.getElementById("photo-pick-btn");
const photoCameraBtn = document.getElementById("photo-camera-btn");
const photoDropzone = document.getElementById("photo-dropzone");
const photoUrlsInput = document.getElementById("photo-urls");
const previewsEl = document.getElementById("photo-previews");
const submitButton = form ? form.querySelector('button[type="submit"]') : null;

let selectedPhotoEntries = [];
let manualPhotoUrls = [];
let isSaving = false;

const params = new URLSearchParams(window.location.search);
const editId = params.get("id");

function setStatus(message, isError = false) {
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message;
  statusEl.style.color = isError ? "#c1121f" : "#25d366";
}

function getApiErrorMessage(data, fallback) {
  const airtableError = data && data.details && data.details.error;

  if (airtableError && airtableError.message) {
    return airtableError.message;
  }

  if (data && data.details && typeof data.details === "string") {
    return data.details;
  }

  return data && data.error ? data.error : fallback;
}

function buildDetailUrl(recordId) {
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/[^/]*$/, "detail.html");
  url.searchParams.set("id", recordId);
  return url.toString();
}

function getUploadUrl() {
  return getUploadApiUrl();
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function dedupePhotoUrls(urls) {
  return [...new Set((urls || []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function normalizePhotoUrls(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function getSelectedPhotoUrls() {
  return selectedPhotoEntries.map((entry) => entry.previewUrl).filter(Boolean);
}

function syncManualPhotoUrlsFromTextarea() {
  if (!photoUrlsInput) {
    return;
  }

  manualPhotoUrls = normalizePhotoUrls(photoUrlsInput.value || "");
  renderPhotoPreviews();
}

function setBusyState(busy) {
  isSaving = busy;

  if (submitButton) {
    submitButton.disabled = busy;
  }

  if (fileInput) {
    fileInput.disabled = busy;
  }

  if (cameraInput) {
    cameraInput.disabled = busy;
  }

  if (photoPickBtn) {
    photoPickBtn.disabled = busy;
  }

  if (photoCameraBtn) {
    photoCameraBtn.disabled = busy;
  }
}

function toggleMenu(forceClose = false) {
  if (!navLinks || !menuToggle) {
    return;
  }

  const willOpen = forceClose ? false : !navLinks.classList.contains("is-open");
  navLinks.classList.toggle("is-open", willOpen);
  menuToggle.classList.toggle("is-active", willOpen);
  menuToggle.setAttribute("aria-expanded", String(willOpen));
  document.body.classList.toggle("menu-open", willOpen);
}

function closeMenuOnNavigate() {
  if (!navLinks) {
    return;
  }

  navLinks.querySelectorAll("a, button").forEach((link) => {
    link.addEventListener("click", () => toggleMenu(true));
  });
}

function revokePreviewEntries(entries) {
  entries.forEach((entry) => {
    if (entry && entry.previewUrl && entry.previewUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(entry.previewUrl);
      } catch (error) {
        // Ignore preview cleanup failures.
      }
    }
  });
}

function clearSelectedPhotos() {
  revokePreviewEntries(selectedPhotoEntries);
  selectedPhotoEntries = [];

  if (fileInput) {
    fileInput.value = "";
  }

  if (cameraInput) {
    cameraInput.value = "";
  }

  renderPhotoPreviews();
}

function setManualPhotoUrls(urls) {
  manualPhotoUrls = dedupePhotoUrls(urls);
  if (photoUrlsInput) {
    photoUrlsInput.value = manualPhotoUrls.join("\n");
  }
  renderPhotoPreviews();
}

function removeManualPhotoUrl(urlToRemove) {
  setManualPhotoUrls(manualPhotoUrls.filter((url) => url !== urlToRemove));
}

function removeSelectedPhoto(entryId) {
  const remaining = [];

  selectedPhotoEntries.forEach((entry) => {
    if (entry.id === entryId) {
      if (entry.previewUrl && entry.previewUrl.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(entry.previewUrl);
        } catch (error) {
          // Ignore preview cleanup failures.
        }
      }
      return;
    }

    remaining.push(entry);
  });

  selectedPhotoEntries = remaining;
  renderPhotoPreviews();
}

function renderPhotoPreviews() {
  if (!previewsEl) {
    return;
  }

  previewsEl.innerHTML = "";

  const items = [
    ...manualPhotoUrls.map((src) => ({ source: "manual", src })),
    ...selectedPhotoEntries.map((entry) => ({ source: "selected", src: entry.previewUrl, id: entry.id }))
  ];

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "photo-preview-empty";
    empty.textContent = "No photos added yet.";
    previewsEl.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "photo-preview-card";

    const img = document.createElement("img");
    img.src = item.src;
    img.alt = item.source === "manual" ? "Saved photo preview" : "New photo preview";
    img.loading = "lazy";
    img.decoding = "async";

    const meta = document.createElement("div");
    meta.className = "photo-preview-meta";

    const label = document.createElement("span");
    label.className = "photo-preview-label";
    label.textContent = item.source === "manual" ? "Saved" : "New";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "photo-preview-remove";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (item.source === "manual") {
        removeManualPhotoUrl(item.src);
      } else {
        removeSelectedPhoto(item.id);
      }
    });

    meta.appendChild(label);
    meta.appendChild(removeBtn);
    card.appendChild(img);
    card.appendChild(meta);

    card.addEventListener("click", () => {
      window.open(item.src, "_blank", "noopener,noreferrer");
    });

    previewsEl.appendChild(card);
  });
}

function addSelectedPhotoFiles(files) {
  const incomingFiles = Array.from(files || []).filter((file) => file && file.type && file.type.startsWith("image/"));
  if (!incomingFiles.length) {
    setStatus(manualPhotoUrls.length ? `${manualPhotoUrls.length} saved photo${manualPhotoUrls.length === 1 ? "" : "s"} ready.` : "No images selected.");
    return;
  }

  const existingKeys = new Set(selectedPhotoEntries.map((entry) => entry.key));
  const nextEntries = [...selectedPhotoEntries];

  incomingFiles.forEach((file) => {
    const key = [file.name, file.size, file.lastModified].join(":");
    if (existingKeys.has(key)) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    nextEntries.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      key,
      file,
      previewUrl
    });
    existingKeys.add(key);
  });

  selectedPhotoEntries = nextEntries.slice(0, 10);

  if (fileInput) {
    fileInput.value = "";
  }

  if (cameraInput) {
    cameraInput.value = "";
  }

  renderPhotoPreviews();

  const count = selectedPhotoEntries.length;
  const label = count === 1 ? "image" : "images";
  setStatus(`${count} ${label} selected. They will upload when you save.`);
}

function openFilePicker(input) {
  if (input) {
    input.click();
  }
}

async function uploadPhotoFile(file, index, total) {
  const formData = new FormData();
  formData.append("photoFile", file, file.name);

  setStatus(`Uploading image ${index} of ${total}...`);

  const response = await fetch(getUploadUrl(), {
    method: "POST",
    body: formData
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const error = new Error(getApiErrorMessage(data, "Unable to upload image"));
    error.isServerError = true;
    error.details = data;
    throw error;
  }

  if (!data.url) {
    throw new Error("Upload succeeded but no image URL was returned.");
  }

  return data.url;
}

async function uploadSelectedPhotos(entries) {
  const uploadedUrls = [];
  const selectedEntries = Array.from(entries || []);

  for (let index = 0; index < selectedEntries.length; index += 1) {
    const entry = selectedEntries[index];
    uploadedUrls.push(await uploadPhotoFile(entry.file, index + 1, selectedEntries.length));
  }

  return uploadedUrls;
}

function findRecordById(data, recordId) {
  if (data.record && data.record.id === recordId) {
    return data.record;
  }

  if (!Array.isArray(data.records)) {
    return null;
  }

  return data.records.find((item) => item && item.id === recordId) || null;
}

async function loadListing(recordId) {
  try {
    const response = await fetch(getListingApiUrl(recordId));
    const data = await response.json();
    const record = findRecordById(data, recordId);

    if (!response.ok || data.error || !record) {
      throw new Error("Listing not found");
    }

    const fields = normalizeApiFields(record.fields || {});
    document.getElementById("property-name").value = fields.propertyName || "";
    document.getElementById("location").value = fields.location || "";
    document.getElementById("price").value = fields.price || "";
    document.getElementById("type").value = fields.type || "House";
    document.getElementById("status").value = fields.status || APP_CONFIG.activeListingStatus;
    document.getElementById("description").value = fields.description || "";
    const existingPhotoUrls = parseListingPhotos(fields)
      .map((photo) => photo.url || "")
      .filter(Boolean);
    setManualPhotoUrls(existingPhotoUrls);
    selectedPhotoEntries = [];
    renderPhotoPreviews();
    recordIdEl.value = record.id;
    shareLinkEl.value = buildDetailUrl(record.id);
    businessIdEl.value = fields.businessId || APP_CONFIG.businessId;
  } catch (error) {
    console.error(error);
    setStatus("Unable to load listing for editing.", true);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isSaving) {
    return;
  }

  setBusyState(true);
  setStatus("Saving listing...");

  const formData = new FormData(form);
  const manualUrlsFromForm = normalizePhotoUrls(formData.get("photoUrls"));
  let uploadedPhotoUrls = [];
  const payload = {
    recordId: formData.get("recordId") || "",
    businessId: formData.get("businessId") || APP_CONFIG.businessId,
    propertyName: formData.get("propertyName") || "",
    location: formData.get("location") || "",
    price: formData.get("price") || "",
    type: formData.get("type") || "House",
    status: formData.get("status") || APP_CONFIG.activeListingStatus,
    description: formData.get("description") || "",
    photoUrls: []
  };

  try {
    if (selectedPhotoEntries.length) {
      uploadedPhotoUrls = await uploadSelectedPhotos(selectedPhotoEntries);
    }

    payload.photoUrls = dedupePhotoUrls([...manualUrlsFromForm, ...uploadedPhotoUrls]);
    setStatus("Saving listing details...");

    const response = await fetch(getListingsApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      const error = new Error(getApiErrorMessage(data, "Unable to save listing"));
      error.isServerError = true;
      error.details = data;
      throw error;
    }

    const recordId = data.recordId || data.id;
    shareLinkEl.value = buildDetailUrl(recordId);
    recordIdEl.value = recordId;
    clearSelectedPhotos();
    setManualPhotoUrls(payload.photoUrls);
    setStatus("Listing saved successfully. Share the link below.");
    window.history.replaceState({}, "", `form.html?id=${recordId}`);
  } catch (error) {
    console.error("Unable to save listing:", error.details || error);

    if (error.isServerError) {
      setStatus(error.message, true);
      setBusyState(false);
      return;
    }

    savePendingSubmission(payload);
    setStatus("Saved locally - will retry when online.", false);
  } finally {
    setBusyState(false);
  }
});

if (editId) {
  loadListing(editId);
}

if (fileInput) {
  fileInput.addEventListener("change", (event) => {
    addSelectedPhotoFiles(event.target.files);
  });
}

if (cameraInput) {
  cameraInput.addEventListener("change", (event) => {
    addSelectedPhotoFiles(event.target.files);
  });
}

if (photoPickBtn) {
  photoPickBtn.addEventListener("click", () => openFilePicker(fileInput));
}

if (photoCameraBtn) {
  photoCameraBtn.addEventListener("click", () => openFilePicker(cameraInput));
}

if (photoDropzone) {
  photoDropzone.addEventListener("click", (event) => {
    if (event.target.closest("button, input, textarea, a")) {
      return;
    }

    openFilePicker(fileInput);
  });

  photoDropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFilePicker(fileInput);
    }
  });

  photoDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    photoDropzone.classList.add("is-dragover");
  });

  photoDropzone.addEventListener("dragleave", () => {
    photoDropzone.classList.remove("is-dragover");
  });

  photoDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    photoDropzone.classList.remove("is-dragover");
    addSelectedPhotoFiles(event.dataTransfer.files);
  });
}

if (photoUrlsInput) {
  photoUrlsInput.addEventListener("input", syncManualPhotoUrlsFromTextarea);
  syncManualPhotoUrlsFromTextarea();
}

if (menuToggle) {
  menuToggle.addEventListener("click", () => toggleMenu());
}

document.addEventListener("click", (event) => {
  if (!navLinks || !menuToggle) {
    return;
  }

  const clickedInsideMenu = navLinks.contains(event.target) || menuToggle.contains(event.target);
  if (!clickedInsideMenu) {
    toggleMenu(true);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    toggleMenu(true);
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth >= 768) {
    toggleMenu(true);
  }
});

closeMenuOnNavigate();

// Offline queue helpers
function pendingKey() {
  return "pendingSubmissions";
}

function savePendingSubmission(payload) {
  try {
    const list = JSON.parse(localStorage.getItem(pendingKey()) || "[]");
    list.push({ payload, createdAt: Date.now() });
    localStorage.setItem(pendingKey(), JSON.stringify(list));
  } catch (e) {
    console.error("Unable to save pending submission", e);
  }
}

async function retryPendingSubmissions() {
  try {
    const list = JSON.parse(localStorage.getItem(pendingKey()) || "[]");
    if (!list.length) return;

    const remaining = [];
    for (const item of list) {
      try {
        const res = await fetch(getListingsApiUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload)
        });
        if (!res.ok) throw new Error("Retry failed");
      } catch (err) {
        remaining.push(item);
      }
    }

    localStorage.setItem(pendingKey(), JSON.stringify(remaining));
    if (!remaining.length) {
      setStatus("All pending submissions synced.");
    } else {
      setStatus(`${remaining.length} submissions still pending.`, true);
    }
  } catch (e) {
    console.error("Retry failed", e);
  }
}

window.addEventListener("online", retryPendingSubmissions);
