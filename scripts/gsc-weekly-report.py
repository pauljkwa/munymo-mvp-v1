#!/usr/bin/env python3
"""Weekly Google Search Console health report for munymo.com.

Read-only. Uses the local Search Console connector's own credentials
(~/WorkSpace/tools/google-search-console-mcp, override with GSC_MCP_DIR) and
only ever reads: sitemap status, URL inspection for a 12-page sample, and
search performance for the last week versus the week before.

It never submits the sitemap, never requests indexing, and never touches the
Indexing API. The sitemap is dynamic and Google re-reads it about daily.

Run:  scripts/gsc-weekly-report.sh            (or: pnpm gsc:report)
      scripts/gsc-weekly-report.sh --end 2026-10-26   (report a past week)
      scripts/gsc-weekly-report.sh --json            (machine-readable too)

Each run saves a snapshot under ~/.munymo/gsc-weekly/ so the next run can say
which sampled pages changed index status.
"""

import argparse
import json
import os
import re
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone

GSC_DIR = os.environ.get("GSC_MCP_DIR") or os.path.expanduser(
    "~/WorkSpace/tools/google-search-console-mcp"
)
SITE = "sc-domain:munymo.com"
ORIGIN = "https://munymo.com"
SITEMAP_URL = f"{ORIGIN}/sitemap.xml"
HISTORY_DIR = os.path.expanduser("~/.munymo/gsc-weekly")

# Fixed part of the 12-URL sample. Four archive pages are added from the live
# sitemap (newest, second newest, middle, oldest) so the report tracks how
# quickly new archive pages get picked up.
FIXED_SAMPLE = [
    "/",
    "/game",
    "/demo",
    "/learn",
    "/learn/what-a-share-actually-is",
    "/learn/why-stock-prices-move",
    "/learn/earnings-day",
    "/leaderboard",
]

NOISE_FLOOR = 50  # below this many impressions, week-on-week % changes are noise

# pageFetchState values that mean Google tried to fetch the page and failed.
# "PAGE_FETCH_STATE_UNSPECIFIED" (never fetched) and "SUCCESSFUL" are not failures.
FETCH_FAILURES = {
    "SOFT_404", "BLOCKED_ROBOTS_TXT", "NOT_FOUND", "ACCESS_DENIED", "SERVER_ERROR",
    "REDIRECT_ERROR", "ACCESS_FORBIDDEN", "BLOCKED_4XX", "INTERNAL_CRAWL_ERROR",
    "INVALID_URL",
}


def die(msg: str) -> None:
    print(f"Search Console report could not run: {msg}", file=sys.stderr)
    sys.exit(1)


def load_service():
    token = os.path.join(GSC_DIR, "token.json")
    if not os.path.exists(token):
        die(
            f"no token.json in {GSC_DIR}. The gsc connector has not been "
            "authorised on this Mac (see the google-search-console skill)."
        )
    sys.path.insert(0, GSC_DIR)
    try:
        from gsc import get_service  # type: ignore
    except ImportError as e:  # pragma: no cover
        die(f"could not import the connector from {GSC_DIR}: {e}")
    return get_service()


# ---------------------------------------------------------------- sitemap

def fetch_live_sitemap() -> dict:
    req = urllib.request.Request(SITEMAP_URL, headers={"User-Agent": "munymo-gsc-report"})
    with urllib.request.urlopen(req, timeout=30) as r:
        xml = r.read().decode("utf-8", "replace")
    locs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml)
    research = [u for u in locs if "/research/" in u]

    def slug_date(u: str) -> str:
        m = re.search(r"(\d{4}-\d{2}-\d{2})/?$", u)
        return m.group(1) if m else "0000-00-00"

    research.sort(key=slug_date, reverse=True)
    return {"count": len(locs), "urls": locs, "research_newest_first": research}


def sitemap_status(service) -> dict:
    resp = service.sitemaps().list(siteUrl=SITE).execute()
    for sm in resp.get("sitemap", []):
        if sm.get("path") == SITEMAP_URL:
            submitted = sum(int(c.get("submitted", 0)) for c in sm.get("contents", []))
            return {
                "found": True,
                "last_downloaded": sm.get("lastDownloaded"),
                "last_submitted": sm.get("lastSubmitted"),
                "submitted_urls": submitted,
                "errors": int(sm.get("errors", 0)),
                "warnings": int(sm.get("warnings", 0)),
                "is_pending": bool(sm.get("isPending")),
            }
    return {"found": False}


# ---------------------------------------------------------- url inspection

