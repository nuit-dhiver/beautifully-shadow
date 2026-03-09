/**
 * Manages model-viewer element: file loading (button + drag-and-drop), URL lifecycle.
 */

let currentObjectUrl: string | null = null;

function getViewer(): HTMLElement & { src: string; updateComplete: Promise<void> } {
  return document.getElementById("viewer") as HTMLElement & {
    src: string;
    updateComplete: Promise<void>;
  };
}

function loadFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".glb")) {
    return;
  }

  // Revoke previous object URL to prevent memory leaks
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
  }

  currentObjectUrl = URL.createObjectURL(file);
  const viewer = getViewer();
  viewer.src = currentObjectUrl;

  // Update file name display
  const fileNameEl = document.getElementById("file-name");
  if (fileNameEl) fileNameEl.textContent = file.name;

  // Hide empty state
  const emptyState = document.getElementById("empty-state");
  if (emptyState) emptyState.classList.add("hidden");

  // Enable download button
  const downloadBtn = document.getElementById("download-btn") as HTMLButtonElement | null;
  if (downloadBtn) downloadBtn.disabled = false;
}

function initDragAndDrop() {
  const main = document.querySelector("main")!;
  const overlay = document.getElementById("drop-overlay")!;

  let dragCounter = 0;

  main.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragCounter++;
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
  });

  main.addEventListener("dragleave", () => {
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      overlay.classList.add("hidden");
      overlay.classList.remove("flex");
    }
  });

  main.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  main.addEventListener("drop", (e) => {
    e.preventDefault();
    dragCounter = 0;
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");

    const file = e.dataTransfer?.files[0];
    if (file) loadFile(file);
  });
}

function initFileInput() {
  const fileInput = document.getElementById("file-input") as HTMLInputElement;
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) loadFile(file);
    // Reset so the same file can be re-selected
    fileInput.value = "";
  });
}

export function getModelViewer() {
  return getViewer();
}

export function hasModelLoaded(): boolean {
  return currentObjectUrl !== null;
}

export function initViewer() {
  initFileInput();
  initDragAndDrop();
}
