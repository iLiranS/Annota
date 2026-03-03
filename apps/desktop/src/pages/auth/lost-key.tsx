import { authApi, useUserStore, userService } from "@annota/core";
import { AlertTriangle, CheckCircle, Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LostKeyPage() {
    const navigate = useNavigate();
    const [confirmText, setConfirmText] = useState("");
    const [processing, setProcessing] = useState(false);
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);

    const isDeleteConfirmed = confirmText.trim().toUpperCase() === "DELETE";

    const getCurrentUserId = async (): Promise<string | null> => {
        const {
            data: { session },
        } = await authApi.getSession();
        return session?.user?.id ?? null;
    };

    const handleProceed = async () => {
        if (!isDeleteConfirmed) return;

        const userId = await getCurrentUserId();
        if (!userId) {
            navigate("/auth/login", { replace: true });
            return;
        }

        setProcessing(true);
        try {
            const newMnemonic = await userService.handleLostKey(userId);
            setGeneratedKey(newMnemonic);
        } catch (err) {
            console.error("Lost key flow error:", err);
        } finally {
            setProcessing(false);
        }
    };

    const copyToClipboard = async () => {
        if (!generatedKey) return;
        await navigator.clipboard.writeText(generatedKey);
    };

    const handleDone = () => {
        useUserStore.getState().setHasMasterKey(true);
        navigate("/", { replace: true });
    };

    // ── New key generated ────────────────────────────────────────
    if (generatedKey) {
        return (
            <Card className="border-border/50 shadow-lg">
                <CardHeader className="items-center space-y-3 pb-2">
                    <CheckCircle className="h-14 w-14 text-green-500" />
                    <CardTitle className="text-2xl font-bold">New Master Key</CardTitle>
                    <CardDescription className="text-center text-base leading-relaxed">
                        Your old data has been erased. Write down these 12 words — this is
                        the ONLY way to recover your data.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                    <div className="flex flex-wrap justify-center gap-2 rounded-lg border border-border p-4">
                        {generatedKey.split(" ").map((word, index) => (
                            <span
                                key={index}
                                className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1"
                            >
                                <span className="text-xs font-medium text-primary">
                                    {index + 1}
                                </span>
                                <span className="text-sm font-bold">{word}</span>
                            </span>
                        ))}
                    </div>

                    <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={copyToClipboard}
                    >
                        <Copy className="h-4 w-4" />
                        Copy to Clipboard
                    </Button>

                    <Button className="w-full" onClick={handleDone}>
                        I Have Saved It
                    </Button>
                </CardContent>
            </Card>
        );
    }

    // ── Confirmation flow ────────────────────────────────────────
    return (
        <Card className="border-border/50 shadow-lg">
            <CardHeader className="items-center space-y-3 pb-2">
                <AlertTriangle className="h-14 w-14 text-destructive" />
                <CardTitle className="text-2xl font-bold">Create New Key</CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
                <div className="rounded-lg bg-destructive/10 p-4">
                    <p className="text-center text-sm font-semibold leading-relaxed text-destructive">
                        This action is irreversible. Creating a new master key will
                        permanently erase all your encrypted cloud data — notes, tasks, and
                        folders.
                    </p>
                </div>

                <div className="rounded-lg bg-muted p-4">
                    <p className="text-center text-sm leading-relaxed text-muted-foreground">
                        Only do this if you've truly lost your 12-word phrase and have no
                        other way to recover your data. You will start completely fresh.
                    </p>
                </div>

                <div className="space-y-2">
                    <p className="text-center text-sm">
                        Type <span className="font-bold">DELETE</span> to confirm
                    </p>
                    <Input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        className="text-center text-lg font-bold tracking-widest"
                        placeholder="DELETE"
                        autoComplete="off"
                    />
                </div>

                <Button
                    className="w-full"
                    variant={isDeleteConfirmed ? "destructive" : "secondary"}
                    disabled={!isDeleteConfirmed || processing}
                    onClick={handleProceed}
                >
                    {processing ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        "Erase Data & Create New Key"
                    )}
                </Button>

                <button
                    type="button"
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => navigate(-1)}
                >
                    Go back
                </button>
            </CardContent>
        </Card>
    );
}
