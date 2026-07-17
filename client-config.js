// ---------------------------------------------------------------------------
// PER-CLIENT CONFIG. This is the ONLY file that changes between clients.
// The shared logic that reads it lives in config.js (do not duplicate it).
// A copy of this file lives in clients/<slug>/client-config.js — that folder
// is the source of truth for deploys. This root copy is the local-dev default;
// run `npm run use <slug>` to preview a different client locally.
// ---------------------------------------------------------------------------
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
  logoSrc: "logo.png",
  logoAlt: "Equity Merchants Ltd logo",
  faviconSrc: "logo.png",
  themeColor: "#003049",
  apiBaseUrl: "/api",
  footerCredit: "Built by Ujao Defined",
  footerCreditUrl: "https://ujao-defined.com",
  // Airtable — per client. The base id + table are passed to the API per request
  // so each client reads/writes only their own base. These are not secrets
  // (the API token that grants access is the secret, set on the Cloudflare project).
  airtableBaseId: "appwFq9FXqtf2cV6B",
  airtableTableName: "Listings",
  airtableEditorUrl: "https://airtable.com/appwFq9FXqtf2cV6B/tbl7SBcj3I3jc0QbU",
  airtableAddFormUrl: "https://airtable.com/appwFq9FXqtf2cV6B/pagWEy5JYFErSCwn4/form",
  airtableBaseUrl: "https://airtable.com/appwFq9FXqtf2cV6B",
  activeListingStatus: "Active",
  airtableFields: {
    propertyName: "Property Name",
    propertyNameFallback: "Name",
    location: "Location",
    price: "Price",
    type: "Type",
    status: "Status",
    description: "Description",
    businessId: "Business ID",
    photo: "Photo",
    photoBase64: "PhotoBase64"
  }
};
