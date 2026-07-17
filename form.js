const form = document.getElementById('listing-form');
const statusEl = document.getElementById('form-status');
const shareLinkEl = document.getElementById('share-link');
const recordIdEl = document.getElementById('record-id');
const businessIdEl = document.getElementById('business-id');
const fileInput = document.getElementById('photo-files');
const previewsEl = document.getElementById('photo-previews');
const submitButton = form ? form.querySelector('button[type="submit"]') : null;

let selectedPhotoFiles = [];
let selectedPhotoUrls = [];
let isSaving = false;

const params = new URLSearchParams(window.location.search);
const editId = params.get('id');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#c1121f' : '#25d366';
}

function getApiErrorMessage(data, fallback) {
  const airtableError = data && data.details && data.details.error;

  if (airtableError && airtableError.message) {
    return airtableError.message;
  }

  if (data && data.details && typeof data.details === 'string') {
    return data.details;
  }

  return data && data.error ? data.error : fallback;
}

function buildDetailUrl(recordId) {
  // Point to detail.html regardless of whether the form is served as
  // /form.html or as a clean URL (/form) on Cloudflare Pages. Replacing the
  // last path segment handles both cases (and subdirectory hosting).
  const url = new URL(window.location.href);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/[^/]*$/, 'detail.html');
  url.searchParams.set('id', recordId);
  return url.toString();
}

function getUploadUrl() {
  return getUploadApiUrl();
}

function setBusyState(busy) {
  isSaving = busy;

  if (submitButton) {
    submitButton.disabled = busy;
  }

  if (fileInput) {
    fileInput.disabled = busy;
  }
}

function dedupePhotoUrls(urls) {
  return [...new Set((urls || []).map((item) => String(item || '').trim()).filter(Boolean))];
}

function normalizePhotoUrls(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function renderPhotoPreviews(srcs) {
  if (!previewsEl) {
    return;
  }

  previewsEl.innerHTML = '';
  srcs.forEach((src) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Uploaded photo preview';
    img.style.width = '100%';
    img.style.borderRadius = '8px';
    img.style.objectFit = 'cover';
    img.loading = 'lazy';

    if (src.startsWith('blob:')) {
      img.addEventListener('load', () => {
        URL.revokeObjectURL(src);
      }, { once: true });
    }

    const holder = document.createElement('div');
    holder.style.minHeight = '80px';
    holder.appendChild(img);
    previewsEl.appendChild(holder);
  });
}

function clearSelectedPhotos() {
  selectedPhotoFiles = [];
  selectedPhotoUrls = [];

  if (fileInput) {
    fileInput.value = '';
  }

  renderPhotoPreviews([]);
}

function setSelectedPhotoFiles(files) {
  selectedPhotoFiles = Array.from(files || []).slice(0, 10);

  if (!selectedPhotoFiles.length) {
    selectedPhotoUrls = [];
    const existingPhotoUrls = normalizePhotoUrls(document.getElementById('photo-urls')?.value || '');
    renderPhotoPreviews(existingPhotoUrls);
    setStatus(existingPhotoUrls.length ? `${existingPhotoUrls.length} saved photo${existingPhotoUrls.length === 1 ? '' : 's'} ready.` : 'No images selected.');
    return;
  }

  selectedPhotoUrls = selectedPhotoFiles.map((file) => URL.createObjectURL(file));
  renderPhotoPreviews(selectedPhotoUrls);

  const count = selectedPhotoFiles.length;
  const label = count === 1 ? 'image' : 'images';
  setStatus(`${count} ${label} selected. They will upload when you save.`);
}

