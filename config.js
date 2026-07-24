// APP_CONFIG is defined in client-config.js, which every page loads BEFORE this
// file. THEMES is defined in themes.js, loaded before this file as well.
// This file holds only shared logic — it never varies between clients.

// --- Theming -----------------------------------------------------------------
// Resolves the tenant's preset (APP_CONFIG.theme + optional themeOverrides)
// against THEMES and applies it as CSS custom properties on :root, a
// data-style attribute on <body>, and dynamically injected Google Fonts links.
// theme.css consumes the variables; no other file knows about presets.

function parseHexColor(hex) {
  const value = String(hex || "").trim().replace(/^#/, "");
  const expanded = value.length === 3
    ? value.split("").map((ch) => ch + ch).join("")
    : value;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return null;
  }

  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16)
  };
}

function darkenHexColor(hex, factor = 0.68) {
  const rgb = parseHexColor(hex);
  if (!rgb) {
    return hex;
  }

  const toHex = (channel) => Math.round(channel * factor).toString(16).padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function hexToRgba(hex, alpha) {
  const rgb = parseHexColor(hex);
  if (!rgb) {
    return "";
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function resolveTheme() {
  const themeName = String(APP_CONFIG.theme || "").trim();
  if (!themeName || typeof THEMES === "undefined" || !THEMES[themeName]) {
    return null;
  }

  const preset = THEMES[themeName];
  const overrides = APP_CONFIG.themeOverrides || {};
  const colors = { ...preset.colors };

  // Tenants may nudge only the primary color; the dark variant follows it.
  if (overrides.primary && parseHexColor(overrides.primary)) {
    colors.primary = overrides.primary;
    colors.primaryDark = darkenHexColor(overrides.primary);
  }

  return { ...preset, colors };
}

function injectGoogleFonts(families) {
  if (!Array.isArray(families) || !families.length) {
    return;
  }

  const familyParams = families.map((family) => `family=${family}`).join("&");
  const href = `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;

  if (document.querySelector(`link[href="${href}"]`)) {
    return;
  }

  const preconnect = document.createElement("link");
  preconnect.rel = "preconnect";
  preconnect.href = "https://fonts.gstatic.com";
  preconnect.crossOrigin = "anonymous";
  document.head.appendChild(preconnect);

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = href;
  document.head.appendChild(stylesheet);
}

function applyTheme() {
  const theme = resolveTheme();
  if (!theme) {
    return;
  }

  const root = document.documentElement.style;
  root.setProperty("--color-primary", theme.colors.primary);
  root.setProperty("--color-primary-dark", theme.colors.primaryDark);
  root.setProperty("--color-secondary", theme.colors.secondary);
  root.setProperty("--color-text", theme.colors.text);
  root.setProperty("--color-bg", theme.colors.bg);
  root.setProperty("--color-surface", theme.colors.surface);
  root.setProperty("--font-heading", theme.fonts.heading);
  root.setProperty("--font-body", theme.fonts.body);
  root.setProperty("--radius-button", theme.radius.button);
  root.setProperty("--radius-card", theme.radius.card);
  root.setProperty("--radius-image", theme.radius.image);

  const tint = hexToRgba(theme.colors.primary, theme.imageTintAlpha ?? 0.14);
  if (tint) {
    root.setProperty("--image-tint", tint);
  }

  document.body.setAttribute("data-style", theme.buttonStyle);
  injectGoogleFonts(theme.fonts.google);
}

// Escape hatch for one-off tenant tweaks: APP_CONFIG.themeOverrides.cssVars
// sets arbitrary CSS custom properties on :root AFTER the preset, e.g.
//   themeOverrides: { cssVars: { "--nav-bg": "#12333f" } }
// Runs even with no preset selected, so the classic look can be nudged too.
function applyCssVarOverrides() {
  const cssVars = (APP_CONFIG.themeOverrides || {}).cssVars;
  if (!cssVars || typeof cssVars !== "object") {
    return;
  }

  const root = document.documentElement.style;
  Object.entries(cssVars).forEach(([name, value]) => {
    if (/^--[\w-]+$/.test(name) && typeof value === "string") {
      root.setProperty(name, value);
    }
  });
}

// --- Shared API / branding helpers ------------------------------------------

function getFieldConfigPayload() {
  const payload = {
    activeStatus: APP_CONFIG.activeListingStatus
  };

  if (APP_CONFIG.airtableFields && typeof APP_CONFIG.airtableFields === "object") {
    payload.fields = APP_CONFIG.airtableFields;
  }

  if (APP_CONFIG.airtableFieldAliases && typeof APP_CONFIG.airtableFieldAliases === "object") {
    payload.fieldAliases = APP_CONFIG.airtableFieldAliases;
  }

  return {
    ...payload
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
  const fields = APP_CONFIG.airtableFields || {};
  const aliases = APP_CONFIG.airtableFieldAliases || {};
  const pickLabel = (role, fallback) => {
    const exact = fields[role];
    if (exact) {
      return exact;
    }

    const aliasList = aliases[role];
    if (Array.isArray(aliasList) && aliasList.length) {
      return aliasList[0];
    }

    return fallback;
  };

  return [
    pickLabel("propertyName", "Property Name"),
    pickLabel("location", "Location"),
    pickLabel("price", "Price"),
    pickLabel("type", "Type"),
    pickLabel("description", "Description"),
    pickLabel("status", "Status"),
    pickLabel("photo", "Photos")
  ].join(", ");
}

function normalizeFieldName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getFieldAliases(role) {
  const defaults = {
    propertyName: ["Property Name", "Name", "Title", "Listing Name"],
    propertyNameFallback: ["Name", "Title"],
    location: ["Location", "Area", "Town", "City", "Address"],
    price: ["Price", "Amount", "Cost", "Rate"],
    type: ["Type", "Category", "Listing Type"],
    status: ["Status", "State", "Availability"],
    description: ["Description", "Details", "Summary"],
    businessId: ["Business ID", "Tenant ID", "Client ID"],
    photo: ["Photo", "Photos", "Image", "Images", "Gallery", "Media"],
    photoBase64: ["PhotoBase64", "Photo Base64", "Image Data"]
  };

  const configured = APP_CONFIG.airtableFieldAliases || {};
  return [
    ...(Array.isArray(configured[role]) ? configured[role] : []),
    ...(defaults[role] || [])
  ];
}

function getFieldCandidates(role) {
  const configuredFields = APP_CONFIG.airtableFields || {};
  const candidates = [];

  if (configuredFields[role]) {
    candidates.push(configuredFields[role]);
  }

  if (role === "propertyName" && configuredFields.propertyNameFallback) {
    candidates.push(configuredFields.propertyNameFallback);
  }

  candidates.push(...getFieldAliases(role));

  return [...new Set(candidates.filter(Boolean))];
}

function getFieldValue(fields, role) {
  if (!fields || typeof fields !== "object") {
    return "";
  }

  const normalizedEntries = Object.entries(fields).map(([key, value]) => [normalizeFieldName(key), value]);
  for (const candidate of getFieldCandidates(role)) {
    const normalizedCandidate = normalizeFieldName(candidate);
    const entry = normalizedEntries.find(([name]) => name === normalizedCandidate);
    if (entry && entry[1] !== undefined && entry[1] !== null && String(entry[1]).trim() !== "") {
      return entry[1];
    }
  }

  return "";
}

function normalizeApiFields(fields) {
  if (!fields || typeof fields !== "object") {
    return {};
  }

  if ("propertyName" in fields || "location" in fields) {
    return fields;
  }

  return {
    propertyName: getFieldValue(fields, "propertyName") || getFieldValue(fields, "propertyNameFallback") || "",
    location: getFieldValue(fields, "location") || "",
    price: getFieldValue(fields, "price") || "",
    type: getFieldValue(fields, "type") || "",
    status: getFieldValue(fields, "status") || "",
    description: getFieldValue(fields, "description") || "",
    businessId: getFieldValue(fields, "businessId") || "",
    photo: getFieldValue(fields, "photo") || "",
    photoBase64: getFieldValue(fields, "photoBase64") || null
  };
}

function parseListingPhotos(fields) {
  const splitPhotoUrls = (value) => String(value || "")
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

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
      if (raw.startsWith("[")) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            photos = parsed.map((item) => toPhotoObject(item, base64Photos.shift() || "")).filter(Boolean);
          }
        } catch (error) {
          photos = splitPhotoUrls(raw)
            .map((item) => toPhotoObject(item, base64Photos.shift() || ""))
            .filter(Boolean);
        }
      } else {
        photos = splitPhotoUrls(raw)
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
  applyTheme();
  applyCssVarOverrides();
  applyBranding();
  applyAdminManifest();
});
