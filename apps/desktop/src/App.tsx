import {
  authApi,
  resetSyncPointer,
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
import { useEffect, useState } from "react";
import { Location, Navigate, Route, Routes, useLocation } from "react-router-dom";
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

// Tasks pages
import NewTaskDialog from "./pages/tasks/new-task-dialog";
import TaskDetailSidebar from "./pages/tasks/task-detail-sidebar";
import TasksLayout from "./pages/tasks/tasks-layout";

// Home Page
import HomePage from "./pages/home/home-page";

type BootstrapState = "booting" | "ready" | "error";

function App() {
  const [bootstrapState, setBootstrapState] =
    useState<BootstrapState>("booting");
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

        // Force a full re-sync on first desktop launch to pull all data.
        // TODO: Remove this once all desktop users have completed their initial sync.
        if (activeUserId) {
          await resetSyncPointer(activeUserId);
        }

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

  // Auth and Deep Link listeners
  useEffect(() => {
    let unlistenDeepLink: (() => void) | undefined;

    initDeepLinkListener().then((unlisten) => {
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
  }, [setSession]);

  // Sync Scheduler
  useEffect(() => {
    if (!session || !hasMasterKey || bootstrapState !== "ready") return;

    let cancelled = false;
    let scheduler: SyncScheduler | null = null;

    const setupScheduler = async () => {
      const key = await getMasterKey(session.user.id);
      if (!key || cancelled) return;

      scheduler = new SyncScheduler();
      scheduler.init(key);
    };

    void setupScheduler();

    return () => {
      cancelled = true;
      scheduler?.dispose();
    };
  }, [session, hasMasterKey, bootstrapState]);

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

  const location = useLocation();
  const state = location.state as { background?: Location };

  // ── Ready — Route tree ───────────────────────────────────────
  return (
    <>
      <Routes location={state?.background || location}>
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
            <Route path="notes" element={<NotesLayout />}>
              <Route index element={<NotesEmpty />} />
              <Route path=":folderId/:noteId" element={<NoteEditor />} />
            </Route>

            {/* Tasks */}
            <Route path="tasks" element={<TasksLayout />}>
              <Route path="new" element={<NewTaskDialog />} />
              <Route path=":id" element={<TaskDetailSidebar />} />
            </Route>

            {/* Settings as a normal route (fallback if no background) */}
            {!state?.background && (
              <Route path="settings" element={<SettingsDialog />} />
            )}
          </Route>
        </Route>
      </Routes>

      {/* Modal routes */}
      {state?.background && (
        <Routes>
          <Route path="settings" element={<SettingsDialog />} />
        </Routes>
      )}
    </>
  );
}

export default App;
