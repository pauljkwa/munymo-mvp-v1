# Munymo SEO Keyword Strategy — 2026-07-24

Research and recommendations for ranking on traditional search engines (Google/Bing),
complementing the GEO/AI-search work already shipped (FAQ + JSON-LD + sitemap).
Prepared by Fable 5 from published SEO-industry data; no paid keyword tool was
available (no Semrush/Ahrefs/Search Console connector exists in the registry).

**Status: awaiting Paul's approval. No site changes have been made.**

---

## 1. Executive summary

- The **education keywords** ("stock market for beginners", "stock market courses",
  "how to invest") have huge volume but are owned by Investopedia, NerdWallet,
  Coursera, and broker-affiliate sites with $3–$10 cost-per-click economics.
  A new domain cannot win these head terms and shouldn't try.
- The **game/simulator keywords** are Munymo's winnable territory. "stock market
  game" gets ~60,500 US searches/month and the #3 Google ranker
  (howthemarketworks.com) is a modest site — not a media giant. Below it,
  terms like "practice stock trading" (2,900), "free stock market game",
  "stock prediction game", and "wordle for stocks" have thin, weak competition —
  several are held by single-page hobby sites.
- **Daily-game demand is enormous and durable**: "wordle" is the #5 most-searched
  term in the US (~46M/month, Ahrefs July 2026) and prediction-market search
  interest nearly quadrupled from Sept 2025 to Jan 2026. "Wordle for the stock
  market" is both Munymo's true positioning and its softest SERP.
- **The site currently throws away its on-page signals.** Every page's title tag
  is just "Munymo", there is no meta description, no Open Graph tags, and the
  landing page has no `<h1>` at all. Fixing this is a small code change with the
  single largest expected SEO impact of anything in this document.

**Strategy in one line:** win "daily stock market prediction game" and its
game/practice long-tail now; use the Learning Hub (already planned) to chip at
education long-tail later; fix the title/meta/h1 basics immediately.

---

## 2. Data sources and honest caveats

No SEO connector exists for Claude, so figures come from published industry data:

- **seopital.co** keyword lists (global Google volumes, per-keyword) — most
  internally consistent source; treated as primary for per-keyword numbers.
- **kwrds.ai** topic pages — **cluster-level global** figures (groups many
  variants into one number). Treat as ceilings, not exact volumes. Its
  LOW/MEDIUM competition flags are *Google Ads* competition, not SEO difficulty.
- **Semrush public website-overview pages** (US, June 2026) — most current and
  US-specific; used for "stock market game", competitor traffic, and Wordle data.
- **Ahrefs blog** top-US-searches list (July 2026) — for Wordle/Connections scale.

Known disagreements: kwrds.ai says the "stock market for beginners" *cluster* is
673K global; seopital says the exact phrase is 9,900. Both are true — one is a
cluster, one is a keyword. Where sources conflict, both are shown. Exact US
volumes for several phrases ("how to analyze stocks", "stock prediction game",
"wordle for stocks") are published nowhere; for those we rely on competitor
evidence (who ranks, and how weak they are).

