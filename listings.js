// WhatsApp contact number used across the site.
const WHATSAPP_NUMBER = "254759043208";
const LISTINGS_API_URL = "https://equity-merchants-listings.ujao.workers.dev";
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
const modal = document.getElementById("listing-modal");
const modalClose = document.getElementById("modal-close");
const modalCloseSecondary = document.getElementById("modal-close-secondary");
const modalPrev = document.getElementById("modal-prev");
const modalNext = document.getElementById("modal-next");
const modalImage = document.getElementById("modal-image");
const modalPlaceholder = document.getElementById("modal-placeholder");
const modalThumbs = document.getElementById("modal-thumbs");
const modalGalleryMain = document.querySelector(".modal-gallery-main");
const modalTitle = document.getElementById("modal-title");
const modalLocation = document.getElementById("modal-location");
const modalPrice = document.getElementById("modal-price");
const modalBadge = document.getElementById("modal-badge");
const modalDescription = document.getElementById("modal-description");
const modalWhatsapp = document.getElementById("modal-whatsapp");
const modalDetails = document.getElementById("modal-details");

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
  const genericMessage = "Hello Equity Merchants Ltd, I would like to learn more about your available properties and services.";
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
  const fields = record.fields || {};
  const photoField = Array.isArray(fields.Photo) ? fields.Photo : [];

  return {
    id: record.id,
    createdTime: record.createdTime ? new Date(record.createdTime) : new Date(0),
    propertyName: fields["Property Name"] || fields.Name || "Untitled Property",
    location: fields.Location || "Location available on request",
    locationSlug: String(fields.Location || "").trim().toLowerCase(),
    priceValue: Number(fields.Price) || 0,
    price: formatKES(fields.Price),
    type: fields.Type || "House",
    description: fields.Description || "Contact us for more information about this property.",
    photos: photoField
      .map((item) => ({
        url: item.url,
        cardUrl: item.cardUrl || item.url,
        thumbUrl: item.thumbUrl || item.cardUrl || item.url
      }))
      .filter((item) => item.url || item.cardUrl || item.thumbUrl)
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

    openListingModal(listing);
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openListingModal(listing);
    }
  });

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

function renderModalPhoto() {
  if (!currentModalListing) {
    return;
  }

  const photos = currentModalListing.photos;
  const activePhoto = photos[currentModalPhotoIndex];

  if (activePhoto && getModalPhotoUrl(activePhoto)) {
    modalImage.hidden = false;
    modalPlaceholder.hidden = true;
    modalImage.src = getModalPhotoUrl(activePhoto);
    modalImage.alt = currentModalListing.propertyName;
  } else {
    modalImage.hidden = true;
    modalPlaceholder.hidden = false;
    modalPlaceholder.textContent = currentModalListing.propertyName;
  }

  modalPrev.disabled = photos.length <= 1;
  modalNext.disabled = photos.length <= 1;

  modalThumbs.innerHTML = "";
  photos.forEach((photo, index) => {
    const thumbButton = document.createElement("button");
    thumbButton.type = "button";
    thumbButton.className = `modal-thumb${index === currentModalPhotoIndex ? " is-active" : ""}`;
    thumbButton.setAttribute("aria-label", `View photo ${index + 1}`);
    thumbButton.innerHTML = `<img src="${getThumbPhotoUrl(photo)}" alt="${currentModalListing.propertyName} thumbnail ${index + 1}" loading="lazy" decoding="async">`;
    thumbButton.addEventListener("click", () => {
      currentModalPhotoIndex = index;
      renderModalPhoto();
    });
    modalThumbs.appendChild(thumbButton);
  });
}

function openListingModal(listing) {
  currentModalListing = listing;
  currentModalPhotoIndex = 0;

  modalTitle.textContent = listing.propertyName;
  modalLocation.textContent = listing.location;
  modalPrice.textContent = listing.price;
  modalBadge.className = getBadgeClass(listing.type);
  modalBadge.textContent = listing.type;
  modalDescription.textContent = listing.description;
  modalDetails.textContent = `${listing.photos.length || 0} photo${listing.photos.length === 1 ? "" : "s"} available`;
  modalWhatsapp.href = buildWhatsAppUrl(`Hi, I am interested in ${listing.propertyName} listed on your website. Please share more details.`);

  renderModalPhoto();
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeListingModal() {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  currentModalListing = null;
  currentModalPhotoIndex = 0;
  modalImage.removeAttribute("src");
  modalThumbs.innerHTML = "";
}

function changeModalPhoto(direction) {
  if (!currentModalListing || currentModalListing.photos.length <= 1) {
    return;
  }

  const total = currentModalListing.photos.length;
  currentModalPhotoIndex = (currentModalPhotoIndex + direction + total) % total;
  renderModalPhoto();
}

function handleTouchStart(event) {
  if (!currentModalListing || currentModalListing.photos.length <= 1) {
    return;
  }

  const touch = event.changedTouches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchInProgress = true;
}

function handleTouchEnd(event) {
  if (!touchInProgress || !currentModalListing || currentModalListing.photos.length <= 1) {
    touchInProgress = false;
    return;
  }

  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;

  touchInProgress = false;

  if (Math.abs(deltaX) < 40 || Math.abs(deltaY) > Math.abs(deltaX) + 30) {
    return;
  }

  changeModalPhoto(deltaX < 0 ? 1 : -1);
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

modalClose.addEventListener("click", closeListingModal);
modalCloseSecondary.addEventListener("click", closeListingModal);
modalPrev.addEventListener("click", () => changeModalPhoto(-1));
modalNext.addEventListener("click", () => changeModalPhoto(1));
modalGalleryMain.addEventListener("touchstart", handleTouchStart, { passive: true });
modalGalleryMain.addEventListener("touchend", handleTouchEnd, { passive: true });
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeListingModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (modal.hidden) {
    return;
  }

  if (event.key === "Escape") {
    closeListingModal();
  } else if (event.key === "ArrowLeft") {
    changeModalPhoto(-1);
  } else if (event.key === "ArrowRight") {
    changeModalPhoto(1);
  }
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
