/**
 * UI state management: resolution presets, format selection, quality slider, transparency toggle,
 * background type and colour controls, watermark.
 */

export type WatermarkPosition =
  | "top-left" | "top-center" | "top-right"
  | "middle-left" | "middle-center" | "middle-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

export interface WatermarkSettings {
  enabled: boolean;
  text: string;
  position: WatermarkPosition;
  fontSize: number;
  color: string;
  opacity: number;
  padding: number;
}

export interface CaptureSettings {
  width: number;
  height: number;
  mimeType: "image/png" | "image/jpeg";
  quality: number;
  transparent: boolean;
  bgType: "solid" | "gradient";
  bgGradientDir: "horizontal" | "vertical";
  bgColor: string;
  bgColorFrom: string;
  bgColorTo: string;
  watermark: WatermarkSettings;
}

const presets: Record<string, [number, number]> = {
  "1280x720": [1280, 720],
  "1920x1080": [1920, 1080],
  "2560x1440": [2560, 1440],
  "3840x2160": [3840, 2160],
};

export function getCaptureSettings(): CaptureSettings {
  const w = document.getElementById("width-input") as HTMLInputElement;
  const h = document.getElementById("height-input") as HTMLInputElement;
  const formatEl = document.querySelector<HTMLInputElement>('input[name="format"]:checked');
  const qualityEl = document.getElementById("quality-slider") as HTMLInputElement;
  const transparentEl = document.getElementById("transparent-toggle") as HTMLInputElement;
  const bgTypeEl = document.querySelector<HTMLInputElement>('input[name="bg-type"]:checked');
  const bgGradientDirEl = document.querySelector<HTMLInputElement>('input[name="bg-gradient-dir"]:checked');
  const bgColorEl = document.getElementById("bg-color") as HTMLInputElement;
  const bgColorFromEl = document.getElementById("bg-color-from") as HTMLInputElement;
  const bgColorToEl = document.getElementById("bg-color-to") as HTMLInputElement;

  const wmToggle = document.getElementById("watermark-toggle") as HTMLInputElement;
  const wmText = document.getElementById("watermark-text") as HTMLInputElement;
  const wmPosBtn = document.querySelector<HTMLButtonElement>(".wm-pos-btn.wm-pos-active");
  const wmSize = document.getElementById("watermark-size") as HTMLInputElement;
  const wmColor = document.getElementById("watermark-color") as HTMLInputElement;
  const wmOpacity = document.getElementById("watermark-opacity") as HTMLInputElement;
  const wmPadding = document.getElementById("watermark-padding") as HTMLInputElement;

  return {
    width: Math.max(1, Math.min(8192, parseInt(w.value, 10) || 1920)),
    height: Math.max(1, Math.min(8192, parseInt(h.value, 10) || 1080)),
    mimeType: (formatEl?.value as CaptureSettings["mimeType"]) ?? "image/png",
    quality: parseInt(qualityEl.value, 10) / 100,
    transparent: transparentEl.checked,
    bgType: (bgTypeEl?.value as CaptureSettings["bgType"]) ?? "solid",
    bgGradientDir: (bgGradientDirEl?.value as CaptureSettings["bgGradientDir"]) ?? "horizontal",
    bgColor: bgColorEl.value,
    bgColorFrom: bgColorFromEl.value,
    bgColorTo: bgColorToEl.value,
    watermark: {
      enabled: wmToggle.checked,
      text: wmText.value,
      position: (wmPosBtn?.dataset.wmPos ?? "bottom-right") as WatermarkPosition,
      fontSize: Math.max(8, Math.min(512, parseInt(wmSize.value, 10) || 48)),
      color: wmColor.value,
      opacity: Math.max(0, Math.min(100, parseInt(wmOpacity.value, 10) || 80)) / 100,
      padding: Math.max(0, Math.min(512, parseInt(wmPadding.value, 10) || 32)),
    },
  };
}

function initPresets() {
  const select = document.getElementById("preset-select") as HTMLSelectElement;
  const widthInput = document.getElementById("width-input") as HTMLInputElement;
  const heightInput = document.getElementById("height-input") as HTMLInputElement;

  select.addEventListener("change", () => {
    const val = select.value;
    if (val === "custom") return;
    const res = presets[val];
    if (res) {
      widthInput.value = String(res[0]);
      heightInput.value = String(res[1]);
    }
  });

  // When user edits dimensions manually, switch preset to "custom"
  const markCustom = () => {
    const w = parseInt(widthInput.value, 10);
    const h = parseInt(heightInput.value, 10);
    const matchingPreset = Object.entries(presets).find(
      ([, [pw, ph]]) => pw === w && ph === h
    );
    select.value = matchingPreset ? matchingPreset[0] : "custom";
  };

  widthInput.addEventListener("input", markCustom);
  heightInput.addEventListener("input", markCustom);
}

