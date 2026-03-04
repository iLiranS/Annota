import { useTasksStore } from "@annota/core";
import { format } from "date-fns";
import {
    Calendar as CalendarIcon,
    CheckCircle2,
    ChevronDown,
    FolderIcon,
    Link as LinkIcon,
    Plus,
    Trash2
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useAppTheme } from "@/hooks/use-app-theme";
import { cn } from "@/lib/utils";

interface TaskFormValues {
    title: string;
    description: string;
    deadline: Date;
    isWholeDay: boolean;
    completed: boolean;
    links: string[];
    folderId: string | null;
}

export default function TaskDetailDialog() {
    const navigate = useNavigate();
    const { colors } = useAppTheme();
    const { id } = useParams<{ id: string }>();
    const tasks = useTasksStore((s) => s.tasks);
    const updateTask = useTasksStore((s) => s.updateTask);
    const deleteTask = useTasksStore((s) => s.deleteTask);

    const task = tasks.find((t) => t.id === id);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
    } = useForm<TaskFormValues>({
        defaultValues: {
            title: "",
            description: "",
            deadline: new Date(),
            isWholeDay: false,
            completed: false,
            links: [],
            folderId: null,
        },
    });

    const watchedTitle = watch("title") || "";
    const watchedDescription = watch("description") || "";
    const watchedLinks = watch("links") || [];
    const watchedDeadline = watch("deadline");
    const watchedIsWholeDay = watch("isWholeDay");
    const watchedCompleted = watch("completed");

    const [newLink, setNewLink] = useState("");
    const [showLinkInput, setShowLinkInput] = useState(false);

    // Track the last submitted values to avoid redundant updates
    const lastSubmittedValues = useRef<string>("");

    const handleClose = useCallback(() => {
        navigate(-1);
    }, [navigate]);

    // Reset form when navigating between tasks
    useEffect(() => {
        if (task) {
            let links: string[] = [];
            try {
                links = JSON.parse(task.links || "[]");
            } catch (e) {
                links = [];
            }
            const values = {
                title: task.title,
                description: task.description ?? "",
                deadline: task.deadline ? new Date(task.deadline) : new Date(),
                isWholeDay: task.isWholeDay ?? false,
                completed: task.completed ?? false,
                links: links,
                folderId: task.folderId,
            };
            reset(values);
            lastSubmittedValues.current = JSON.stringify(values);
        }
    }, [task?.id, reset, task]);

    const onSubmit = useCallback(async (values: TaskFormValues) => {
        if (!task) return;

        const stringified = JSON.stringify(values);
        if (stringified === lastSubmittedValues.current) return;

        lastSubmittedValues.current = stringified;

        let deadline = values.deadline;
        if (values.isWholeDay) {
            deadline = new Date(deadline);
            deadline.setHours(23, 59, 59, 999);
        }
        try {
            await updateTask(task.id, {
                title: values.title,
                description: values.description,
                deadline: deadline,
                isWholeDay: values.isWholeDay,
                completed: values.completed,
                links: JSON.stringify(values.links),
                folderId: values.folderId,
            });
        } catch (err) {
            console.error("Failed to update task:", err);
        }
    }, [task, updateTask]);

    // Update on blur for text fields
    const handleBlur = () => {
        void handleSubmit(onSubmit)();
    };

    // Immediate update for toggles and specific actions
    const triggerUpdate = () => {
        void handleSubmit(onSubmit)();
    };

    const handleAddLink = () => {
        if (newLink.trim() && watchedLinks.length < 5) {
            const updated = [...watchedLinks, newLink.trim()];
            setValue("links", updated);
            setNewLink("");
            setShowLinkInput(false);
            triggerUpdate();
        }
    };

    const handleRemoveLink = (index: number) => {
        const updated = watchedLinks.filter((_, i) => i !== index);
        setValue("links", updated);
        triggerUpdate();
    };

    const handleDelete = async () => {
        if (!task) return;
        if (confirm("Are you sure you want to delete this task?")) {
            await deleteTask(task.id);
            handleClose();
        }
    };

    if (!task) {
        return null;
    }

    return (
        <Dialog open onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-xl h-[85vh] w-[90vw] gap-0 overflow-hidden p-0 shadow-2xl flex flex-col">
                <DialogHeader className="px-6 pt-5 pb-4 shrink-0 border-b">
                    <DialogTitle className="text-lg flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5" style={{ color: colors.primary }} />
                        Task Details
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-auto p-6 custom-scrollbar">
                    <form className="space-y-6" onBlur={handleBlur} onSubmit={(e) => e.preventDefault()}>
                        {/* Title */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">Title</Label>
                                <span className="text-[10px] tabular-nums font-medium text-muted-foreground/40">
                                    {(watchedTitle || "").length}/50
                                </span>
                            </div>
                            <Input
                                {...register("title")}
                                placeholder="Task Title"
                                maxLength={50}
                                className="border-none bg-transparent p-0 text-xl font-bold shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">Description</Label>
                                <span className="text-[10px] tabular-nums font-medium text-muted-foreground/40">
                                    {(watchedDescription || "").length}/200
                                </span>
                            </div>
                            <div className="rounded-xl bg-muted/40 p-3 ring-1 ring-inset ring-muted-foreground/5 focus-within:ring-primary/20 transition-all">
                                <textarea
                                    {...register("description")}
                                    placeholder="Add description..."
                                    rows={4}
                                    maxLength={200}
                                    className="w-full resize-none border-none bg-transparent p-0 text-sm shadow-none focus-visible:outline-none focus:ring-0 placeholder:text-muted-foreground/40 leading-relaxed"
                                />
                            </div>
                        </div>

                        <Separator className="opacity-50" />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Date & Time Picker */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-2">
                                        <CalendarIcon className="h-3 w-3" /> DEADLINE
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground/70">All Day</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setValue("isWholeDay", !watchedIsWholeDay);
                                                triggerUpdate();
                                            }}
                                            className={cn(
                                                "w-7 h-4 rounded-full p-[2px] transition-colors relative",
                                                watchedIsWholeDay ? "bg-primary" : "bg-muted"
                                            )}
                                            style={watchedIsWholeDay ? { backgroundColor: colors.primary } : {}}
                                        >
                                            <div className={cn(
                                                "w-3 h-3 bg-white rounded-full transition-transform",
                                                watchedIsWholeDay ? "translate-x-3" : "translate-x-0"
                                            )} />
                                        </button>
                                    </div>
                                </div>

                                <FieldGroup className="flex-row gap-2">
                                    <Field className="flex-1">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className="w-full justify-start font-normal text-xs h-9 bg-muted/30 border-muted-foreground/10"
                                                >
                                                    <CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-50" />
                                                    {watchedDeadline ? format(watchedDeadline, "PPP") : "Pick a date"}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={watchedDeadline}
                                                    onSelect={(date) => {
                                                        if (date) {
                                                            const current = new Date(watchedDeadline);
                                                            date.setHours(current.getHours(), current.getMinutes());
                                                            setValue("deadline", date);
                                                            triggerUpdate();
                                                        }
                                                    }}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </Field>

                                    {!watchedIsWholeDay && (
                                        <Field className="w-[100px]">
                                            <Input
                                                type="time"
                                                value={watchedDeadline ? format(watchedDeadline, "HH:mm") : ""}
                                                onChange={(e) => {
                                                    const [hours, minutes] = e.target.value.split(":").map(Number);
                                                    const newDate = new Date(watchedDeadline);
                                                    newDate.setHours(hours, minutes);
                                                    setValue("deadline", newDate);
                                                }}
                                                onBlur={handleBlur}
                                                className="h-9 text-xs bg-muted/30 border-muted-foreground/10"
                                            />
                                        </Field>
                                    )}
                                </FieldGroup>
                            </div>

                            {/* Folder Link Placeholder */}
                            <div className="space-y-3">
                                <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-2">
                                    <FolderIcon className="h-3 w-3" /> FOLDER
                                </Label>
                                <Button
                                    variant="outline"
                                    type="button"
                                    className="w-full justify-between h-9 text-xs bg-muted/30 border-muted-foreground/10 text-muted-foreground hover:text-foreground"
                                    onClick={() => alert("Folder picker popup not implemented - as requested placeholder")}
                                >
                                    <span className="flex items-center gap-2">
                                        <FolderIcon className="h-3.5 w-3.5 opacity-40" />
                                        {task.folderId ? "Connected Folder" : "Link Folder"}
                                    </span>
                                    <ChevronDown className="h-3.5 w-3.5 opacity-40" />
                                </Button>
                            </div>
                        </div>

                        {/* Links */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-2">
                                    <LinkIcon className="h-3 w-3" /> LINKS
                                </Label>
                                {watchedLinks.length < 5 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        type="button"
                                        className="h-6 px-2 text-[10px] hover:bg-primary/10"
                                        style={{ color: colors.primary }}
                                        onClick={() => setShowLinkInput(true)}
                                    >
                                        <Plus className="h-3 w-3 mr-1" /> Add Link
                                    </Button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {watchedLinks.map((link, index) => (
                                    <div key={index} className="group flex items-center gap-2 p-2 rounded-md bg-muted/20 border border-transparent hover:border-primary/20 transition-all">
                                        <LinkIcon className="h-3 w-3 text-muted-foreground" />
                                        <span className="flex-1 text-[11px] truncate">{link}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveLink(index)}
                                            className="opacity-0 group-hover:opacity-100 p-1 rounded-sm hover:bg-destructive/10 text-destructive/70 hover:text-destructive transition-all"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {showLinkInput && (
                                <div className="flex gap-2 animate-in slide-in-from-top-1 duration-200">
                                    <Input
                                        value={newLink}
                                        onChange={(e) => setNewLink(e.target.value)}
                                        placeholder="Paste link..."
                                        className="h-8 text-[11px] bg-muted/50"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddLink();
                                            }
                                            if (e.key === 'Escape') setShowLinkInput(false);
                                        }}
                                    />
                                    <Button size="sm" className="h-8 w-8 p-0" onClick={handleAddLink} style={{ backgroundColor: colors.primary }}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        <Separator className="opacity-50" />

                        {/* Footer Actions */}
                        <div className="flex items-center justify-between">
                            {/* Completed Status */}
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col gap-1">
                                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">Status</Label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setValue("completed", !watchedCompleted);
                                            triggerUpdate();
                                        }}
                                        className="flex items-center gap-2 group transition-all"
                                    >
                                        <div className={cn(
                                            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                            watchedCompleted ? "border-primary bg-primary" : "border-muted-foreground/30 group-hover:border-muted-foreground/50"
                                        )} style={watchedCompleted ? { backgroundColor: colors.primary, borderColor: colors.primary } : {}}>
                                            {watchedCompleted && <CheckCircle2 className="h-4 w-4 text-white" />}
                                        </div>
                                        <span className={cn(
                                            "text-sm font-semibold transition-colors",
                                            watchedCompleted ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                        )} style={watchedCompleted ? { color: colors.primary } : {}}>
                                            {watchedCompleted ? "Completed" : "Mark as completed"}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <Button
                                variant="ghost"
                                type="button"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive bg-destructive/5 px-4 h-11"
                                onClick={handleDelete}
                            >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete Task
                            </Button>
                        </div>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
