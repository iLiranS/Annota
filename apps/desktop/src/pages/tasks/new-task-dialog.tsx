import { useTasksStore } from "@annota/core";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewTaskDialog() {
    const navigate = useNavigate();
    const createTask = useTasksStore((s) => s.createTask);

    const [title, setTitle] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [creating, setCreating] = useState(false);

    const handleClose = () => {
        navigate("/tasks");
    };

    const handleCreate = async () => {
        if (!title.trim()) return;
        setCreating(true);
        try {
            await createTask?.({
                title: title.trim(),
                deadline: dueDate ? new Date(dueDate) : undefined,
            });
            navigate("/tasks");
        } catch (err) {
            console.error("Failed to create task:", err);
        } finally {
            setCreating(false);
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>New Task</DialogTitle>
                    <DialogDescription>
                        Add a new task to your list.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="task-title">Title</Label>
                        <Input
                            id="task-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="What needs to be done?"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleCreate();
                            }}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="task-date">Due Date (optional)</Label>
                        <Input
                            id="task-date"
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreate}
                        disabled={!title.trim() || creating}
                    >
                        {creating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            "Create Task"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
