const form = document.getElementById('listing-form');
const statusEl = document.getElementById('form-status');
const shareLinkEl = document.getElementById('share-link');
const recordIdEl = document.getElementById('record-id');
const businessIdEl = document.getElementById('business-id');
const fileInput = document.getElementById('photo-files');
const previewsEl = document.getElementById('photo-previews');

let photoData = [];

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
  const base = `${window.location.origin}${window.location.pathname.replace(/form\.html$/, 'detail.html')}`;
  return `${base}?id=${recordId}`;
}

function renderPhotoPreviews(dataUrls) {
  if (!previewsEl) {
    return;
  }

  previewsEl.innerHTML = '';
  dataUrls.forEach((dataUrl) => {
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = 'Uploaded photo preview';
    img.style.width = '100%';
    img.style.borderRadius = '8px';
    img.style.objectFit = 'cover';

    const holder = document.createElement('div');
    holder.style.minHeight = '80px';
    holder.appendChild(img);
    previewsEl.appendChild(holder);
  });
}

function compressImageFile(file, maxDimension = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxDimension / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error(`Unable to process ${file.name}`));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function processSelectedPhotos(files) {
  const selectedFiles = Array.from(files || []).slice(0, 10);
  photoData = [];

  if (!selectedFiles.length) {
    renderPhotoPreviews([]);
    return;
  }

  setStatus('Processing photos...');

  for (const file of selectedFiles) {
    try {
      photoData.push(await compressImageFile(file));
    } catch (error) {
      console.error(error);
      setStatus(`Could not process ${file.name}. Try a smaller image.`, true);
      return;
    }
  }

  const payloadSize = JSON.stringify(photoData).length;
  if (payloadSize > 90000) {
    photoData = [];
    renderPhotoPreviews([]);
    setStatus('Photos are too large after compression. Upload fewer images or use photo URLs instead.', true);
    return;
  }

  renderPhotoPreviews(photoData);
  setStatus(`${photoData.length} photo${photoData.length === 1 ? '' : 's'} ready to upload.`);
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
    const response = await fetch(`${getWorkerUrl()}&action=get&id=${encodeURIComponent(recordId)}`);
    const data = await response.json();
    const record = findRecordById(data, recordId);

    if (!response.ok || data.error || !record) {
      throw new Error('Listing not found');
    }

    const fields = record.fields || {};
    document.getElementById('property-name').value = fields['Property Name'] || '';
    document.getElementById('location').value = fields.Location || '';
    document.getElementById('price').value = fields.Price || '';
    document.getElementById('type').value = fields.Type || 'House';
    document.getElementById('status').value = fields.Status || 'Active';
    document.getElementById('description').value = fields.Description || '';
    document.getElementById('photo-urls').value = Array.isArray(fields.Photo)
      ? fields.Photo.map((photo) => photo.url || '').filter(Boolean).join('\n')
      : '';
    photoData = parseListingPhotos(fields)
      .map((photo) => photo.url)
      .filter((url) => typeof url === 'string' && url.startsWith('data:'));
    renderPhotoPreviews(photoData);
    recordIdEl.value = record.id;
    shareLinkEl.value = buildDetailUrl(record.id);
    businessIdEl.value = fields['Business ID'] || APP_CONFIG.businessId;
  } catch (error) {
    console.error(error);
    setStatus('Unable to load listing for editing.', true);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('Saving listing...');

  const formData = new FormData(form);
  const payload = {
    recordId: formData.get('recordId') || '',
    businessId: formData.get('businessId') || APP_CONFIG.businessId,
    propertyName: formData.get('propertyName') || '',
    location: formData.get('location') || '',
    price: formData.get('price') || '',
    type: formData.get('type') || 'House',
    status: formData.get('status') || 'Active',
    description: formData.get('description') || '',
    photoUrls: (formData.get('photoUrls') || '').split(/\n|,/).map((item) => item.trim()).filter(Boolean),
    photoData: photoData.slice()
  };

  try {
    const response = await fetch(getWorkerUrl(), {
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
    setStatus('Listing saved successfully. Share the link below.');
    window.history.replaceState({}, '', `form.html?id=${recordId}`);
  } catch (error) {
    console.error('Unable to save listing:', error.details || error);

    if (error.isServerError) {
      setStatus(error.message, true);
      return;
    }

    savePendingSubmission(payload);
    setStatus('Saved locally — will retry when online.', false);
  }
});

if (editId) {
  loadListing(editId);
}

// File input handling: compress, preview, and store data URLs
if (fileInput) {
  fileInput.addEventListener('change', (event) => {
    processSelectedPhotos(event.target.files);
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
        const res = await fetch(getWorkerUrl(), {
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
