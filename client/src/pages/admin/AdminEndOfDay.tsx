import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Plus, Trash2, Upload } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetricRow {
  id: string;
  label: string;
  value: string;
}

interface FormState {
  // Close today
  closeGameId: string;
  winner: "A" | "B" | "";
  companyAPerf: string;
  companyBPerf: string;
  resultSummary: string;
  hindsightSpotlight: string;
  // Tomorrow's game
  nextGameDate: string;
  nextExchange: string;
  nextCompanyAName: string;
  nextCompanyATicker: string;
  nextCompanyBName: string;
  nextCompanyBTicker: string;
  nextSector: string;
  nextPairingRationale: string;
  nextLockoutAt: string;
  // Tomorrow's research
  nextResearchContent: string;
  metrics: MetricRow[];
  // Tomorrow's validation question
  nextQuestionType: "multiple_choice" | "yes_no" | "true_false" | "";
  nextQuestionText: string;
  nextQuestionOptions: string[];
  nextCorrectAnswer: string;
}

const EXCHANGES = ["NASDAQ", "NYSE", "ASX", "LSE", "TSX", "HKEX", "SSE", "EURONEXT"];

function makeId() {
  return Math.random().toString(36).slice(2);
}

const defaultForm: FormState = {
  closeGameId: "",
  winner: "",
  companyAPerf: "",
  companyBPerf: "",
  resultSummary: "",
  hindsightSpotlight: "",
  nextGameDate: "",
  nextExchange: "NASDAQ",
  nextCompanyAName: "",
  nextCompanyATicker: "",
  nextCompanyBName: "",
  nextCompanyBTicker: "",
  nextSector: "",
  nextPairingRationale: "",
  nextLockoutAt: "",
  nextResearchContent: "",
  metrics: [{ id: makeId(), label: "", value: "" }],
  nextQuestionType: "",
  nextQuestionText: "",
  nextQuestionOptions: ["", ""],
  nextCorrectAnswer: "",
};

// ─── JSON Import ──────────────────────────────────────────────────────────────

