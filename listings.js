// WhatsApp contact number used across the site.
const WHATSAPP_NUMBER = APP_CONFIG.whatsappNumber;
const LISTINGS_API_URL = getWorkerUrl();
const LISTINGS_PER_PAGE = 6;

const navLinks = document.getElementById("nav-links");
const menuToggle = document.getElementById("menu-toggle");
const listingsState = document.getElementById("listings-state");
const listingsGrid = document.getElementById("listings-grid");
const filterForm = document.getElementById("filter-form");
const filterLocation = document.getElementById("filter-location");
const filterType = document.getElementById("filter-type");
const filterMinPrice = document.getElementById("filter-min-price");
const filterMaxPrice = document.getElementById("filter-max-price");
const filterReset = document.getElementById("filter-reset");
const sortOrder = document.getElementById("sort-order");
const resultsSummary = document.getElementById("results-summary");
const pagination = document.getElementById("pagination");
const paginationPrev = document.getElementById("pagination-prev");
const paginationNext = document.getElementById("pagination-next");
const paginationPages = document.getElementById("pagination-pages");
let allListings = [];
let filteredListings = [];
let currentPage = 1;
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

function getListingsPerPage() {
  return isMobileViewport() ? 4 : LISTINGS_PER_PAGE;
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
  const footerPhone = document.getElementById("footer-phone");
  const navWhatsapp = document.getElementById("nav-whatsapp");

  if (navWhatsapp) {
    navWhatsapp.href = genericUrl;
  }

  if (footerPhone) {
    footerPhone.href = genericUrl;
    footerPhone.textContent = formatWhatsAppDisplay(WHATSAPP_NUMBER);
  }
}

function toggleMenu(forceClose = false) {
  const willOpen = forceClose ? false : !navLinks.classList.contains("is-open");
  navLinks.classList.toggle("is-open", willOpen);
  menuToggle.classList.toggle("is-active", willOpen);
  menuToggle.setAttribute("aria-expanded", String(willOpen));
}

