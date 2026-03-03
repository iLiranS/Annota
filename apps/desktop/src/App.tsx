import {
  authApi,
  setStorageEngine,
  useNotesStore,
  useTasksStore,
  useUserStore,
} from "@annota/core";
import { SyncScheduler, getMasterKey, initPlatformAdapters } from "@annota/core/platform";
import { useEffect, useState } from "react";
import "./App.css";
import { createDesktopAdapters } from "./bootstrap/desktop-adapters";
import { initDesktopSqlite } from "./bootstrap/desktop-db";
import { createDesktopStorageEngine } from "./bootstrap/desktop-storage";

type BootstrapState = "booting" | "ready" | "error";

function App() {
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>("booting");
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);

  const notesCount = useNotesStore((state) => state.notes.length);
  const foldersCount = useNotesStore((state) => state.folders.length);
  const tasksCount = useTasksStore((state) => state.tasks.length);
  const user = useUserStore((state) => state.user);
  const session = useUserStore((state) => state.session);
  const setSession = useUserStore((state) => state.setSession);

  useEffect(() => {
    let cancelled = false;
    let scheduler: SyncScheduler | null = null;

    const bootstrap = async () => {
      setBootstrapState("booting");
      setBootstrapError(null);

      try {
        // Keep deterministic ordering: storage -> adapters -> db.
        setStorageEngine(createDesktopStorageEngine());
        initPlatformAdapters(createDesktopAdapters());
        await initDesktopSqlite();

        let activeUserId: string | null = null;
        try {
          const { data } = await authApi.getSession();
          if (data.session) {
            setSession(data.session);
            activeUserId = data.session.user.id;
          }
        } catch (error) {
          console.warn("[DesktopBootstrap] Session restore failed (offline likely):", error);
        }

        if (!activeUserId) activeUserId = useUserStore.getState().user?.id ?? null;

        await Promise.all([
          useNotesStore.getState().initApp(),
          useTasksStore.getState().loadTasks(),
        ]);

        if (activeUserId) {
          const masterKey = await getMasterKey(activeUserId);
          if (masterKey && !cancelled) {
            scheduler = new SyncScheduler();
            scheduler.init(masterKey);
          }
        }

        if (!cancelled) {
          setBootstrapState("ready");
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setBootstrapError(message);
        setBootstrapState("error");
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      scheduler?.dispose();
    };
  }, [runId, setSession]);

  if (bootstrapState === "booting") {
    return (
      <main className="page">
        <section className="panel">
          <h1>Starting Annota Desktop</h1>
          <p>Initializing storage, platform adapters, and database.</p>
        </section>
      </main>
    );
  }

  if (bootstrapState === "error") {
    return (
      <main className="page">
        <section className="panel">
          <h1>Bootstrap Error</h1>
          <p>{bootstrapError ?? "Unknown startup error"}</p>
          <button onClick={() => setRunId((value) => value + 1)}>Retry</button>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="panel">
        <h1 className="text-2xl">Annota Desktop</h1>
        <p className="text-red-400">Core runtime is ready.</p>
        <ul>
          <li>
            <strong>User:</strong> {session?.user?.email ?? user?.email ?? "Offline/guest"}
          </li>
          <li>
            <strong>Folders:</strong> {foldersCount}
          </li>
          <li>
            <strong>Notes:</strong> {notesCount}
          </li>
          <li>
            <strong>Tasks:</strong> {tasksCount}
          </li>
        </ul>
      </section>
    </main>
  );
}

export default App;
