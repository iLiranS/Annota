import { useState } from "react";
import { GreetingHeader } from "./components/greeting-header";
import { HomeCalendar } from "./components/home-calendar";
import { QuickStatsWidget } from "./components/quick-stats-widget";
import { RecentNotesGrid } from "./components/recent-notes-grid";
import { TasksOnboarding } from "./components/tasks-onboarding";
import WeeklyInsights from "./components/weekly-insights";

export default function HomePage() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    return (
        // 1. Root container is strictly screen height. No overflow here.
        <div className="flex h-full flex-col overflow-hidden bg-background max-w-7xl mx-auto">

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

            {/* Main Content Area - Scrollable when needed */}
            {/* 3. Page scrolling happens HERE now, giving the flexbox a boundary */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-4">

                {/* 4. On desktop, we use a grid to enforce a strict height constraint so the inner scrollbars activate. On mobile, it flows naturally. */}
                <div className="mx-auto flex flex-col lg:grid lg:grid-rows-[auto_1fr] gap-6 lg:h-full lg:min-h-[600px]">

                    {/* Row 1: Insights & Calendar */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 shrink-0">
                        <div className="lg:col-span-7">
                            <WeeklyInsights />
                        </div>
                        <div className="lg:col-span-5">
                            <HomeCalendar
                                selectedDate={selectedDate}
                                onDateSelect={setSelectedDate}
                            />
                        </div>
                    </div>

                    {/* Row 2: Recent Notes & Tasks */}
                    {/* 5. The parent grid hands this row exactly the remaining space. `lg:min-h-0` stops it from overflowing that space. */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:min-h-0">
                        <div className="lg:col-span-7 flex flex-col lg:min-h-0">
                            <RecentNotesGrid />
                        </div>
                        <div className="lg:col-span-5 flex flex-col lg:min-h-0">
                            <TasksOnboarding selectedDate={selectedDate} />
                        </div>
                    </div>

                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(0,0,0,0.1);
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                }
            `}</style>
        </div>
    );
}