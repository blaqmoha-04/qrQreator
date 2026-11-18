const typeCards = [...document.querySelectorAll("[data-qr-type]")];
const stepButtons = [...document.querySelectorAll("[data-step-jump]")];
const workflowSteps = [...document.querySelectorAll("[data-step]")];
const contentForm = document.querySelector("#content-form");
const contentPanels = [...document.querySelectorAll("[data-content-panel]")];
const stepAnnouncement = document.querySelector("#step-announcement");
const wifiSecurity = document.querySelector("#wifi-security");
const wifiPasswordField = document.querySelector("#wifi-password-field");
const wifiPassword = document.querySelector("#wifi-password");
const foregroundColor = document.querySelector("#foreground-color");
const backgroundColor = document.querySelector("#background-color");
const sizeControl = document.querySelector("#qr-size");
const errorCorrection = document.querySelector("#error-correction");
const frameStyle = document.querySelector("#frame-style");
const logoUpload = document.querySelector("#logo-upload");
const logoSizeControl = document.querySelector("#logo-size");
const logoBackgroundShape = document.querySelector("#logo-background-shape");
const logoName = document.querySelector("#logo-name");
const logoFeedback = document.querySelector("#logo-feedback");
const logoFeedbackText = document.querySelector("#logo-feedback-text");
const logoLoadingIndicator = document.querySelector("#logo-loading-indicator");
const removeLogoButton = document.querySelector("#remove-logo");
const previewSheet = document.querySelector("#design-preview-sheet");
const qrPreviewImage = document.querySelector("#qr-preview-image");
const qrPreviewWrap = document.querySelector("#qr-preview-wrap");
const qrPreviewEmpty = document.querySelector("#qr-preview-empty");
const qrPreviewEmptyMessage = document.querySelector("#qr-preview-empty-message");
const previewStatus = document.querySelector("#design-preview-status");
const previewStatusDot = document.querySelector("#preview-status-dot");
const downloadButton = document.querySelector("#download-qr");
const downloadControl = document.querySelector(".download-control");
const downloadMenu = document.querySelector("#download-format-menu");
const downloadPngButton = document.querySelector("#download-png");
const downloadSvgButton = document.querySelector("#download-svg");
const downloadStatus = document.querySelector("#download-status");

const defaultDesign = {
  foreground: "#101522",
  background: "#ffffff",
  size: "256",
  errorCorrection: "M",
  errorCorrectionBeforeLogo: "",
  dotStyle: "square",
  cornerStyle: "square",
  frameStyle: "none",
  logoSize: "20",
  logoBackgroundShape: "square",
  logoFile: null,
  logoDataUrl: "",
};

const state = {
  currentStep: 1,
  qrType: "",
  contentValid: false,
  showValidationErrors: false,
  design: { ...defaultDesign },
};

let currentQrCode = null;
let currentQrSvg = "";
let logoLoadId = 0;

const stepNames = {
  1: "Choose a QR type",
  2: "Add your content",
  3: "Design your QR",
};

function getSelectedTypeCard() {
  return typeCards.find((card) => card.dataset.qrType === state.qrType);
}

function updateSelectedType() {
  typeCards.forEach((card) => {
    const isSelected = card.dataset.qrType === state.qrType;
    card.classList.toggle("is-selected", isSelected);
    card.setAttribute("aria-pressed", String(isSelected));
  });

  const selectedCard = getSelectedTypeCard();
  const typeName = selectedCard
    ? selectedCard.querySelector(".type-card-title").textContent
    : "Choose a type";

  document.querySelector("#selected-type-label").textContent = typeName;
  document.querySelector("#design-type-label").textContent = typeName;
  document.querySelector("#design-preview-type").textContent = typeName;

  const selectedIcon = selectedCard && selectedCard.querySelector("svg");
  ["#selected-type-icon", "#design-type-icon"].forEach((selector) => {
    const iconContainer = document.querySelector(selector);
    iconContainer.replaceChildren(
      selectedIcon ? selectedIcon.cloneNode(true) : document.createElement("span"),
    );
  });

  updateContentPanels();
  updateProgress();
  updateQrPreview();
}