async function uploadPhotoFile(file, index, total) {
  const formData = new FormData();
  formData.append('photoFile', file, file.name);

  setStatus(`Uploading image ${index} of ${total}...`);

  const response = await fetch(getUploadUrl(), {
    method: 'POST',
    body: formData
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const error = new Error(getApiErrorMessage(data, 'Unable to upload image'));
    error.isServerError = true;
    error.details = data;
    throw error;
  }

  if (!data.url) {
    throw new Error('Upload succeeded but no image URL was returned.');
  }

  return data.url;
}

async function uploadSelectedPhotos(files) {
  const uploadedUrls = [];
  const selectedFiles = Array.from(files || []);

  for (let index = 0; index < selectedFiles.length; index += 1) {
    const file = selectedFiles[index];
    uploadedUrls.push(await uploadPhotoFile(file, index + 1, selectedFiles.length));
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
      throw new Error('Listing not found');
    }

    const fields = normalizeApiFields(record.fields || {});
    document.getElementById('property-name').value = fields.propertyName || '';
    document.getElementById('location').value = fields.location || '';
    document.getElementById('price').value = fields.price || '';
    document.getElementById('type').value = fields.type || 'House';
    document.getElementById('status').value = fields.status || APP_CONFIG.activeListingStatus;
    document.getElementById('description').value = fields.description || '';
    const existingPhotoUrls = parseListingPhotos(fields)
      .map((photo) => photo.url || '')
      .filter(Boolean);
    document.getElementById('photo-urls').value = existingPhotoUrls.join('\n');
    selectedPhotoFiles = [];
    selectedPhotoUrls = [];
    renderPhotoPreviews(existingPhotoUrls);
    recordIdEl.value = record.id;
    shareLinkEl.value = buildDetailUrl(record.id);
    businessIdEl.value = fields.businessId || APP_CONFIG.businessId;
  } catch (error) {
    console.error(error);
    setStatus('Unable to load listing for editing.', true);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (isSaving) {
    return;
  }

  setBusyState(true);
  setStatus('Saving listing...');

  const formData = new FormData(form);
  const manualPhotoUrls = normalizePhotoUrls(formData.get('photoUrls'));
  let uploadedPhotoUrls = [];
  const payload = {
    recordId: formData.get('recordId') || '',
    businessId: formData.get('businessId') || APP_CONFIG.businessId,
    propertyName: formData.get('propertyName') || '',
    location: formData.get('location') || '',
    price: formData.get('price') || '',
    type: formData.get('type') || 'House',
    status: formData.get('status') || APP_CONFIG.activeListingStatus,
    description: formData.get('description') || '',
    photoUrls: []
  };

  try {
    if (selectedPhotoFiles.length) {
      uploadedPhotoUrls = await uploadSelectedPhotos(selectedPhotoFiles);
    }

    payload.photoUrls = dedupePhotoUrls([...manualPhotoUrls, ...uploadedPhotoUrls]);
    setStatus('Saving listing details...');

    const response = await fetch(getListingsApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      const error = new Error(getApiErrorMessage(data, 'Unable to save listing'));
      error.isServerError = true;
      error.details = data;
      throw error;
    }

    const recordId = data.recordId || data.id;
    shareLinkEl.value = buildDetailUrl(recordId);
    recordIdEl.value = recordId;
    selectedPhotoFiles = [];
    selectedPhotoUrls = [];
    if (fileInput) {
      fileInput.value = '';
    }
    renderPhotoPreviews(payload.photoUrls);
    setStatus('Listing saved successfully. Share the link below.');
    window.history.replaceState({}, '', `form.html?id=${recordId}`);
  } catch (error) {
    console.error('Unable to save listing:', error.details || error);

    if (error.isServerError) {
      setStatus(error.message, true);
      setBusyState(false);
      return;
    }

    savePendingSubmission(payload);
    setStatus('Saved locally - will retry when online.', false);
  } finally {
    setBusyState(false);
  }
});

if (editId) {
  loadListing(editId);
}

// File input handling: preview selected images and upload them on submit
if (fileInput) {
  fileInput.addEventListener('change', (event) => {
    setSelectedPhotoFiles(event.target.files);
  });
}

// Offline queue helpers
function pendingKey() { return 'pendingSubmissions'; }

function savePendingSubmission(payload) {
  try {
    const list = JSON.parse(localStorage.getItem(pendingKey()) || '[]');
    list.push({ payload, createdAt: Date.now() });
    localStorage.setItem(pendingKey(), JSON.stringify(list));
  } catch (e) {
    console.error('Unable to save pending submission', e);
  }
}

async function retryPendingSubmissions() {
  try {
    const list = JSON.parse(localStorage.getItem(pendingKey()) || '[]');
    if (!list.length) return;

    const remaining = [];
    for (const item of list) {
      try {
        const res = await fetch(getListingsApiUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload)
        });
        if (!res.ok) throw new Error('Retry failed');
      } catch (err) {
        remaining.push(item);
      }
    }

    localStorage.setItem(pendingKey(), JSON.stringify(remaining));
    if (!remaining.length) {
      setStatus('All pending submissions synced.');
    } else {
      setStatus(`${remaining.length} submissions still pending.`, true);
    }
  } catch (e) {
    console.error('Retry failed', e);
  }
}

window.addEventListener('online', retryPendingSubmissions);

