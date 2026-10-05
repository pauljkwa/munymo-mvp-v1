import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * The one explanation an iPhone player gets when they ask for notifications
 * in Safari, wherever they ask (profile, game page, after sign-up).
 *
 * WHY a sheet with a reason first: Apple only delivers web push to sites
 * added to the Home Screen. Without the reason, "add us to your home screen"
 * reads as an app grabbing screen space, and without the steps, an Enable
 * button that silently does nothing reads as a fault (Paul, 2026-10-05).
 *
 * Step 3's second sign-in is real, checked on Paul's iPhone 2026-10-05:
 * Safari and the Home Screen app don't share sign-ins.
 */
export function IosInstallSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-lg">One step first: add Munymo to your home screen</SheetTitle>
          <SheetDescription>
            Apple only lets iPhone apps send notifications once they're on your home screen. It's a
            shortcut, not an App Store download, and you can delete it like any other icon.
          </SheetDescription>
        </SheetHeader>

        <ol className="px-4 space-y-3 text-sm" style={{ color: "var(--color-foreground)" }}>
          <Step n={1}>
            Tap <ShareIcon /> at the bottom of Safari
          </Step>
          <Step n={2}>
            Tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>
            <span className="block text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
              You may need to scroll down to find it.
            </span>
          </Step>
          <Step n={3}>Open Munymo from your home screen and sign in once more</Step>
          <Step n={4}>
            Tap <strong>Turn on notifications</strong> when we ask
          </Step>
        </ol>

        <p className="px-4 mt-4 text-sm" style={{ color: "var(--color-muted)" }}>
          Until then, we'll keep emailing your results.
        </p>

        <div className="px-4 mt-4">
          <button className="btn-brand w-full justify-center" onClick={() => onOpenChange(false)}>
            Got it
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: "var(--color-brand)", color: "var(--color-brand-foreground)" }}
      >
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

/** Safari's Share glyph: a square with an arrow coming out of the top. */
function ShareIcon() {
  return (
    <svg
      aria-label="the Share button"
      role="img"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      className="inline -mt-1 mx-0.5"
      fill="none"
      stroke="#007AFF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" />
      <path d="M12 15V3" />
      <path d="M8.5 6.5 12 3l3.5 3.5" />
    </svg>
  );
}
