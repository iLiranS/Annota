import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { removeApiKey, saveApiKey, useAiStore, useSettingsStore } from "@annota/core";
import { Bot, Check, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { SettingItem } from "./setting-item";
import { cn } from "@/lib/utils";

const Toggle = ({ enabled }: { enabled: boolean }) => (
    <div className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        enabled ? "bg-accent-full" : "bg-muted-foreground/60"
    )}>
        <span className={cn(
            "pointer-events-none block h-4 w-4 rounded-full  shadow-lg ring-0 transition-transform duration-200 ease-in-out",
            enabled ? "translate-x-4 bg-background dark:bg-foreground" : "translate-x-0 bg-background dark:bg-foreground"
        )} />
    </div>
);

export function AiSettings() {
    const { general, updateGeneralSettings } = useSettingsStore();
    const {
        activeProvider,
        setActiveProvider,
        hasOpenAiKey,
        setHasOpenAiKey,
        hasAnthropicKey,
        setHasAnthropicKey,
        hasGoogleKey,
        setHasGoogleKey,
        ollamaBaseUrl,
        setOllamaBaseUrl,
        isOllamaRunning,
        checkConnection
    } = useAiStore();

    const [isCheckingOllama, setIsCheckingOllama] = useState(false);

    // Local state for keys
    const [localOpenAiKey, setLocalOpenAiKey] = useState('');
    const [localAnthropicKey, setLocalAnthropicKey] = useState('');
    const [localGoogleKey, setLocalGoogleKey] = useState('');

    // UI states
    const [isSavingOpenAi, setIsSavingOpenAi] = useState(false);
    const [isSavingAnthropic, setIsSavingAnthropic] = useState(false);
    const [isSavingGoogle, setIsSavingGoogle] = useState(false);

    const handleSaveOpenAiKey = async () => {
        setIsSavingOpenAi(true);
        try {
            if (localOpenAiKey.trim()) {
                await saveApiKey('openai', localOpenAiKey.trim());
                setHasOpenAiKey(true);
                setLocalOpenAiKey(''); // Clear input after save
            } else if (!hasOpenAiKey) {
                await removeApiKey('openai');
                setHasOpenAiKey(false);
            }
        } catch (error) {
            console.error("Failed to save OpenAI key:", error);
        } finally {
            setIsSavingOpenAi(false);
        }
    };

    const handleRemoveOpenAiKey = async () => {
        setIsSavingOpenAi(true);
        try {
            await removeApiKey('openai');
            setHasOpenAiKey(false);
            setLocalOpenAiKey('');
        } catch (error) {
            console.error("Failed to remove OpenAI key:", error);
        } finally {
            setIsSavingOpenAi(false);
        }
    };

    const handleSaveAnthropicKey = async () => {
        setIsSavingAnthropic(true);
        try {
            if (localAnthropicKey.trim()) {
                await saveApiKey('anthropic', localAnthropicKey.trim());
                setHasAnthropicKey(true);
                setLocalAnthropicKey('');
            } else if (!hasAnthropicKey) {
                await removeApiKey('anthropic');
                setHasAnthropicKey(false);
            }
        } catch (error) {
            console.error("Failed to save Anthropic key:", error);
        } finally {
            setIsSavingAnthropic(false);
        }
    };

    const handleRemoveAnthropicKey = async () => {
        setIsSavingAnthropic(true);
        try {
            await removeApiKey('anthropic');
            setHasAnthropicKey(false);
            setLocalAnthropicKey('');
        } catch (error) {
            console.error("Failed to remove Anthropic key:", error);
        } finally {
            setIsSavingAnthropic(false);
        }
    };

    const handleSaveGoogleKey = async () => {
        setIsSavingGoogle(true);
        try {
            if (localGoogleKey.trim()) {
                await saveApiKey('google', localGoogleKey.trim());
                setHasGoogleKey(true);
                setLocalGoogleKey('');
            } else if (!hasGoogleKey) {
                await removeApiKey('google');
                setHasGoogleKey(false);
            }
        } catch (error) {
            console.error("Failed to save Google key:", error);
        } finally {
            setIsSavingGoogle(false);
        }
    };

    const handleRemoveGoogleKey = async () => {
        setIsSavingGoogle(true);
        try {
            await removeApiKey('google');
            setHasGoogleKey(false);
            setLocalGoogleKey('');
        } catch (error) {
            console.error("Failed to remove Google key:", error);
        } finally {
            setIsSavingGoogle(false);
        }
    };

    const handleCheckOllama = async () => {
        setIsCheckingOllama(true);
        await checkConnection();
        setIsCheckingOllama(false);
    };

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
            {/* Enable AI Features Toggle */}
            <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                <SettingItem
                    label="Enable AI Features"
                    description="Access AI writing assistant, summaries, and flashcards"
                    icon={<Sparkles size={18} />}
                    iconBg="bg-indigo-600"
                    onClick={() => updateGeneralSettings({ isAiEnabled: !general.isAiEnabled })}
                    action={<Toggle enabled={general.isAiEnabled} />}
                />
            </div>

            {general.isAiEnabled && (
                <>
                    {/* Provider Selection */}
                    <div className="space-y-3 pt-1">
                        <div className="grid gap-2">
                            <Label className="text-[12px] font-semibold">Active AI Provider</Label>
                            <Select value={activeProvider} onValueChange={(v: any) => setActiveProvider(v)}>
                                <SelectTrigger className="w-full h-9 rounded-xl pr-4">
                                    <SelectValue placeholder="Select Provider" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border/40 shadow-xl">
                                    <SelectItem value="ollama">Ollama (Local)</SelectItem>
                                    <SelectItem value="openai">OpenAI</SelectItem>
                                    <SelectItem value="anthropic">Anthropic</SelectItem>
                                    <SelectItem value="google">Google (Gemini)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Provider Settings */}
                    <div className="space-y-5 pt-4 border-t border-border/30">
                        {activeProvider === 'ollama' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-primary/80">
                                    <Bot size={15} />
                                    <h4 className="text-[13px] font-bold">Ollama Configuration</h4>
                                </div>

                                <div className="grid gap-3">
                                    <Label htmlFor="ollama-url" className="text-xs font-medium">Base URL</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="ollama-url"
                                            value={ollamaBaseUrl}
                                            onChange={(e) => setOllamaBaseUrl(e.target.value)}
                                            placeholder="http://127.0.0.1:11434"
                                            className="h-9 rounded-xl border-border/40"
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleCheckOllama}
                                            disabled={isCheckingOllama}
                                            className="rounded-xl px-4 h-9"
                                        >
                                            {isOllamaRunning ? (
                                                <div className="flex items-center gap-2 text-green-500">
                                                    <Check size={14} />
                                                    <span>Connected</span>
                                                </div>
                                            ) : (
                                                "Check"
                                            )}
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground opacity-60">
                                        Ensure Ollama is running and CORS is configured if needed.
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeProvider === 'openai' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-primary/80">
                                    <ShieldCheck size={15} />
                                    <h4 className="text-[13px] font-bold">OpenAI Settings</h4>
                                </div>

                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="openai-key" className="text-xs font-medium">API Key</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="openai-key"
                                                type="password"
                                                value={localOpenAiKey}
                                                onChange={(e) => setLocalOpenAiKey(e.target.value)}
                                                placeholder={hasOpenAiKey ? "sk-••••••••••••• (Key configured)" : "sk-..."}
                                                className="h-9 rounded-xl border-border/40 font-mono text-[13px] flex-1"
                                            />
                                            {hasOpenAiKey && !localOpenAiKey.trim() ? (
                                                <Button
                                                    onClick={handleRemoveOpenAiKey}
                                                    disabled={isSavingOpenAi}
                                                    variant="destructive"
                                                    size="sm"
                                                    className="h-9 rounded-xl px-4"
                                                >
                                                    {isSavingOpenAi ? "Removing..." : "Remove"}
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={handleSaveOpenAiKey}
                                                    disabled={isSavingOpenAi || (!localOpenAiKey.trim() && hasOpenAiKey)}
                                                    size="sm"
                                                    className="h-9 rounded-xl px-4"
                                                >
                                                    {isSavingOpenAi ? "Saving..." : "Save"}
                                                </Button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                                            <span>Stored locally in secure vault.</span>
                                            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="flex items-center gap-0.5 hover:text-primary transition-colors ml-1">
                                                Get key <ExternalLink size={10} />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeProvider === 'anthropic' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-primary/80">
                                    <ShieldCheck size={15} />
                                    <h4 className="text-[13px] font-bold">Anthropic Settings</h4>
                                </div>

                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="anthropic-key" className="text-xs font-medium">API Key</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="anthropic-key"
                                                type="password"
                                                value={localAnthropicKey}
                                                onChange={(e) => setLocalAnthropicKey(e.target.value)}
                                                placeholder={hasAnthropicKey ? "sk-ant-••••••••••••• (Key configured)" : "sk-ant-..."}
                                                className="h-9 rounded-xl border-border/40 font-mono text-[13px] flex-1"
                                            />
                                            {hasAnthropicKey && !localAnthropicKey.trim() ? (
                                                <Button
                                                    onClick={handleRemoveAnthropicKey}
                                                    disabled={isSavingAnthropic}
                                                    variant="destructive"
                                                    size="sm"
                                                    className="h-9 rounded-xl px-4"
                                                >
                                                    {isSavingAnthropic ? "Removing..." : "Remove"}
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={handleSaveAnthropicKey}
                                                    disabled={isSavingAnthropic || (!localAnthropicKey.trim() && hasAnthropicKey)}
                                                    size="sm"
                                                    className="h-9 rounded-xl px-4"
                                                >
                                                    {isSavingAnthropic ? "Saving..." : "Save"}
                                                </Button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                                            <span>Stored locally in secure vault.</span>
                                            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="flex items-center gap-0.5 hover:text-primary transition-colors ml-1">
                                                Get key <ExternalLink size={10} />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeProvider === 'google' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-primary/80">
                                    <ShieldCheck size={15} />
                                    <h4 className="text-[13px] font-bold">Google (Gemini) Settings</h4>
                                </div>

                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="google-key" className="text-xs font-medium">API Key (Google AI Studio)</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="google-key"
                                                type="password"
                                                value={localGoogleKey}
                                                onChange={(e) => setLocalGoogleKey(e.target.value)}
                                                placeholder={hasGoogleKey ? "••••••••••••• (Key configured)" : "Paste your API key here..."}
                                                className="h-9 rounded-xl border-border/40 font-mono text-[13px] flex-1"
                                            />
                                            {hasGoogleKey && !localGoogleKey.trim() ? (
                                                <Button
                                                    onClick={handleRemoveGoogleKey}
                                                    disabled={isSavingGoogle}
                                                    variant="destructive"
                                                    size="sm"
                                                    className="h-9 rounded-xl px-4"
                                                >
                                                    {isSavingGoogle ? "Removing..." : "Remove"}
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={handleSaveGoogleKey}
                                                    disabled={isSavingGoogle || (!localGoogleKey.trim() && hasGoogleKey)}
                                                    size="sm"
                                                    className="h-9 rounded-xl px-4"
                                                >
                                                    {isSavingGoogle ? "Saving..." : "Save"}
                                                </Button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                                            <span>Stored locally in secure vault. Uses OpenAI compatibility endpoint.</span>
                                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="flex items-center gap-0.5 hover:text-primary transition-colors ml-1">
                                                Get key <ExternalLink size={10} />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

