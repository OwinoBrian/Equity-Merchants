// APP_CONFIG is defined in client-config.js, which every page loads BEFORE this
// file. This file holds only shared logic — it never varies between clients.

function getFieldConfigPayload() {
  return {
    fields: APP_CONFIG.airtableFields,
    activeStatus: APP_CONFIG.activeListingStatus
  };
}

function getApiBaseUrl() {
  return String(APP_CONFIG.apiBaseUrl || "/api").replace(/\/+$/, "") || "/api";
}

function getApiUrl(pathname = "") {
  const baseUrl = getApiBaseUrl();
  const path = String(pathname || "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

function applyTenantParams(url) {
  url.searchParams.set("businessId", APP_CONFIG.businessId);
  url.searchParams.set("fieldConfig", JSON.stringify(getFieldConfigPayload()));
  if (APP_CONFIG.airtableBaseId) {
    url.searchParams.set("baseId", APP_CONFIG.airtableBaseId);
  }
  if (APP_CONFIG.airtableTableName) {
    url.searchParams.set("tableName", APP_CONFIG.airtableTableName);
  }
  return url;
}

function getListingsApiUrl() {
  return applyTenantParams(new URL(getApiUrl("/listings"), window.location.origin)).toString();
}

function getListingApiUrl(recordId) {
  return applyTenantParams(new URL(getApiUrl(`/listings/${encodeURIComponent(recordId)}`), window.location.origin)).toString();
}

function getUploadApiUrl() {
  return getApiUrl("/upload");
}

function getImageProxyUrl(imageUrl) {
  const src = String(imageUrl || "").trim();
  if (!src) {
    return "";
  }

  return getApiUrl(`/image?src=${encodeURIComponent(src)}`);
}

function getGenericWhatsAppMessage() {
  return `Hello ${APP_CONFIG.siteName}, I would like to learn more about your available properties and services.`;
}

function getRequiredFieldLabels() {
  const fields = APP_CONFIG.airtableFields;
  return [
    fields.propertyName,
    fields.location,
    fields.price,
    fields.type,
    fields.description,
    fields.status,
    fields.photo
  ].join(", ");
}

function normalizeApiFields(fields) {
  if (!fields || typeof fields !== "object") {
    return {};
  }

  if ("propertyName" in fields || "location" in fields) {
    return fields;
  }

  const map = APP_CONFIG.airtableFields;
  const photoField = fields[map.photo];

  return {
    propertyName: fields[map.propertyName] || fields[map.propertyNameFallback] || "",
    location: fields[map.location] || "",
    price: fields[map.price] || "",
    type: fields[map.type] || "",
    status: fields[map.status] || "",
    description: fields[map.description] || "",
    businessId: fields[map.businessId] || "",
    photo: photoField || "",
    photoBase64: fields[map.photoBase64] || null
  };
}

function parseListingPhotos(fields) {
  const toPhotoObject = (value, fallbackUrl = "") => {
    const url = String(value || "").trim();
    if (!url) {
      return null;
    }

    const proxiedUrl = getImageProxyUrl(url);

    return {
      url: proxiedUrl,
      cardUrl: proxiedUrl,
      thumbUrl: proxiedUrl,
      fallbackUrl: String(fallbackUrl || "").trim()
    };
  };

  const base64Photos = [];
  if (fields.photoBase64) {
    try {
      const baseList = typeof fields.photoBase64 === "string"
        ? JSON.parse(fields.photoBase64)
        : fields.photoBase64;

      if (Array.isArray(baseList)) {
        base64Photos.push(...baseList.map((item) => String(item || "").trim()).filter(Boolean));
      }
    } catch (error) {
      // ignore parse errors
    }
  }

  let photos = [];

  if (Array.isArray(fields.photo)) {
    photos = fields.photo
      .map((item) => {
        if (!item) {
          return null;
        }

        if (typeof item === "string") {
          return toPhotoObject(item, base64Photos.shift() || "");
        }

        if (typeof item === "object") {
          const url = item.url || item.cardUrl || item.thumbUrl || "";
          const proxiedUrl = getImageProxyUrl(url);
          return {
            url: proxiedUrl,
            cardUrl: getImageProxyUrl(item.cardUrl || url),
            thumbUrl: getImageProxyUrl(item.thumbUrl || item.cardUrl || url),
            fallbackUrl: base64Photos.shift() || item.fallbackUrl || ""
          };
        }

        return null;
      })
      .filter(Boolean);
  } else if (typeof fields.photo === "string") {
    const raw = fields.photo.trim();

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          photos = parsed.map((item) => toPhotoObject(item, base64Photos.shift() || "")).filter(Boolean);
        }
      } catch (error) {
        photos = raw
          .split(/\r?\n|,/)
          .map((item) => toPhotoObject(item, base64Photos.shift() || ""))
          .filter(Boolean);
      }
    }
  } else if (fields.photo && typeof fields.photo === "object") {
    const url = fields.photo.url || fields.photo.cardUrl || fields.photo.thumbUrl || "";
    if (url) {
      const proxiedUrl = getImageProxyUrl(url);
      photos = [{
        url: proxiedUrl,
        cardUrl: getImageProxyUrl(fields.photo.cardUrl || url),
        thumbUrl: getImageProxyUrl(fields.photo.thumbUrl || fields.photo.cardUrl || url),
        fallbackUrl: base64Photos.shift() || fields.photo.fallbackUrl || ""
      }];
    }
  }

  if ((!photos || !photos.length) && base64Photos.length) {
    photos = base64Photos.map((dataUrl) => ({
      url: dataUrl,
      cardUrl: dataUrl,
      thumbUrl: dataUrl,
      fallbackUrl: dataUrl
    }));
  }

  return photos
    .map((item) => ({
      url: item.url,
      cardUrl: item.cardUrl || item.url,
      thumbUrl: item.thumbUrl || item.cardUrl || item.url,
      fallbackUrl: item.fallbackUrl || ""
    }))
    .filter((item) => item.url || item.cardUrl || item.thumbUrl);
}

