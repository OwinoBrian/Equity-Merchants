const editorLink = document.getElementById("airtable-editor-link");
const addLink = document.getElementById("airtable-add-link");
const baseLink = document.getElementById("airtable-base-link");
const adminNote = document.getElementById("admin-note");
const navLinks = document.getElementById("nav-links");
const menuToggle = document.getElementById("menu-toggle");

function applyAdminLink(element, url) {
  if (!element) {
    return;
  }

  if (!url || url.includes("YOUR_")) {
    element.setAttribute("aria-disabled", "true");
    element.removeAttribute("target");
    element.removeAttribute("rel");
    element.href = "#";
    return;
  }

  element.href = url;
}

applyAdminLink(editorLink, APP_CONFIG.airtableEditorUrl);
applyAdminLink(addLink, APP_CONFIG.airtableAddFormUrl);
applyAdminLink(baseLink, APP_CONFIG.airtableBaseUrl);

if (
  !APP_CONFIG.airtableEditorUrl.includes("YOUR_") &&
  !APP_CONFIG.airtableAddFormUrl.includes("YOUR_") &&
  !APP_CONFIG.airtableBaseUrl.includes("YOUR_")
) {
  adminNote.textContent = "Use the links above to keep the listing data up to date.";
}

// Pending submissions UI
const retryBtn = document.getElementById('retry-pending-btn');
const pendingCountEl = document.getElementById('pending-count');

function pendingKey() { return 'pendingSubmissions'; }

function updatePendingCount() {
  try {
    const list = JSON.parse(localStorage.getItem(pendingKey()) || '[]');
    pendingCountEl.textContent = `${list.length} pending`;
  } catch (e) {
    pendingCountEl.textContent = '0 pending';
  }
}

async function retryPending() {
  try {
    const list = JSON.parse(localStorage.getItem(pendingKey()) || '[]');
    if (!list.length) return alert('No pending submissions');

    const remaining = [];
    for (const item of list) {
      try {
        const res = await fetch(getListingsApiUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload)
        });
        if (!res.ok) throw new Error('Retry failed');
      } catch (err) {
        remaining.push(item);
      }
    }

    localStorage.setItem(pendingKey(), JSON.stringify(remaining));
    updatePendingCount();
    alert(`Retry complete. ${remaining.length} still pending.`);
  } catch (e) {
    console.error(e);
    alert('Retry failed — check the console.');
  }
}

if (retryBtn) {
  retryBtn.addEventListener('click', retryPending);
}

updatePendingCount();

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

if (menuToggle) {
  menuToggle.addEventListener("click", () => toggleMenu());
}

if (navLinks) {
  navLinks.querySelectorAll("a, button").forEach((link) => {
    link.addEventListener("click", () => toggleMenu(true));
  });
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