def inspect(service, url: str) -> dict:
    try:
        r = service.urlInspection().index().inspect(
            body={"inspectionUrl": url, "siteUrl": SITE}
        ).execute()
    except Exception as e:  # keep going; one failure must not kill the report
        return {"url": url, "error": str(e)[:200]}
    s = r.get("inspectionResult", {}).get("indexStatusResult", {})
    return {
        "url": url,
        "verdict": s.get("verdict", "UNKNOWN"),
        "state": s.get("coverageState", "UNKNOWN"),
        "last_crawl": s.get("lastCrawlTime"),
        "canonical": s.get("googleCanonical"),
        "robots": s.get("robotsTxtState"),
        "fetch": s.get("pageFetchState"),
    }


def classify(row: dict) -> str:
    """Bucket a URL inspection row into one of five plain words."""
    if "error" in row:
        return "error"
    state = (row.get("state") or "").lower()
    if row.get("verdict") == "PASS" or "indexed" in state and "not indexed" not in state:
        return "indexed"
    if state.startswith("crawled"):
        return "crawled, not indexed"
    if state.startswith("discovered"):
        return "known, never crawled"
    if "unknown" in state or row.get("verdict") == "NEUTRAL" and not state:
        return "unknown to Google"
    if "duplicate" in state or "canonical" in state:
        return "folded into another page"
    return state or "unknown"


# ------------------------------------------------------------ performance

def sa_query(service, start: date, end: date, dims=None, limit=1000) -> list:
    body = {
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "rowLimit": limit,
        "dataState": "all",
    }
    if dims:
        body["dimensions"] = dims
    resp = service.searchanalytics().query(siteUrl=SITE, body=body).execute()
    return resp.get("rows", [])


def totals(rows: list) -> dict:
    if not rows:
        return {"clicks": 0, "impressions": 0, "ctr": 0.0, "position": None}
    r = rows[0]
    return {
        "clicks": int(r.get("clicks", 0)),
        "impressions": int(r.get("impressions", 0)),
        "ctr": float(r.get("ctr", 0)),
        "position": float(r["position"]) if r.get("impressions") else None,
    }


def by_key(rows: list) -> dict:
    return {
        r["keys"][0]: {
            "clicks": int(r.get("clicks", 0)),
            "impressions": int(r.get("impressions", 0)),
            "position": float(r.get("position", 0)),
        }
        for r in rows
    }


# --------------------------------------------------------------- history

def load_previous_snapshot(current_end: date):
    if not os.path.isdir(HISTORY_DIR):
        return None
    files = sorted(f for f in os.listdir(HISTORY_DIR) if f.endswith(".json"))
    files = [f for f in files if f[:-5] < current_end.isoformat()]
    if not files:
        return None
    with open(os.path.join(HISTORY_DIR, files[-1])) as fh:
        return json.load(fh)


def save_snapshot(report: dict) -> str:
    os.makedirs(HISTORY_DIR, exist_ok=True)
    path = os.path.join(HISTORY_DIR, f"{report['week']['end']}.json")
    with open(path, "w") as fh:
        json.dump(report, fh, indent=1)
    return path


# ------------------------------------------------------------- formatting

def fmt_day(d: date) -> str:
    return d.strftime("%a %-d %b")


def ago(iso: str | None, now: datetime) -> str:
    if not iso:
        return "never"
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone()
    days = (now.astimezone().date() - dt.date()).days
    when = dt.strftime("%a %-d %b, %H:%M local")
    if days <= 0:
        return f"today ({when})"
    if days == 1:
        return f"yesterday ({when})"
    return f"{days} days ago ({when})"


def short(url: str) -> str:
    return url.replace(ORIGIN, "") or "/"


def impressions(n: int) -> str:
    return f"{n} impression" + ("" if n == 1 else "s")


def delta(cur, prev, pct_ok: bool) -> str:
    if prev is None or cur is None:
        return ""
    if cur == prev:
        return "(same as last week)"
    arrow = "up" if cur > prev else "down"
    if pct_ok and prev:
        return f"({arrow} from {prev}, {((cur - prev) / prev) * 100:+.0f}%)"
    return f"({arrow} from {prev})"


