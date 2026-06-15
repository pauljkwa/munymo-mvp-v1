import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

/** Strip common markdown syntax so explanations render as plain readable prose */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")          // # headings
    .replace(/\*\*([^*]+)\*\*/g, "$1")   // **bold**
    .replace(/\*([^*]+)\*/g, "$1")       // *italic*
    .replace(/__([^_]+)__/g, "$1")       // __bold__
    .replace(/_([^_]+)_/g, "$1")         // _italic_
    .replace(/`([^`]+)`/g, "$1")         // `code`
    .replace(/^[\*\-\+]\s+/gm, "")       // bullet list markers
    .replace(/^\d+\.\s+/gm, "")          // numbered list markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [link text](url)
    .replace(/^>\s*/gm, "")              // > blockquotes
    .replace(/\n{3,}/g, "\n\n")          // collapse excess blank lines
    .trim();
}
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";

interface MetricExplanationSheetProps {
  metricLabel: string;
}

/**
 * A "What does this mean?" tap target that opens a bottom sheet (mobile) or
 * modal (desktop) with an AI-generated plain-English explanation of the metric.
 * Explanations are fetched from the server, which caches them after the first
 * LLM generation so subsequent loads are instant.
 */
export function MetricExplanationSheet({ metricLabel }: MetricExplanationSheetProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  // Only fetch when the sheet is open
  const { data, isLoading, isError } = trpc.metrics.getExplanation.useQuery(
    { metricLabel },
    { enabled: open, staleTime: Infinity }
  );

  const content = (
    <div className="space-y-4 px-1">
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {metricLabel}
      </p>
      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      )}
      {isError && (
        <p className="text-sm text-destructive">
          Could not load an explanation right now. Please try again.
        </p>
      )}
      {data && (
        <p className="text-sm leading-relaxed text-foreground">{stripMarkdown(data.explanation)}</p>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`What does ${metricLabel} mean?`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          What does this mean?
        </button>

        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <DrawerHeader className="flex items-center justify-between pb-2">
              <DrawerTitle className="text-base">Understanding this metric</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </DrawerHeader>
            <div className="px-4 pb-8 pt-2">{content}</div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-label={`What does ${metricLabel} mean?`}
      >
        <HelpCircle className="h-3.5 w-3.5" />
        What does this mean?
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Understanding this metric</DialogTitle>
          </DialogHeader>
          <div className="pt-2">{content}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
