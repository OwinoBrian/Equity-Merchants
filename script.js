// WhatsApp contact number used across the site.
const WHATSAPP_NUMBER = "254759043208";

// Public API endpoint used by the site to load listings.
// Replace this with your deployed Cloudflare Worker URL.
const LISTINGS_API_URL = "https://equity-merchants-listings.ujao.workers.dev";

const navLinks = document.getElementById("nav-links");
const menuToggle = document.getElementById("menu-toggle");
const contactForm = document.getElementById("contact-form");
const loadingState = document.getElementById("listings-loading");
const listingsState = document.getElementById("listings-state");
const listingsGrid = document.getElementById("listings-grid");

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

function createListingCard(record) {
  const fields = record.fields || {};
  const propertyName = fields["Property Name"] || fields.Name || "Untitled Property";
  const location = fields.Location || "Location available on request";
  const price = formatKES(fields.Price);
  const type = fields.Type || "House";
  const description = fields.Description || "Contact us for more information about this property.";
  const photoUrl = fields.Photo && Array.isArray(fields.Photo) && fields.Photo[0] ? fields.Photo[0].url : "";
  const message = `Hi, I am interested in ${propertyName} listed on your website. Please share more details.`;

  const card = document.createElement("article");
  card.className = "card listing-card";

  card.innerHTML = `
    ${
      photoUrl
        ? `<div class="listing-image"><img src="${photoUrl}" alt="${propertyName}"></div>`
        : `<div class="listing-placeholder">${propertyName}</div>`
    }
    <div class="listing-content">
      <div class="listing-top">
        <span class="${getBadgeClass(type)}">${type}</span>
        <span class="listing-price">${price}</span>
      </div>
      <div>
        <h3>${propertyName}</h3>
        <p class="listing-meta">${location}</p>
      </div>
      <p class="listing-copy">${description}</p>
      <a
        class="btn btn-whatsapp"
        href="${buildWhatsAppUrl(message)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Inquire on WhatsApp
      </a>
    </div>
  `;

  return card;
}

function showListingState(message) {
  loadingState.hidden = true;
  listingsGrid.hidden = true;
  listingsState.hidden = false;
  listingsState.textContent = message;
}

async function fetchListings() {
  if (LISTINGS_API_URL.includes("YOUR_")) {
    showListingState("No listings available at the moment \u2014 check back soon. Contact us directly on WhatsApp for off-market properties.");
    return;
  }

  try {
    const response = await fetch(LISTINGS_API_URL, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Listings API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const activeRecords = Array.isArray(data.records) ? data.records : [];

    loadingState.hidden = true;

    if (!activeRecords.length) {
      showListingState("No listings available at the moment \u2014 check back soon. Contact us directly on WhatsApp for off-market properties.");
      return;
    }

    listingsGrid.innerHTML = "";
    activeRecords.forEach((record) => {
      listingsGrid.appendChild(createListingCard(record));
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

contactForm.addEventListener("submit", handleContactFormSubmit);

closeMenuOnNavigate();
setStaticWhatsAppLinks();
initRevealAnimations();
fetchListings();
