/**
 * Share card — the 1200×630 image a chat app or social network shows when
 * someone pastes a Munymo matchup link. GET /og/:slug.png
 *
 * WHY: a shared result used to unfurl as the generic site card (logo + "Free
 * Daily Stock Market Prediction Game") under a line of emoji that meant
 * nothing to anyone outside the game (Paul, 2026-10-12: "ugly… someone not
 * in the know would have no idea"). The picture IS the message in iMessage,
 * WhatsApp, Facebook and X, so it has to explain itself: two real stocks,
 * who won, by how much, how the sharer did, and that anyone can play free.
 *
 * Optional query params put the sharer's own result on the card. They're
 * user-editable (anyone can type ?s=100), same as a Wordle grid — it's a
 * brag, not a record — so they're validated to a tiny fixed vocabulary and
 * never echo free text into the image.
 *   s  = score 0–100      st = streak 0–999
 *   r  = 1 called it / 0 missed it
 *   c  = t | l | c  (Toss-up / Leaning / Confident)
 *
 * Rendered with satori (layout → SVG) + resvg (SVG → PNG). Only published
 * games render, so a card can never reveal tomorrow's matchup.
 */
import type { Express, Request, Response } from "express";
import fs from "fs";
import { createRequire } from "module";
import path from "path";

export interface ShareParams {
  score: number | null;
  streak: number | null;
  called: boolean | null;
  confidence: "Toss-up" | "Leaning" | "Confident" | null;
}

const CONFIDENCE: Record<string, ShareParams["confidence"]> = {
  t: "Toss-up",
  l: "Leaning",
  c: "Confident",
};

/** Strict parse of the share query string; anything unexpected is dropped. */
export function parseShareParams(query: string | URLSearchParams): ShareParams {
  const q = typeof query === "string" ? new URLSearchParams(query.replace(/^\?/, "")) : query;
  const int = (k: string, max: number) => {
    const v = q.get(k);
    if (v === null || !/^\d{1,3}$/.test(v)) return null;
    const n = parseInt(v, 10);
    return n <= max ? n : null;
  };
  const r = q.get("r");
  return {
    score: int("s", 100),
    streak: int("st", 999),
    called: r === "1" ? true : r === "0" ? false : null,
    confidence: CONFIDENCE[q.get("c") ?? ""] ?? null,
  };
}

export function hasShareParams(p: ShareParams): boolean {
  return p.score !== null || p.called !== null;
}

/** Canonical query string for a share — the inverse of parseShareParams. */
export function shareQuery(p: ShareParams): string {
  const q = new URLSearchParams();
  if (p.score !== null) q.set("s", String(p.score));
  if (p.called !== null) q.set("r", p.called ? "1" : "0");
  if (p.streak !== null && p.streak > 1) q.set("st", String(p.streak));
  const c = Object.entries(CONFIDENCE).find(([, v]) => v === p.confidence)?.[0];
  if (c) q.set("c", c);
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ── rendering ────────────────────────────────────────────────────────────────

interface CardGame {
  gameDate: string;
  companyATicker: string;
  companyBTicker: string;
  companyAName: string;
  companyBName: string;
  companyAPerf: string | null;
  companyBPerf: string | null;
  winner: string | null;
  sector: string | null;
}

const C = {
  bg: "#06281a",
  bg2: "#0b3b26",
  panel: "rgba(255,255,255,0.06)",
  panelWin: "rgba(0,176,96,0.16)",
  line: "rgba(255,255,255,0.14)",
  emerald: "#1fd17f",
  emeraldDeep: "#009050",
  red: "#ff6b6b",
  amber: "#ffb84d",
  white: "#ffffff",
  muted: "rgba(255,255,255,0.68)",
  subtle: "rgba(255,255,255,0.45)",
};

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: unknown[]): Node => ({
  type,
  props: {
    style: { display: "flex", ...style },
    children: children.flat().filter((c) => c !== null && c !== undefined && c !== false),
  },
});

