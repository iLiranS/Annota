import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    DAILY_NOTES_FOLDER_ID,
    useNotesStore,
} from "@annota/core";
import { eachDayOfInterval, endOfMonth, endOfWeek, format, isToday, startOfMonth, startOfWeek, } from "date-fns";
import { BookOpen, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

export function DailyNotesCalendar() {
    const navigate = useNavigate();
    const { notes, createNote } = useNotesStore();


    const [currentMonth, setCurrentMonth] = useState(new Date());


    const dailyNotes = useMemo(() => {
        return notes.filter(n => n.folderId === DAILY_NOTES_FOLDER_ID && !n.isDeleted);
    }, [notes]);

    const calendarDays = useMemo(() => {
        const startOfSelectedMonth = startOfMonth(currentMonth);
        const endOfSelectedMonth = endOfMonth(currentMonth);
        const startDate = startOfWeek(startOfSelectedMonth);
        const endDate = endOfWeek(endOfSelectedMonth);

        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [currentMonth]);

    const dailyNotesMap = useMemo(() => {
        const map: Record<string, any> = {};
        dailyNotes.forEach(note => {
            const dateStr = format(new Date(note.createdAt), "yyyy-MM-dd");
            map[dateStr] = note;
        });
        return map;
    }, [dailyNotes]);

    const handleDateClick = async (date: Date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        const existingNote = dailyNotesMap[dateStr];

        if (existingNote) {
            navigate(`/notes/${DAILY_NOTES_FOLDER_ID}/${existingNote.id}`);
        } else {
            if (isToday(date)) {
                const newNote = await createNote({ folderId: DAILY_NOTES_FOLDER_ID });
                navigate(`/notes/${DAILY_NOTES_FOLDER_ID}/${newNote.id}`);
            }
        }
    };

    const nextMonth = () => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const goToToday = () => {
        setCurrentMonth(new Date());
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background">
            {/* Clean Header */}
            <div className="sticky top-0 z-10 px-8 py-4 bg-background border-b border-border">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-accent/10 text-accent-full">
                                <CalendarIcon className="h-5 w-5" />
                            </div>
                            <h1 className="text-lg font-bold tracking-tight">Daily Notes</h1>
                        </div>
                        <div className="h-4 w-px bg-border" />
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <BookOpen className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">{dailyNotes.length} memories</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={goToToday}
                            className="h-8 rounded-md px-3 text-xs font-medium hover:bg-accent/5 hover:text-accent-full transition-colors"
                        >
                            Today
                        </Button>
                        <div className="flex items-center bg-muted/30 p-0.5 rounded-md border border-border">
                            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-7 w-7 rounded-sm hover:bg-background">
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="px-3 text-[10px] font-bold uppercase tracking-widest min-w-[110px] text-center text-foreground/90">
                                {format(currentMonth, "MMMM yyyy")}
                            </span>
                            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-7 w-7 rounded-sm hover:bg-background">
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
                <div className="max-w-4xl w-full h-full flex flex-col items-center justify-center">
                    <div className="w-full bg-border/40 p-px rounded-xl overflow-hidden border border-border shadow-sm flex flex-col h-fit max-h-full">
                        <div className="grid grid-cols-7 bg-muted/50 border-b border-border">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="text-center text-[9px] font-bold text-muted-foreground uppercase tracking-widest py-2.5">
                                    {day}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-px auto-rows-fr flex-1">
                            {calendarDays.map((date) => {
                                const dateStr = format(date, "yyyy-MM-dd");
                                const note = dailyNotesMap[dateStr];
                                const isTodayDate = isToday(date);
                                const isCurrentMonth = date.getMonth() === currentMonth.getMonth();

                                return (
                                    <div
                                        key={dateStr}
                                        onClick={() => handleDateClick(date)}
                                        className={cn(
                                            "relative min-h-[70px] flex flex-col group transition-all cursor-pointer p-2.5",
                                            isCurrentMonth ? "bg-card" : "bg-muted/10 opacity-30 select-none pointer-events-none",
                                            "hover:bg-accent/3"
                                        )}
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className={cn(
                                                "text-xs font-bold tabular-nums transition-colors",
                                                isTodayDate ? "text-accent-full" : "text-foreground/60 group-hover:text-foreground"
                                            )}>
                                                {format(date, "d")}
                                            </span>
                                            {note && (
                                                <div className="h-1.5 w-1.5 rounded-full bg-accent-full shadow-[0_0_8px_rgba(var(--accent-rgb),0.5)]" />
                                            )}
                                        </div>

                                        <div className="mt-1.5 flex-1 min-h-0 overflow-hidden">
                                            {note ? (
                                                <p className="text-[10px] text-muted-foreground line-clamp-2 leading-snug group-hover:text-foreground/70 transition-colors italic">
                                                    {note.preview}
                                                </p>
                                            ) : isTodayDate ? (
                                                <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100">
                                                    <div className="p-1 rounded-full bg-accent/10 text-accent-full">
                                                        <Plus className="h-3 w-3" />
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>

                                        {isTodayDate && (
                                            <div className="absolute inset-0 border border-accent/40 bg-accent/2 pointer-events-none" />
                                        )}

                                        {/* Subtle hover accent line */}
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent scale-x-0 group-hover:scale-x-100 transition-transform origin-left opacity-60" />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-8 mt-6 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-accent-full shadow-[0_0_8px_rgba(var(--accent-rgb),0.5)]" />
                            <span>Memories Recorded</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-sm border border-accent/40 bg-accent/5" />
                            <span>Today</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
