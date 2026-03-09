/**
 * Screenshot capture: resize model-viewer to target resolution, capture via toBlob(), download.
 */

import { getModelViewer, hasModelLoaded } from "./viewer";
import { getCaptureSettings } from "./ui";

interface ModelViewerElement extends HTMLElement {
  toBlob: (options: {
    mimeType?: string;
    qualityArgument?: number;
    idealAspect?: boolean;
  }) => Promise<Blob>;
  updateComplete: Promise<void>;
  src: string;
}

async function captureScreenshot(): Promise<void> {
  if (!hasModelLoaded()) return;

  const viewer = getModelViewer() as unknown as ModelViewerElement;
  const settings = getCaptureSettings();
  const btn = document.getElementById("download-btn") as HTMLButtonElement;
  const btnText = document.getElementById("download-text")!;

  // Disable button during capture
  btn.disabled = true;
  btnText.textContent = "Capturing…";

  // Store original styles
  const origWidth = viewer.style.width;
  const origHeight = viewer.style.height;
  const origPosition = viewer.style.position;
  const origZIndex = viewer.style.zIndex;
  const origOpacity = viewer.style.opacity;
  const origBg = viewer.style.backgroundColor;

  try {
    // Handle transparent background for capture
    if (settings.transparent) {
      viewer.style.backgroundColor = "transparent";
    } else {
      viewer.style.backgroundColor = "#ffffff";
    }

    // Resize viewer to target resolution (off-screen technique: keep in DOM but make invisible)
    viewer.style.position = "fixed";
    viewer.style.zIndex = "-9999";
    viewer.style.opacity = "0";
    viewer.style.width = `${settings.width}px`;
    viewer.style.height = `${settings.height}px`;

    // Wait for model-viewer to re-render at new size
    await viewer.updateComplete;
    // Extra frame to ensure WebGL render completes
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    // Capture
    const blob = await viewer.toBlob({
      mimeType: settings.mimeType,
      qualityArgument: settings.mimeType === "image/jpeg" ? settings.quality : undefined,
      idealAspect: true,
    });

    // Download
    const ext = settings.mimeType === "image/jpeg" ? "jpg" : "png";
    const filename = `screenshot-${settings.width}x${settings.height}.${ext}`;
    downloadBlob(blob, filename);
  } finally {
    // Restore original styles
    viewer.style.width = origWidth;
    viewer.style.height = origHeight;
    viewer.style.position = origPosition;
    viewer.style.zIndex = origZIndex;
    viewer.style.opacity = origOpacity;
    viewer.style.backgroundColor = origBg;

    // Restore transparent mode if it was on
    const transparentEl = document.getElementById("transparent-toggle") as HTMLInputElement;
    if (transparentEl.checked) {
      viewer.style.backgroundColor = "transparent";
    }

    await viewer.updateComplete;

    btn.disabled = false;
    btnText.textContent = "Download Screenshot";
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function initCapture() {
  const btn = document.getElementById("download-btn")!;
  btn.addEventListener("click", () => {
    captureScreenshot();
  });
}