def render(report: dict) -> str:
    w = report["week"]
    sm = report["sitemap"]
    live = report["live_sitemap"]
    idx = report["index_sample"]
    perf = report["performance"]
    now = datetime.now(timezone.utc)
    out = []
    out.append(
        f"MUNYMO SEARCH HEALTH — week {fmt_day(date.fromisoformat(w['start']))} "
        f"to {fmt_day(date.fromisoformat(w['end']))} {w['end'][:4]}"
    )
    out.append("")

    # Sitemap
    out.append("SITEMAP")
    if not sm.get("found"):
        out.append("  Google has no record of our sitemap. That needs a look.")
    else:
        line = f"  Google last read it {ago(sm['last_downloaded'], now)}."
        out.append(line)
        out.append(
            f"  {sm['submitted_urls']} URLs on Google's copy, {live['count']} on the live sitemap now."
        )
        if sm["errors"] or sm["warnings"]:
            out.append(f"  {sm['errors']} errors, {sm['warnings']} warnings reported by Google.")
        else:
            out.append("  No errors or warnings.")
    out.append("")

    # Index sample
    buckets: dict[str, list] = {}
    for row in idx:
        buckets.setdefault(classify(row), []).append(row)
    n = len(idx)
    indexed = len(buckets.get("indexed", []))
    out.append(f"INDEX CHECK — {indexed} of {n} sampled pages are in Google")
    for row in idx:
        c = classify(row)
        mark = "+" if c == "indexed" else "-"
        extra = ""
        if c == "indexed" and row.get("canonical") and row["canonical"].rstrip("/") != row["url"].rstrip("/"):
            extra = f" (Google shows it as {short(row['canonical'])})"
        elif c == "error":
            extra = f" ({row['error']})"
        elif c == "unknown to Google" and not row.get("in_sitemap", True):
            extra = " (not in the sitemap, so expected)"
        elif c in ("unknown to Google", "known, never crawled") and row.get("published_days_ago") is not None \
                and row["published_days_ago"] <= 7:
            extra = f" (published {row['published_days_ago']} days ago; normal this soon)"
        elif row.get("last_crawl"):
            crawled = datetime.fromisoformat(row["last_crawl"].replace("Z", "+00:00"))
            extra = f" (last crawled {crawled.strftime('%-d %b')})"
        out.append(f"  {mark} {short(row['url'])} — {c}{extra}")
    changes = report.get("index_changes") or []
    if changes:
        out.append("  Changed since the last report:")
        for ch in changes:
            out.append(f"    {short(ch['url'])}: {ch['before']} -> {ch['after']}")
    elif report.get("previous_report_date"):
        out.append(f"  No change in these pages since the last report ({report['previous_report_date']}).")
    out.append("")

    # Performance
    cur, prev = perf["current"], perf["previous"]
    pct_ok = prev["impressions"] >= NOISE_FLOOR and cur["impressions"] >= NOISE_FLOOR
    out.append("SEARCH TRAFFIC (vs the week before)")
    out.append(f"  Clicks: {cur['clicks']} {delta(cur['clicks'], prev['clicks'], pct_ok)}")
    out.append(
        f"  Impressions: {cur['impressions']} {delta(cur['impressions'], prev['impressions'], pct_ok)}"
    )
    if cur["position"] is not None:
        pos_line = f"  Average position: {cur['position']:.0f}"
        if prev["position"] is not None:
            pos_line += f" (was {prev['position']:.0f})"
        out.append(pos_line)
    if not pct_ok:
        out.append(
            f"  (Under {NOISE_FLOOR} impressions a week, week-on-week swings are noise, not a trend.)"
        )
    if perf["top_queries"]:
        out.append("  Top searches we appeared for:")
        for q in perf["top_queries"]:
            prev_q = perf["previous_queries"].get(q["key"])
            was = f", was {prev_q['impressions']}" if prev_q else ", new"
            out.append(
                f"    \"{q['key']}\" — {impressions(q['impressions'])}{was}, position {q['position']:.0f}"
            )
    else:
        out.append("  No search queries recorded this week.")
    if perf["top_pages"]:
        out.append("  Pages that appeared most:")
        for p in perf["top_pages"]:
            prev_p = perf["previous_pages"].get(p["key"])
            was = f", was {prev_p['impressions']}" if prev_p else ", new"
            out.append(f"    {short(p['key'])} — {impressions(p['impressions'])}{was}")
    out.append("")

    # Verdict
    out.append("BOTTOM LINE")
    for line in report["verdict"]:
        out.append(f"  {line}")
    return "\n".join(out)


