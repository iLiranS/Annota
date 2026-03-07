import { useAppTheme } from "@/hooks/use-app-theme";
import {
  authApi,
  setStorageEngine,
  useNotesStore,
  useSettingsStore,
  useTasksStore,
  useUserStore
} from "@annota/core";
import {
  SyncScheduler,
  getMasterKey,
  initPlatformAdapters,
} from "@annota/core/platform";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Location, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import { createDesktopAdapters } from "./bootstrap/desktop-adapters";
import { initDesktopSqlite } from "./bootstrap/desktop-db";
import { createDesktopStorageEngine } from "./bootstrap/desktop-storage";
import { initDeepLinkListener } from "./lib/auth-listener";

// Layout components
import AppShell from "@/components/layout/app-shell";
import AuthGuard from "@/components/layout/auth-guard";
import SettingsDialog from "@/components/settings/settings-dialog";

import AuthLayout from "./pages/auth/auth-layout";
import LoginPage from "./pages/auth/login";
import LostKeyPage from "./pages/auth/lost-key";
import MasterKeyPage from "./pages/auth/master-key";

// Notes pages
import NoteEditor from "./pages/notes/note-editor";
import NotesEmpty from "./pages/notes/notes-empty";
import NotesLayout from "./pages/notes/notes-layout";
import TrashPage from "./pages/notes/trash-page";

// Tasks pages
import TaskDetailDialog from "./pages/tasks/task-detail-dialog";
import TasksLayout from "./pages/tasks/tasks-layout";

// Home Page
import HomePage from "./pages/home/home-page";

type BootstrapState = "booting" | "ready" | "error";

