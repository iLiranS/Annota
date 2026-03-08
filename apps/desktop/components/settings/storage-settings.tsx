import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
    resetAll,
    resetMasterKey,
    StorageService,
    useNotesStore,
    useSyncStore,
    useTasksStore,
    useUserStore
} from "@annota/core";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Ionicons } from "../ui/ionicons";

import { SettingItem } from "./setting-item";

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function StorageSettings() {
    const { session } = useUserStore();
    const { isSyncing } = useSyncStore();
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showResetDialog, setShowResetDialog] = useState(false);
    const [showRemoveKeyDialog, setShowRemoveKeyDialog] = useState(false);

    const loadStats = async () => {
        setIsLoading(true);
        try {
            const s = await StorageService.getStats();
            setStats(s);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load storage stats");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    const handleManualSync = async () => {
        if (!session?.user?.id) {
            toast.error("You need to be signed in to sync");
            return;
        }

        try {
            toast.info("Syncing with cloud...");
            await useSyncStore.getState().forceSync();

            toast.success("Sync complete");
            await loadStats();
        } catch (error: any) {
            console.error("Manual Sync Error:", error);
            toast.error(error?.message || "Sync failed");
        }
    };

    const handleRemoveMasterKey = async () => {
        if (!session?.user?.id) return;
        try {
            await resetMasterKey(session.user.id);
            toast.success("Master Key removed from this device");
            setShowRemoveKeyDialog(false);
        } catch (e) {
            console.error(e);
            toast.error("Failed to remove Master Key");
        }
    };

    const handleResetDatabase = async () => {
        try {
            await resetAll();

            // Re-init stores so UI reflects the wiped database
            await useNotesStore.getState().initApp();
            await useTasksStore.getState().loadTasks();

            toast.success("Local database has been wiped");
            setShowResetDialog(false);
            await loadStats();
        } catch (e) {
            console.error(e);
            toast.error("Failed to reset database");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Storage Stats Section */}
            <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase">
                        Storage Usage
                    </h4>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-muted-foreground hover:text-primary"
                        onClick={loadStats}
                        disabled={isLoading}
                    >
                        <Ionicons name="refresh" size={12} className={cn("mr-1", isLoading && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                    <SettingItem
                        label="Images Size"
                        description="Physical image files on device"
                        icon={<Ionicons name="images" size={20} />}
                        iconBg="bg-blue-500"
                        value={stats ? formatBytes(stats.totalImagesSize) : '...'}
                    />
                    <Separator />
                    <SettingItem
                        label="Notes & Data Size"
                        description="Database file size (optimized)"
                        icon={<Ionicons name="document-text" size={20} />}
                        iconBg="bg-amber-500"
                        value={stats ? formatBytes(stats.notesSize) : '...'}
                    />
                    <Separator />
                    <SettingItem
                        label="Total Size"
                        description="Combined app data usage"
                        icon={<Ionicons name="pie-chart" size={20} />}
                        iconBg="bg-indigo-600"
                        value={stats ? formatBytes(stats.totalSize) : '...'}
                    />
                </div>
            </section>

            {/* Counts Section */}
            <section className="space-y-3">
                <h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-1">
                    Items Count
                </h4>
                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                    <SettingItem
                        label="Total Notes"
                        icon={<Ionicons name="journal" size={20} />}
                        iconBg="bg-violet-500"
                        value={stats?.totalNotes ?? '...'}
                    />
                    <Separator />
                    <SettingItem
                        label="Total Tasks"
                        icon={<Ionicons name="checkbox" size={20} />}
                        iconBg="bg-teal-500"
                        value={stats?.totalTasks ?? '...'}
                    />
                    <Separator />
                    <SettingItem
                        label="Total Folders"
                        icon={<Ionicons name="folder" size={20} />}
                        iconBg="bg-sky-500"
                        value={stats?.totalFolders ?? '...'}
                    />
                    <Separator />
                    <SettingItem
                        label="Total Images"
                        icon={<Ionicons name="image" size={20} />}
                        iconBg="bg-emerald-500"
                        value={stats?.totalImages ?? '...'}
                    />
                </div>
            </section>

            {/* Actions Section */}
            <section className="space-y-3">
                <h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-1">
                    Database Actions
                </h4>
                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                    {session && session.user && (
                        <>
                            <SettingItem
                                label="Sync with Cloud DB"
                                description="Force a full recursive sync"
                                icon={<Ionicons name="cloud-upload" size={20} />}
                                iconBg="bg-primary"
                                onClick={handleManualSync}
                                loading={isSyncing}
                                action={<Ionicons name="chevron-forward" size={16} className="text-muted-foreground" />}
                            />
                            <Separator />
                            <SettingItem
                                label="Remove Master Key"
                                description="Clear encryption key from this device"
                                icon={<Ionicons name="key-outline" size={20} />}
                                iconBg="bg-orange-500"
                                onClick={() => setShowRemoveKeyDialog(true)}
                                action={<Ionicons name="chevron-forward" size={16} className="text-muted-foreground" />}
                            />
                            <Separator />
                        </>
                    )}
                    <SettingItem
                        label="Reset Local Database"
                        description="Permanently delete ALL local data"
                        icon={<Ionicons name="trash-bin" size={20} />}
                        iconBg="bg-rose-600"
                        danger
                        onClick={() => setShowResetDialog(true)}
                        action={<Ionicons name="chevron-forward" size={16} className="text-muted-foreground" />}
                    />
                </div>
            </section>

            {/* Reset Dialog */}
            <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will completely erase all local notes, tasks, and images from your device.
                            If you haven't synced, they will be lost forever.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetDatabase} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Reset Everything
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Remove Key Dialog */}
            <AlertDialog open={showRemoveKeyDialog} onOpenChange={setShowRemoveKeyDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Master Key?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the master key from your device. You will need to re-enter it to sync your data again.
                            Your local data will remain intact.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveMasterKey}>
                            Remove Key
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
