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
    document.getElementById('photo-urls').value = Array.isArray(fields.Photo) ? fields.Photo.map((photo) => photo.url || '').filter(Boolean).join('\n') : '';
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

// File input handling: create previews and read data URLs
if (fileInput) {
  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    previewsEl.innerHTML = '';
    photoData = [];

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        photoData.push(dataUrl);

        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = file.name || 'preview';
        img.style.width = '100%';
        img.style.borderRadius = '8px';
        img.style.objectFit = 'cover';

        const holder = document.createElement('div');
        holder.style.minHeight = '80px';
        holder.appendChild(img);
        previewsEl.appendChild(holder);
      };
      reader.readAsDataURL(file);
    });
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
