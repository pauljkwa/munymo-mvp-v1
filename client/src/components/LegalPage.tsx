import PublicLayout from "@/components/PublicLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

interface LegalPageProps {
  title: string;
  subtitle?: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export default function LegalPage({ title, subtitle, lastUpdated, children }: LegalPageProps) {
  usePageMeta({ title: `${title} | Munymo` });
  return (
    <PublicLayout>
      <div className="container py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-10 pb-8" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <p className="section-label mb-3">Legal</p>
            <h1 className="font-display mb-3" style={{ color: "var(--color-foreground)" }}>
              {title}
            </h1>
            {subtitle && (
              <p className="text-base leading-relaxed" style={{ color: "var(--color-muted)" }}>
                {subtitle}
              </p>
            )}
            <p className="text-xs mt-4" style={{ color: "var(--color-subtle)" }}>
              Last updated: {lastUpdated}
            </p>
          </div>

          {/* Content */}
          <div className="legal-content space-y-8">
            {children}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className="text-lg font-semibold mb-3"
        style={{ color: "var(--color-foreground)" }}
      >
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
        {children}
      </div>
    </section>
  );
}
