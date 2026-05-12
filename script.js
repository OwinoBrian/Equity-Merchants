// WhatsApp contact number used across the site.
const WHATSAPP_NUMBER = "254759043208";

// Public API endpoint used by the site to load listings.
const LISTINGS_API_URL = "https://equity-merchants-listings.ujao.workers.dev";
const FEATURED_LISTINGS_LIMIT = 4;

const navLinks = document.getElementById("nav-links");
const menuToggle = document.getElementById("menu-toggle");
const contactForm = document.getElementById("contact-form");
const listingsState = document.getElementById("listings-state");
const listingsGrid = document.getElementById("listings-grid");
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

let currentModalListing = null;
let currentModalPhotoIndex = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchInProgress = false;

function buildWhatsAppUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
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
    priceValue: Number(fields.Price) || 0,
    price: formatKES(fields.Price),
    type: fields.Type || "House",
    description: fields.Description || "Contact us for more information about this property.",
    photos: photoField
      .map((item) => ({ url: item.url }))
      .filter((item) => item.url)
  };
}

function createListingCard(listing) {
  const message = `Hi, I am interested in ${listing.propertyName} listed on your website. Please share more details.`;
  const photoUrl = listing.photos[0] ? listing.photos[0].url : "";

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
  listingsState.hidden = false;
  listingsState.textContent = message;
}

function renderModalPhoto() {
  if (!currentModalListing) {
    return;
  }

  const photos = currentModalListing.photos;
  const activePhoto = photos[currentModalPhotoIndex];

  if (activePhoto) {
    modalImage.hidden = false;
    modalPlaceholder.hidden = true;
    modalImage.src = activePhoto.url;
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
    thumbButton.innerHTML = `<img src="${photo.url}" alt="${currentModalListing.propertyName} thumbnail ${index + 1}" loading="lazy" decoding="async">`;
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

    if (!listings.length) {
      showListingState("No listings available at the moment — check back soon. Contact us directly on WhatsApp for off-market properties.");
      return;
    }

    listingsGrid.innerHTML = "";
    listings.slice(0, FEATURED_LISTINGS_LIMIT).forEach((listing) => {
      listingsGrid.appendChild(createListingCard(listing));
    });

    listingsState.hidden = true;
    listingsGrid.hidden = false;
  } catch (error) {
    console.error("Unable to load Airtable listings:", error);
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
    "Hello Equity Merchants Ltd,",
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

menuToggle.addEventListener("click", () => toggleMenu());
document.addEventListener("click", (event) => {
  const clickedInsideMenu = navLinks.contains(event.target) || menuToggle.contains(event.target);
  if (!clickedInsideMenu) {
    toggleMenu(true);
  }
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

contactForm.addEventListener("submit", handleContactFormSubmit);

closeMenuOnNavigate();
setStaticWhatsAppLinks();
initRevealAnimations();
fetchListings();
