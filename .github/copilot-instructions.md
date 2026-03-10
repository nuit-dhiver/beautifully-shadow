# Copilot Instructions

## Commands

```bash
npm run dev       # Vite dev server
npm run build     # TypeScript check + Vite production build
npm run preview   # Preview production build locally
```

There is no test suite or linter beyond TypeScript's compiler (`tsc`). Running `npm run build` is the way to type-check the project.

## Architecture

**beautifully-shadow** is a browser-only single-page app for capturing high-quality screenshots from 3D GLB models. It has zero runtime dependencies beyond `@google/model-viewer`.

The `src/` directory is split into four modules with a strict single-responsibility split:

- `viewer.ts` — loads GLB files (via `<input>` or drag-and-drop), manages the `<model-viewer>` element and the current object URL
- `ui.ts` — owns all sidebar control state (resolution presets, format, quality, transparent toggle) and exposes `getCaptureSettings()`
- `modes.ts` — manages view modes (Default / Matcap / Mesh); replaces Three.js materials on the scene for non-default modes, restores originals on switch-back; re-applies mode on model reload
- `capture.ts` — performs the screenshot: resizes the viewer off-screen to the target resolution, calls `viewer.toBlob()`, then downloads the result
- `main.ts` — entry point; just imports and calls `initViewer()`, `initUI()`, `initCapture()`, `initModes()`

`index.html` contains the entire DOM structure (header, `<model-viewer>`, sidebar). No HTML is generated at runtime.

## Key Conventions

**Module initialization pattern:** Each module exports an `init*()` function that wires up its own DOM event listeners. Modules expose state via getter functions (`getCaptureSettings()`, `getModelViewer()`, `hasModelLoaded()`). Avoid direct cross-module DOM access.

**DOM typing:** `<model-viewer>` is a custom element with methods not in standard TS types. The local `ModelViewerElement` interface in `capture.ts` extends `HTMLElement` to add `toBlob()` and `updateComplete`. `vite-env.d.ts` holds JSX namespace declarations for the element's HTML attributes.

**Off-screen capture technique:** To capture at resolutions larger than the viewport, `capture.ts` temporarily sets the viewer to `position: fixed; z-index: -9999; opacity: 0` at the target pixel dimensions, awaits `viewer.updateComplete` plus two `requestAnimationFrame` ticks for WebGL to re-render, then calls `toBlob()`. Original styles are always restored in a `finally` block. Because view modes replace materials directly on the Three.js scene, screenshots taken in Matcap or Mesh mode automatically capture those appearances.

**Accessing Three.js objects from model-viewer:** `model-viewer` stores its internal `ModelScene` at a private symbol (`Symbol('scene')`). `modes.ts` locates this symbol at runtime via `Object.getOwnPropertySymbols()` — filtering by `sym.description === 'scene'` — then accesses `modelScene.model` to get the Three.js root `Object3D`. This avoids importing internal model-viewer modules while still giving full access to traverse and replace mesh materials.

**Object URL lifecycle:** `viewer.ts` calls `URL.revokeObjectURL()` on the previous URL before creating a new one to avoid memory leaks. File inputs are reset (`fileInput.value = ""`) after loading so the same file can be re-selected.

**Tailwind CSS v4:** Styling uses `@tailwindcss/vite` (the Vite plugin, not PostCSS). The only custom CSS is the checkerboard `background-image` gradient on `#viewer.transparent-bg` (applied/removed by `ui.ts`), range slider thumb styles, and `model-viewer { --poster-color: transparent }`.

**TypeScript strictness:** `tsconfig.json` enables `strict`, `noUnusedLocals`, `noUnusedParameters`, and `erasableSyntaxOnly`. All code uses `verbatimModuleSyntax`, so type-only imports must use `import type`.
