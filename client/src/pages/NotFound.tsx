import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";

export default function NotFound() {
  return (
    <PublicLayout>
      <div className="min-h-[60vh] flex items-center justify-center py-20">
        <div className="text-center max-w-md px-4">
          <div className="flex justify-center mb-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "var(--color-danger-muted)" }}
            >
              <AlertCircle size={32} style={{ color: "var(--color-danger)" }} />
            </div>
          </div>
          <h1
            className="font-display mb-2"
            style={{ fontSize: "3.5rem", lineHeight: 1, color: "var(--color-foreground)" }}
          >
            404
          </h1>
          <h2 className="text-xl font-semibold mb-3" style={{ color: "var(--color-foreground)" }}>
            Page Not Found
          </h2>
          <p className="mb-8 leading-relaxed" style={{ color: "var(--color-muted)" }}>
            Sorry, the page you are looking for doesn't exist. It may have been moved or deleted.
          </p>
          <Link href="/" className="btn-brand text-sm px-6 py-2.5">
            Go Home
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