function App() {
  useAppTheme();
  const [bootstrapState, setBootstrapState] =
    useState<BootstrapState>("booting");
  const bootstrapStateRef = useRef<BootstrapState>(bootstrapState);
  useEffect(() => {
    bootstrapStateRef.current = bootstrapState;
  }, [bootstrapState]);

  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);

  const setSession = useUserStore((state) => state.setSession);
  const session = useUserStore((state) => state.session);
  const hasMasterKey = useUserStore((state) => state.hasMasterKey);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setBootstrapState("booting");
      setBootstrapError(null);

      try {
        // Keep deterministic ordering: storage -> adapters -> db.
        setStorageEngine(createDesktopStorageEngine());

        // Rehydrate persisted stores manually since skipHydration is true
        await useUserStore.persist.rehydrate();
        await useSettingsStore.persist.rehydrate();

        initPlatformAdapters(createDesktopAdapters());

        let activeUserId: string | null = null;
        try {
          const { data } = await authApi.getSession();
          if (data.session) {
            setSession(data.session);
            activeUserId = data.session.user.id;
          }
        } catch (error) {
          console.warn(
            "[DesktopBootstrap] Session restore failed (offline likely):",
            error,
          );
        }

        if (!activeUserId)
          activeUserId = useUserStore.getState().user?.id ?? null;

        // Initialise (or switch to) the per-user SQLite database.
        await initDesktopSqlite(activeUserId);

        await Promise.all([
          useNotesStore.getState().initApp(),
          useTasksStore.getState().loadTasks(),
        ]);

        if (!cancelled) {
          setBootstrapState("ready");
        }
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : String(error);
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

  // Handle pending deep link once ready
  useEffect(() => {
    if (bootstrapState === "ready" && pendingDeepLink) {
      try {
        const url = pendingDeepLink;
        setPendingDeepLink(null);

        const parsedUrl = new URL(url);
        if (parsedUrl.host === "note") {
          const noteId = parsedUrl.pathname.replace("/", "");
          const elementId = parsedUrl.searchParams.get("elementId");
          const note = useNotesStore.getState().notes.find((n) => n.id === noteId);
          if (note) {
            let routePath = `/notes/${note.folderId}/${noteId}`;
            if (elementId) routePath += `?elementId=${elementId}`;
            navigate(routePath);
          }
        }
      } catch (err) {
        console.error("Failed to handle pending deep link:", err);
      }
    }
  }, [bootstrapState, pendingDeepLink, navigate]);

  // Auth and Deep Link listeners
  useEffect(() => {
    let unlistenDeepLink: (() => void) | undefined;

    const handleDeepLink = (url: string) => {
      try {
        const parsedUrl = new URL(url);
        // Parse 'annota://note/123?elementId=456'
        if (parsedUrl.host === "note") {
          if (bootstrapStateRef.current !== "ready") {
            setPendingDeepLink(url);
            return;
          }

          const noteId = parsedUrl.pathname.replace("/", "");
          const elementId = parsedUrl.searchParams.get("elementId");

          // Try to find the note to get its folderId for the route
          const note = useNotesStore.getState().notes.find((n) => n.id === noteId);
          if (note) {
            let routePath = `/notes/${note.folderId}/${noteId}`;
            if (elementId) {
              routePath += `?elementId=${elementId}`;
            }
            navigate(routePath);
          } else {
            console.warn("[DeepLink] Note not found in store, can't route yet:", noteId);
          }
        }
      } catch (err) {
        console.error("Failed to handle deep link:", err);
      }
    };

    initDeepLinkListener(handleDeepLink).then((unlisten) => {
      unlistenDeepLink = unlisten;
    });

    const subscription = authApi.onAuthStateChange((event, newSession) => {
      const prevUserId = useUserStore.getState().user?.id ?? null;

      if (newSession) {
        setSession(newSession);
        // Ensure AuthGuard knows whether to redirect to /auth/master-key
        useUserStore.getState().checkMasterKey();

        // Different user signed in — re-bootstrap to switch DB + reload stores.
        if (newSession.user.id !== prevUserId) {
          setRunId((v) => v + 1);
        }
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        // Re-bootstrap so the next login starts with a fresh DB context.
        setRunId((v) => v + 1);
      }
    });

    return () => {
      if (unlistenDeepLink) unlistenDeepLink();
      subscription.unsubscribe();
    };
  }, [setSession, navigate]);

  // Sync Scheduler
  useEffect(() => {
    if (!session || !hasMasterKey || bootstrapState !== "ready") return;

    let cancelled = false;

    const setupScheduler = async () => {
      const key = await getMasterKey(session.user.id);
      if (!key || cancelled) return;

      SyncScheduler.getInstance().init(key);
    };

    void setupScheduler();

    return () => {
      cancelled = true;
      // We don't dispose here normally because we want it to persist across route changes
      // It will only re-init if the masterKey changes or if it was disposed.
    };
  }, [session, hasMasterKey, bootstrapState]);

  const location = useLocation();
  const locationState = location.state as { background?: Location };

  // ── Booting ──────────────────────────────────────────────────
  if (bootstrapState === "booting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Starting Annota…</p>
        </div>
      </div>
    );
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
            onClick={() => setRunId((v) => v + 1)}
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
          <Route element={<AppShell />}>
            {/* Default redirect */}
            <Route index element={<Navigate to="/home" replace />} />

            {/* Home */}
            <Route path="home" element={<HomePage />} />

            {/* Notes */}
            <Route path="notes/trash" element={<TrashPage />} />
            <Route path="notes" element={<NotesLayout />}>
              <Route index element={<NotesEmpty />} />
              <Route path=":folderId/:noteId" element={<NoteEditor />} />
            </Route>

            {/* Tasks */}
            <Route path="tasks" element={<TasksLayout />} />

            {/* Modal-style routes as regular routes (fallback if no background) */}
            {!locationState?.background && (
              <>
                <Route path="settings" element={<SettingsDialog />} />
                <Route path="task/:id" element={<TaskDetailDialog />} />
              </>
            )}
          </Route>
        </Route>
      </Routes>

      {/* Modal routes */}
      {locationState?.background && (
        <Routes>
          <Route path="settings" element={<SettingsDialog />} />
          <Route path="task/:id" element={<TaskDetailDialog />} />
        </Routes>
      )}
    </>
  );
}

export default App;
