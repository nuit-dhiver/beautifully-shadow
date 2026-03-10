/**
 * View mode management: Default (PBR), Matcap (clay-like), Mesh (wireframe).
 *
 * Matcap and Mesh modes access model-viewer's internal Three.js scene by
 * locating the ModelScene instance stored at the private $scene symbol on
 * the element. The symbol is found via Object.getOwnPropertySymbols()
 * so no internal module imports are needed.
 */

import { CanvasTexture, Color, MeshBasicMaterial, MeshMatcapMaterial } from "three";
import { getModelViewer, hasModelLoaded } from "./viewer";

export type ViewMode = "default" | "matcap" | "mesh";

let currentMode: ViewMode = "default";

interface StoredMeshState {
  material: unknown;
  castShadow: boolean;
  receiveShadow: boolean;
}

// mesh node (any) → original state before override
const storedMeshState = new Map<object, StoredMeshState>();

// ── Three.js scene access ──────────────────────────────────────────────────

/** Returns the Three.js root Object3D from model-viewer's internal ModelScene. */
function getThreeScene(): { traverse: (cb: (node: unknown) => void) => void } | null {
  const mv = getModelViewer() as unknown as object;
  // model-viewer stores its ModelScene at a symbol keyed as Symbol('scene').
  for (const sym of Object.getOwnPropertySymbols(mv)) {
    if (sym.description === "scene") {
      const modelScene = (mv as Record<symbol, { model: unknown }>)[sym];
      const model = modelScene?.model;
      if (model && typeof (model as { traverse?: unknown }).traverse === "function") {
        return model as { traverse: (cb: (node: unknown) => void) => void };
      }
    }
  }
  return null;
}

// ── Matcap texture ─────────────────────────────────────────────────────────

let cachedMatcapTexture: CanvasTexture | null = null;
let cachedMatcapHex: string = "";

function buildMatcapTexture(hex: string): CanvasTexture {
  if (cachedMatcapTexture && cachedMatcapHex === hex) return cachedMatcapTexture;

  const col = new Color(hex);
  const r = col.r, g = col.g, b = col.b;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Dark outer ring — tinted to match the colour
  const darkR = Math.round(r * 10), darkG = Math.round(g * 10), darkB = Math.round(b * 10);
  ctx.fillStyle = `rgb(${darkR},${darkG},${darkB})`;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Main radial gradient — upper-left highlight, lower-right shadow, tinted
  const grad = ctx.createRadialGradient(
    size * 0.36, size * 0.32, size * 0.02,
    size * 0.5,  size * 0.5,  size * 0.52,
  );

  const stop = (t: number): string => {
    const v = Math.round(t * 255);
    return `rgb(${Math.round(v * r)},${Math.round(v * g)},${Math.round(v * b)})`;
  };

  grad.addColorStop(0,    stop(0.95));
  grad.addColorStop(0.18, stop(0.87));
  grad.addColorStop(0.5,  stop(0.56));
  grad.addColorStop(0.78, stop(0.24));
  grad.addColorStop(1,    stop(0.04));

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fill();

  cachedMatcapTexture = new CanvasTexture(canvas);
  cachedMatcapHex = hex;
  return cachedMatcapTexture;
}

// ── Settings readers ───────────────────────────────────────────────────────

function getMatcapColor(): string {
  return (document.getElementById("matcap-color") as HTMLInputElement).value;
}

function getMatcapFlatShading(): boolean {
  return (document.getElementById("matcap-flat-shading") as HTMLInputElement).checked;
}

function getMeshColor(): string {
  return (document.getElementById("mesh-color") as HTMLInputElement).value;
}

// ── Shadow management ──────────────────────────────────────────────────────

let storedShadowIntensity: string | null = null;

function disableViewerShadow(): void {
  const mv = getModelViewer() as Element;
  storedShadowIntensity = mv.getAttribute("shadow-intensity");
  mv.setAttribute("shadow-intensity", "0");
}

function restoreViewerShadow(): void {
  const mv = getModelViewer() as Element;
  mv.setAttribute("shadow-intensity", storedShadowIntensity ?? "0");
  storedShadowIntensity = null;
}

// ── Mode application ───────────────────────────────────────────────────────

