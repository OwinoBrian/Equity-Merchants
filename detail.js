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
  const previewWidth = '1200';
  const previewHeight = '630';

  document.title = `${titleText} | ${APP_CONFIG.shortName}`;

  const ensureMeta = (selector, attribute) => {
    let element = document.querySelector(selector);
    if (!element) {
      element = document.createElement('meta');
      const match = selector.match(/\[(?:property|name)="([^"]+)"\]/);
      const name = match ? match[1] : '';
      if (attribute === 'property') {
        element.setAttribute('property', name);
      } else {
        element.setAttribute('name', name);
      }
      document.head.appendChild(element);
    }
    return element;
  };

  ensureMeta('meta[property="og:title"]', 'property').setAttribute('content', titleText);
  ensureMeta('meta[property="og:description"]', 'property').setAttribute('content', descriptionText);
  ensureMeta('meta[property="og:image"]', 'property').setAttribute('content', imageUrl || '');
  ensureMeta('meta[property="og:image:width"]', 'property').setAttribute('content', previewWidth);
  ensureMeta('meta[property="og:image:height"]', 'property').setAttribute('content', previewHeight);
  ensureMeta('meta[property="og:url"]', 'property').setAttribute('content', canonicalUrl);
  ensureMeta('meta[property="og:type"]', 'property').setAttribute('content', 'website');
  ensureMeta('meta[name="twitter:title"]', 'name').setAttribute('content', titleText);
  ensureMeta('meta[name="twitter:description"]', 'name').setAttribute('content', descriptionText);
  ensureMeta('meta[name="twitter:image"]', 'name').setAttribute('content', imageUrl || '');

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

function setImageWithFallback(img, primarySrc, fallbackSrc, altText) {
  img.alt = altText;
  img.src = primarySrc;

  if (!fallbackSrc || fallbackSrc === primarySrc) {
    return;
  }

  img.addEventListener('error', () => {
    if (img.dataset.fallbackApplied === 'true') {
      return;
    }

    img.dataset.fallbackApplied = 'true';
    img.src = fallbackSrc;
  }, { once: true });
}

async function loadDetail() {
  const params = new URLSearchParams(window.location.search);
  const recordId = params.get('id');

  if (!recordId) {
    loadingEl.textContent = 'No property selected.';
    return;
  }

  try {
    const response = await fetch(getListingApiUrl(recordId), {
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

    const fields = normalizeApiFields(record.fields || {});
    let photos = parseListingPhotos(fields);

    const listingTitle = fields.propertyName || 'Property';
    const listingDescription = fields.description || 'No description available.';
    const previewImage = photos[0]?.url || APP_CONFIG.logoSrc || '';

    titleEl.textContent = listingTitle;
    locationEl.textContent = fields.location || 'Location available on request';
    priceEl.textContent = new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      maximumFractionDigits: 0
    }).format(Number(fields.price) || 0);
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
        setImageWithFallback(img, photo.url, photo.fallbackUrl, listingTitle);
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
