/// <reference types="vite/client" />

declare namespace JSX {
  interface IntrinsicElements {
    "model-viewer": ModelViewerAttributes;
  }

  interface ModelViewerAttributes
    extends React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    > {
    src?: string;
    alt?: string;
    "camera-controls"?: boolean | string;
    "touch-action"?: string;
    "shadow-intensity"?: string;
    "shadow-softness"?: string;
    exposure?: string;
    "interaction-prompt"?: string;
  }
}
