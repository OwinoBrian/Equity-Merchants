const loadingEl = document.getElementById('detail-loading');
const cardEl = document.getElementById('detail-card');
const galleryEl = document.getElementById('detail-gallery');
const titleEl = document.getElementById('detail-title');
const locationEl = document.getElementById('detail-location');
const priceEl = document.getElementById('detail-price');
const descriptionEl = document.getElementById('detail-description');
const whatsappEl = document.getElementById('detail-whatsapp');

function setShareMeta(imageUrl, title, description) {
  const canonicalUrl = window.location.href;
  const titleText = title || 'Property Details';
  const descriptionText = description || 'View this property listing and photos.';

  document.title = `${titleText} | Equity Merchants`;

  const setMeta = (selector, attr, value) => {
    let element = document.querySelector(selector);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attr === 'name' ? 'name' : 'property', selector.includes('twitter') ? 'twitter:image' : 'og:image');
      document.head.appendChild(element);
    }
    if (attr === 'name') {
      element.setAttribute('name', selector.replace('meta[name="', '').replace('"]', ''));
    } else {
      element.setAttribute(attr, value);
    }
  };

  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    ogImage.setAttribute('content', imageUrl || '');
  } else {
    const meta = document.createElement('meta');
    meta.setAttribute('property', 'og:image');
    meta.setAttribute('content', imageUrl || '');
    document.head.appendChild(meta);
  }

  const twitterImage = document.querySelector('meta[name="twitter:image"]');
  if (twitterImage) {
    twitterImage.setAttribute('content', imageUrl || '');
  } else {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'twitter:image');
    meta.setAttribute('content', imageUrl || '');
    document.head.appendChild(meta);
  }

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    ogTitle.setAttribute('content', titleText);
  }

  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) {
    ogDescription.setAttribute('content', descriptionText);
  }

  const twitterTitle = document.querySelector('meta[name="twitter:title"]');
  if (twitterTitle) {
    twitterTitle.setAttribute('content', titleText);
  }

  const twitterDescription = document.querySelector('meta[name="twitter:description"]');
  if (twitterDescription) {
    twitterDescription.setAttribute('content', descriptionText);
  }

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    canonical.setAttribute('href', canonicalUrl);
  } else {
    const link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', canonicalUrl);
    document.head.appendChild(link);
  }
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

async function loadDetail() {
  const params = new URLSearchParams(window.location.search);
  const recordId = params.get('id');

  if (!recordId) {
    loadingEl.textContent = 'No property selected.';
    return;
  }

  try {
    const workerUrl = new URL(getWorkerUrl());
    workerUrl.searchParams.set('action', 'get');
    workerUrl.searchParams.set('id', recordId);

    const response = await fetch(workerUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    const responseText = await response.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Unable to parse worker response:', responseText, parseError);
      throw new Error('Invalid response from listing service.');
    }

    console.debug('Detail worker response', data);

    const record = findRecordById(data, recordId);

    if (!response.ok || data.error || !record) {
      const errorMessage = data.error || `Unable to load property${recordId ? ` (${recordId})` : ''}`;
      console.error('Detail fetch failed:', errorMessage, data);
      throw new Error(errorMessage);
    }

    const fields = record.fields || {};
    let photos = Array.isArray(fields.Photo) ? fields.Photo : [];
    // If no attachments, check for PhotoBase64 (stored as JSON string)
    if ((!photos || !photos.length) && fields.PhotoBase64) {
      try {
        const baseList = typeof fields.PhotoBase64 === 'string' ? JSON.parse(fields.PhotoBase64) : fields.PhotoBase64;
        if (Array.isArray(baseList) && baseList.length) {
          photos = baseList.map((dataUrl) => ({ url: dataUrl }));
        }
      } catch (e) {
        // ignore parse errors
      }
    }

    const listingTitle = fields['Property Name'] || 'Property';
    const listingDescription = fields.Description || 'No description available.';
    const previewImage = photos[0]?.url || APP_CONFIG.logoSrc || '';

    titleEl.textContent = listingTitle;
    locationEl.textContent = fields.Location || 'Location available on request';
    priceEl.textContent = new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      maximumFractionDigits: 0
    }).format(Number(fields.Price) || 0);
    descriptionEl.textContent = listingDescription;
    whatsappEl.href = `https://wa.me/${APP_CONFIG.whatsappNumber}?text=${encodeURIComponent(`Hello, I am interested in ${listingTitle}.`)}`;
    setShareMeta(previewImage, listingTitle, listingDescription);

    galleryEl.innerHTML = '';
    galleryEl.className = 'detail-gallery';

    if (photos.length) {
      const collagePhotos = photos.slice(0, 4);
      collagePhotos.forEach((photo, index) => {
        const frame = document.createElement('figure');
        frame.className = `detail-gallery-card${index === 0 ? ' is-featured' : ''}`;
        const img = document.createElement('img');
        img.src = photo.url;
        img.alt = listingTitle;
        frame.appendChild(img);
        galleryEl.appendChild(frame);
      });
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'detail-gallery-card';
      placeholder.innerHTML = '<div class="listing-placeholder">No images available</div>';
      galleryEl.appendChild(placeholder);
    }

    loadingEl.hidden = true;
    cardEl.hidden = false;
  } catch (error) {
    console.error(error);
    loadingEl.textContent = 'Unable to load this property right now.';
  }
}

loadDetail();
