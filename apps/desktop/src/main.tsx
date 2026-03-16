import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setStorageEngine } from "@annota/core";
import { initPlatformAdapters } from "@annota/core/platform";
import * as Sentry from "@sentry/react";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { createDesktopAdapters } from "./bootstrap/desktop-adapters";
import { createDesktopStorageEngine } from "./bootstrap/desktop-storage";

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
});

// Initialize platform-specific adapters and storage early
setStorageEngine(createDesktopStorageEngine());
initPlatformAdapters(createDesktopAdapters());

const container = document.getElementById("root") as HTMLElement;
const root = ReactDOM.createRoot(container, {
  onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.error("Uncaught error", error, errorInfo);
  }),
  onCaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.error("Caught error", error, errorInfo);
  }),
  onRecoverableError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.error("Recoverable error", error, errorInfo);
  }),
});

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
