import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useUserStore } from "@annota/core";
import { getMasterKey } from "@annota/core/platform";
import { useEffect, useState } from "react";
import { Ionicons } from "../ui/ionicons";

const GUEST_DISPLAY_NAME_KEY = 'guest_display_name';

import { SettingItem } from "./setting-item";

function RoleBadge({ role }: { role: string | null }) {
    if (!role) return <span className="text-xs text-muted-foreground italic">Fetching...</span>;

    const lowerRole = role.toLowerCase();

    if (lowerRole === 'pro') {
        return (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 font-bold text-[10px] tracking-wider uppercase">
                <Ionicons name="star" size={12} className="text-amber-500" />
                PRO
            </div>
        );
    }

    if (lowerRole === 'beta') {
        return (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-500 font-bold text-[10px] tracking-wider uppercase">
                <Ionicons name="flask" size={12} />
                BETA
            </div>
        );
    }

    if (lowerRole === 'admin') {
        return (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-500 font-bold text-[10px] tracking-wider uppercase">
                <Ionicons name="build" size={12} />
                ADMIN
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-500 font-bold text-[10px] tracking-wider uppercase">
            <Ionicons name="shield-checkmark" size={12} />
            FREE
        </div>
    );
}

export function AccountSettings() {
    const { session, signOut, setGuest, updateDisplayName } = useUserStore();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [displayName, setDisplayName] = useState<string>("");
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState("");
    const [isRevealingKey, setIsRevealingKey] = useState(false);
    const [masterKey, setMasterKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [isPendingDelete, setIsPendingDelete] = useState(false);

    useEffect(() => {
        if (session) {
            const fetchData = async () => {
                const [role, name] = await Promise.all([
                    useUserStore.getState().getUserRole(),
                    useUserStore.getState().getDisplayName()
                ]);
                setUserRole(role);
                setDisplayName(name || session.user?.user_metadata?.display_name || "Guest");
            };
            fetchData();
        } else {
            const guestName = localStorage.getItem(GUEST_DISPLAY_NAME_KEY);
            setDisplayName(guestName || "Guest");
            setUserRole(null);
        }
    }, [session]);

    const handleUpdateName = async () => {
        if (!newName.trim() || newName === displayName) {
            setIsEditingName(false);
            return;
        }

        try {
            if (session) {
                await updateDisplayName(newName);
            } else {
                localStorage.setItem(GUEST_DISPLAY_NAME_KEY, newName);
            }
            setDisplayName(newName);
            setIsEditingName(false);
        } catch (error) {
            console.error("Failed to update name:", error);
        }
    };

    const handleRevealKey = async () => {
        if (!session?.user?.id) return;

        try {
            const key = await getMasterKey(session.user.id);
            setMasterKey(key);
            setIsRevealingKey(true);
        } catch (error) {
            console.error("Failed to reveal key:", error);
        }
    };

    const copyToClipboard = () => {
        if (masterKey) {
            navigator.clipboard.writeText(masterKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDeleteAccount = async () => {
        setIsPendingDelete(true);
        try {
            await useUserStore.getState().deleteAccount();
        } catch (error) {
            console.error("Failed to delete account:", error);
            setIsPendingDelete(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Profile Section */}
            <section className="space-y-3">
                <h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-1">
                    {session ? "Profile" : "Account"}
                </h4>
                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                    {session ? (
                        <>
                            <SettingItem
                                label="Connected Email"
                                description={session.user?.email || "Authenticated User"}
                                icon={<Ionicons name="mail" size={20} />}
                                iconBg="bg-emerald-500"
                            />
                            <Separator />
                            <SettingItem
                                label="Display Name"
                                description={displayName}
                                icon={<Ionicons name="person" size={20} />}
                                iconBg="bg-blue-500"
                                onClick={() => {
                                    setNewName(displayName);
                                    setIsEditingName(true);
                                }}
                                action={<Ionicons name="pencil" size={14} className="text-muted-foreground group-hover:text-blue-500 transition-colors" />}
                            />
                            <Separator />
                            <SettingItem
                                label="Account Role"
                                description="You can manage your subscription in the mobile app"
                                icon={<Ionicons name="star" size={20} />}
                                iconBg="bg-amber-500"
                                value={<RoleBadge role={userRole} />}
                            />
                            <Separator />
                            <SettingItem
                                label="Sign Out"
                                description="Disconnect from cloud sync"
                                icon={<Ionicons name="log-out" size={20} />}
                                iconBg="bg-rose-500"
                                danger
                                onClick={signOut}
                            />
                        </>
                    ) : (
                        <>
                            <SettingItem
                                label="Sign In"
                                description="Enable cloud sync and multi-device access"
                                icon={<Ionicons name="log-in" size={20} />}
                                iconBg="bg-blue-600"
                                onClick={() => setGuest(false)}
                                action={<Ionicons name="chevron-forward" size={16} className="text-muted-foreground" />}
                            />
                            <Separator />
                            <SettingItem
                                label="Display Name"
                                description={displayName}
                                icon={<Ionicons name="person" size={20} />}
                                iconBg="bg-gray-500"
                                onClick={() => {
                                    setNewName(displayName);
                                    setIsEditingName(true);
                                }}
                                action={<Ionicons name="pencil" size={14} className="text-muted-foreground" />}
                            />
                        </>
                    )}
                </div>
            </section>

            {/* Security Section */}
            {session && (
                <>
                    <section className="space-y-3">
                        <h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-1">
                            Security
                        </h4>
                        <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                            <SettingItem
                                label="Reveal Master Key"
                                description="View your 12-word fallback phrase"
                                icon={<Ionicons name="key" size={20} />}
                                iconBg="bg-indigo-500"
                                onClick={handleRevealKey}
                            />
                        </div>
                        <p className="px-3 text-[11px] text-muted-foreground flex gap-1.5 items-start">
                            <Ionicons name="alert-circle" size={14} className="mt-0.5 shrink-0" />
                            Never share your master key with anyone. It is used to decrypt your data if you lose access.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h4 className="text-[11px] font-bold text-rose-500 tracking-wider uppercase px-1">
                            Danger Zone
                        </h4>
                        <div className="bg-card border-rose-500/20 border rounded-2xl overflow-hidden shadow-sm">
                            <SettingItem
                                label="Delete Account"
                                description="Permanently delete your account and all cloud data"
                                icon={<Ionicons name="trash" size={20} />}
                                iconBg="bg-rose-500"
                                danger
                                onClick={() => setIsDeletingAccount(true)}
                            />
                        </div>
                    </section>
                </>
            )}

            {/* Edit Name Dialog */}
            <Dialog open={isEditingName} onOpenChange={setIsEditingName}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Update Display Name</DialogTitle>
                        <DialogDescription>
                            Enter a new name for your profile. This is what others will see.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="name-input" className="sr-only">Display Name</Label>
                        <Input
                            id="name-input"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Display name"
                            className="bg-accent/30"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateName();
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditingName(false)}>Cancel</Button>
                        <Button onClick={handleUpdateName}>Update</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Master Key Reveal Dialog */}
            <Dialog open={isRevealingKey} onOpenChange={setIsRevealingKey}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Ionicons name="key" size={20} className="text-indigo-500" />
                            Your Master Key
                        </DialogTitle>
                        <DialogDescription>
                            This 12-word phrase is your ultimate backup. Store it safely and offline.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 transition-all duration-300">
                        {masterKey ? (
                            <div className="bg-accent/40 rounded-xl p-4 relative group group-hover:bg-accent/60 border border-indigo-500/10">
                                <div className="grid grid-cols-3 gap-2">
                                    {masterKey.split(' ').map((word, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <span className="text-[10px] text-muted-foreground w-4 text-right">{idx + 1}.</span>
                                            <span className="text-sm font-mono font-medium">{word}</span>
                                        </div>
                                    ))}
                                </div>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="absolute top-2 right-2 h-8 w-8 hover:bg-white dark:hover:bg-slate-800 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={copyToClipboard}
                                >
                                    {copied ? <Ionicons name="checkmark" size={16} className="text-green-500" /> : <Ionicons name="copy" size={16} />}
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                                <Ionicons name="alert-circle" size={48} className="text-rose-500 opacity-20" />
                                <p className="text-sm text-muted-foreground italic">No master key found on this device.</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="sm:justify-center">
                        <Button variant="secondary" onClick={() => setIsRevealingKey(false)} className="w-full sm:w-auto px-8">Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Account Dialog */}
            <Dialog open={isDeletingAccount} onOpenChange={setIsDeletingAccount}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-rose-600">Delete Account</DialogTitle>
                        <DialogDescription>
                            This action is permanent. All your data in the cloud will be deleted. Your local data will remain on this device.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-muted-foreground">
                            To confirm, please realize that this cannot be undone. All your encrypted notes, tasks, and folders on our servers will be wiped.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeletingAccount(false)} disabled={isPendingDelete}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteAccount}
                            disabled={isPendingDelete}
                        >
                            {isPendingDelete ? "Deleting..." : "Permanently Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