function fmtDate(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtMove(v: string | null): { text: string; color: string } {
  if (v === null || v === undefined || Number.isNaN(parseFloat(v))) return { text: "—", color: C.muted };
  const n = parseFloat(v);
  return { text: `${n > 0 ? "+" : ""}${n.toFixed(2)}%`, color: n >= 0 ? C.emerald : C.red };
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

function companyPanel(ticker: string, name: string, perf: string | null, isWinner: boolean): Node {
  const move = fmtMove(perf);
  return h(
    "div",
    {
      flexDirection: "column",
      flex: 1,
      padding: "26px 30px",
      borderRadius: 24,
      background: isWinner ? C.panelWin : C.panel,
      border: `3px solid ${isWinner ? C.emerald : C.line}`,
    },
    h(
      "div",
      { alignItems: "center", justifyContent: "space-between" },
      h("div", { fontSize: 72, fontWeight: 800, color: C.white, letterSpacing: -2, lineHeight: 1 }, ticker),
      isWinner
        ? h(
            "div",
            {
              fontSize: 20,
              fontWeight: 800,
              color: C.bg,
              background: C.emerald,
              padding: "8px 16px",
              borderRadius: 999,
              letterSpacing: 2,
            },
            "WINNER"
          )
        : null
    ),
    h("div", { fontSize: 24, color: C.muted, marginTop: 8 }, clip(name, 30)),
    h("div", { fontSize: 56, fontWeight: 800, color: move.color, marginTop: 14, lineHeight: 1 }, move.text),
    h("div", { fontSize: 18, color: C.subtle, marginTop: 6 }, "on the day")
  );
}

function personalBanner(p: ShareParams): Node {
  const called = p.called !== false;
  const chips: string[] = [];
  if (p.confidence) chips.push(p.confidence);
  if (p.streak !== null && p.streak > 1) chips.push(`${p.streak}-day streak`);
  return h(
    "div",
    { alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
    h(
      "div",
      { alignItems: "center" },
      h(
        "div",
        {
          width: 64,
          height: 64,
          borderRadius: 999,
          background: called ? C.emerald : C.amber,
          alignItems: "center",
          justifyContent: "center",
          fontSize: 40,
          fontWeight: 800,
          color: C.bg,
          marginRight: 20,
        },
        { type: "img", props: { src: called ? TICK : CROSS, width: 36, height: 36 } }
      ),
      h(
        "div",
        { fontSize: 50, fontWeight: 800, color: called ? C.emerald : C.amber, letterSpacing: -1 },
        called ? "I called it" : "I missed this one"
      ),
      ...chips.map((c) =>
        h(
          "div",
          {
            marginLeft: 16,
            fontSize: 22,
            fontWeight: 700,
            color: C.white,
            border: `2px solid ${C.line}`,
            padding: "8px 16px",
            borderRadius: 999,
          },
          c
        )
      )
    ),
    p.score !== null
      ? h(
          "div",
          { alignItems: "baseline" },
          h("div", { fontSize: 76, fontWeight: 800, color: C.white, lineHeight: 1 }, String(p.score)),
          h("div", { fontSize: 30, fontWeight: 700, color: C.subtle, marginLeft: 4 }, "/100")
        )
      : null
  );
}

const svgUri = (d: string) =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${C.bg}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`
  ).toString("base64")}`;
const TICK = svgUri("M4 12.5l5 5L20 6.5");
const CROSS = svgUri("M6 6l12 12M18 6L6 18");

export function cardTree(g: CardGame, p: ShareParams, logoDataUri: string | null): Node {
  const personal = hasShareParams(p);
  return h(
    "div",
    {
      // Satori sizes boxes content-box: 1200×630 minus the padding.
      width: 1200 - 112,
      height: 630 - 40,
      flexDirection: "column",
      padding: "40px 56px 0 56px",
      background: `linear-gradient(135deg, ${C.bg} 0%, ${C.bg2} 100%)`,
      fontFamily: "Jakarta",
      color: C.white,
    },
    // Header: logo + date
    h(
      "div",
      { alignItems: "center", justifyContent: "space-between", marginBottom: personal ? 22 : 30 },
      logoDataUri
        ? h(
            "div",
            { background: C.white, borderRadius: 16, padding: "10px 18px" },
            { type: "img", props: { src: logoDataUri, width: 175, height: 38 } }
          )
        : h("div", { fontSize: 40, fontWeight: 800 }, "munymo"),
      h(
        "div",
        { flexDirection: "column", alignItems: "flex-end" },
        h("div", { fontSize: 20, fontWeight: 700, color: C.emerald, letterSpacing: 3 }, "DAILY STOCK MATCHUP"),
        h("div", { fontSize: 24, color: C.muted, marginTop: 4 }, `${fmtDate(g.gameDate)}${g.sector ? ` · ${clip(g.sector, 26)}` : ""}`)
      )
    ),
    personal
      ? personalBanner(p)
      : h(
          "div",
          { fontSize: 50, fontWeight: 800, letterSpacing: -1, marginBottom: 26 },
          "Which stock would you have picked?"
        ),
    // The matchup
    h(
      "div",
      { alignItems: "stretch" },
      companyPanel(g.companyATicker, g.companyAName, g.companyAPerf, g.winner === "A"),
      h("div", { width: 70, alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800, color: C.subtle }, "vs"),
      companyPanel(g.companyBTicker, g.companyBName, g.companyBPerf, g.winner === "B")
    ),
    // Footer: what Munymo is + the ask
    h(
      "div",
      {
        marginTop: "auto",
        marginLeft: -56,
        marginRight: -56,
        padding: "22px 56px",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(0,0,0,0.28)",
      },
      h(
        "div",
        { flexDirection: "column" },
        h("div", { fontSize: 26, fontWeight: 700, color: C.white }, "Two real stocks. One call. Every trading day."),
        h("div", { fontSize: 21, color: C.muted, marginTop: 4 }, "Free stock market game · no sign-up · munymo.com")
      ),
      h(
        "div",
        {
          fontSize: 26,
          fontWeight: 800,
          color: C.bg,
          background: C.emerald,
          padding: "16px 28px",
          borderRadius: 999,
        },
        personal ? "Can you beat me? →" : "Play today's →"
      )
    )
  );
}

// ── assets ───────────────────────────────────────────────────────────────────

const require_ = createRequire(import.meta.url);
let fontsCache: { name: string; data: Buffer; weight: 500 | 700 | 800; style: "normal" }[] | null = null;
function fonts() {
  if (!fontsCache) {
    const file = (w: number) =>
      fs.readFileSync(require_.resolve(`@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-${w}-normal.woff`));
    fontsCache = ([500, 700, 800] as const).map((weight) => ({
      name: "Jakarta",
      data: file(weight),
      weight,
      style: "normal" as const,
    }));
  }
  return fontsCache;
}

let logoCache: string | null | undefined;
function logo(): string | null {
  if (logoCache !== undefined) return logoCache;
  const name = "munymo-logo-cropped_e625fcf7.png";
  // Production serves dist/public; dev serves client/public.
  const candidates = [
    path.resolve(import.meta.dirname, "public", name),
    path.resolve(import.meta.dirname, "../..", "client", "public", name),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  logoCache = found ? `data:image/png;base64,${fs.readFileSync(found).toString("base64")}` : null;
  return logoCache;
}

export async function renderShareCard(g: CardGame, p: ShareParams): Promise<Buffer> {
  const satori = (await import("satori")).default;
  const { Resvg } = await import("@resvg/resvg-js");
  const svg = await satori(cardTree(g, p, logo()) as never, { width: 1200, height: 630, fonts: fonts() });
  return new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
}

// ── route ────────────────────────────────────────────────────────────────────

const PNG_CACHE_MAX = 300;
const pngCache = new Map<string, Buffer>();

async function shareCardHandler(req: Request, res: Response) {
  try {
    const slug = String(req.params.slug ?? "");
    const { getPublishedGameBySlug } = await import("../db");
    const game = await getPublishedGameBySlug(slug);
    if (!game) return res.status(404).end();

    const p = parseShareParams(req.originalUrl.split("?")[1] ?? "");
    const key = `${slug}${shareQuery(p)}`;
    let png = pngCache.get(key);
    if (!png) {
      png = await renderShareCard(game, p);
      if (pngCache.size >= PNG_CACHE_MAX) pngCache.delete(pngCache.keys().next().value as string);
      pngCache.set(key, png);
    }
    res
      .set("Content-Type", "image/png")
      // A published game's numbers never change; let Cloudflare keep it.
      .set("Cache-Control", "public, max-age=86400")
      .send(png);
  } catch (err) {
    console.error("[shareCard] render failed:", err);
    res.status(500).end();
  }
}

export function registerShareCard(app: Express) {
  app.get("/og/:slug.png", shareCardHandler);
}
