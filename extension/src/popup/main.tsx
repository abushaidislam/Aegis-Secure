import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { PopupErrorBoundary } from "./error-boundary";
import "./popup.css";

const el = document.getElementById("root");
if (!el) throw new Error("popup root missing");
createRoot(el).render(
  <StrictMode>
    <PopupErrorBoundary>
      <App />
    </PopupErrorBoundary>
  </StrictMode>,
);

