import { authApi, useUserStore, userService } from "@annota/core";
import { generateMasterKey } from "@annota/core/platform";
import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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

export default function MasterKeyPage() {
    const navigate = useNavigate();
    const [mode, setMode] = useState<"generate" | "import">("import");
    const [checkingUser, setCheckingUser] = useState(true);
    const [hasCloudData, setHasCloudData] = useState(false);
    const [mnemonic, setMnemonic] = useState("");
    const [importWords, setImportWords] = useState<string[]>(Array(12).fill(""));
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getCurrentUserId = async (): Promise<string | null> => {
        const {
            data: { session },
        } = await authApi.getSession();
        return session?.user?.id ?? null;
    };

    const generateNewKey = async () => {
        const key = await generateMasterKey();
        setMnemonic(key);
    };

    useEffect(() => {
        const checkExistingData = async () => {
            try {
                setCheckingUser(true);
                const userId = await getCurrentUserId();
                if (!userId) {
                    navigate("/auth/login", { replace: true });
                    return;
                }
                const hasData = await userService.hasMasterKey(userId);
                if (hasData) {
                    setHasCloudData(true);
                    setMode("import");
                } else {
                    setMode("generate");
                    await generateNewKey();
                }
            } catch {
                setMode("generate");
                await generateNewKey();
            } finally {
                setCheckingUser(false);
            }
        };
        checkExistingData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const copyToClipboard = async () => {
        await navigator.clipboard.writeText(mnemonic);
    };

    const handleConfirmGenerate = async () => {
        const userId = await getCurrentUserId();
        if (!userId) {
            navigate("/auth/login", { replace: true });
            return;
        }

        const confirmed = window.confirm(
            hasCloudData
                ? "You already have encrypted data in the cloud! Generating a NEW key will permanently delete your old cloud data so you can start fresh. Continue?"
                : "Have you written down your master key? If you lose it, you will permanently lose access to your synced data.",
        );

        if (!confirmed) return;

        await userService.setupMasterKey(userId, mnemonic, hasCloudData);
        useUserStore.getState().setHasMasterKey(true);
        navigate("/", { replace: true });
    };

    const handleConfirmImport = async () => {
        const userId = await getCurrentUserId();
        if (!userId) {
            navigate("/auth/login", { replace: true });
            return;
        }

        const joinedWords = importWords.join(" ").trim().toLowerCase();
        setImporting(true);
        setError(null);
        try {
            const storedValidator = await useUserStore.getState().fetchKeyValidator(userId);
            await userService.importMasterKey(userId, joinedWords, storedValidator);
            useUserStore.getState().setHasMasterKey(true);
            navigate("/", { replace: true });
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Validation failed";
            if (message === "INVALID_FORMAT") {
                setError("The 12-word phrase you entered is invalid. Please check your spelling.");
            } else if (message === "HASH_MISMATCH") {
                setError("The 12-word phrase does not match your registered key. Please try again.");
            } else {
                setError("Could not verify your key. Please try again.");
            }
        } finally {
            setImporting(false);
        }
    };

    const handleWordChange = (text: string, index: number) => {
        const clipboardWords = text.trim().split(/\s+/);
        if (clipboardWords.length === 12) {
            setImportWords(clipboardWords.map((w) => w.toLowerCase()));
            return;
        }
        const newWords = [...importWords];
        newWords[index] = text.toLowerCase().trim();
        setImportWords(newWords);
        if (error) setError(null);
    };

    if (checkingUser) {
        return (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                    Checking cloud data...
                </p>
            </div>
        );
    }

    return (
        <Card className="border-border/50 shadow-lg">
            <CardHeader className="items-center space-y-2 pb-2">
                <CardTitle className="text-2xl font-bold">
                    {mode === "generate" ? "Your Master Key" : "Recover Account"}
                </CardTitle>

                {/* Mode toggle */}
                <div className="flex gap-2 pt-1">
                    <Button
                        variant={mode === "import" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMode("import")}
                    >
                        Import Key
                    </Button>
                    <Button
                        variant={mode === "generate" ? "default" : "outline"}
                        size="sm"
                        onClick={async () => {
                            setMode("generate");
                            if (!mnemonic) await generateNewKey();
                        }}
                    >
                        Generate New
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-4">
                {mode === "generate" ? (
                    <>
                        {hasCloudData && (
                            <div className="rounded-lg bg-destructive/10 p-4">
                                <p className="text-center text-sm font-semibold text-destructive">
                                    Warning: You have existing cloud data. Generating a new key
                                    will permanently delete your previous data!
                                </p>
                            </div>
                        )}

                        <CardDescription className="text-center text-sm leading-relaxed">
                            Write down these 12 words in order. This is the ONLY way to
                            recover your data if you lose your device.
                        </CardDescription>

                        <div className="flex flex-wrap justify-center gap-2 rounded-lg border border-border p-4">
                            {mnemonic
                                ? mnemonic.split(" ").map((word, index) => (
                                    <span
                                        key={index}
                                        className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1"
                                    >
                                        <span className="text-xs font-medium text-primary">
                                            {index + 1}
                                        </span>
                                        <span className="text-sm font-bold">{word}</span>
                                    </span>
                                ))
                                : null}
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={generateNewKey}
                            >
                                Randomize
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={copyToClipboard}
                            >
                                Copy
                            </Button>
                        </div>

                        <Button className="w-full" onClick={handleConfirmGenerate}>
                            I Have Saved It
                        </Button>
                    </>
                ) : (
                    <>
                        <CardDescription className="text-center text-sm leading-relaxed">
                            Enter your existing 12-word master key to regain access to your
                            synced data. You can also paste the entire phrase into the first
                            box.
                        </CardDescription>

                        <div className="grid grid-cols-2 gap-2">
                            {importWords.map((word, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1"
                                >
                                    <span className="w-4 text-xs text-muted-foreground">
                                        {index + 1}
                                    </span>
                                    <Input
                                        value={word}
                                        onChange={(e) => handleWordChange(e.target.value, index)}
                                        className="h-8 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                                        placeholder="word"
                                        autoComplete="off"
                                        autoCapitalize="off"
                                        autoCorrect="off"
                                        spellCheck={false}
                                    />
                                </div>
                            ))}
                        </div>

                        {error && (
                            <div className="rounded-lg bg-destructive/10 p-3 flex items-center gap-2 border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                                <p className="text-xs font-medium text-destructive">
                                    {error}
                                </p>
                            </div>
                        )}

                        <Button
                            className="w-full"
                            disabled={importing}
                            onClick={handleConfirmImport}
                        >
                            {importing ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                "Recover Account"
                            )}
                        </Button>

                        <button
                            type="button"
                            className="w-full text-center text-sm text-muted-foreground underline hover:text-foreground"
                            onClick={() => navigate("/auth/lost-key")}
                        >
                            Lost your key? Create a new one
                        </button>
                    </>
                )}

                <button
                    type="button"
                    className="w-full text-center text-sm font-semibold text-destructive hover:text-destructive/80"
                    onClick={async () => {
                        await useUserStore.getState().signOut();
                        navigate("/auth/login", { replace: true });
                    }}
                >
                    Sign out of this account
                </button>
            </CardContent>
        </Card>
    );
}
