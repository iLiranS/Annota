import { useTasksStore, type Task } from "@annota/core";
import { Calendar, X } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface TaskFormValues {
    title: string;
    description: string;
    deadline: string;
    isWholeDay: boolean;
}

function taskToFormValues(task: Task): TaskFormValues {
    return {
        title: task.title,
        description: task.description ?? "",
        deadline: task.deadline
            ? new Date(task.deadline).toISOString().split("T")[0]
            : "",
        isWholeDay: task.isWholeDay ?? false,
    };
}

export default function TaskDetailSidebar() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const tasks = useTasksStore((s) => s.tasks);
    const updateTask = useTasksStore((s) => s.updateTask);

    const task = tasks.find((t) => t.id === id);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty },
    } = useForm<TaskFormValues>({
        defaultValues: task ? taskToFormValues(task) : undefined,
    });

    // Reset form when navigating between tasks
    useEffect(() => {
        if (task) reset(taskToFormValues(task));
    }, [task?.id, reset]);

    if (!task) {
        return (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
                Task not found
            </div>
        );
    }

    const onSubmit = async (values: TaskFormValues) => {
        await updateTask(task.id, {
            title: values.title,
            description: values.description,
            deadline: values.deadline ? new Date(values.deadline) : task.deadline,
            isWholeDay: values.isWholeDay,
        });
    };

    const handleBlur = () => {
        if (isDirty) void handleSubmit(onSubmit)();
    };

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Task Details
                </h3>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => navigate("/tasks")}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <Separator />

            <form
                onSubmit={handleSubmit(onSubmit)}
                className="flex-1 space-y-5 overflow-auto p-4"
            >
                {/* Title */}
                <div className="space-y-1.5">
                    <Label htmlFor="task-title" className="text-xs">
                        Title
                    </Label>
                    <Input
                        id="task-title"
                        {...register("title", {
                            required: "Title is required",
                            maxLength: { value: 50, message: "Max 50 characters" },
                        })}
                        onBlur={handleBlur}
                        className="font-medium"
                    />
                    {errors.title && (
                        <p className="text-xs text-destructive">{errors.title.message}</p>
                    )}
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                    <Label htmlFor="task-description" className="text-xs">
                        Description
                    </Label>
                    <textarea
                        id="task-description"
                        {...register("description", {
                            maxLength: { value: 200, message: "Max 200 characters" },
                        })}
                        onBlur={handleBlur}
                        className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder="Add a description..."
                    />
                    {errors.description && (
                        <p className="text-xs text-destructive">
                            {errors.description.message}
                        </p>
                    )}
                </div>

                {/* Due date */}
                <div className="space-y-1.5">
                    <Label htmlFor="task-deadline" className="text-xs">
                        Due Date
                    </Label>
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <Input
                            id="task-deadline"
                            type="date"
                            {...register("deadline")}
                            onBlur={handleBlur}
                            className="flex-1"
                        />
                    </div>
                </div>

                {/* Whole day toggle */}
                <div className="flex items-center gap-2">
                    <input
                        id="task-whole-day"
                        type="checkbox"
                        {...register("isWholeDay")}
                        onChange={(e) => {
                            register("isWholeDay").onChange(e);
                            void handleSubmit(onSubmit)();
                        }}
                        className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor="task-whole-day" className="text-xs font-normal">
                        All-day task
                    </Label>
                </div>
            </form>
        </div>
    );
}
