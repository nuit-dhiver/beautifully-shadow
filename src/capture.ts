/**
 * Screenshot capture: resize model-viewer to target resolution, capture via toBlob(), download.
 *
 * For non-transparent backgrounds (solid or gradient), the model is captured
 * with a transparent background then composited onto a canvas with the
 * background drawn first. This is necessary because model-viewer's toBlob()
 * only captures the WebGL canvas — CSS backgrounds are not included.
 */

import { getModelViewer, hasModelLoaded } from "./viewer";
import type { CaptureSettings } from "./ui";
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

  btn.disabled = true;
  btnText.textContent = "Capturing…";

  // Store original styles
  const origWidth = viewer.style.width;
  const origHeight = viewer.style.height;
  const origPosition = viewer.style.position;
  const origZIndex = viewer.style.zIndex;
  const origOpacity = viewer.style.opacity;
  const origBg = viewer.style.backgroundColor;
  const origBgImage = viewer.style.backgroundImage;

  try {
    const needsBg = !settings.transparent;

    // Resize viewer off-screen to target resolution
    viewer.style.position = "fixed";
    viewer.style.zIndex = "-9999";
    viewer.style.opacity = "0";
    viewer.style.width = `${settings.width}px`;
    viewer.style.height = `${settings.height}px`;

    // Always capture with transparent WebGL background;
    // backgrounds are composited onto a canvas afterwards
    viewer.style.backgroundColor = "transparent";
    viewer.style.backgroundImage = "";

    await viewer.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const blob = await viewer.toBlob({
      mimeType: needsBg ? "image/png" : settings.mimeType,
      qualityArgument: !needsBg && settings.mimeType === "image/jpeg" ? settings.quality : undefined,
      idealAspect: false,
    });

    const ext = settings.mimeType === "image/jpeg" ? "jpg" : "png";
    const filename = `screenshot-${settings.width}x${settings.height}.${ext}`;

    if (needsBg) {
      const composited = await compositeBackground(blob, settings);
      downloadBlob(composited, filename);
    } else {
      downloadBlob(blob, filename);
    }
  } finally {
    viewer.style.width = origWidth;
    viewer.style.height = origHeight;
    viewer.style.position = origPosition;
    viewer.style.zIndex = origZIndex;
    viewer.style.opacity = origOpacity;
    viewer.style.backgroundColor = origBg;
    viewer.style.backgroundImage = origBgImage;

    await viewer.updateComplete;

    btn.disabled = false;
    btnText.textContent = "Download Screenshot";
  }
}

async function compositeBackground(
  modelBlob: Blob,
  settings: CaptureSettings,
): Promise<Blob> {
  const { width, height } = settings;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Draw background
  if (settings.bgType === "gradient") {
    const grad = settings.bgGradientDir === "vertical"
      ? ctx.createLinearGradient(0, 0, 0, height)
      : ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, settings.bgColorFrom);
    grad.addColorStop(1, settings.bgColorTo);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = settings.bgColor;
  }
  ctx.fillRect(0, 0, width, height);

  // Draw model on top — blob matches the requested dimensions exactly
  const img = await createImageBitmap(modelBlob);
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
      settings.mimeType,
      settings.mimeType === "image/jpeg" ? settings.quality : undefined,
    );
  });
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
