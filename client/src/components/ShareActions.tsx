import { useState } from "react";
import { Share2, Check, ImageDown } from "lucide-react";
import { toast } from "sonner";

/**
 * Share buttons for a result or an archive matchup.
 *
 *  - Share: the phone's own share sheet (every installed app, no setup), or
 *    the clipboard where there isn't one.
 *  - Save image: the 1200×630 card from /og/:slug.png as a file. Instagram
 *    can't take a link, only a picture — on phones this opens the share sheet
 *    with the image itself (Save Image, Instagram Stories); elsewhere it
 *    downloads.
 *  - X / Facebook / WhatsApp: shown only where there's no share sheet
 *    (mostly desktop browsers), so sharing is still one click.
 */
export interface ShareActionsProps {
  text: string;
  /** Absolute link; unfurls into the card in chat apps. */
  url: string;
  /** Same-origin path to the card image, e.g. /og/pep-vs-kdp-2026-10-09.png?s=100 */
  imagePath: string;
  imageFileName: string;
  label: string;
}

const hasShareSheet = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

const isAbort = (err: unknown) => (err as { name?: string })?.name === "AbortError";

export default function ShareActions({ text, url, imagePath, imageFileName, label }: ShareActionsProps) {
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const nativeShare = hasShareSheet();

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setDone(true);
      toast.success("Copied — paste it anywhere.");
    } catch {
      toast.error("Couldn't share from this browser.");
    }
  }

  async function share() {
    if (!nativeShare) return copy();
    try {
      // Separate url so chat apps unfurl it into the preview card.
      await navigator.share({ text, url });
      setDone(true);
    } catch (err) {
      if (!isAbort(err)) await copy();
    }
  }

  async function saveImage() {
    setSaving(true);
    try {
      const res = await fetch(imagePath);
      if (!res.ok) throw new Error(`card ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], imageFileName, { type: "image/png" });
      if (nativeShare && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = imageFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch (err) {
      if (!isAbort(err)) toast.error("Couldn't save the image.");
    } finally {
      setSaving(false);
    }
  }

  const enc = encodeURIComponent;
  const intents = [
    { name: "X", href: `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { name: "WhatsApp", href: `https://wa.me/?text=${enc(`${text}\n${url}`)}` },
  ];

  return (
    <div className="flex flex-col items-stretch sm:items-start gap-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={share}
          className="btn-ghost text-sm px-5 py-2.5 inline-flex items-center justify-center gap-2"
        >
          {done ? <Check size={15} /> : <Share2 size={15} />}
          {done ? "Shared" : label}
        </button>
        <button
          type="button"
          onClick={saveImage}
          disabled={saving}
          className="btn-ghost text-sm px-5 py-2.5 inline-flex items-center justify-center gap-2"
        >
          <ImageDown size={15} />
          {saving ? "Preparing…" : "Save image"}
        </button>
      </div>
      {!nativeShare && (
        <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--color-subtle)" }}>
          <span>Post to</span>
          {intents.map((i) => (
            <a
              key={i.name}
              href={i.href}
              target="_blank"
              rel="noopener"
              className="rounded-full px-3 py-1 font-semibold"
              style={{ background: "var(--color-surface-raised)", color: "var(--color-foreground)" }}
            >
              {i.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