def build_verdict(report: dict) -> list:
    sm = report["sitemap"]
    idx = report["index_sample"]
    perf = report["performance"]
    now = datetime.now(timezone.utc)
    problems = []
    if not sm.get("found"):
        problems.append("Google has lost our sitemap. Check Search Console > Sitemaps.")
    else:
        dt = datetime.fromisoformat(sm["last_downloaded"].replace("Z", "+00:00"))
        if (now - dt).days > 7:
            problems.append(
                "Google has not re-read the sitemap in over a week. Worth a look before anything else."
            )
        if sm["errors"]:
            problems.append("The sitemap is reporting errors in Search Console.")
    blocked = [r for r in idx if r.get("robots") == "DISALLOWED" or r.get("fetch") in FETCH_FAILURES]
    if blocked:
        problems.append(
            "Google could not fetch: " + ", ".join(short(r["url"]) for r in blocked)
            + ". That is a technical problem on our side, not a waiting game."
        )
    errors = [r for r in idx if "error" in r]
    if errors:
        problems.append(f"{len(errors)} URL checks failed (API error); the rest of the report stands.")

    lines = []
    if problems:
        lines.append("ATTENTION:")
        lines.extend(problems)
    else:
        lines.append("Nothing is broken. Sitemap is being read, nothing is blocked.")
    cur = perf["current"]
    if cur["clicks"] == 0:
        lines.append(
            "Still zero clicks from Google, which is normal for a site nobody links to yet. "
            "The lever here is links from other sites, not more code."
        )
    newly = [c for c in (report.get("index_changes") or []) if c["after"] == "indexed"]
    if newly:
        lines.append(f"Good sign: {len(newly)} sampled page(s) got indexed since last report.")
    return lines


# ------------------------------------------------------------------- main

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--end", help="last day of the week to report (YYYY-MM-DD). Default: yesterday.")
    ap.add_argument("--json", action="store_true", help="also print the raw report as JSON")
    ap.add_argument("--no-save", action="store_true", help="do not write a snapshot to ~/.munymo/gsc-weekly")
    args = ap.parse_args()

    end = date.fromisoformat(args.end) if args.end else date.today() - timedelta(days=1)
    start = end - timedelta(days=6)
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=6)

    service = load_service()

    # 1. Sitemap
    sm = sitemap_status(service)
    try:
        live = fetch_live_sitemap()
    except Exception as e:
        live = {"count": 0, "urls": [], "research_newest_first": [], "error": str(e)}

    # 2. Index sample
    research = live["research_newest_first"]
    sample = [ORIGIN + p for p in FIXED_SAMPLE]
    if research:
        picks = [research[0]]
        if len(research) > 1:
            picks.append(research[1])
        if len(research) > 3:
            picks.append(research[len(research) // 2])
        if len(research) > 2:
            picks.append(research[-1])
        sample[7:7] = picks  # keep /leaderboard last
    index_sample = [inspect(service, u) for u in sample]
    live_set = set(live["urls"])
    for r in index_sample:
        r["in_sitemap"] = r["url"] in live_set
        m = re.search(r"(\d{4}-\d{2}-\d{2})/?$", r["url"])
        if m:
            r["published_days_ago"] = (end - date.fromisoformat(m.group(1))).days

    # 3. Performance, this week vs last
    cur_tot = totals(sa_query(service, start, end))
    prev_tot = totals(sa_query(service, prev_start, prev_end))
    cur_q = sa_query(service, start, end, ["query"], 1000)
    prev_q = by_key(sa_query(service, prev_start, prev_end, ["query"], 1000))
    cur_p = sa_query(service, start, end, ["page"], 1000)
    prev_p = by_key(sa_query(service, prev_start, prev_end, ["page"], 1000))

    def rows_to_list(rows):
        out = [
            {
                "key": r["keys"][0],
                "clicks": int(r.get("clicks", 0)),
                "impressions": int(r.get("impressions", 0)),
                "position": float(r.get("position", 0)),
            }
            for r in rows
        ]
        out.sort(key=lambda x: (x["clicks"], x["impressions"]), reverse=True)
        return out[:10]

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "site": SITE,
        "week": {"start": start.isoformat(), "end": end.isoformat()},
        "previous_week": {"start": prev_start.isoformat(), "end": prev_end.isoformat()},
        "sitemap": sm,
        "live_sitemap": {"count": live["count"], "error": live.get("error")},
        "index_sample": index_sample,
        "performance": {
            "current": cur_tot,
            "previous": prev_tot,
            "top_queries": rows_to_list(cur_q),
            "previous_queries": prev_q,
            "top_pages": rows_to_list(cur_p),
            "previous_pages": prev_p,
        },
    }

    # 4. Compare index statuses with the previous snapshot
    previous = load_previous_snapshot(end)
    if previous:
        before = {r["url"]: classify(r) for r in previous.get("index_sample", [])}
        changes = []
        for r in index_sample:
            b = before.get(r["url"])
            a = classify(r)
            if b is not None and b != a:
                changes.append({"url": r["url"], "before": b, "after": a})
        report["index_changes"] = changes
        report["previous_report_date"] = previous["week"]["end"]

    report["verdict"] = build_verdict(report)

    print(render(report))
    if args.json:
        print("\n--- JSON ---")
        print(json.dumps(report, indent=1))
    if not args.no_save:
        save_snapshot(report)


if __name__ == "__main__":
    main()
