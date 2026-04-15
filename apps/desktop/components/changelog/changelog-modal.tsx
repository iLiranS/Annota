import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChangelog } from "@annota/core";
import { Bug, CheckCircle2, Loader2, Sparkles } from "lucide-react";

export default function ChangelogModal() {
  const { isOpen, isLoading, changelogData, markAsSeen, setIsOpen } = useChangelog("desktop");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && (isLoading ? setIsOpen(false) : markAsSeen())}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl p-0 overflow-hidden border-none bg-note-bg backdrop-blur-xl shadow-2xl">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-accent-full" />
            <p className="text-sm font-medium text-muted-foreground">Fetching latest updates...</p>
          </div>
        ) : !changelogData ? (
          <div className="p-10 flex flex-col items-center justify-center">
            <p className="text-sm font-medium text-muted-foreground text-center">No changelog data available.</p>
            <Button className="mt-4" onClick={() => setIsOpen(false)}>Close</Button>
          </div>
        ) : (
          <>
            {/* Header Hero */}
            <div className="relative h-fill bg-linear-to-br from-accent-full/10 via-accent-full/5 to-transparent flex items-end p-8 border-b border-border/50">
              <div className="absolute top-6 right-8 bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border border-primary/20">
                Released {changelogData.date}
              </div>
              <div className="space-y-1">
                <DialogTitle asChild>
                  <h2 className="text-3xl font-bold tracking-tight text-foreground">{changelogData.title}</h2>
                </DialogTitle>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-[500px] overflow-y-auto premium-scrollbar">
              <div className="space-y-10  px-8 py-2">
                {changelogData.features.length > 0 && (
                  <section className="space-y-5">
                    <div className="flex items-center gap-2.5 text-primary">
                      <div className="p-1.5 rounded-md bg-primary/10">
                        <Sparkles className="h-4 w-4 text-accent-full" />
                      </div>
                      <h3 className="font-bold text-base tracking-tight italic text-accent-full">What's New</h3>
                    </div>
                    <ul className="space-y-4">
                      {changelogData.features.map((feature, i) => (
                        <li key={i} className="flex gap-4 group">
                          <div className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0 group-hover:scale-125 transition-transform duration-200" />
                          <p className="text-sm leading-relaxed text-foreground/80 font-medium">{feature}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {changelogData.fixes.length > 0 && (
                  <section className="space-y-5">
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <div className="p-1.5 rounded-md bg-muted">
                        <Bug className="h-4 w-4" />
                      </div>
                      <h3 className="font-bold text-base tracking-tight italic text-foreground/60">Housekeeping</h3>
                    </div>
                    <ul className="space-y-4">
                      {changelogData.fixes.map((fix, i) => (
                        <li key={i} className="flex gap-4 items-start group">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500/60 shrink-0" />
                          <p className="text-sm leading-relaxed text-muted-foreground font-light">{fix}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="p-6 bg-muted/20 border-t border-border/50">
              <Button
                onClick={() => markAsSeen()}
                className="w-full sm:w-auto px-10 bg-accent-full text-white hover:bg-accent-full/80 h-11 font-bold rounded-xl shadow-lg shadow-primary/10 transition-all hover:scale-[1.02] active:scale-95"
              >
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
