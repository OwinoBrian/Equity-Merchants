// WhatsApp contact number used across the site.
const WHATSAPP_NUMBER = typeof getPrimaryWhatsAppNumber === "function"
  ? getPrimaryWhatsAppNumber()
  : APP_CONFIG.whatsappNumber;

// Public API endpoint used by the site to load listings.
const LISTINGS_API_URL = getListingsApiUrl();
const FEATURED_LISTINGS_LIMIT = 3;

const navLinks = document.getElementById("nav-links");
const menuToggle = document.getElementById("menu-toggle");
const contactForm = document.getElementById("contact-form");
const listingsState = document.getElementById("listings-state");
const listingsGrid = document.getElementById("listings-grid");
let currentModalListing = null;
let currentModalPhotoIndex = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchInProgress = false;
const debugEnabled = new URLSearchParams(window.location.search).has("debug");
const debugLogs = [];

function buildWhatsAppUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 767px)").matches;
}

function getFeaturedListingsLimit() {
  return isMobileViewport() ? 2 : FEATURED_LISTINGS_LIMIT;
}

function formatWhatsAppDisplay(number) {
  if (!number.startsWith("254") || number.length < 12) {
    return number;
  }

  return `+${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6, 9)} ${number.slice(9)}`;
}

function setStaticWhatsAppLinks() {
  const genericMessage = getGenericWhatsAppMessage();
  const genericUrl = buildWhatsAppUrl(genericMessage);
  const displayNumber = formatWhatsAppDisplay(WHATSAPP_NUMBER);

  const staticLinks = [
    document.getElementById("nav-whatsapp"),
    document.getElementById("hero-whatsapp"),
    document.getElementById("contact-whatsapp"),
    document.getElementById("contact-phone"),
    document.getElementById("footer-phone")
  ];

  staticLinks.forEach((link) => {
    if (link) {
      link.href = genericUrl;
    }
  });

  const phoneTargets = [
    document.getElementById("contact-phone"),
    document.getElementById("footer-phone")
  ];

  phoneTargets.forEach((link) => {
    if (link) {
      link.textContent = displayNumber;
    }
  });
}

function toggleMenu(forceClose = false) {
  if (!navLinks || !menuToggle) {
    return;
  }

  const willOpen = forceClose ? false : !navLinks.classList.contains("is-open");
  navLinks.classList.toggle("is-open", willOpen);
  menuToggle.classList.toggle("is-active", willOpen);
  menuToggle.setAttribute("aria-expanded", String(willOpen));
  document.body.classList.toggle("menu-open", willOpen);
}

function closeMenuOnNavigate() {
  if (!navLinks) {
    return;
  }

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => toggleMenu(true));
  });
}

function formatKES(value) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return value ? `KES ${value}` : "Price on request";
  }

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0
  }).format(numericValue);
}

function getBadgeClass(type) {
  const normalizedType = String(type || "").trim().toLowerCase();

  if (normalizedType === "land") {
    return "badge badge-land";
  }

  if (normalizedType === "commercial") {
    return "badge badge-commercial";
  }

  return "badge badge-house";
}

function normalizeListing(record) {
  const fields = normalizeApiFields(record.fields || {});

  return {
    id: record.id,
    createdTime: record.createdTime ? new Date(record.createdTime) : new Date(0),
    propertyName: fields.propertyName || "Untitled Property",
    location: fields.location || "Location available on request",
    priceValue: Number(fields.price) || 0,
    price: formatKES(fields.price),
    type: fields.type || "House",
    description: fields.description || "Contact us for more information about this property.",
    photos: parseListingPhotos(fields)
  };
}

function getCardPhotoUrl(listing) {
  const photo = listing.photos[0];
  if (!photo) {
    return "";
  }

  return photo.cardUrl || photo.thumbUrl || photo.url || "";
}

function getModalPhotoUrl(photo) {
  return photo.cardUrl || photo.url || photo.thumbUrl || "";
}

function getThumbPhotoUrl(photo) {
  return photo.thumbUrl || photo.cardUrl || photo.url || "";
}

function logDebug(message, details = "") {
  if (!debugEnabled) {
    return;
  }

  const timestamp = new Date().toLocaleTimeString();
  debugLogs.push(`[${timestamp}] ${message}${details ? `: ${details}` : ""}`);
  renderDebugPanel();
}

