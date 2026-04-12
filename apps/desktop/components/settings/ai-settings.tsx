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
import { useAiStore } from "@annota/core";
import { AlertCircle, Bot, Check, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";

export function AiSettings() {
    const {
        activeProvider,
        setActiveProvider,
        openAiKey,
        setOpenAiKey,
        anthropicKey,
        setAnthropicKey,
        selectedModelOpenAi,
        setSelectedModelOpenAi,
        selectedModelAnthropic,
        setSelectedModelAnthropic,
        googleKey,
        setGoogleKey,
        selectedModelGoogle,
        setSelectedModelGoogle,
        ollamaBaseUrl,
        setOllamaBaseUrl,
        isOllamaRunning,
        checkConnection
    } = useAiStore();

    const [isCheckingOllama, setIsCheckingOllama] = useState(false);

    const handleCheckOllama = async () => {
        setIsCheckingOllama(true);
        await checkConnection();
        setIsCheckingOllama(false);
    };

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
            {/* Recommendations & Technical Info */}
            <div className="grid gap-3">
                <div className="flex gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/10 items-start">
                    <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                    <div className="space-y-1">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-primary/80">Recommendation</p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                            We recommend <strong>Google Gemini</strong> for its generous free limits or <strong>Ollama</strong> for 100% private local use.
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 p-4 rounded-2xl bg-muted/30 border border-border/40 items-start">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground/60" />
                    <div className="space-y-1">
                        <p className="text-[11px] font-bold uppercase tracking-wider opacity-60">Context Handling</p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground/80">
                            <strong>Ollama:</strong> Receives fresh note content on <em>every</em> message for maximum accuracy. <br/>
                            <strong>Cloud:</strong> Receives context on the first message or context shift to optimize tokens/cost.
                        </p>
                    </div>
                </div>
            </div>

            {/* Token Warning for Cloud Providers */}
            {activeProvider !== 'ollama' && (
                <div className="flex gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500/90 items-start">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-[11px] font-bold uppercase tracking-wider">Token Usage Warning</p>
                        <p className="text-[11px] leading-relaxed opacity-80">
                            Cloud providers may result in higher token usage as note context is sent with messages. Monitor your dashboard carefully.
                        </p>
                    </div>
                </div>
            )}

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
                                <Input 
                                    id="openai-key"
                                    type="password"
                                    value={openAiKey}
                                    onChange={(e) => setOpenAiKey(e.target.value)}
                                    placeholder="sk-..."
                                    className="h-9 rounded-xl border-border/40 font-mono text-[13px]"
                                />
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                                    <span>Stored locally on this device.</span>
                                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="flex items-center gap-0.5 hover:text-primary transition-colors ml-1">
                                        Get key <ExternalLink size={10} />
                                    </a>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label className="text-xs font-medium">Model Selection</Label>
                                <Select value={selectedModelOpenAi} onValueChange={setSelectedModelOpenAi}>
                                    <SelectTrigger className="h-9 rounded-xl border-border/40">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border/40">
                                        <SelectItem value="gpt-4o">GPT-4o (Smartest)</SelectItem>
                                        <SelectItem value="gpt-4o-mini">GPT-4o mini (Fast & Cheap)</SelectItem>
                                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                                    </SelectContent>
                                </Select>
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
                                <Input 
                                    id="anthropic-key"
                                    type="password"
                                    value={anthropicKey}
                                    onChange={(e) => setAnthropicKey(e.target.value)}
                                    placeholder="sk-ant-..."
                                    className="h-9 rounded-xl border-border/40 font-mono text-[13px]"
                                />
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                                    <span>Stored locally on this device.</span>
                                    <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="flex items-center gap-0.5 hover:text-primary transition-colors ml-1">
                                        Get key <ExternalLink size={10} />
                                    </a>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label className="text-xs font-medium">Model Selection</Label>
                                <Select value={selectedModelAnthropic} onValueChange={setSelectedModelAnthropic}>
                                    <SelectTrigger className="h-9 rounded-xl border-border/40">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border/40">
                                        <SelectItem value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet</SelectItem>
                                        <SelectItem value="claude-3-5-haiku-latest">Claude 3.5 Haiku</SelectItem>
                                        <SelectItem value="claude-3-opus-latest">Claude 3 Opus</SelectItem>
                                    </SelectContent>
                                </Select>
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
                                <Input 
                                    id="google-key"
                                    type="password"
                                    value={googleKey}
                                    onChange={(e) => setGoogleKey(e.target.value)}
                                    placeholder="Paste your API key here..."
                                    className="h-9 rounded-xl border-border/40 font-mono text-[13px]"
                                />
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                                    <span>Stored locally on this device. Uses OpenAI compatibility endpoint.</span>
                                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="flex items-center gap-0.5 hover:text-primary transition-colors ml-1">
                                        Get key <ExternalLink size={10} />
                                    </a>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label className="text-xs font-medium">Model Selection</Label>
                                <Select value={selectedModelGoogle} onValueChange={setSelectedModelGoogle}>
                                    <SelectTrigger className="h-9 rounded-xl border-border/40">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border/40">
                                        <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                                        <SelectItem value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
