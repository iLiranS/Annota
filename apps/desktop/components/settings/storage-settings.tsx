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
    useUserStore
} from "@annota/core";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useImportNotes } from "../../hooks/use-import-notes";

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
    const { handleImportMarkdown, isImporting } = useImportNotes();
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isVacuuming, setIsVacuuming] = useState(false);
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

    const handleVacuumDatabase = async () => {
        setIsLoading(true);
        setIsVacuuming(true);
        try {
            toast.info("Vacuuming database...");
            await StorageService.vacuum();
            toast.success("Database vacuumed and optimized");
            await loadStats();
        } catch (error) {
            console.error(error);
            toast.error("Failed to vacuum database");
        } finally {
            setIsLoading(false);
            setIsVacuuming(false);
        }
    };

    const handleResetDatabase = async () => {
        try {
            await resetAll();

            // Re-init stores so UI reflects the wiped database
            await useNotesStore.getState().initApp();

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
            {/* Import Section */}
            <section className="space-y-3">
                <h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-1">
                    Import
                </h4>
                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                    <SettingItem
                        label="Import Markdown"
                        description="Import up to 20 .md files at once"
                        icon={<Ionicons name="cloud-download-outline" size={20} />}
                        iconBg="bg-blue-600"
                        onClick={handleImportMarkdown}
                        loading={isImporting}
                        action={<Ionicons name="chevron-forward" size={16} className="text-muted-foreground" />}
                    />
                </div>
            </section>

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
                        label="Files Size"
                        description="Physical files on device"
                        icon={<Ionicons name="file-tray-full" size={20} />}
                        iconBg="bg-blue-500"
                        value={stats ? formatBytes(stats.totalFilesSize) : '...'}
                    />
                    <Separator />
                    <SettingItem
                        label="Notes & Data Size"
                        description="Database file size (optimized)"
                        icon={<Ionicons name="document-text" size={20} />}
                        iconBg="bg-amber-500"
                        value={stats ? formatBytes(stats.notesSize) : '...'}
                    />
                    {stats && (stats.freelistSize > 0 || stats.noteContentSize > 0 || stats.noteVersionsSize > 0 || stats.aiMessagesSize > 0) && (
                        <div className="bg-muted/30 px-4 py-3 text-xs space-y-2 border-t border-b">
                            <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1">
                                Database Space Breakdown
                            </div>
                            {stats.noteContentSize > 0 && (
                                <div className="flex justify-between items-center text-muted-foreground">
                                    <span>Active Notes Content</span>
                                    <span className="font-mono text-foreground">{formatBytes(stats.noteContentSize)}</span>
                                </div>
                            )}
                            {stats.noteVersionsSize > 0 && (
                                <div className="flex justify-between items-center text-muted-foreground">
                                    <span>Notes Version History</span>
                                    <span className="font-mono text-foreground">{formatBytes(stats.noteVersionsSize)}</span>
                                </div>
                            )}
                            {stats.aiMessagesSize > 0 && (
                                <div className="flex justify-between items-center text-muted-foreground">
                                    <span>AI Chats & Messages</span>
                                    <span className="font-mono text-foreground">{formatBytes(stats.aiMessagesSize)}</span>
                                </div>
                            )}
                            {stats.freelistSize > 0 && (
                                <div className="flex justify-between items-center text-muted-foreground">
                                    <span>Reclaimable Space (Freelist)</span>
                                    <span className="font-mono text-emerald-600 font-medium">{formatBytes(stats.freelistSize)}</span>
                                </div>
                            )}
                        </div>
                    )}
                    {stats && stats.tableBreakdown && stats.tableBreakdown.length > 0 && (
                        <div className="border-b px-4 py-3 text-xs">
                            <details className="group">
                                <summary className="flex items-center justify-between font-bold text-muted-foreground tracking-wider uppercase cursor-pointer select-none">
                                    <span>Technical Table Breakdown</span>
                                    <Ionicons name="chevron-down" size={12} className="transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="mt-2 space-y-1.5 pt-1 font-mono text-[11px] text-muted-foreground">
                                    {stats.tableBreakdown.map((item: any) => (
                                        <div key={item.name} className="flex justify-between items-center">
                                            <span className="truncate pr-4">{item.name}</span>
                                            <span className="text-foreground shrink-0">{formatBytes(item.bytes)}</span>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </div>
                    )}
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
                        label="Total Folders"
                        icon={<Ionicons name="folder" size={20} />}
                        iconBg="bg-sky-500"
                        value={stats?.totalFolders ?? '...'}
                    />
                    <Separator />
                    <SettingItem
                        label="Total Files"
                        icon={<Ionicons name="file-tray-full" size={20} />}
                        iconBg="bg-emerald-500"
                        value={stats?.totalFiles ?? '...'}
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
                        label="Vacuum Database"
                        description="Reclaim space (automatically runs daily)"
                        icon={<Ionicons name="construct-outline" size={20} />}
                        iconBg="bg-emerald-600"
                        onClick={handleVacuumDatabase}
                        loading={isVacuuming}
                        action={<Ionicons name="chevron-forward" size={16} className="text-muted-foreground" />}
                    />
                    <Separator />
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
                            This will completely erase all local notes and files from your device.
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
