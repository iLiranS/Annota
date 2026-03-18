import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setStorageEngine } from "@annota/core";
import { initPlatformAdapters } from "@annota/core/platform";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { createDesktopAdapters } from "./bootstrap/desktop-adapters";
import { createDesktopStorageEngine } from "./bootstrap/desktop-storage";



import { toast } from "sonner";

// Initialize platform-specific adapters and storage early
setStorageEngine(createDesktopStorageEngine());
initPlatformAdapters(createDesktopAdapters());

// Toast Listener (Bridge between core and desktop UI)
window.addEventListener('annota:toast', (e: any) => {
  const { type, title, message } = e.detail;
  const showToast = type === 'success' ? toast.success : type === 'error' ? toast.error : toast.info;
  showToast(title, { description: message });
});

const container = document.getElementById("root") as HTMLElement;
const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <TooltipProvider>
        <App />
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
