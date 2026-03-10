/**
 * View mode management: Default (PBR), Matcap (clay-like), Mesh (wireframe).
 *
 * Matcap and Mesh modes access model-viewer's internal Three.js scene by
 * locating the ModelScene instance stored at the private $scene symbol on
 * the element. The symbol is found via Object.getOwnPropertySymbols()
 * so no internal module imports are needed.
 */

import { CanvasTexture, MeshBasicMaterial, MeshMatcapMaterial } from "three";
import { getModelViewer, hasModelLoaded } from "./viewer";

export type ViewMode = "default" | "matcap" | "mesh";

let currentMode: ViewMode = "default";

// mesh node (any) → original material(s) before override
const storedMaterials = new Map<object, unknown>();

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

function buildMatcapTexture(): CanvasTexture {
  if (cachedMatcapTexture) return cachedMatcapTexture;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Dark outer ring
  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Main radial gradient — upper-left highlight, lower-right shadow
  const grad = ctx.createRadialGradient(
    size * 0.36, size * 0.32, size * 0.02,
    size * 0.5,  size * 0.5,  size * 0.52,
  );
  grad.addColorStop(0,    "#f2f2f2");
  grad.addColorStop(0.18, "#dedede");
  grad.addColorStop(0.5,  "#909090");
  grad.addColorStop(0.78, "#3c3c3c");
  grad.addColorStop(1,    "#0a0a0a");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fill();

  cachedMatcapTexture = new CanvasTexture(canvas);
  return cachedMatcapTexture;
}

// ── Mode application ───────────────────────────────────────────────────────

function applyMatcap(): void {
  const scene = getThreeScene();
  if (!scene) return;

  const matcap = buildMatcapTexture();

  scene.traverse((node) => {
    const n = node as { isMesh?: boolean; material?: unknown };
    if (!n.isMesh || n.material == null) return;

    storedMaterials.set(n, n.material);

    const mats = Array.isArray(n.material) ? n.material : [n.material];
    const replacements = mats.map(() => new MeshMatcapMaterial({ matcap }));
    n.material = Array.isArray(n.material) ? replacements : replacements[0];
  });
}

function applyMesh(): void {
  const scene = getThreeScene();
  if (!scene) return;

  scene.traverse((node) => {
    const n = node as { isMesh?: boolean; material?: unknown };
    if (!n.isMesh || n.material == null) return;

    storedMaterials.set(n, n.material);

    const mats = Array.isArray(n.material) ? n.material : [n.material];
    const replacements = mats.map(
      () => new MeshBasicMaterial({ color: 0x60a5fa, wireframe: true }),
    );
    n.material = Array.isArray(n.material) ? replacements : replacements[0];
  });
}

function restoreDefault(): void {
  const scene = getThreeScene();
  if (!scene) return;

  scene.traverse((node) => {
    const n = node as { isMesh?: boolean; material?: unknown };
    if (!n.isMesh) return;

    const orig = storedMaterials.get(n);
    if (orig !== undefined) {
      n.material = orig;
      storedMaterials.delete(n);
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
}

export function initModes(): void {
  const viewer = getModelViewer();

  // Re-apply current mode whenever a new model finishes loading
  viewer.addEventListener("load", () => {
    storedMaterials.clear();
    const mode = currentMode;
    currentMode = "default";
    setViewMode(mode);
    syncModeButtons(mode);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-view-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.viewMode as ViewMode;
      setViewMode(mode);
      syncModeButtons(mode);
    });
  });
}
