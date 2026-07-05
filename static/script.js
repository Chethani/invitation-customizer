const API_ENDPOINT = "/generate";
const PREVIEW_ENDPOINT = "/preview";

const form = document.querySelector("#generator-form");
const guestInput = document.querySelector("#guest-list");
const templateInput = document.querySelector("#template-image");
const submitButton = document.querySelector("#generate-button");
const result = document.querySelector("#result");
const resultTitle = document.querySelector("#result-title");
const retryButton = document.querySelector("#retry-button");
const templatePreview = document.querySelector("#template-preview");
const previewPlaceholder = document.querySelector("#preview-placeholder");
const nameCount = document.querySelector("#name-count strong");
const uploadError = document.querySelector("#upload-error");
let previewUrl;
let previewRequestController;

async function updateCustomizedPreview() {
  const guestFile = guestInput.files[0];
  const templateFile = templateInput.files[0];
  if (!guestFile || !templateFile) return;

  previewRequestController?.abort();
  previewRequestController = new AbortController();

  const formData = new FormData();
  formData.append("guest_list", guestFile);
  formData.append("invitation_template", templateFile);

  try {
    alert("Calling preview"); // temporary debugging

    const response = await fetch(PREVIEW_ENDPOINT, {
      method: "POST",
      body: formData,
      signal: previewRequestController.signal,
    });

    if (!response.ok) throw new Error(`Preview returned status ${response.status}.`);

    const previewImage = await response.blob();
    clearUploadError();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(previewImage);
    templatePreview.src = previewUrl;
    templatePreview.hidden = false;
    previewPlaceholder.hidden = true;
  } catch (error) {
    alert(error.name + ": " + error.message); // temporary debugging
    if (error.name !== "AbortError") showUploadError("Couldn’t generate the customized preview.");
  }
}

function clearUploadError() {
  uploadError.hidden = true;
  uploadError.textContent = "";
}

function showUploadError(message) {
  uploadError.textContent = message;
  uploadError.hidden = false;
}

function setDroppedFile(input, file) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function showSelectedFile(input, nameElementId) {
  const nameElement = document.querySelector(`#${nameElementId}`);
  const file = input.files[0];

  nameElement.textContent = file ? file.name : nameElement.dataset.defaultName;
  input.closest(".upload-card").classList.toggle("has-file", Boolean(file));
}

document.querySelector("#guest-file-name").dataset.defaultName = "Choose guest_list.txt";
document.querySelector("#template-file-name").dataset.defaultName = "Choose invitation_template.png";

guestInput.addEventListener("change", () => {
  clearUploadError();
  showSelectedFile(guestInput, "guest-file-name");
  const file = guestInput.files[0];

  if (!file) {
    nameCount.textContent = "0";
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const names = String(reader.result)
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean);
    nameCount.textContent = names.length;
  });
  reader.addEventListener("error", () => {
    nameCount.textContent = "—";
  });
  reader.readAsText(file);
  updateCustomizedPreview();
});

templateInput.addEventListener("change", () => {
  clearUploadError();
  showSelectedFile(templateInput, "template-file-name");
  const file = templateInput.files[0];

  if (previewUrl) URL.revokeObjectURL(previewUrl);

  if (!file) {
    templatePreview.hidden = true;
    templatePreview.removeAttribute("src");
    previewPlaceholder.hidden = false;
    previewUrl = undefined;
    return;
  }

  previewUrl = URL.createObjectURL(file);
  templatePreview.src = previewUrl;
  templatePreview.hidden = false;
  previewPlaceholder.hidden = true;
  updateCustomizedPreview();
});

function enableDropUpload(card, input, acceptsFile, errorMessage) {
  card.addEventListener("dragenter", (event) => {
    event.preventDefault();
    card.classList.add("drag-over");
  });

  card.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    card.classList.add("drag-over");
  });

  card.addEventListener("dragleave", (event) => {
    if (!card.contains(event.relatedTarget)) card.classList.remove("drag-over");
  });

  card.addEventListener("drop", (event) => {
    event.preventDefault();
    card.classList.remove("drag-over");

    const file = event.dataTransfer.files[0];
    if (!file || !acceptsFile(file)) {
      showUploadError(errorMessage);
      return;
    }

    clearUploadError();
    setDroppedFile(input, file);
  });
}

enableDropUpload(
  guestInput.closest(".upload-card"),
  guestInput,
  (file) => file.name.toLowerCase().endsWith(".txt"),
  "Please drop a valid .txt guest list.",
);

enableDropUpload(
  templateInput.closest(".upload-card"),
  templateInput,
  (file) => file.type.startsWith("image/"),
  "Please drop a valid image file, preferably a .png.",
);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.reportValidity()) return;

  submitButton.disabled = true;
  submitButton.hidden = true;
  result.className = "action-status loading";
  resultTitle.textContent = "Generating invitations...";
  retryButton.hidden = true;
  result.hidden = false;

  try {
    alert("Calling generate"); // temporary debugging

    const formData = new FormData();
    formData.append("guest_list", guestInput.files[0]);
    formData.append("invitation_template", templateInput.files[0]);

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`The generator returned status ${response.status}.`);
    }

    const zipFile = await response.blob();
    const downloadUrl = URL.createObjectURL(zipFile);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = "customized_invitations.zip";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

    result.className = "action-status success";
    resultTitle.textContent = "Your invitations are ready!";
    retryButton.hidden = true;
  } catch (error) {
    result.className = "action-status error";

    alert(error.name + ": " + error.message); // temporary debugging

    resultTitle.textContent = `${error.message} Make sure the FastAPI server is running.`;
    retryButton.textContent = "Try Again";
    retryButton.hidden = false;
  }
});

retryButton.addEventListener("click", () => {
  result.hidden = true;
  submitButton.hidden = false;
  submitButton.disabled = false;
  form.requestSubmit();
});
