// ---------------------------------------------------------------------------
// PER-CLIENT CONFIG.
// This file is the active tenant config for the current Cloudflare Pages
// deployment. The shared logic that reads it lives in config.js.
//
// For a new client, duplicate this file, update the branding + Airtable values,
// and deploy that tenant as its own Pages project or preview branch.
// ---------------------------------------------------------------------------
const APP_CONFIG = {
  siteName: "Foyer Properties",
  shortName: "Foyer Properties",
  brandNameShort: "Foyer Properties",
  adminAppName: "Foyer Properties Admin",
  adminAppShortName: "Foyer Admin",
  tagline: "Property Solutions",
  heroTitle: "Property & Real Estate in Kenya",
  description: "Foyer Properties is a Nairobi-based property and real estate company offering land, homes, rentals, development, and trusted transaction support across Kenya.",
  listingsDescription: "Browse all active Foyer Properties property listings with filters by location, type, and price.",
  keywords: "Foyer Properties, Nairobi real estate, Kenya property, land for sale Kenya, homes for sale Nairobi, commercial property Kenya, property management Nairobi",
  businessId: "foyer-properties",
  whatsappNumber: "254718062312",
  contactEmail: "foyerproperties@protonmail.com",
  address: "Nairobi, Kenya",
  mapText: "Map loading - contact us for directions",
  logoSrc: "foyer-properties.png",
  logoAlt: "Foyer Properties logo",
  faviconSrc: "foyer-properties.png",
  themeColor: "#d9ddd2",
  // Visual theme — pick one preset name from themes.js:
  //   "warmOrange" | "coolProfessional" | "friendlyPill" | "boldMinimal"
  // Leave unset/empty to keep the classic default look (theme.css fallbacks).
  //   theme: "coolProfessional",
  // Optional per-tenant nudge: override ONLY the primary/accent color without
  // picking a different preset. primaryDark and the image tint are re-derived
  // from this value automatically.
  //   themeOverrides: { primary: "#0e7490" },
  // For one-off element tweaks, set any CSS variable directly (applied after
  // the preset — works with or without a theme selected):
  //   themeOverrides: { cssVars: { "--nav-bg": "#12333f", "--radius-card": "10px" } },
  theme: "warmOrange",
  themeOverrides: {primary: "#c1121f",
    cssVars:{

    }
  },
  apiBaseUrl: "/api",
  footerCredit: "Built by Ujao Defined",
  footerCreditUrl: "https://ujao-defined.com",
  contacts: [
    {
      label: "Office Email",
      type: "email",
      value: "foyerproperties@protonmail.com"
    },
    {
      label: "Sales WhatsApp",
      type: "whatsapp",
      value: "254718062312"
    },
    {
      label: "Office Location",
      type: "text",
      value: "Nairobi, Kenya"
    }
  ],
  // Airtable — per client. The base id + table are passed to the API per request
  // so each client reads/writes only their own base. These are not secrets
  // (the API token that grants access is the secret, set on the Cloudflare project).
  airtableBaseId: "app1v1HsEckeM9MGd",
  airtableTableName: "Listings",
  airtableEditorUrl: "https://airtable.com/app1v1HsEckeM9MGd/tbl7SBcj3I3jc0QbU",
  airtableAddFormUrl: "https://airtable.com/app1v1HsEckeM9MGd/pagWEy5JYFErSCwn4/form",
  airtableBaseUrl: "https://airtable.com/app1v1HsEckeM9MGd",
  activeListingStatus: "Active",
  airtableFieldAliases: {
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
  }
};
