import { useAppTheme } from "@/hooks/use-app-theme";
import { useDailyCleanup } from "@/hooks/use-daily-cleanup";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { useNoteWindowSync } from "@/hooks/use-note-window-sync";
import {
  authApi,
  fileSyncService,
  useAiStore,
  useNotesStore,
  useSearchStore,
  useSettingsStore,
  useSyncStore,
  useUserStore
} from "@annota/core";
import {
  SyncScheduler,
  getMasterKey,
} from "@annota/core/platform";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Location, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import { initDesktopSqlite } from "./bootstrap/desktop-db";
import { initDeepLinkListener } from "./lib/auth-listener";

// Layout components
import ChangelogModal from "@/components/changelog/changelog-modal";
import AppShell from "@/components/layout/app-shell";
import AuthGuard from "@/components/layout/auth-guard";
import SettingsDialog from "@/components/settings/settings-dialog";

import AuthLayout from "./pages/auth/auth-layout";
import LoginPage from "./pages/auth/login";
import LostKeyPage from "./pages/auth/lost-key";
import MasterKeyPage from "./pages/auth/master-key";

// Notes pages
import NoteFullscreen from "./pages/notes/note-fullscreen";
import NotesLayout from "./pages/notes/notes-layout";
import NotesViewManager from "./pages/notes/notes-view-manager";
import TrashPage from "./pages/notes/trash-page";



// Home Page
import HomePage from "./pages/home/home-page";

type BootstrapState = "booting" | "ready" | "error";

const STARTUP_NETWORK_TIMEOUT_MS = 5000;

class StartupTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StartupTimeoutError";
  }
}