function parseJsonImport(raw: string): Partial<FormState> | null {
  try {
    const obj = JSON.parse(raw);
    // Filter out analyst consensus from pre-game metrics — it belongs in Hindsight Spotlight only
    const CONSENSUS_PATTERN = /analyst\s*(consensus|rating|rec|recommendation)/i;
    const rawMetrics = obj.nextResearchMetrics
      ? Object.entries(obj.nextResearchMetrics as Record<string, string>)
      : [];
    const filteredMetrics = rawMetrics.filter(([label]) => !CONSENSUS_PATTERN.test(label));
    const removedCount = rawMetrics.length - filteredMetrics.length;
    if (removedCount > 0) {
      // We'll surface a warning via a returned flag so the caller can toast
      (obj as Record<string, unknown>).__consensusRemoved = removedCount;
    }
    const metrics: MetricRow[] = filteredMetrics.length > 0
      ? filteredMetrics.map(([label, value]) => ({ id: makeId(), label, value }))
      : [];
    return {
      closeGameId: String(obj.closeGameId ?? ""),
      winner: obj.winner ?? "",
      companyAPerf: obj.companyAPerf !== undefined ? String(obj.companyAPerf) : "",
      companyBPerf: obj.companyBPerf !== undefined ? String(obj.companyBPerf) : "",
      resultSummary: obj.resultSummary ?? "",
      hindsightSpotlight: obj.hindsightSpotlight ?? "",
      nextGameDate: obj.nextGameDate ?? "",
      nextExchange: obj.nextExchange ?? "NASDAQ",
      nextCompanyAName: obj.nextCompanyAName ?? "",
      nextCompanyATicker: obj.nextCompanyATicker ?? "",
      nextCompanyBName: obj.nextCompanyBName ?? "",
      nextCompanyBTicker: obj.nextCompanyBTicker ?? "",
      nextSector: obj.nextSector ?? "",
      nextPairingRationale: obj.nextPairingRationale ?? "",
      nextLockoutAt: obj.nextLockoutAt ?? "",
      nextResearchContent: obj.nextResearchContent ?? "",
      metrics: metrics.length > 0 ? metrics : [{ id: makeId(), label: "", value: "" }],
      nextQuestionType: obj.nextQuestionType ?? "",
      nextQuestionText: obj.nextQuestionText ?? "",
      nextQuestionOptions: obj.nextQuestionOptions ?? ["", ""],
      nextCorrectAnswer: obj.nextCorrectAnswer ?? "",
    };
  } catch {
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminEndOfDay() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [showJsonPanel, setShowJsonPanel] = useState(false);
  const [sectionOpen, setSectionOpen] = useState({ close: true, tomorrow: true, research: true, question: true });

  const endOfDay = trpc.admin.endOfDay.useMutation({
    onSuccess: () => {
      toast.success("End of day complete — today's result published and tomorrow's game created.");
      navigate("/admin");
    },
    onError: (err) => {
      toast.error(`Failed: ${err.message}`);
    },
  });

  // ── Active games list for the "close game" selector ──
  const { data: gamesData } = trpc.admin.listAllGames.useQuery({ limit: 10, offset: 0 });
  const activeGames = gamesData?.filter((g) => g.status === "active" || g.status === "locked") ?? [];

  function set(key: keyof FormState, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleJsonImport() {
    let obj: Record<string, unknown> | null = null;
    try { obj = JSON.parse(jsonInput); } catch { /* handled below */ }
    const parsed = obj ? parseJsonImport(jsonInput) : null;
    if (!parsed) {
      setJsonError("Invalid JSON — please check the format and try again.");
      return;
    }
    setJsonError("");
    setForm((prev) => ({ ...prev, ...parsed }));
    setShowJsonPanel(false);
    setJsonInput("");
    const removed = obj?.__consensusRemoved as number | undefined;
    if (removed && removed > 0) {
      toast.warning(
        `${removed} analyst consensus metric${removed > 1 ? "s were" : " was"} removed from Research Metrics. Analyst consensus belongs in the Hindsight Spotlight only.`,
        { duration: 6000 }
      );
    } else {
      toast.success("Fields populated from JSON. Please review before submitting.");
    }
  }

  function addMetric() {
    set("metrics", [...form.metrics, { id: makeId(), label: "", value: "" }]);
  }

  function updateMetric(id: string, field: "label" | "value", val: string) {
    set(
      "metrics",
      form.metrics.map((m) => (m.id === id ? { ...m, [field]: val } : m))
    );
  }

  function removeMetric(id: string) {
    set(
      "metrics",
      form.metrics.filter((m) => m.id !== id)
    );
  }

  function updateOption(idx: number, val: string) {
    const opts = [...form.nextQuestionOptions];
    opts[idx] = val;
    set("nextQuestionOptions", opts);
  }

  function addOption() {
    set("nextQuestionOptions", [...form.nextQuestionOptions, ""]);
  }

  function removeOption(idx: number) {
    set(
      "nextQuestionOptions",
      form.nextQuestionOptions.filter((_, i) => i !== idx)
    );
  }

  function handleSubmit() {
    if (!form.closeGameId || !form.winner || !form.resultSummary || !form.hindsightSpotlight) {
      toast.error("Please complete all required fields in the 'Close Today's Game' section.");
      return;
    }
    if (!form.nextGameDate || !form.nextCompanyAName || !form.nextCompanyATicker || !form.nextCompanyBName || !form.nextCompanyBTicker) {
      toast.error("Please complete all required fields in the 'Set Up Tomorrow's Game' section.");
      return;
    }

    const metricsRecord: Record<string, string> = {};
    form.metrics.filter((m) => m.label && m.value).forEach((m) => {
      metricsRecord[m.label] = m.value;
    });

    endOfDay.mutate({
      closeGameId: parseInt(form.closeGameId),
      winner: form.winner as "A" | "B",
      companyAPerf: parseFloat(form.companyAPerf) || 0,
      companyBPerf: parseFloat(form.companyBPerf) || 0,
      resultSummary: form.resultSummary,
      hindsightSpotlight: form.hindsightSpotlight,
      nextGameDate: form.nextGameDate,
      nextExchange: form.nextExchange,
      nextCompanyAName: form.nextCompanyAName,
      nextCompanyATicker: form.nextCompanyATicker,
      nextCompanyBName: form.nextCompanyBName,
      nextCompanyBTicker: form.nextCompanyBTicker,
      nextSector: form.nextSector || undefined,
      nextPairingRationale: form.nextPairingRationale || undefined,
      nextLockoutAt: form.nextLockoutAt || undefined,
      nextResearchContent: form.nextResearchContent || undefined,
      nextResearchMetrics: Object.keys(metricsRecord).length > 0 ? metricsRecord : undefined,
      nextQuestionType: (form.nextQuestionType as "multiple_choice" | "yes_no" | "true_false") || undefined,
      nextQuestionText: form.nextQuestionText || undefined,
      nextQuestionOptions: form.nextQuestionType === "multiple_choice" ? form.nextQuestionOptions.filter(Boolean) : undefined,
      nextCorrectAnswer: form.nextCorrectAnswer || undefined,
    });
  }

  function toggleSection(key: keyof typeof sectionOpen) {
    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <AdminLayout>
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">End of Day</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Publish today's result and pre-load tomorrow's game in one atomic operation.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowJsonPanel((v) => !v)}>
          <Upload className="w-4 h-4 mr-2" />
          Import JSON
        </Button>
      </div>

      {/* JSON import panel */}
      {showJsonPanel && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Paste Manus JSON Output</CardTitle>
            <CardDescription>Paste the JSON from your daily Manus curation task. All fields will be populated for review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{ "closeGameId": 12, "winner": "A", ... }'
              rows={8}
              className="font-mono text-xs"
            />
            {jsonError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {jsonError}
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={handleJsonImport} size="sm">Populate Fields</Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowJsonPanel(false); setJsonInput(""); setJsonError(""); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Section 1: Close Today's Game ── */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => toggleSection("close")}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="default" className="bg-red-600 text-white">Close Today</Badge>
              <CardTitle className="text-base">Today's Result</CardTitle>
            </div>
            {sectionOpen.close ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </CardHeader>
        {sectionOpen.close && (
          <CardContent className="space-y-5">
            {/* Game selector */}
            <div className="space-y-1.5">
              <Label>Game to Close <span className="text-destructive">*</span></Label>
              {activeGames.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active or locked games found.</p>
              ) : (
                <Select value={form.closeGameId} onValueChange={(v) => set("closeGameId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select game…" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeGames.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.gameDate} — {g.companyAName} vs {g.companyBName}
                        <Badge variant="outline" className="ml-2 text-xs">{g.status}</Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Winner */}
            <div className="space-y-1.5">
              <Label>Winner <span className="text-destructive">*</span></Label>
              <div className="flex gap-3">
                {(["A", "B"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => set("winner", w)}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                      form.winner === w
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                    }`}
                  >
                    Company {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Performance percentages */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Company A Performance %</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="+2.45"
                  value={form.companyAPerf}
                  onChange={(e) => set("companyAPerf", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Company B Performance %</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="-1.23"
                  value={form.companyBPerf}
                  onChange={(e) => set("companyBPerf", e.target.value)}
                />
              </div>
            </div>

            {/* Result summary */}
            <div className="space-y-1.5">
              <Label>Result Summary <span className="text-destructive">*</span></Label>
              <Textarea
                rows={3}
                placeholder="A short paragraph summarising what happened in today's matchup…"
                value={form.resultSummary}
                onChange={(e) => set("resultSummary", e.target.value)}
              />
            </div>

            {/* Hindsight Spotlight */}
            <div className="space-y-1.5">
              <Label>Hindsight Spotlight <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground">
                Post-result educational debrief. Cover: what the research indicated → how players voted → what actually happened → conclusions with hindsight. <strong>Include analyst consensus here</strong> (e.g. "14 analysts had a Buy rating on Company A — the market agreed") as a retrospective teaching point, not as pre-game guidance.
              </p>
              <Textarea
                rows={5}
                placeholder="With the benefit of hindsight, the research metrics clearly indicated…"
                value={form.hindsightSpotlight}
                onChange={(e) => set("hindsightSpotlight", e.target.value)}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Section 2: Tomorrow's Game ── */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => toggleSection("tomorrow")}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="default" className="bg-emerald-600 text-white">Tomorrow</Badge>
              <CardTitle className="text-base">Next Game Setup</CardTitle>
            </div>
            {sectionOpen.tomorrow ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </CardHeader>
        {sectionOpen.tomorrow && (
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Game Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.nextGameDate} onChange={(e) => set("nextGameDate", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Exchange</Label>
                <Select value={form.nextExchange} onValueChange={(v) => set("nextExchange", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXCHANGES.map((ex) => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Company A Name <span className="text-destructive">*</span></Label>
                <Input placeholder="Apple Inc." value={form.nextCompanyAName} onChange={(e) => set("nextCompanyAName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Company A Ticker <span className="text-destructive">*</span></Label>
                <Input placeholder="AAPL" value={form.nextCompanyATicker} onChange={(e) => set("nextCompanyATicker", e.target.value.toUpperCase())} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Company B Name <span className="text-destructive">*</span></Label>
                <Input placeholder="Microsoft Corp." value={form.nextCompanyBName} onChange={(e) => set("nextCompanyBName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Company B Ticker <span className="text-destructive">*</span></Label>
                <Input placeholder="MSFT" value={form.nextCompanyBTicker} onChange={(e) => set("nextCompanyBTicker", e.target.value.toUpperCase())} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sector</Label>
                <Input placeholder="Technology" value={form.nextSector} onChange={(e) => set("nextSector", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Lockout Time</Label>
                <Input type="datetime-local" value={form.nextLockoutAt} onChange={(e) => set("nextLockoutAt", e.target.value ? new Date(e.target.value).toISOString() : "")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Pairing Rationale</Label>
              <Textarea
                rows={3}
                placeholder="Why these two companies make an interesting matchup today…"
                value={form.nextPairingRationale}
                onChange={(e) => set("nextPairingRationale", e.target.value)}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Section 3: Research ── */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => toggleSection("research")}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="outline">Research</Badge>
              <CardTitle className="text-base">Research Content & Metrics</CardTitle>
            </div>
            {sectionOpen.research ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </CardHeader>
        {sectionOpen.research && (
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Research Content</Label>
              <Textarea
                rows={6}
                placeholder="The curated research material players will read before making their final selection…"
                value={form.nextResearchContent}
                onChange={(e) => set("nextResearchContent", e.target.value)}
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Research Metrics</Label>
                <Button variant="outline" size="sm" onClick={addMetric}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Metric
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Key financial data points displayed as a structured table. Add, remove, and edit freely — these are not hard-coded. <strong>Do not include analyst consensus ratings here</strong> — that belongs in the Hindsight Spotlight post-result debrief only.
              </p>
              <div className="space-y-2">
                {form.metrics.map((m) => (
                  <div key={m.id} className="flex gap-2 items-center">
                    <Input
                      placeholder="Label (e.g. P/E Ratio)"
                      value={m.label}
                      onChange={(e) => updateMetric(m.id, "label", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value (e.g. 28.4x)"
                      value={m.value}
                      onChange={(e) => updateMetric(m.id, "value", e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMetric(m.id)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Section 4: Validation Question ── */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => toggleSection("question")}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="outline">Validation</Badge>
              <CardTitle className="text-base">Research Validation Question</CardTitle>
            </div>
            {sectionOpen.question ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </CardHeader>
        {sectionOpen.question && (
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Question Type</Label>
              <Select value={form.nextQuestionType} onValueChange={(v) => set("nextQuestionType", v)}>
                <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes_no">Yes / No</SelectItem>
                  <SelectItem value="true_false">True / False</SelectItem>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.nextQuestionType && (
              <>
                <div className="space-y-1.5">
                  <Label>Question Text</Label>
                  <Textarea
                    rows={3}
                    placeholder="Based on the research provided, which statement is correct?"
                    value={form.nextQuestionText}
                    onChange={(e) => set("nextQuestionText", e.target.value)}
                  />
                </div>

                {form.nextQuestionType === "multiple_choice" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Answer Options</Label>
                      <Button variant="outline" size="sm" onClick={addOption}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Option
                      </Button>
                    </div>
                    {form.nextQuestionOptions.map((opt, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <span className="text-xs text-muted-foreground w-5 shrink-0">{String.fromCharCode(65 + idx)}.</span>
                        <Input
                          placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                          value={opt}
                          onChange={(e) => updateOption(idx, e.target.value)}
                          className="flex-1"
                        />
                        {form.nextQuestionOptions.length > 2 && (
                          <Button variant="ghost" size="icon" onClick={() => removeOption(idx)} className="text-muted-foreground hover:text-destructive shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Correct Answer</Label>
                  <p className="text-xs text-muted-foreground">
                    This is never shown to players until after they answer. For Y/N enter "Yes" or "No". For T/F enter "True" or "False". For multiple choice enter the exact option text.
                  </p>
                  {form.nextQuestionType === "multiple_choice" ? (
                    <Select value={form.nextCorrectAnswer} onValueChange={(v) => set("nextCorrectAnswer", v)}>
                      <SelectTrigger><SelectValue placeholder="Select correct answer…" /></SelectTrigger>
                      <SelectContent>
                        {form.nextQuestionOptions.filter(Boolean).map((opt, idx) => (
                          <SelectItem key={idx} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : form.nextQuestionType === "yes_no" ? (
                    <Select value={form.nextCorrectAnswer} onValueChange={(v) => set("nextCorrectAnswer", v)}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={form.nextCorrectAnswer} onValueChange={(v) => set("nextCorrectAnswer", v)}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="True">True</SelectItem>
                        <SelectItem value="False">False</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Submit */}
      <div className="flex items-center justify-between pt-2 pb-8">
        <p className="text-xs text-muted-foreground max-w-sm">
          This action is atomic — today's result and tomorrow's game are committed together. Result emails will be sent automatically on submit.
        </p>
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={endOfDay.isPending}
          className="min-w-[180px]"
        >
          {endOfDay.isPending ? (
            "Publishing…"
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Publish & Create Next
            </>
          )}
        </Button>
      </div>
    </div>
    </AdminLayout>
  );
}