function updateContentPanels() {
  contentPanels.forEach((panel) => {
    const isActive = panel.dataset.contentPanel === state.qrType;
    panel.hidden = !isActive;
    panel.querySelectorAll("input, textarea, select").forEach((field) => {
      field.disabled = !isActive;
    });
  });

  updateWifiPassword();
}

function updateWifiPassword() {
  if (!wifiSecurity || !wifiPassword || !wifiPasswordField) {
    return;
  }

  const isOpenNetwork = wifiSecurity.value === "nopass";
  wifiPasswordField.hidden = isOpenNetwork;
  wifiPassword.disabled = isOpenNetwork || state.qrType !== "wifi";
  wifiPassword.required = !isOpenNetwork;
}

function addValidationMessages() {
  contentForm.querySelectorAll("input, textarea, select").forEach((field) => {
    const errorMessage = document.createElement("span");
    errorMessage.className = "field-error";
    errorMessage.id = `${field.id}-error`;
    errorMessage.hidden = true;
    errorMessage.setAttribute("aria-live", "polite");
    field.closest(".form-field").append(errorMessage);
  });
}

function getFieldError(field) {
  const value = field.value.trim();

  if (field.required && !value) {
    return "This field is required.";
  }

  if (!value) {
    return "";
  }

  if (field.type === "url") {
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "Use a public link beginning with http:// or https://.";
      }
    } catch {
      return "Enter a complete link, including https://.";
    }
  }

  if (field.type === "email" && !field.validity.valid) {
    return "Enter a valid email address.";
  }

  if (field.type === "tel") {
    const digits = value.replace(/\D/g, "");
    if (!/^\+?[\d\s().-]+$/.test(value) || digits.length < 7 || digits.length > 15) {
      return "Enter a valid phone number, including the country code if needed.";
    }
  }

  return "";
}

function validateContent(showErrors) {
  if (!state.qrType) {
    state.contentValid = false;
    updateProgress();
    return false;
  }

  const activePanel = contentPanels.find(
    (panel) => panel.dataset.contentPanel === state.qrType,
  );
  const fields = [...activePanel.querySelectorAll("input, textarea, select")].filter(
    (field) => !field.disabled,
  );
  let firstInvalidField = null;

  fields.forEach((field) => {
    const errorMessage = field.closest(".form-field").querySelector(".field-error");
    const message = getFieldError(field);

    if (message) {
      firstInvalidField = firstInvalidField || field;
      if (showErrors) {
        errorMessage.textContent = message;
        errorMessage.hidden = false;
        field.setAttribute("aria-invalid", "true");
        field.setAttribute("aria-describedby", errorMessage.id);
      }
      return;
    }

    errorMessage.textContent = "";
    errorMessage.hidden = true;
    field.removeAttribute("aria-invalid");

    if (field.getAttribute("aria-describedby") === errorMessage.id) {
      field.removeAttribute("aria-describedby");
    }
  });

  state.contentValid = firstInvalidField === null;
  state.showValidationErrors = showErrors && !state.contentValid;
  updateProgress();

  if (!state.contentValid && showErrors) {
    firstInvalidField.focus();
  }

  return state.contentValid;
}

function getFieldValue(fieldId) {
  return document.querySelector(`#${fieldId}`).value.trim();
}

