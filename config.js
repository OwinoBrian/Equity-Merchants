const APP_CONFIG = {
  siteName: "Equity Merchants Ltd",
  shortName: "Equity Merchants",
  adminAppName: "Equity Merchants Admin",
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
    document.title = pageTitle.replace("{siteName}", APP_CONFIG.siteName).replace("{heroTitle}", APP_CONFIG.heroTitle);
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
  setText("[data-brand-short-name]", APP_CONFIG.shortName);
  setText("[data-brand-tagline]", APP_CONFIG.tagline);
  setText("[data-brand-address]", APP_CONFIG.address);
  setText("[data-brand-email]", APP_CONFIG.contactEmail);
  setText("[data-brand-map-text]", APP_CONFIG.mapText);
  setText("[data-brand-credit]", APP_CONFIG.footerCredit);

  document.querySelectorAll("[data-brand-site-name]").forEach((element) => {
    element.textContent = APP_CONFIG.siteName;
  });

  document.querySelectorAll("[data-brand-logo]").forEach((element) => {
    if (element.tagName.toLowerCase() === "img") {
      element.src = APP_CONFIG.logoSrc;
      element.alt = APP_CONFIG.logoAlt;
    }
  });

  document.querySelectorAll("[data-brand-icon]").forEach((element) => {
    element.setAttribute("href", APP_CONFIG.logoSrc);
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

window.addEventListener("DOMContentLoaded", applyBranding);