function applyMatcap(): void {
  const scene = getThreeScene();
  if (!scene) return;

  disableViewerShadow();
  const matcap = buildMatcapTexture(getMatcapColor());
  const flatShading = getMatcapFlatShading();

  scene.traverse((node) => {
    const n = node as { isMesh?: boolean; material?: unknown; castShadow: boolean; receiveShadow: boolean };
    if (!n.isMesh || n.material == null) return;

    if (!storedMeshState.has(n)) {
      storedMeshState.set(n, { material: n.material, castShadow: n.castShadow, receiveShadow: n.receiveShadow });
    }

    const mats = Array.isArray(n.material) ? n.material : [n.material];
    const replacements = mats.map(() => new MeshMatcapMaterial({ matcap, flatShading }));
    n.material = Array.isArray(n.material) ? replacements : replacements[0];
    n.castShadow = false;
    n.receiveShadow = false;
  });
}

function applyMesh(): void {
  const scene = getThreeScene();
  if (!scene) return;

  disableViewerShadow();
  const color = getMeshColor();

  scene.traverse((node) => {
    const n = node as { isMesh?: boolean; material?: unknown; castShadow: boolean; receiveShadow: boolean };
    if (!n.isMesh || n.material == null) return;

    if (!storedMeshState.has(n)) {
      storedMeshState.set(n, { material: n.material, castShadow: n.castShadow, receiveShadow: n.receiveShadow });
    }

    const mats = Array.isArray(n.material) ? n.material : [n.material];
    const replacements = mats.map(
      () => new MeshBasicMaterial({ color, wireframe: true }),
    );
    n.material = Array.isArray(n.material) ? replacements : replacements[0];
    n.castShadow = false;
    n.receiveShadow = false;
  });
}

function restoreDefault(): void {
  const scene = getThreeScene();
  if (!scene) return;

  restoreViewerShadow();

  scene.traverse((node) => {
    const n = node as { isMesh?: boolean; material?: unknown; castShadow: boolean; receiveShadow: boolean };
    if (!n.isMesh) return;

    const orig = storedMeshState.get(n);
    if (orig !== undefined) {
      n.material = orig.material;
      n.castShadow = orig.castShadow;
      n.receiveShadow = orig.receiveShadow;
      storedMeshState.delete(n);
    }
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

export function setViewMode(mode: ViewMode): void {
  if (!hasModelLoaded()) return;

  // Tear down current non-default mode
  if (currentMode !== "default") restoreDefault();

  currentMode = mode;

  if (mode === "matcap") applyMatcap();
  else if (mode === "mesh") applyMesh();
}

/** Re-apply the current mode (used when settings change for live preview). */
function reapplyCurrentMode(): void {
  if (!hasModelLoaded() || currentMode === "default") return;

  // Re-apply without restoring first — applyMatcap/applyMesh guard against
  // double-storing originals via the has() check
  if (currentMode === "matcap") {
    // Invalidate texture cache so new colour takes effect
    cachedMatcapTexture = null;
    applyMatcap();
  } else if (currentMode === "mesh") {
    applyMesh();
  }
}

export function getCurrentMode(): ViewMode {
  return currentMode;
}

// ── UI wiring ──────────────────────────────────────────────────────────────

function syncModeButtons(active: ViewMode): void {
  document.querySelectorAll<HTMLButtonElement>("[data-view-mode]").forEach((btn) => {
    const isActive = btn.dataset.viewMode === active;
    btn.classList.toggle("border-blue-500",   isActive);
    btn.classList.toggle("bg-blue-500/10",    isActive);
    btn.classList.toggle("text-blue-400",     isActive);
    btn.classList.toggle("border-neutral-700", !isActive);
    btn.classList.toggle("bg-neutral-800",    !isActive);
    btn.classList.toggle("text-neutral-300",  !isActive);
  });

  // Show/hide mode-specific settings panels
  document.getElementById("matcap-settings")!.classList.toggle("hidden", active !== "matcap");
  document.getElementById("mesh-settings")!.classList.toggle("hidden", active !== "mesh");
}

export function initModes(): void {
  const viewer = getModelViewer();

  // Re-apply current mode whenever a new model finishes loading
  viewer.addEventListener("load", () => {
    storedMeshState.clear();
    const mode = currentMode;
    currentMode = "default";
    setViewMode(mode);
    syncModeButtons(mode);
  });

  // Mode buttons
  document.querySelectorAll<HTMLButtonElement>("[data-view-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.viewMode as ViewMode;
      setViewMode(mode);
      syncModeButtons(mode);
    });
  });

  // Matcap settings — live preview on change
  document.getElementById("matcap-color")!.addEventListener("input", reapplyCurrentMode);
  document.getElementById("matcap-flat-shading")!.addEventListener("change", reapplyCurrentMode);

  // Mesh settings — live preview on change
  document.getElementById("mesh-color")!.addEventListener("input", reapplyCurrentMode);
}