Once Google Search Console has data (sitemap submission is still on Paul's list),
its Queries report becomes our ground truth and should override all of this.

---

## 3. Keyword universe with volumes

### 3a. Game / simulator / practice — PRIMARY TARGET

| Keyword | Est. monthly volume | Competition notes |
|---|---|---|
| stock market game | 60,500 (US, Semrush) | #3 ranker is howthemarketworks.com, a modest site (~61K visits/mo) — head term is reachable in 12–18 months |
| stock market simulator | 33,100 (seopital) | Investopedia-class competitors; target via comparison content, not head-on |
| stock trading simulator / stock simulator | 33,100 each | same |
| paper trading simulator | 9,900 | mid-tail |
| day trading simulator | 8,100 | mid-tail |
| demo stock trading | 4,400 | winnable |
| practice stock trading | 2,900 | winnable, exact learn-by-doing intent |
| best trading simulator | 1,300 | commercial modifier |
| day trading simulator free | 1,000 | winnable now |
| free stock simulator | 480 | tiny but exact intent |
| stock prediction game / daily stock game / stock picking game | unpublished | no incumbent owns these; competitors are single-page hobby sites |
| guess the stock (chart) | unpublished | only guessthestockchart.io competes |
| wordle for stocks / finance wordle / stockle | unpublished | 4+ live micro-games self-describe this way (stockle.fun, wallstreetle.com, bearbull.io/stockle) — soft SERP, literal Munymo positioning |

### 3b. Daily-game / Wordle-adjacent — DEMAND PROOF

| Keyword | Est. monthly volume | Notes |
|---|---|---|
| wordle | ~45.9M (US, Ahrefs 7/2026) | #5 most-searched term in the US |
| connections | ~9.3M (US) | #47 — daily-puzzle demand is durable, not a fad |
| wordle unlimited | 673,000 (US) | one clone site takes 1.47M visits/mo off this |
| games like wordle | unpublished | listicle SERP — outreach/PR target, not a page target |

Supporting trend data: Wordle held ~12M daily active users in Q2 2025;
prediction-market search interest nearly quadrupled Sept 2025–Jan 2026
(covers.com; Bernstein projects $1T market by 2030 per CNBC 4/2026);
simulator-app market growing ~15%/yr.

### 3c. Learning / education — SECONDARY (long-tail only)

| Keyword | Est. monthly volume | Competition notes |
|---|---|---|
| stock market for beginners | 9,900 exact (cluster 673K global) | head owned by media giants |
| stock market classes/courses (cluster) | 90,500–165,000 global | MEDIUM; course platforms own it |
| stock market basics | 60,500 global cluster | **LOW Ads competition** — best big-cluster entry point |
| what is the stock market / how does it work | 74,000 global cluster | **LOW competition**, question intent — also ideal GEO/AI-search food |
| learn stock market | 12,100 | |
| learn how to trade stocks / learn stock market trading | 9,900 each | |
| stock trading for beginners / investing in stocks for beginners | 8,100 each | |
| stocks for beginners / learn how to invest | 4,400 each | |
| learn about stocks | 2,900 | winnable, pure learner intent |
| stock market investing for beginners | 2,900 | winnable |
| learn how to invest in stocks | 2,400 | winnable |
| investing basics | 1,900 | winnable |
| buying stocks for beginners | 1,600 | winnable |
| investing for beginners | 33,100 (two sources agree) | $8.55 CPC = affiliate warzone; avoid as primary |
| how to start investing | 8,100 | $10 CPC; avoid as primary |

### 3d. Analysis skills — feeds the Learning Hub

| Keyword | Est. monthly volume | Notes |
|---|---|---|
| stock analysis | 12,100 | $4.80 CPC |
| technical analysis | 8,100+ | definitional |
| fundamental analysis | 2,900 | surprisingly low competition for a definitional term — good explainer target |
| financial literacy | 33,100 | broad |
| financial education | 12,100 | broad |
| stock market games for students | unpublished | a solo blog ranks — very winnable; seasonal school demand |
| investing games for beginners | unpublished | SERP is listicles, not products |

**Avoid entirely** (CPC signals broker-affiliate warzones): "best stocks to buy
now", "stock screener", "how to start investing", "investing for beginners" as
primary targets.

---

## 4. Current-site audit (2026-07-24)

| Item | Current state | Impact |
|---|---|---|
| Title tag | `<title>Munymo</title>` — same on every page, zero keywords | **Critical.** The title tag is the strongest on-page ranking signal |
| Meta description | none anywhere | Google writes its own snippet; we control nothing |
| Open Graph / Twitter cards | none | shares on social/chat render bare |
| `<h1>` on landing page | none — hero headline is styled `<p>` text | crawlers see no topical heading |
| First `<h2>` on landing | "Four steps. Five minutes. One daily habit." | lovely copy, zero keyword value |
| Per-route titles | no `document.title` management at all | every page (archive games, Learning Hub, demo) presents as "Munymo" in Google |
| FAQ JSON-LD | ✅ shipped, working | keep |
| Dynamic sitemap + robots.txt | ✅ shipped | keep; GSC submission still pending (Paul) |
| Archive pages (/research/:id) | in sitemap, have h1s, unique content | biggest untapped asset — see 5d |
| SPA rendering | client-side only, no SSR | Google renders JS fine; Bing/others less reliably. Not urgent; noted for later |

---

## 5. Recommendations (priority order)

### P0 — Title, meta, headings (small code change, largest impact)

1. **Landing page title tag:**
   `Munymo — Daily Stock Market Prediction Game | Learn by Playing`
   (keyword-bearing, under 60 chars, brand first for recognition).
2. **Meta description** (~155 chars):
   `Munymo is a free daily stock market game. Predict which of two companies
   will perform better, read real research, and build genuine market intuition
   in 5 minutes a day.`
3. **Add a real `<h1>`** to the hero containing the primary phrase, e.g.
   `The daily stock market prediction game` (can be styled exactly like the
   current p-tag headline — this is a markup change, not a visual redesign).
4. **Per-route titles** via a tiny hook (`useDocumentTitle`), e.g.:
   - /demo → `How Munymo Works — Daily Stock Market Game Demo | Munymo`
   - /learn → `Learn Stock Market Basics by Playing | Munymo Learning Hub`
   - /research → `Stock Matchup Archive — Daily Company Comparisons | Munymo`
5. **Open Graph + Twitter card tags** with a proper share image.
6. **Add `WebSite` + `Organization` JSON-LD** alongside the existing FAQPage
   block; consider `WebApplication` schema for the game itself.

### P1 — Weave keywords into existing copy (no new pages)

7. **Hero badge/copy:** "Daily Stock Market Training Game" → keep the vibe but
   ensure the exact phrases "stock market game" and "prediction" appear in
   crawlable body text, e.g. "a free daily stock market prediction game".
8. **Body copy additions** (one sentence each, where natural): "practice stock
   analysis with no simulator account and no real money", "learn the stock
   market by playing".
9. **FAQ: add three search-phrased questions** (feeds both SEO and the existing
   FAQPage JSON-LD for GEO):
   - "Is Munymo a stock market simulator?" (captures 33K simulator/paper-trading
     comparison demand; honest answer: no portfolio, one sharp daily decision)
   - "Is Munymo like Wordle for the stock market?" (captures the soft
     wordle-for-stocks SERP with an authentic yes-and answer)
   - "Can a complete beginner learn stock analysis by playing a game?"
     (captures learn-by-playing long-tail)
10. **One `<h2>` on the landing page** should carry a keyword, e.g. the How It
    Works section: "How the daily stock market game works".

### P2 — Archive pages: the compounding asset

11. **Per-game titles:** `/research/:id` should set
    `NEE vs DUK — Which Stock Performed Better? | Munymo` style titles.
    Every game day mints a new page targeting "TICKER vs TICKER" comparison
    searches — unique content no competitor generates daily. Over a year this
    is 250+ long-tail pages.
12. Add a short crawlable intro line on each archive page containing
    "stock comparison" / "stock analysis" phrasing if not already present.

### P3 — New content via the Learning Hub (already planned — align, don't add scope)

13. When the Learning Hub research phase begins, **name lessons after winnable
    keywords**: "Stock Market Basics", "What Is Fundamental Analysis?",
    "How Does the Stock Market Work?", "How to Read a Research Brief",
    "Investing Basics". The LOW-competition clusters (stock market basics,
    how-does-it-work questions) are exactly lesson-shaped.
14. One comparison page eventually: "Munymo vs. Stock Market Simulators —
    which teaches faster?" targeting simulator/practice terms honestly.
15. Optional seasonal page: "Stock market games for students" (teachers search
    this every semester; current ranker is a solo blog).

### Ongoing

16. **Submit the sitemap in Google Search Console** (already on Paul's list) —
    after 4–6 weeks the Queries report tells us which of these bets are paying
    and replaces all estimated volumes above with real data.
17. Revisit this document once GSC data exists; prune what isn't working.

---

## 6. What we are NOT doing (and why)

- **Not chasing** "stock market for beginners", "stock market courses",
  "investing for beginners", "how to start investing" as primary targets —
  media giants and broker affiliates own them; CPCs of $3–$10 mark the
  warzones. These are YMYL (Your Money Your Life) queries where Google
  heavily weights domain authority we don't yet have.
- **Not adding SSR/prerendering yet** — Google renders our JS fine; revisit
  only if Bing/DuckDuckGo indexing proves poor in practice.
- **Not buying ads or link-building services** — out of scope; archive pages +
  the guerrilla article-attribution links are the current backlink strategy.