function applyBranding() {
  const setText = (selector, value) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = value;
    });
  };

  const setContent = (selector, value) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.setAttribute("content", value);
    });
  };

  const pageTitle = document.body.dataset.pageTitle;
  if (pageTitle) {
    document.title = pageTitle
      .replace("{siteName}", APP_CONFIG.siteName)
      .replace("{shortName}", APP_CONFIG.shortName)
      .replace("{heroTitle}", APP_CONFIG.heroTitle)
      .replace("{adminAppName}", APP_CONFIG.adminAppName);
  }

  setContent('meta[name="description"][data-brand-description]', APP_CONFIG.description);
  setContent('meta[name="description"][data-brand-listings-description]', APP_CONFIG.listingsDescription);
  setContent('meta[name="keywords"][data-brand-keywords]', APP_CONFIG.keywords);
  setContent('meta[property="og:title"][data-brand-page-title]', document.title);
  setContent('meta[name="twitter:title"][data-brand-page-title]', document.title);
  setContent('meta[property="og:description"][data-brand-description]', APP_CONFIG.description);
  setContent('meta[name="twitter:description"][data-brand-description]', APP_CONFIG.description);
  setContent('meta[name="theme-color"]', APP_CONFIG.themeColor);

  setText("[data-brand-site-name]", APP_CONFIG.siteName);
  setText("[data-brand-short-name]", APP_CONFIG.shortName || APP_CONFIG.brandNameShort);
  setText("[data-brand-tagline]", APP_CONFIG.tagline);
  setText("[data-brand-address]", APP_CONFIG.address);
  setText("[data-brand-email]", APP_CONFIG.contactEmail);
  setText("[data-brand-map-text]", APP_CONFIG.mapText);
  setText("[data-brand-credit]", APP_CONFIG.footerCredit);
  setText("[data-brand-field-list]", getRequiredFieldLabels());

  document.querySelectorAll("[data-brand-logo]").forEach((element) => {
    if (element.tagName.toLowerCase() === "img") {
      element.src = APP_CONFIG.logoSrc;
      element.alt = APP_CONFIG.logoAlt;
    }
  });

  document.querySelectorAll("[data-brand-icon]").forEach((element) => {
    element.setAttribute("href", APP_CONFIG.faviconSrc || APP_CONFIG.logoSrc);
  });

  document.querySelectorAll("[data-brand-home-link]").forEach((element) => {
    element.setAttribute("aria-label", `${APP_CONFIG.siteName} home`);
  });

  document.querySelectorAll("[data-brand-email-link]").forEach((element) => {
    element.href = `mailto:${APP_CONFIG.contactEmail}`;
  });

  document.querySelectorAll("[data-brand-credit-link]").forEach((element) => {
    element.href = APP_CONFIG.footerCreditUrl;
    element.textContent = APP_CONFIG.footerCredit;
  });

  document.querySelectorAll("[data-brand-business-id]").forEach((element) => {
    element.value = APP_CONFIG.businessId;
  });

  const schema = document.getElementById("brand-schema");
  if (schema) {
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "RealEstateAgent",
      name: APP_CONFIG.siteName,
      description: APP_CONFIG.description,
      address: {
        "@type": "PostalAddress",
        streetAddress: APP_CONFIG.address
      },
      email: APP_CONFIG.contactEmail,
      telephone: `+${APP_CONFIG.whatsappNumber}`
    });
  }
}

function applyAdminManifest() {
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (!manifestLink) {
    return;
  }

  const manifest = {
    name: APP_CONFIG.adminAppName,
    short_name: APP_CONFIG.adminAppShortName,
    description: `Installable admin app for managing ${APP_CONFIG.shortName} listings`,
    start_url: "./admin.html",
    scope: "./",
    display: "standalone",
    background_color: "#fffaf5",
    theme_color: APP_CONFIG.themeColor,
    orientation: "portrait",
    icons: [
      {
        src: APP_CONFIG.logoSrc,
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: APP_CONFIG.logoSrc,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };

  const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
  manifestLink.href = URL.createObjectURL(blob);
}

window.addEventListener("DOMContentLoaded", () => {
  applyBranding();
  applyAdminManifest();
});