function escapeVCardText(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function escapeWifiValue(value) {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

function getPhoneNumber(fieldId) {
  return getFieldValue(fieldId).replace(/[^\d+]/g, "");
}

function buildQrPayload() {
  switch (state.qrType) {
    case "website":
      return getFieldValue("website-url");
    case "vcard": {
      const firstName = escapeVCardText(getFieldValue("vcard-first-name"));
      const lastName = escapeVCardText(getFieldValue("vcard-last-name"));
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${lastName};${firstName};;;`,
        `FN:${firstName} ${lastName}`,
      ];
      const email = getFieldValue("vcard-email");
      const phone = getFieldValue("vcard-phone");
      const organization = getFieldValue("vcard-organization");
      const website = getFieldValue("vcard-website");

      if (email) lines.push(`EMAIL:${escapeVCardText(email)}`);
      if (phone) lines.push(`TEL:${escapeVCardText(phone)}`);
      if (organization) lines.push(`ORG:${escapeVCardText(organization)}`);
      if (website) lines.push(`URL:${escapeVCardText(website)}`);
      lines.push("END:VCARD");
      return lines.join("\r\n");
    }
    case "wifi": {
      const security = wifiSecurity.value;
      const networkName = escapeWifiValue(getFieldValue("wifi-name"));
      const password = security === "nopass"
        ? ""
        : escapeWifiValue(getFieldValue("wifi-password"));
      return `WIFI:T:${security};S:${networkName};P:${password};;`;
    }
    case "pdf":
      return getFieldValue("pdf-url");
    case "social":
      return getFieldValue("social-url");
    case "image":
      return getFieldValue("image-url");
    case "video":
      return getFieldValue("video-url");
    case "text":
      return getFieldValue("plain-text");
    case "email": {
      const address = getFieldValue("email-address");
      const parameters = new URLSearchParams();
      const subject = getFieldValue("email-subject");
      const message = getFieldValue("email-message");
      if (subject) parameters.set("subject", subject);
      if (message) parameters.set("body", message);
      const query = parameters.toString();
      return `mailto:${address}${query ? `?${query}` : ""}`;
    }
    case "phone":
      return `tel:${getPhoneNumber("phone-number")}`;
    case "sms": {
      const number = getPhoneNumber("sms-number");
      const message = getFieldValue("sms-message");
      return `sms:${number}${message ? `?body=${encodeURIComponent(message)}` : ""}`;
    }
    case "location":
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        getFieldValue("location-address"),
      )}`;
    default:
      throw new Error("Choose a supported QR type before generating a code.");
  }
}

function setPreviewMessage(message, status = "Waiting for valid content", statusType = "") {
  currentQrCode = null;
  currentQrSvg = "";
  qrPreviewWrap.hidden = true;
  qrPreviewImage.hidden = true;
  qrPreviewImage.removeAttribute("src");
  qrPreviewImage.alt = "";
  qrPreviewEmpty.hidden = false;
  qrPreviewEmptyMessage.textContent = message;
  previewStatus.textContent = status;
  previewStatusDot.className = "preview-status-dot";
  downloadButton.disabled = true;
  downloadStatus.textContent = "";
  closeDownloadMenu();
  if (statusType) {
    previewStatusDot.classList.add(`is-${statusType}`);
  }
}

function closeDownloadMenu() {
  downloadMenu.hidden = true;
  downloadButton.setAttribute("aria-expanded", "false");
}

function openDownloadMenu() {
  if (downloadButton.disabled) {
    return;
  }

  downloadMenu.hidden = false;
  downloadButton.setAttribute("aria-expanded", "true");
  downloadPngButton.focus();
}

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character];
  });
}

function setLogoFeedback(message, isLoading = false) {
  logoFeedbackText.textContent = message;
  logoLoadingIndicator.hidden = !isLoading;
  logoFeedback.setAttribute("aria-busy", String(isLoading));
  logoUpload.disabled = isLoading;
}

function getLogoBounds(size, logoSizePercentage = state.design.logoSize) {
  const logoSize = size * (Number(logoSizePercentage) / 100);
  const padding = size * 0.01;
  const backgroundSize = logoSize + padding * 2;
  return {
    logoSize,
    backgroundSize,
    backgroundX: (size - backgroundSize) / 2,
    backgroundY: (size - backgroundSize) / 2,
    logoX: (size - logoSize) / 2,
    logoY: (size - logoSize) / 2,
  };
}

