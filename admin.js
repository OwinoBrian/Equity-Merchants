const editorLink = document.getElementById("airtable-editor-link");
const addLink = document.getElementById("airtable-add-link");
const baseLink = document.getElementById("airtable-base-link");
const adminNote = document.getElementById("admin-note");

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
  adminNote.textContent = "This admin page is ready to share. Use it as the single bookmark for your client.";
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
        const res = await fetch(getWorkerUrl(), {
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
