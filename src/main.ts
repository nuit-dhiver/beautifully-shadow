import "@google/model-viewer";
import "./style.css";
import { initViewer } from "./viewer";
import { initUI } from "./ui";
import { initCapture } from "./capture";
import { initModes } from "./modes";

initViewer();
initUI();
initCapture();
initModes();