function createQrSvg(qr, size) {
  const moduleCount = qr.getModuleCount();
  const quietZone = 4;
  const viewSize = moduleCount + quietZone * 2;
  const foreground = escapeXml(state.design.foreground);
  const background = escapeXml(state.design.background);
  const pathParts = [];

  for (let row = 0; row < moduleCount; row += 1) {
    let column = 0;
    while (column < moduleCount) {
      if (!qr.isDark(row, column)) {
        column += 1;
        continue;
      }

      const start = column;
      while (column < moduleCount && qr.isDark(row, column)) {
        column += 1;
      }
      const runLength = column - start;
      pathParts.push(
        `M${start + quietZone} ${row + quietZone}h${runLength}v1h-${runLength}z`,
      );
    }
  }

  let logoMarkup = "";
  if (state.design.logoDataUrl) {
    const bounds = getLogoBounds(viewSize);
    const logoData = escapeXml(state.design.logoDataUrl);
    const logoBackground = state.design.logoBackgroundShape === "circle"
      ? `<circle cx="${viewSize / 2}" cy="${viewSize / 2}" r="${bounds.backgroundSize / 2}" fill="${background}"/>`
      : `<rect x="${bounds.backgroundX}" y="${bounds.backgroundY}" width="${bounds.backgroundSize}" height="${bounds.backgroundSize}" fill="${background}"/>`;
    logoMarkup = `
      ${logoBackground}
      <image href="${logoData}" xlink:href="${logoData}" x="${bounds.logoX}" y="${bounds.logoY}" width="${bounds.logoSize}" height="${bounds.logoSize}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${viewSize} ${viewSize}" shape-rendering="crispEdges" role="img" aria-labelledby="qr-title">
    <title id="qr-title">Qreator QR code</title>
    <rect width="${viewSize}" height="${viewSize}" fill="${background}"/>
    <path d="${pathParts.join("")}" fill="${foreground}" stroke="none" shape-rendering="crispEdges"/>
    ${logoMarkup}
  </svg>`;
}

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function createPngBlob(qr, size, design) {
  return new Promise((resolve, reject) => {
    const moduleCount = qr.getModuleCount();
    const quietZone = 4;
    const viewSize = moduleCount + quietZone * 2;
    const pixelsPerModule = size / viewSize;
    if (pixelsPerModule < 2) {
      reject(new Error("Increase the QR size or shorten the content before downloading."));
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("Your browser could not prepare the PNG image."));
      return;
    }

    context.fillStyle = design.background;
    context.fillRect(0, 0, size, size);
    context.fillStyle = design.foreground;

    for (let row = 0; row < moduleCount; row += 1) {
      for (let column = 0; column < moduleCount; column += 1) {
        if (qr.isDark(row, column)) {
          const x = Math.floor(((column + quietZone) * size) / viewSize);
          const y = Math.floor(((row + quietZone) * size) / viewSize);
          const right = Math.floor(((column + quietZone + 1) * size) / viewSize);
          const bottom = Math.floor(((row + quietZone + 1) * size) / viewSize);
          context.fillRect(x, y, right - x, bottom - y);
        }
      }
    }

    const finishPng = () => {
      try {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Your browser could not create the PNG download."));
            return;
          }
          resolve(blob);
        }, "image/png");
      } catch (error) {
        reject(error instanceof Error
          ? error
          : new Error("Your browser could not create the PNG download."));
      }
    };

    if (!design.logoDataUrl) {
      finishPng();
      return;
    }

    loadLogoImage(design.logoDataUrl).then((logoImage) => {
      const bounds = getLogoBounds(viewSize, design.logoSize);
      const scale = size / viewSize;
      const backgroundX = bounds.backgroundX * scale;
      const backgroundY = bounds.backgroundY * scale;
      const backgroundSize = bounds.backgroundSize * scale;
      const logoX = bounds.logoX * scale;
      const logoY = bounds.logoY * scale;
      const logoSize = bounds.logoSize * scale;
      const fitScale = Math.min(
        logoSize / logoImage.naturalWidth,
        logoSize / logoImage.naturalHeight,
      );
      const drawnWidth = logoImage.naturalWidth * fitScale;
      const drawnHeight = logoImage.naturalHeight * fitScale;
      const drawnX = logoX + (logoSize - drawnWidth) / 2;
      const drawnY = logoY + (logoSize - drawnHeight) / 2;

      try {
        context.fillStyle = design.background;
        if (design.logoBackgroundShape === "circle") {
          context.beginPath();
          context.arc(
            backgroundX + backgroundSize / 2,
            backgroundY + backgroundSize / 2,
            backgroundSize / 2,
            0,
            Math.PI * 2,
          );
          context.fill();
        } else {
          context.fillRect(backgroundX, backgroundY, backgroundSize, backgroundSize);
        }
        context.drawImage(logoImage, drawnX, drawnY, drawnWidth, drawnHeight);
        finishPng();
      } catch (error) {
        reject(error instanceof Error
          ? error
          : new Error("The selected logo could not be added to the PNG."));
      }
    }).catch((error) => {
      reject(error instanceof Error
        ? error
        : new Error("The selected logo could not be added to the PNG."));
    });
  });
}

