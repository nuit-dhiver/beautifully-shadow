/**
 * UI state management: resolution presets, format selection, quality slider, transparency toggle.
 */

export interface CaptureSettings {
  width: number;
  height: number;
  mimeType: "image/png" | "image/jpeg";
  quality: number;
  transparent: boolean;
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

  return {
    width: Math.max(1, Math.min(8192, parseInt(w.value, 10) || 1920)),
    height: Math.max(1, Math.min(8192, parseInt(h.value, 10) || 1080)),
    mimeType: (formatEl?.value as CaptureSettings["mimeType"]) ?? "image/png",
    quality: parseInt(qualityEl.value, 10) / 100,
    transparent: transparentEl.checked,
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

function initTransparencyToggle() {
  const toggle = document.getElementById("transparent-toggle") as HTMLInputElement;
  const viewer = document.getElementById("viewer")!;

  const apply = () => {
    viewer.classList.toggle("transparent-bg", toggle.checked);
    viewer.style.backgroundColor = toggle.checked ? "transparent" : "";
  };

  toggle.addEventListener("change", apply);
  // Apply initial state
  apply();
}

export function initUI() {
  initPresets();
  initFormatToggle();
  initQualitySlider();
  initTransparencyToggle();
}
