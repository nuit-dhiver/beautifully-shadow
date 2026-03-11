/**
 * Screenshot capture: resize model-viewer to target resolution, capture via toBlob(), download.
 *
 * For solid backgrounds, model-viewer's backgroundColor is set before capture.
 * For gradient backgrounds, the model is captured with a transparent background
 * and then composited onto a canvas with the gradient drawn first.
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
    const needsGradient = !settings.transparent && settings.bgType === "gradient";

    // Resize viewer off-screen to target resolution
    viewer.style.position = "fixed";
    viewer.style.zIndex = "-9999";
    viewer.style.opacity = "0";
    viewer.style.width = `${settings.width}px`;
    viewer.style.height = `${settings.height}px`;

    if (settings.transparent || needsGradient) {
      // Transparent capture (gradient composites later; transparent just stays transparent)
      viewer.style.backgroundColor = "transparent";
      viewer.style.backgroundImage = "";
    } else {
      // Solid colour — model-viewer renders it directly into the WebGL canvas
      viewer.style.backgroundColor = settings.bgColor;
      viewer.style.backgroundImage = "";
    }

    await viewer.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const blob = await viewer.toBlob({
      mimeType: needsGradient ? "image/png" : settings.mimeType,
      qualityArgument: settings.mimeType === "image/jpeg" && !needsGradient ? settings.quality : undefined,
      idealAspect: true,
    });

    const ext = settings.mimeType === "image/jpeg" ? "jpg" : "png";
    const filename = `screenshot-${settings.width}x${settings.height}.${ext}`;

    if (needsGradient) {
      // Composite: draw gradient first, then the transparent model PNG on top
      const composited = await compositeGradient(blob, settings.width, settings.height, settings.bgColorFrom, settings.bgColorTo, settings.bgGradientDir, settings.mimeType, settings.quality);
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

async function compositeGradient(
  modelBlob: Blob,
  width: number,
  height: number,
  colorFrom: string,
  colorTo: string,
  dir: "horizontal" | "vertical",
  mimeType: string,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Draw gradient background — horizontal: left→right, vertical: top→bottom
  const grad = dir === "vertical"
    ? ctx.createLinearGradient(0, 0, 0, height)
    : ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, colorFrom);
  grad.addColorStop(1, colorTo);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Draw model PNG on top
  const img = await createImageBitmap(modelBlob);
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
      mimeType,
      mimeType === "image/jpeg" ? quality : undefined,
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