function closeMenuOnNavigate() {
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
    locationSlug: String(fields.location || "").trim().toLowerCase(),
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

function wireImageFallback(img, fallbackSrc) {
  if (!img || !fallbackSrc || fallbackSrc === img.src) {
    return;
  }

  img.addEventListener("error", () => {
    if (img.dataset.fallbackApplied === "true") {
      return;
    }

    img.dataset.fallbackApplied = "true";
    img.src = fallbackSrc;
  }, { once: true });
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
        ? `<div class="listing-image"><img src="${photoUrl}" data-fallback-src="${listing.photos[0]?.fallbackUrl || ""}" alt="${listing.propertyName}" loading="lazy" decoding="async"></div>`
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

  const img = card.querySelector(".listing-image img");
  if (img) {
    wireImageFallback(img, img.dataset.fallbackSrc || "");
  }

  return card;
}

function showListingState(message) {
  listingsGrid.hidden = true;
  pagination.hidden = true;
  listingsState.hidden = false;
  listingsState.textContent = message;
}

function populateLocationFilter(listings) {
  const uniqueLocations = [...new Set(
    listings
      .map((listing) => listing.location)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  filterLocation.innerHTML = '<option value="">All locations</option>';
  uniqueLocations.forEach((location) => {
    const option = document.createElement("option");
    option.value = location.toLowerCase();
    option.textContent = location;
    filterLocation.appendChild(option);
  });
}

function applyFilters() {
  const locationValue = filterLocation.value.trim().toLowerCase();
  const typeValue = filterType.value.trim();
  const minPrice = Number(filterMinPrice.value) || 0;
  const maxPrice = Number(filterMaxPrice.value) || Infinity;

  filteredListings = allListings.filter((listing) => {
    const matchesLocation = !locationValue || listing.locationSlug === locationValue;
    const matchesType = !typeValue || listing.type === typeValue;
    const matchesMin = listing.priceValue >= minPrice;
    const matchesMax = listing.priceValue <= maxPrice;

    return matchesLocation && matchesType && matchesMin && matchesMax;
  });

  applySort();
}

function applySort() {
  const sortValue = sortOrder.value;

  filteredListings.sort((a, b) => {
    if (sortValue === "price-asc") {
      return a.priceValue - b.priceValue;
    }

    if (sortValue === "price-desc") {
      return b.priceValue - a.priceValue;
    }

    if (sortValue === "name-asc") {
      return a.propertyName.localeCompare(b.propertyName);
    }

    return b.createdTime - a.createdTime;
  });
}

function renderPagination(totalPages) {
  paginationPages.innerHTML = "";
  pagination.hidden = totalPages <= 1;

  paginationPrev.disabled = currentPage === 1;
  paginationNext.disabled = currentPage === totalPages;

  for (let page = 1; page <= totalPages; page += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pagination-page${page === currentPage ? " is-active" : ""}`;
    button.textContent = String(page);
    button.addEventListener("click", () => {
      currentPage = page;
      renderListingsPage();
    });
    paginationPages.appendChild(button);
  }
}

function renderListingsPage() {
  if (!filteredListings.length) {
    showListingState("No listings match your filters right now. Try adjusting the filters or contact us directly.");
    return;
  }

  const listingsPerPage = getListingsPerPage();
  const totalPages = Math.ceil(filteredListings.length / listingsPerPage);
  currentPage = Math.min(currentPage, totalPages);
  const startIndex = (currentPage - 1) * listingsPerPage;
  const pageListings = filteredListings.slice(startIndex, startIndex + listingsPerPage);

  listingsGrid.innerHTML = "";
  pageListings.forEach((listing) => {
    listingsGrid.appendChild(createListingCard(listing));
  });

  const start = startIndex + 1;
  const end = startIndex + pageListings.length;
  resultsSummary.textContent = `Showing ${start}-${end} of ${filteredListings.length} active listings`;

  listingsState.hidden = true;
  listingsGrid.hidden = false;
  renderPagination(totalPages);
}

function refreshFilteredListings(resetPage = true) {
  if (resetPage) {
    currentPage = 1;
  }

  applyFilters();
  renderListingsPage();
}

async function fetchListings() {
  if (LISTINGS_API_URL.includes("YOUR_")) {
    showListingState("No listings available at the moment — check back soon. Contact us directly on WhatsApp for off-market properties.");
    return;
  }

  try {
    logDebug("Fetching listing page data", LISTINGS_API_URL);
    const response = await fetch(LISTINGS_API_URL, {
      method: "GET",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Listings API request failed with status ${response.status}`);
    }

    const data = await response.json();
    allListings = Array.isArray(data.records)
      ? data.records.map(normalizeListing).sort((a, b) => b.createdTime - a.createdTime)
      : [];

    logDebug("Listing page data loaded", String(allListings.length));

    if (!allListings.length) {
      showListingState("No listings available at the moment — check back soon. Contact us directly on WhatsApp for off-market properties.");
      return;
    }

    populateLocationFilter(allListings);
    refreshFilteredListings();
  } catch (error) {
    console.error("Unable to load Airtable listings:", error);
    logDebug("Listing page failed", error instanceof Error ? error.message : String(error));
    showListingState("Unable to load listings right now. Please contact us directly.");
  }
}

menuToggle.addEventListener("click", () => toggleMenu());
document.addEventListener("click", (event) => {
  const clickedInsideMenu = navLinks.contains(event.target) || menuToggle.contains(event.target);
  if (!clickedInsideMenu) {
    toggleMenu(true);
  }
});

filterForm.addEventListener("input", () => refreshFilteredListings());
sortOrder.addEventListener("change", () => refreshFilteredListings(false));
filterReset.addEventListener("click", () => {
  filterForm.reset();
  sortOrder.value = "recent";
  refreshFilteredListings();
});

paginationPrev.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    renderListingsPage();
  }
});

paginationNext.addEventListener("click", () => {
  const totalPages = Math.ceil(filteredListings.length / getListingsPerPage());
  if (currentPage < totalPages) {
    currentPage += 1;
    renderListingsPage();
  }
});

window.addEventListener("resize", () => {
  if (!allListings.length) {
    return;
  }

  refreshFilteredListings(false);
});

closeMenuOnNavigate();
setStaticWhatsAppLinks();
window.addEventListener("error", (event) => {
  logDebug("Window error", event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  logDebug("Promise rejection", String(event.reason));
});
fetchListings();
