import { openUrl } from '@tauri-apps/plugin-opener';
import {
    ExternalLink,
    Globe,
    Mail,
    MessageCircle
} from "lucide-react";

import { SettingItem } from "./setting-item";

function Github({ size = 18 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
        </svg>
    );
}

export function HelpSettings() {
    const handleMailSupport = async () => {
        await openUrl("mailto:support@annota.online");
    };

    const handleDiscordOpen = async () => {
        await openUrl("https://discord.gg/dG5nNJPDAh");
    };

    const handleWebsiteOpen = async () => {
        await openUrl("https://annota.online");
    };

    const handleGithubOpen = async () => {
        await openUrl("https://github.com/iLiranS/Annota");
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Contact & Support Section */}
            <section className="space-y-3">
                <h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-1">
                    Contact & Support
                </h4>
                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                    <SettingItem
                        label="Email Support"
                        description="Send us an email for any issues or feedback"
                        icon={<Mail size={18} />}
                        iconBg="bg-blue-600"
                        onClick={handleMailSupport}
                        action={<ExternalLink size={16} className="text-muted-foreground" />}
                    />
                    <div className="h-px bg-border/50 mx-4" />
                    <SettingItem
                        label="Join Discord"
                        description="Chat with the community and the team and ask for help"
                        icon={<MessageCircle size={18} />}
                        iconBg="bg-[#5865F2]"
                        onClick={handleDiscordOpen}
                        action={<ExternalLink size={16} className="text-muted-foreground" />}
                    />
                </div>
            </section>

            {/* Resources Section */}
            <section className="space-y-3">
                <h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-1">
                    Resources
                </h4>
                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                    <SettingItem
                        label="Official Website"
                        description="Learn more about Annota"
                        icon={<Globe size={18} />}
                        iconBg="bg-emerald-500"
                        onClick={handleWebsiteOpen}
                        action={<ExternalLink size={16} className="text-muted-foreground" />}
                    />
                    <div className="h-px bg-border/50 mx-4" />
                    <SettingItem
                        label="GitHub Repository"
                        description="View source code and contribute"
                        icon={<Github size={18} />}
                        iconBg="bg-zinc-800"
                        onClick={handleGithubOpen}
                        action={<ExternalLink size={16} className="text-muted-foreground" />}
                    />
                </div>
            </section>

            <div className="px-1 py-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Have feedback or found a bug? We'd love to hear from you!
                    The best way to get in touch is via our Discord server or by sending an email to our support team.
                </p>
            </div>
        </div>
    );
}
