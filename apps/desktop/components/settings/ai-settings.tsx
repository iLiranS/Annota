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
import { removeApiKey, saveApiKey, useAiStore } from "@annota/core";
import { AlertCircle, Bot, Check, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";

export function AiSettings() {
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

    // Fetch mask values asynchronously on mount just in case we wanted them, 
    // but the hasKey booleans already tell us if they exist.
    // Instead of showing the full key, we just rely on hasKey flags to show a masked placeholder.

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

    const handleCheckOllama = async () => {
        setIsCheckingOllama(true);
        await checkConnection();
        setIsCheckingOllama(false);
    };

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
            {/* Token Warning for Cloud Providers */}
            {activeProvider !== 'ollama' && (
                <div className="flex gap-2.5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-amber-500/80 items-start">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-tight">TOKENS USED</p>
                        <p className="text-[11px] leading-snug opacity-90">
                            Because the full note context is injected into every message to maintain accuracy, Cloud providers (OpenAI, Anthropic, Google) will consume higher token volumes. Models with "Prompt Caching" (like Claude 3.5 or Gemini 2.5) will automatically discount these costs. Local AI (Ollama) is always free.
                        </p>
                    </div>
                </div>
            )}

            {/* Recommendations & Technical Info */}
            <div className="flex gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/10 items-start">
                <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/70" />
                <div className="space-y-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-tight text-primary/70">Info</p>
                    <p className="text-[11px] leading-snug text-muted-foreground/90">
                        We recommend <strong>Gemini free API version</strong> for fast and easy cloud responses, or <strong>Ollama</strong> for a fully private, offline experience. To ensure the AI is always in sync with your writing, the live note content is sent as context with every single message across all providers.
                    </p>
                </div>
            </div>

            {/* Provider Selection */}
            <div className="space-y-3">
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
            <div className="space-y-5 pt-1 border-t border-border/30">
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
                                    <Button
                                        onClick={handleSaveOpenAiKey}
                                        disabled={isSavingOpenAi || (!localOpenAiKey.trim() && hasOpenAiKey)}
                                        size="sm"
                                        className="h-9 rounded-xl px-4"
                                    >
                                        {isSavingOpenAi ? "Saving..." : "Save"}
                                    </Button>
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
                                    <Button
                                        onClick={handleSaveAnthropicKey}
                                        disabled={isSavingAnthropic || (!localAnthropicKey.trim() && hasAnthropicKey)}
                                        size="sm"
                                        className="h-9 rounded-xl px-4"
                                    >
                                        {isSavingAnthropic ? "Saving..." : "Save"}
                                    </Button>
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
                                    <Button
                                        onClick={handleSaveGoogleKey}
                                        disabled={isSavingGoogle || (!localGoogleKey.trim() && hasGoogleKey)}
                                        size="sm"
                                        className="h-9 rounded-xl px-4"
                                    >
                                        {isSavingGoogle ? "Saving..." : "Save"}
                                    </Button>
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
        </div>
    );
}