async function downloadQr(format) {
  if (!currentQrCode) {
    return;
  }

  const qr = currentQrCode;
  const svg = currentQrSvg;
  const design = { ...state.design };

  try {
    const size = Number(design.size);
    let blob;
    if (format === "svg") {
      blob = new Blob([svg], {
        type: "image/svg+xml;charset=utf-8",
      });
    } else if (format === "png") {
      blob = await createPngBlob(qr, size, design);
    } else {
      throw new Error("Choose PNG or SVG to download your QR code.");
    }

    downloadBlob(blob, `qreator-qr-code.${format}`);
    downloadStatus.textContent = `${format.toUpperCase()} download started. Check your downloads.`;
    closeDownloadMenu();
    downloadButton.focus();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    downloadStatus.textContent = `Download failed: ${message}`;
  }
}

function updateQrPreview() {
  if (!state.qrType) {
    setPreviewMessage("Choose a type and add valid content to create your QR code.");
    return;
  }

  if (!state.contentValid) {
    setPreviewMessage(
      "Complete the required fields with valid details to see your QR code.",
      "Waiting for valid content",
    );
    return;
  }

  try {
    if (typeof qrcode !== "function") {
      throw new Error("The QR generator did not load. Refresh the page and try again.");
    }

    const qr = qrcode(0, state.design.errorCorrection);
    qr.addData(buildQrPayload(), "Byte");
    qr.make();

    currentQrCode = qr;
    currentQrSvg = createQrSvg(qr, Number(state.design.size));
    qrPreviewImage.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(currentQrSvg)}`;
    qrPreviewImage.alt = `Scannable ${getSelectedTypeCard()
      .querySelector(".type-card-title").textContent} QR code`;
    qrPreviewEmpty.hidden = true;
    qrPreviewWrap.hidden = false;
    qrPreviewImage.hidden = false;
    downloadButton.disabled = false;
    downloadStatus.textContent = "";

    const displayedSize = Math.min(Number(state.design.size), 256);
    qrPreviewImage.style.width = `${displayedSize}px`;
    const modulesWithQuietZone = qr.getModuleCount() + 8;
    const pixelsPerModule = Number(state.design.size) / modulesWithQuietZone;
    if (pixelsPerModule < 2) {
      previewStatus.textContent =
        "QR code generated; increase the size or shorten the content for easier scanning";
      previewStatusDot.className = "preview-status-dot is-warning";
      return;
    }

    previewStatus.textContent = "Scannable QR code ready";
    previewStatusDot.className = "preview-status-dot is-ready";
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isCapacityError = errorMessage.includes("code length overflow");
    setPreviewMessage(
      isCapacityError
        ? "This content is too long for the selected error-correction level. Shorten it or choose a lower level."
        : errorMessage,
      "Unable to generate QR code",
      "error",
    );
  }
}

function clearValidationErrors() {
  contentForm.querySelectorAll("[aria-invalid]").forEach((field) => {
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
  });
  contentForm.querySelectorAll(".field-error").forEach((message) => {
    message.textContent = "";
    message.hidden = true;
  });
}

function updateProgress() {
  stepButtons.forEach((button) => {
    const stepNumber = Number(button.dataset.stepJump);
    const isCurrent = stepNumber === state.currentStep;
    const isComplete =
      stepNumber < state.currentStep ||
      (stepNumber === 1 && Boolean(state.qrType)) ||
      (stepNumber === 2 && state.contentValid);

    if (stepNumber === 2) {
      button.disabled = !state.qrType;
    } else if (stepNumber === 3) {
      button.disabled = !state.contentValid;
    } else {
      button.disabled = false;
    }

    button.classList.toggle("is-active", isCurrent);
    button.classList.toggle("is-complete", isComplete && !isCurrent);

    if (isCurrent) {
      button.setAttribute("aria-current", "step");
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

function showStep(stepNumber) {
  if (stepNumber < 1 || stepNumber > 3) {
    return;
  }
  if (stepNumber >= 2 && !state.qrType) {
    return;
  }
  if (stepNumber === 3 && !validateContent(true)) {
    return;
  }

  state.currentStep = stepNumber;
  workflowSteps.forEach((step) => {
    step.hidden = Number(step.dataset.step) !== stepNumber;
  });

  stepAnnouncement.textContent = `Step ${stepNumber} of 3 — ${stepNames[stepNumber]}.`;
  updateProgress();
  updateSelectedType();

  const heading = document.querySelector(`[data-step="${stepNumber}"] h2`);
  heading.focus({ preventScroll: true });
  document.querySelector(".studio-heading").scrollIntoView({ block: "start" });
}

function updateStyleSelection(groupName, value) {
  state.design[groupName] = value;

  document.querySelectorAll(`[data-option-group="${groupName}"]`).forEach((button) => {
    const isSelected = button.dataset.optionValue === value;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  updateDesignSummary();
}

function updateDesignSummary() {
  const dotNames = {
    square: "Square dots",
    rounded: "Rounded dots",
    dots: "Circular dots",
  };
  const cornerNames = {
    square: "Square corners",
    rounded: "Rounded corners",
  };
  const frameNames = {
    none: "No frame",
    outline: "Simple outline",
    caption: "Caption space",
  };

  document.querySelector("#design-style-summary").textContent =
    `${dotNames[state.design.dotStyle]} · ${cornerNames[state.design.cornerStyle]} · ${frameNames[state.design.frameStyle]}`;
}

function updateColorControl(input, output, stateKey, updatePreview) {
  const color = input.value.toUpperCase();
  state.design[stateKey] = color.toLowerCase();
  output.value = color;
  output.textContent = color;

  if (updatePreview) {
    previewSheet.style.backgroundColor = color;
  }
}

function resetDesign() {
  logoLoadId += 1;
  Object.assign(state.design, defaultDesign);

  foregroundColor.value = defaultDesign.foreground;
  backgroundColor.value = defaultDesign.background;
  sizeControl.value = defaultDesign.size;
  errorCorrection.value = defaultDesign.errorCorrection;
  frameStyle.value = defaultDesign.frameStyle;
  logoSizeControl.value = defaultDesign.logoSize;
  logoSizeControl.disabled = true;
  logoBackgroundShape.value = defaultDesign.logoBackgroundShape;
  logoBackgroundShape.disabled = true;
  logoUpload.value = "";
  errorCorrection.disabled = false;
  logoName.textContent = "Add a logo";
  setLogoFeedback("Add a small logo to the centre of your QR code.");
  removeLogoButton.hidden = true;

  updateColorControl(
    foregroundColor,
    document.querySelector("#foreground-value"),
    "foreground",
    false,
  );
  updateColorControl(
    backgroundColor,
    document.querySelector("#background-value"),
    "background",
    true,
  );
  updateRangeOutput(sizeControl, document.querySelector("#size-value"), "size", " px");
  updateRangeOutput(
    logoSizeControl,
    document.querySelector("#logo-size-value"),
    "logoSize",
    "%",
  );
  updateStyleSelection("dotStyle", defaultDesign.dotStyle);
  updateStyleSelection("cornerStyle", defaultDesign.cornerStyle);
  updateDesignSummary();
}

function updateRangeOutput(input, output, stateKey, suffix) {
  state.design[stateKey] = input.value;
  output.value = `${input.value}${suffix}`;
  output.textContent = `${input.value}${suffix}`;
}

typeCards.forEach((card) => {
  card.addEventListener("click", () => {
    state.qrType = card.dataset.qrType;
    state.contentValid = false;
    state.showValidationErrors = false;
    clearValidationErrors();
    showStep(2);
  });
});

document.querySelector("#content-next").addEventListener("click", () => {
  if (validateContent(true)) {
    showStep(3);
  }
});

document.querySelectorAll("[data-step-back]").forEach((button) => {
  button.addEventListener("click", () => showStep(state.currentStep - 1));
});

stepButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetStep = Number(button.dataset.stepJump);
    if (targetStep < state.currentStep || targetStep === state.currentStep) {
      showStep(targetStep);
    } else if (targetStep === 2 && state.qrType) {
      showStep(2);
    } else if (targetStep === 3 && state.contentValid) {
      showStep(3);
    }
  });
});

contentForm.addEventListener("input", () => {
  validateContent(state.showValidationErrors);
  updateQrPreview();
});

contentForm.addEventListener("change", () => {
  validateContent(state.showValidationErrors);
  updateQrPreview();
});

wifiSecurity.addEventListener("change", () => {
  updateWifiPassword();
  validateContent(state.showValidationErrors);
  updateQrPreview();
});

foregroundColor.addEventListener("input", () => {
  updateColorControl(
    foregroundColor,
    document.querySelector("#foreground-value"),
    "foreground",
    false,
  );
  updateQrPreview();
});

backgroundColor.addEventListener("input", () => {
  updateColorControl(
    backgroundColor,
    document.querySelector("#background-value"),
    "background",
    true,
  );
  updateQrPreview();
});

sizeControl.addEventListener("input", () => {
  updateRangeOutput(sizeControl, document.querySelector("#size-value"), "size", " px");
  updateQrPreview();
});

logoSizeControl.addEventListener("input", () => {
  updateRangeOutput(
    logoSizeControl,
    document.querySelector("#logo-size-value"),
    "logoSize",
    "%",
  );
  updateQrPreview();
});

logoBackgroundShape.addEventListener("change", () => {
  state.design.logoBackgroundShape = logoBackgroundShape.value;
  updateQrPreview();
});

errorCorrection.addEventListener("change", () => {
  state.design.errorCorrection = errorCorrection.value;
  updateQrPreview();
});

frameStyle.addEventListener("change", () => {
  state.design.frameStyle = frameStyle.value;
  updateDesignSummary();
});

document.querySelectorAll("[data-option-group]").forEach((button) => {
  button.addEventListener("click", () => {
    updateStyleSelection(button.dataset.optionGroup, button.dataset.optionValue);
  });
});

logoUpload.addEventListener("change", async () => {
  const [file] = logoUpload.files;

  if (!file) {
    return;
  }

  const mimeType = getLogoMimeType(file);
  if (!mimeType || file.size > 2 * 1024 * 1024) {
    logoUpload.value = "";
    setLogoFeedback("Choose a PNG, JPG, or SVG file up to 2 MB.");
    return;
  }

  const requestId = ++logoLoadId;
  setLogoFeedback("Loading logo…", true);
  try {
    const logoDataUrl = await readFileAsDataUrl(file, mimeType);
    const logoImage = await loadLogoImage(logoDataUrl);
    if (requestId !== logoLoadId) {
      return;
    }

    if (!state.design.logoDataUrl) {
      state.design.errorCorrectionBeforeLogo = state.design.errorCorrection;
    }
    state.design.logoFile = file;
    state.design.logoDataUrl = logoDataUrl;
    state.design.errorCorrection = "H";
    errorCorrection.value = "H";
    errorCorrection.disabled = true;
    logoSizeControl.disabled = false;
    logoBackgroundShape.disabled = false;
    logoName.textContent = file.name;
    logoUpload.value = "";
    removeLogoButton.hidden = false;
    updateQrPreview();
    if (requestId !== logoLoadId) {
      return;
    }
    setLogoFeedback(
      `Logo added (${logoImage.naturalWidth} × ${logoImage.naturalHeight}). High error correction is on.`,
    );
  } catch (error) {
    if (requestId !== logoLoadId) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    logoUpload.value = "";
    setLogoFeedback(`Could not load logo: ${message}`);
  } finally {
    if (requestId === logoLoadId) {
      logoLoadingIndicator.hidden = true;
      logoFeedback.setAttribute("aria-busy", "false");
      logoUpload.disabled = false;
    }
  }
});

function getLogoMimeType(file) {
  const mimeTypes = {
    "image/png": "image/png",
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/svg+xml": "image/svg+xml",
  };
  const extension = file.name.split(".").pop().toLowerCase();
  const extensionTypes = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    svg: "image/svg+xml",
  };
  return mimeTypes[file.type.toLowerCase()] || extensionTypes[extension] || "";
}

function readFileAsDataUrl(file, mimeType) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        reject(new Error("The selected logo could not be read."));
        return;
      }
      resolve(reader.result);
    }, { once: true });
    reader.addEventListener("error", () => {
      reject(new Error("The selected logo could not be read."));
    }, { once: true });
    const imageFile = file.type === mimeType
      ? file
      : file.slice(0, file.size, mimeType);
    reader.readAsDataURL(imageFile);
  });
}

async function loadLogoImage(dataUrl) {
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener(
      "error",
      () => reject(new Error("The selected file could not be decoded as an image.")),
      { once: true },
    );
    image.src = dataUrl;
  });

  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error("The selected file has no readable image dimensions.");
  }
  return image;
}

removeLogoButton.addEventListener("click", () => {
  logoLoadId += 1;
  state.design.logoFile = null;
  state.design.logoDataUrl = "";
  state.design.logoBackgroundShape = defaultDesign.logoBackgroundShape;
  logoUpload.value = "";
  logoSizeControl.disabled = true;
  logoBackgroundShape.value = defaultDesign.logoBackgroundShape;
  logoBackgroundShape.disabled = true;
  logoName.textContent = "Add a logo";
  setLogoFeedback("Logo removed.");
  removeLogoButton.hidden = true;

  if (state.design.errorCorrectionBeforeLogo) {
    state.design.errorCorrection = state.design.errorCorrectionBeforeLogo;
    errorCorrection.value = state.design.errorCorrection;
    state.design.errorCorrectionBeforeLogo = "";
  }
  errorCorrection.disabled = false;
  updateQrPreview();
});

downloadButton.addEventListener("click", () => {
  if (downloadMenu.hidden) {
    openDownloadMenu();
  } else {
    closeDownloadMenu();
  }
});

downloadPngButton.addEventListener("click", () => downloadQr("png"));
downloadSvgButton.addEventListener("click", () => downloadQr("svg"));

document.addEventListener("pointerdown", (event) => {
  if (!downloadControl.contains(event.target)) {
    closeDownloadMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !downloadMenu.hidden) {
    closeDownloadMenu();
    downloadButton.focus();
  }
});

document.querySelector("#reset-studio").addEventListener("click", () => {
  contentForm.reset();
  typeCards.forEach((card) => {
    card.classList.remove("is-selected");
    card.setAttribute("aria-pressed", "false");
  });

  state.qrType = "";
  state.contentValid = false;
  state.showValidationErrors = false;
  clearValidationErrors();

  resetDesign();
  showStep(1);
});

addValidationMessages();
resetDesign();
updateSelectedType();