const withStartupTimeout = async <T,>(
  promise: Promise<T>,
  label: string,
  timeoutMs: number = STARTUP_NETWORK_TIMEOUT_MS,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new StartupTimeoutError(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const isStartupTimeout = (error: unknown) =>
  error instanceof StartupTimeoutError;

function App() {
  useAppTheme();
  useDailyCleanup();
  useNoteWindowSync();
  useGlobalShortcuts();

  const [bootstrapState, setBootstrapState] =
    useState<BootstrapState>("booting");
  const bootstrapStateRef = useRef<BootstrapState>(bootstrapState);
  useEffect(() => {
    bootstrapStateRef.current = bootstrapState;
  }, [bootstrapState]);


  // Prevent default browser navigation for global drag and drop
  useEffect(() => {
    const preventNavigation = (e: any) => {
      e.preventDefault();
    };

    // You must prevent default on 'dragover' to allow the 'drop' event to fire
    window.addEventListener('dragover', preventNavigation);
    window.addEventListener('drop', preventNavigation);

    // Note: If using a framework like React, remember to return a cleanup function 
    // to remove these listeners on unmount.
  }, [])

  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);

  const setSession = useUserStore((state) => state.setSession);
  const session = useUserStore((state) => state.session);
  const hasMasterKey = useUserStore((state) => state.hasMasterKey);
  const saltHex = useUserStore((state) => state.saltHex);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {

      setBootstrapState("booting");
      setBootstrapError(null);

      try {
        // 1. Rehydrate persisted stores manually (storage/adapters initialized in main.tsx)
        await useUserStore.persist.rehydrate();
        await useSettingsStore.persist.rehydrate();
        await useAiStore.persist.rehydrate();

        // 2. Fetch/Apply remote app config (blocking sync if needed)
        try {
          const { appConfigService } = await import("@annota/core");
          await withStartupTimeout(appConfigService.init(), "App config");
        } catch (e) {
          console.error("[DesktopBootstrap] Failed to init app config:", e);
          if (isStartupTimeout(e)) {
            useSyncStore.getState().setOnline(false);
          }
        }

        // 3. Optimistically grab the persisted user ID FIRST
        let activeUserId: string | null = useUserStore.getState().user?.id ?? null;

        // Populate master key early so offline mode doesn't redirect to /auth/master-key
        // since authApi.onAuthStateChange might not provide a session when offline.
        if (activeUserId) {
          await useUserStore.getState().checkMasterKey();
        }

        // 3. Attempt session restore with a safety timeout
        try {
          const { data } = await withStartupTimeout(
            authApi.getSession(),
            "Session restore",
          ) as any;

          if (data?.session) {
            setSession(data.session);
            activeUserId = data.session.user.id;
            // Fetch profile to sync role, sub_exp_date, etc.
            await useUserStore.getState().getUserProfile();
          }
        } catch (error) {
          console.warn(
            "[DesktopBootstrap] Session restore delayed/failed (offline likely). Falling back to local user state.",
            error,
          );
          if (isStartupTimeout(error)) {
            useSyncStore.getState().setOnline(false);
          }
          // We gracefully catch this. activeUserId still holds the persisted ID!
        }

        // 4. Initialise (or switch to) the per-user SQLite database.
        await initDesktopSqlite(activeUserId);

        // 5. Initialize stores only for the main window.
        //    Child windows (standalone note editors) read directly from the DB
        //    via NoteService and don't need the full store to be populated.
        const isMain = getCurrentWindow().label === "main";
        if (isMain) {
          try {
            const storesPromise = Promise.all([
              useNotesStore.getState().initApp(),
            ]);
            const storesTimeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Stores init timeout")), 5000)
            );

            await Promise.race([storesPromise, storesTimeoutPromise]);
          } catch (error) {
            console.warn(
              "[DesktopBootstrap] Stores sync timed out/failed. Proceeding with local DB data.",
              error
            );
            // Don't throw here! We want the app to finish booting so the user can access local SQLite data.
          }
        }

        if (!cancelled) {
          setBootstrapState("ready");
        }
      } catch (error) {
        // Real local crashes (e.g., SQLite failing to mount) will still end up here
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setBootstrapError(message);
        setBootstrapState("error");
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [runId, setSession]);

  const navigate = useNavigate();
  const [pendingDeepLink, setPendingDeepLink] = useState<string | null>(null);

  // Auth and Deep Link listeners
  useEffect(() => {
    let unlistenDeepLink: (() => void) | undefined;

    const handleDeepLink = (url: string) => {
      // If we are not in the main window, we should NOT navigate locally.
      // Instead, we tell the main window to handle it.
      if (getCurrentWindow().label !== 'main') {
        emit("request-main-window-navigation", { url });
        return;
      }

      try {
        const parsedUrl = new URL(url);
        // Parse 'annota://note/123?elementId=456'
        if (parsedUrl.host === "note") {
          if (bootstrapStateRef.current !== "ready") {
            setPendingDeepLink(url);
            return;
          }

          const noteId = parsedUrl.pathname.replace("/", "");
          const elementId = parsedUrl.searchParams.get("elementId") || parsedUrl.searchParams.get("blockId");

          // Try to find the note to get its folderId for the route
          const note = useNotesStore.getState().notes.find((n) => n.id === noteId);
          if (note) {
            const folderId = note.folderId || "root";
            let routePath = `/notes/${folderId}/${noteId}`;
            if (elementId) {
              routePath += `?elementId=${elementId}`;
            }
            navigate(routePath);
            const win = getCurrentWindow();
            win.unminimize();
            win.setFocus();
          } else {
            console.warn("[DeepLink] Note not found in store, can't route yet:", noteId);
          }
        }
      } catch (err) {
        console.error("Failed to handle deep link:", err);
      }
    };

    // 0. Listen for navigation requests from other windows (only in main window)
    let unlistenRequest: (() => void) | undefined;
    if (getCurrentWindow().label === 'main') {
      listen("request-main-window-navigation", (event: any) => {
        const win = getCurrentWindow();
        if (event.payload?.path) {
          // In-app route navigation (e.g. from standalone note window)
          navigate(event.payload.path);
          win.unminimize();
          win.setFocus();
        } else if (event.payload?.url) {
          handleDeepLink(event.payload.url);
          win.unminimize();
          win.setFocus();
        }
      }).then(un => unlistenRequest = un);
    }

    // 1. Listen for external OS-level links
    initDeepLinkListener(handleDeepLink).then((unlisten) => {
      unlistenDeepLink = unlisten;
    });

    // 2. NEW: Listen for internal link clicks inside the WebView
    const handleGlobalClick = (e: MouseEvent) => {
      // Find if the click originated from inside an <a> tag
      const anchor = (e.target as Element).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      // If it's an internal app link, stop the webview from navigating natively
      if (href && href.startsWith("annota://")) {
        e.preventDefault();
        handleDeepLink(href);
      }
    };

    // Attach the event listener to the document
    document.addEventListener("click", handleGlobalClick);

    const subscription = authApi.onAuthStateChange((event, newSession) => {
      const prevUserId = useUserStore.getState().user?.id ?? null;

      if (newSession) {
        setSession(newSession);
        useUserStore.getState().checkMasterKey();
        useUserStore.getState().getUserProfile();

        if (newSession.user.id !== prevUserId) {
          setRunId((v) => v + 1);
        }
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        useNotesStore.getState().reset();
        useSearchStore.getState().reset();
        useSyncStore.getState().reset();
        setRunId((v) => v + 1);
      }
    });

    return () => {
      if (unlistenDeepLink) unlistenDeepLink();
      if (unlistenRequest) unlistenRequest();
      subscription.unsubscribe();
      // Clean up the click listener when unmounting
      document.removeEventListener("click", handleGlobalClick);
    };
  }, [setSession, navigate]);

  // Handle pending deep link once ready
  useEffect(() => {
    if (bootstrapState === "ready" && pendingDeepLink) {
      try {
        const url = pendingDeepLink;
        setPendingDeepLink(null);

        const parsedUrl = new URL(url);
        if (parsedUrl.host === "note") {
          const noteId = parsedUrl.pathname.replace("/", "");
          const elementId = parsedUrl.searchParams.get("elementId") || parsedUrl.searchParams.get("blockId");
          const note = useNotesStore.getState().notes.find((n) => n.id === noteId);
          if (note) {
            const folderId = note.folderId || "root";
            let routePath = `/notes/${folderId}/${noteId}`;
            if (elementId) routePath += `?elementId=${elementId}`;
            navigate(routePath);
          }
        }
      } catch (err) {
        console.error("Failed to handle pending deep link:", err);
      }
    }
  }, [bootstrapState, pendingDeepLink, navigate]);


  // Sync Scheduler
  useEffect(() => {
    if (!session || !hasMasterKey || !saltHex || bootstrapState !== "ready" || getCurrentWindow().label !== "main") return;
    let cancelled = false;
    if (SyncScheduler.getInstance().isInitialized()) return;

    const setupScheduler = async () => {
      const key = await getMasterKey(session.user.id);
      if (!key || cancelled) return;

      SyncScheduler.getInstance().init(key, saltHex, {
        reinitStores: async () => {
          await Promise.all([
            useNotesStore.getState().initApp(),
          ]);
        },
        getSyncState: () => {
          const state = useSyncStore.getState();
          return {
            isOnline: state.isOnline,
            syncError: state.syncError,
            setOnline: state.setOnline
          };
        }
      }, session.user.id);

      // 2. Kick off any pending file downloads from previous sessions
      fileSyncService.retryPendingDownloads(key, saltHex, session.user.id).catch(err => {
        console.error('[Startup] Failed to retry pending file downloads:', err);
      });
    };

    void setupScheduler();

    return () => {
      cancelled = true;
      SyncScheduler.getInstance().dispose();
    };
  }, [session?.user?.id, hasMasterKey, saltHex, bootstrapState]);

  const location = useLocation();
  const locationState = location.state as { background?: Location };

  // ── Booting ──────────────────────────────────────────────────
  if (bootstrapState === "booting") {
    const isMain = getCurrentWindow().label === "main";
    if (isMain) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Starting Annota…</p>
          </div>
        </div>
      );
    } else {
      // Cleaner standalone loader (just the background and a subtle spinner)
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground/30" />
        </div>
      );
    }
  }

  // ── Error ────────────────────────────────────────────────────
  if (bootstrapState === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 shadow-lg">
          <h1 className="text-lg font-bold text-foreground">
            Bootstrap Error
          </h1>
          <p className="text-sm text-muted-foreground">
            {bootstrapError ?? "Unknown startup error"}
          </p>
          <button
            onClick={() => {
              const { lastViewedNoteId, lastViewedFolderId } = useSettingsStore.getState();
              if (lastViewedNoteId) {
                navigate(`/notes/${lastViewedFolderId || 'root'}/${lastViewedNoteId}`);
              } else {
                navigate('/notes');
              }
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Ready — Route tree ───────────────────────────────────────
  return (
    <>
      <Routes location={locationState?.background || location}>
        {/* Auth routes (no sidebar) */}
        <Route path="/auth" element={<AuthLayout />}>
          <Route index element={<Navigate to="login" replace />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="lost-key" element={<LostKeyPage />} />
          <Route path="master-key" element={<MasterKeyPage />} />
        </Route>

        {/* Protected app routes */}
        <Route element={<AuthGuard />}>
          <Route path="note-fullscreen/:noteId" element={<NoteFullscreen />} />
          <Route element={<AppShell />}>
            {/* Default redirect: Instead of /home, go to /notes or last viewed note */}
            <Route index element={<Navigate to="/notes" replace />} />

            {/* Notes */}
            <Route path="notes/trash" element={<TrashPage />} />
            <Route path="notes" element={<NotesLayout />}>
              <Route index element={<NotesViewManager />} />
              <Route path=":folderId/:noteId" element={<NotesViewManager />} />
            </Route>

            {/* Modal-style routes as regular routes (fallback if no background) */}
            {!locationState?.background && (
              <>
                <Route path="settings" element={<SettingsDialog />} />
              </>
            )}
          </Route>
        </Route>
      </Routes>

      {/* Modal routes */}
      {locationState?.background && (
        <Routes>
          <Route path="settings" element={<SettingsDialog />} />
        </Routes>
      )}
      <ChangelogModal />
    </>
  );
}

export default App;