function renderDebugPanel() {
  let panel = document.getElementById("debug-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "debug-panel";
    panel.style.position = "fixed";
    panel.style.left = "0.75rem";
    panel.style.right = "0.75rem";
    panel.style.bottom = "0.75rem";
    panel.style.zIndex = "2000";
    panel.style.maxHeight = "38vh";
    panel.style.overflow = "auto";
    panel.style.padding = "0.85rem";
    panel.style.borderRadius = "16px";
    panel.style.background = "rgba(0,0,0,0.82)";
    panel.style.color = "#fff";
    panel.style.font = "12px/1.45 monospace";
    panel.style.whiteSpace = "pre-wrap";
    panel.style.boxShadow = "0 12px 28px rgba(0,0,0,0.24)";
    document.body.appendChild(panel);
  }

  panel.textContent = debugLogs.slice(-10).join("\n");
}

function createListingCard(listing) {
  const message = `Hi, I am interested in ${listing.propertyName} listed on your website. Please share more details.`;
  const photoUrl = isMobileViewport() ? "" : getCardPhotoUrl(listing);

  const card = document.createElement("article");
  card.className = "card listing-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `View details for ${listing.propertyName}`);

  card.innerHTML = `
    ${
      photoUrl
        ? `<div class="listing-image"><img src="${photoUrl}" alt="${listing.propertyName}" loading="lazy" decoding="async"></div>`
        : `<div class="listing-placeholder">${listing.propertyName}</div>`
    }
    <div class="listing-content">
      <div class="listing-top">
        <span class="${getBadgeClass(listing.type)}">${listing.type}</span>
        <span class="listing-price">${listing.price}</span>
      </div>
      <div>
        <h3>${listing.propertyName}</h3>
        <p class="listing-meta">${listing.location}</p>
      </div>
      <p class="listing-copy">${listing.description}</p>
      <div class="listing-actions">
        <button class="btn btn-outline" type="button">View Details</button>
        <a
          class="btn btn-whatsapp"
          href="${buildWhatsAppUrl(message)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Inquire on WhatsApp
        </a>
      </div>
    </div>
  `;

  card.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      return;
    }

    window.location.href = `detail.html?id=${listing.id}`;
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      window.location.href = `detail.html?id=${listing.id}`;
    }
  });

  return card;
}

function showListingState(message) {
  listingsGrid.hidden = true;
  listingsState.hidden = false;
  listingsState.textContent = message;
}

async function fetchListings() {
  try {
    logDebug("Fetching featured listings", LISTINGS_API_URL);
    const response = await fetch(LISTINGS_API_URL, {
      method: "GET",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Listings API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const listings = Array.isArray(data.records)
      ? data.records.map(normalizeListing).sort((a, b) => b.createdTime - a.createdTime)
      : [];

    logDebug("Featured listings loaded", String(listings.length));

    if (!listings.length) {
      showListingState("No listings available at the moment — check back soon. Contact us directly on WhatsApp for off-market properties.");
      return;
    }

    listingsGrid.innerHTML = "";
    listings.slice(0, getFeaturedListingsLimit()).forEach((listing) => {
      listingsGrid.appendChild(createListingCard(listing));
    });

    listingsState.hidden = true;
    listingsGrid.hidden = false;
  } catch (error) {
    console.error("Unable to load Airtable listings:", error);
    logDebug("Featured listings failed", error instanceof Error ? error.message : String(error));
    showListingState("Unable to load listings right now. Please contact us directly.");
  }
}

function handleContactFormSubmit(event) {
  event.preventDefault();

  const formData = new FormData(contactForm);
  const name = (formData.get("name") || "").toString().trim();
  const phone = (formData.get("phone") || "").toString().trim();
  const message = (formData.get("message") || "").toString().trim();

  const composedMessage = [
    `Hello ${APP_CONFIG.siteName},`,
    "",
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Message: ${message}`
  ].join("\n");

  window.open(buildWhatsAppUrl(composedMessage), "_blank", "noopener");
}

function initRevealAnimations() {
  const revealItems = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: "0px 0px -40px 0px"
    }
  );

  revealItems.forEach((item) => observer.observe(item));
}

if (menuToggle) {
  menuToggle.addEventListener("click", () => toggleMenu());
}

document.addEventListener("click", (event) => {
  if (!navLinks || !menuToggle) {
    return;
  }

  const clickedInsideMenu = navLinks.contains(event.target) || menuToggle.contains(event.target);
  if (!clickedInsideMenu) {
    toggleMenu(true);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    toggleMenu(true);
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth >= 768) {
    toggleMenu(true);
  }
});

contactForm.addEventListener("submit", handleContactFormSubmit);

closeMenuOnNavigate();
setStaticWhatsAppLinks();
initRevealAnimations();
window.addEventListener("error", (event) => {
  logDebug("Window error", event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  logDebug("Promise rejection", String(event.reason));
});
fetchListings();