function initFormatToggle() {
  const formatRadios = document.querySelectorAll<HTMLInputElement>('input[name="format"]');
  const qualityGroup = document.getElementById("quality-group")!;

  formatRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      qualityGroup.classList.toggle("hidden", radio.value !== "image/jpeg");
    });
  });
}

function initQualitySlider() {
  const slider = document.getElementById("quality-slider") as HTMLInputElement;
  const display = document.getElementById("quality-value")!;

  slider.addEventListener("input", () => {
    display.textContent = `${slider.value}%`;
  });
}

/** Applies the current background settings to the preview div behind the viewer. */
function applyBgPreview(): void {
  const bgDiv = document.getElementById("bg-preview")!;
  const viewer = document.getElementById("viewer")!;
  const settings = getCaptureSettings();

  if (settings.transparent) {
    // Show checkerboard on the viewer itself; clear the bg div
    viewer.classList.add("transparent-bg");
    bgDiv.style.backgroundColor = "";
    bgDiv.style.backgroundImage = "";
    return;
  }

  viewer.classList.remove("transparent-bg");
  // Keep viewer WebGL background transparent so the bg div shows through
  viewer.style.backgroundColor = "transparent";

  if (settings.bgType === "gradient") {
    bgDiv.style.backgroundColor = "";
    bgDiv.style.backgroundImage = `linear-gradient(${settings.bgGradientDir === "vertical" ? "to bottom" : "to right"}, ${settings.bgColorFrom}, ${settings.bgColorTo})`;
  } else {
    bgDiv.style.backgroundImage = "";
    bgDiv.style.backgroundColor = settings.bgColor;
  }
}

function initTransparencyToggle() {
  const toggle = document.getElementById("transparent-toggle") as HTMLInputElement;
  const bgControls = document.getElementById("bg-controls")!;

  const apply = () => {
    bgControls.classList.toggle("hidden", toggle.checked);
    applyBgPreview();
  };

  toggle.addEventListener("change", apply);
  apply();
}

function initBgControls() {
  const bgTypeRadios = document.querySelectorAll<HTMLInputElement>('input[name="bg-type"]');
  const solidControls = document.getElementById("bg-solid-controls")!;
  const gradientControls = document.getElementById("bg-gradient-controls")!;

  const applyType = () => {
    const val = document.querySelector<HTMLInputElement>('input[name="bg-type"]:checked')?.value;
    solidControls.classList.toggle("hidden", val !== "solid");
    gradientControls.classList.toggle("hidden", val !== "gradient");
    applyBgPreview();
  };

  bgTypeRadios.forEach((r) => r.addEventListener("change", applyType));

  // Live preview on direction or colour changes
  document.querySelectorAll<HTMLInputElement>('input[name="bg-gradient-dir"]').forEach((r) =>
    r.addEventListener("change", applyBgPreview),
  );
  document.getElementById("bg-color")!.addEventListener("input", applyBgPreview);
  document.getElementById("bg-color-from")!.addEventListener("input", applyBgPreview);
  document.getElementById("bg-color-to")!.addEventListener("input", applyBgPreview);
}

function initWatermark() {
  const toggle = document.getElementById("watermark-toggle") as HTMLInputElement;
  const controls = document.getElementById("watermark-controls")!;
  const opacitySlider = document.getElementById("watermark-opacity") as HTMLInputElement;
  const opacityDisplay = document.getElementById("watermark-opacity-value")!;
  const posBtns = document.querySelectorAll<HTMLButtonElement>(".wm-pos-btn");

  toggle.addEventListener("change", () => {
    controls.classList.toggle("hidden", !toggle.checked);
  });

  opacitySlider.addEventListener("input", () => {
    opacityDisplay.textContent = `${opacitySlider.value}%`;
  });

  posBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      posBtns.forEach((b) => b.classList.remove("wm-pos-active", "border-blue-500", "bg-blue-500/10"));
      btn.classList.add("wm-pos-active", "border-blue-500", "bg-blue-500/10");
    });
  });
}

export function initUI() {
  initPresets();
  initFormatToggle();
  initQualitySlider();
  initTransparencyToggle();
  initBgControls();
  initWatermark();
}
