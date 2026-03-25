import { ActivityInsights } from "./components/activity-insights";
import { GreetingHeader } from "./components/greeting-header";
import { QuickStatsWidget } from "./components/quick-stats-widget";
import { RecentNotesGrid } from "./components/recent-notes-grid";

export default function HomePage() {

    return (
        // 1. Root container is strictly screen height. No overflow here.
        <div dir="ltr" className="flex h-full flex-col  bg-background max-w-7xl mx-auto pb-2 ">

            {/* Top Section - Compact Header */}
            {/* 2. Added shrink-0 so the header never compresses */}
            <div className="flex items-center justify-between px-8 py-4 border-b border-border/10 bg-card/5 backdrop-blur-xl z-10 shrink-0">
                <div className="">
                    <GreetingHeader />
                </div>
                <div className="flex justify-end">
                    <QuickStatsWidget />
                </div>
            </div>

            {/* Main Content Area - Total dash height is constrained to viewport */}
            <div className="flex flex-1 flex-col p-8 pt-2 overflow-y-auto custom-scrollbar">
                <div className="mx-auto flex flex-1 w-full flex-col gap-10 lg:min-h-0 ">
                    {/* Top Section: Insights */}
                    <div className="shrink-0 flex flex-col gap-4">
                        <ActivityInsights />
                    </div>
                    {/* Bottom Section: Recent Notes */}
                    <div className="flex-1 lg:min-h-0">
                        <RecentNotesGrid />
                    </div>
                </div>
            </div>
        </div>
    );
}