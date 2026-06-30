const APP_CONFIG = {
  siteName: "Equity Merchants Ltd",
  shortName: "Equity Merchants",
  brandNameShort: "Equity Merchants",
  adminAppName: "Equity Merchants Admin",
  adminAppShortName: "Equity Admin",
  tagline: "Property. Supplies. Solutions.",
  heroTitle: "Property & Real Estate in Kenya",
  description: "Equity Merchants Ltd is a Nairobi-based property and real estate company offering land, homes, rentals, development, and trusted transaction support across Kenya.",
  listingsDescription: "Browse all active Equity Merchants Ltd property listings with filters by location, type, and price.",
  keywords: "Equity Merchants Ltd, Nairobi real estate, Kenya property, land for sale Kenya, homes for sale Nairobi, commercial property Kenya, property management Nairobi",
  businessId: "equity-merchants",
  whatsappNumber: "254759043208",
  contactEmail: "equity161@gmail.com",
  address: "55356 00200 Nairobi, Kenya",
  mapText: "Map loading - contact us for directions",
  logoSrc: "Equity Merchants.png",
  logoAlt: "Equity Merchants Ltd logo",
  faviconSrc: "Equity Merchants.png",
  themeColor: "#003049",
  workerBaseUrl: "https://equity-merchants-listings.ujao.workers.dev",
  footerCredit: "Built by Ujao Defined",
  footerCreditUrl: "https://ujao-defined.com",
  airtableEditorUrl: "https://airtable.com/appwFq9FXqtf2cV6B/tbl7SBcj3I3jc0QbU",
  airtableAddFormUrl: "https://airtable.com/appwFq9FXqtf2cV6B/pagWEy5JYFErSCwn4/form",
  airtableBaseUrl: "https://airtable.com/appwFq9FXqtf2cV6B"
};

function getWorkerUrl() {
  const url = new URL(APP_CONFIG.workerBaseUrl);
  url.searchParams.set("businessId", APP_CONFIG.businessId);
  return url.toString();
}

function getGenericWhatsAppMessage() {
  return `Hello ${APP_CONFIG.siteName}, I would like to learn more about your available properties and services.`;
}

function parseListingPhotos(fields) {
  let photos = Array.isArray(fields.Photo) ? fields.Photo : [];

  if ((!photos || !photos.length) && fields.PhotoBase64) {
    try {
      const baseList = typeof fields.PhotoBase64 === "string"
        ? JSON.parse(fields.PhotoBase64)
        : fields.PhotoBase64;

      if (Array.isArray(baseList) && baseList.length) {
        photos = baseList.map((dataUrl) => ({
          url: dataUrl,
          cardUrl: dataUrl,
          thumbUrl: dataUrl
        }));
      }
    } catch (error) {
      // ignore parse errors
    }
  }

  return photos
    .map((item) => ({
      url: item.url,
      cardUrl: item.cardUrl || item.url,
      thumbUrl: item.thumbUrl || item.cardUrl || item.url
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
