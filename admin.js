// Replace these with the Airtable URLs you want the client to use.
const AIRTABLE_EDITOR_URL = "https://airtable.com/appwFq9FXqtf2cV6B/tbl7SBcj3I3jc0QbU";
const AIRTABLE_ADD_FORM_URL = "https://airtable.com/appwFq9FXqtf2cV6B/pagWEy5JYFErSCwn4/form";
const AIRTABLE_BASE_URL = "https://airtable.com/appwFq9FXqtf2cV6B";

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

applyAdminLink(editorLink, AIRTABLE_EDITOR_URL);
applyAdminLink(addLink, AIRTABLE_ADD_FORM_URL);
applyAdminLink(baseLink, AIRTABLE_BASE_URL);

if (
  !AIRTABLE_EDITOR_URL.includes("YOUR_") &&
  !AIRTABLE_ADD_FORM_URL.includes("YOUR_") &&
  !AIRTABLE_BASE_URL.includes("YOUR_")
) {
  adminNote.textContent = "This admin page is ready to share. Use it as the single bookmark for your client.";
}
