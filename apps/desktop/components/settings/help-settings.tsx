import { openUrl } from '@tauri-apps/plugin-opener';
import {
    ExternalLink,
    Globe,
    Mail,
    MessageCircle
} from "lucide-react";

import { SettingItem } from "./setting-item";

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
                        description="Chat with the community and the team"
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
