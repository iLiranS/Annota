import { useState } from "react";
import { GreetingHeader } from "./components/greeting-header";
import { HomeCalendar } from "./components/home-calendar";
import { PersonalMomentum } from "./components/personal-momentum";
import { QuickStatsWidget } from "./components/quick-stats-widget";
import { RecentNotesGrid } from "./components/recent-notes-grid";
import { TasksOnboarding } from "./components/tasks-onboarding";
import WeeklyInsights from "./components/weekly-insights";

export default function HomePage() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    return (
        // 1. Root container is strictly screen height. No overflow here.
        <div dir="ltr" className="flex h-full flex-col lg:overflow-hidden bg-background max-w-7xl mx-auto">

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
            <div className="flex-1 flex flex-col lg:overflow-hidden p-8 pt-2 overflow-y-auto custom-scrollbar">
                <div className="mx-auto flex-1 w-full flex flex-col lg:grid lg:grid-cols-[3fr_2fr] gap-10 lg:min-h-0 lg:overflow-hidden">

                    {/* Column 1: Insights & Notes - Scrollable independently if content exceeds viewport */}
                    <div className="flex flex-col gap-4 lg:pr-2 lg:min-h-0">
                        <div className="shrink-0 flex flex-col gap-4">
                            <WeeklyInsights />
                            <PersonalMomentum />
                        </div>
                        <div className="shrink-0">
                            <RecentNotesGrid />
                        </div>
                    </div>

                    {/* Column 2: Calendar & Tasks - Tasks scroll internally to match Column 1's bottom area */}
                    <div className="flex flex-col gap-4 lg:min-h-0 lg:overflow-hidden">
                        <div className="shrink-0">
                            <HomeCalendar
                                selectedDate={selectedDate}
                                onDateSelect={setSelectedDate}
                            />
                        </div>
                        <div className="lg:flex-1 lg:min-h-0">
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