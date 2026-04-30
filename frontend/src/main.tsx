import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress DOM mutation errors caused by browser extensions (Grammarly, Google Translate, etc.)
// These are NOT app bugs — extensions modify React's DOM tree and cause removeChild/insertBefore errors.
const isDomMutationError = (e: any) =>
  /removeChild|insertBefore|NotFoundError|appendChild/.test(
    String(e?.message || e?.reason?.message || '')
  );

window.addEventListener('error', (e) => {
  if (isDomMutationError(e.error || e)) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}, true);

window.addEventListener('unhandledrejection', (e) => {
  if (isDomMutationError(e.reason)) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
