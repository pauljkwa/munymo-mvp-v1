#!/usr/bin/env python3
"""Live checks for the Munymo product audit.

Pulls the public tRPC API and prints:
  1. today's game
  2. leaderboard composition (which rows are tester bots)
  3. the last 50 archived games with perf-vs-open-to-close mismatches and
     winner flips under the open-to-close rule (Decision 6)
  4. ids to spot-check in the browser

Usage: python3 live_checks.py [--base https://munymo.com] [--tolerance 0.15]
No dependencies beyond the standard library.
"""
import argparse
import json
import sys
import urllib.parse
import urllib.request

TESTER_IDS = {870002, 870004, 870006, 870008, 870010, 870012}


def call(base, proc, inp=None):
    payload = {"json": inp}
    url = f"{base}/api/trpc/{proc}?input={urllib.parse.quote(json.dumps(payload))}"
    # Cloudflare returns 403 to Python's default User-Agent; a browser-like one is fine.
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (munymo-product-audit)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    if "error" in data:
        raise RuntimeError(f"{proc}: {data['error']}")
    return data["result"]["data"]["json"]


def pct(start, end):
    return (end - start) / start * 100.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://munymo.com")
    ap.add_argument("--tolerance", type=float, default=0.15,
                    help="max allowed gap (percentage points) between stored perf and open-to-close")
    args = ap.parse_args()

    today = call(args.base, "games.getToday")
    print("== Today's game")
    if today:
        print(f"  {today.get('gameDate')} {today.get('companyATicker')} vs {today.get('companyBTicker')} "
              f"status={today.get('status')} lockoutAt={today.get('lockoutAt')} source={today.get('sourcePublisher')}")
    else:
        print("  none")

    print("\n== Qualified leaderboard")
    board = call(args.base, "leaderboard.get")
    bots = 0
    for row in board:
        is_bot = row["userId"] in TESTER_IDS
        bots += is_bot
        print(f"  {row.get('userName')!s:14} avg={row['averageDailyScore']:>6} games={row['gamesPlayed']:>3} "
              f"id={row['userId']} {'BOT' if is_bot else ''}")
    print(f"  {len(board)} rows, {bots} tester bots")

    print("\n== Provisional leaderboard")
    prov = call(args.base, "leaderboard.getProvisional")
    for row in prov:
        is_bot = row["userId"] in TESTER_IDS
        print(f"  {row.get('userName')!s:14} avg={row['averageDailyScore']:>6} games={row['gamesPlayed']:>3} "
              f"id={row['userId']} {'BOT' if is_bot else ''}")

    print("\n== Last 50 archived games: stored perf vs open-to-close from stored prices")
    archive = call(args.base, "games.listArchive", {"limit": 50})
    mismatches, flips, nodata = [], [], 0
    for g in archive:
        try:
            pa, pb = float(g["companyAPerf"]), float(g["companyBPerf"])
            oa = pct(float(g["companyAStartPrice"]), float(g["companyAEndPrice"]))
            ob = pct(float(g["companyBStartPrice"]), float(g["companyBEndPrice"]))
        except (TypeError, ValueError, KeyError):
            nodata += 1
            continue
        mism = abs(oa - pa) > args.tolerance or abs(ob - pb) > args.tolerance
        expected = "A" if oa >= ob else "B"
        flip = expected != g["winner"]
        tag = ("  MISMATCH" if mism else "") + ("  WINNER FLIPS" if flip else "")
        print(f"  id={g['id']} {g['gameDate']} {g['companyATicker']:>5} vs {g['companyBTicker']:<5} "
              f"perf {pa:+.2f}/{pb:+.2f}  open->close {oa:+.2f}/{ob:+.2f}  winner {g['winner']}{tag}")
        if mism:
            mismatches.append(g["id"])
        if flip:
            flips.append(g["id"])
    print(f"\n  {len(archive)} games checked, {len(mismatches)} mismatches, {len(flips)} winner flips, "
          f"{nodata} without price data")
    if flips:
        print(f"  flipped game ids: {flips}")

    if archive:
        print("\n== Spot-check in the browser")
        print(f"  {args.base}/research/{archive[0]['id']}")
        print(f"  {args.base}/game/{archive[0]['id']}/result")
        if flips:
            print(f"  {args.base}/game/{flips[0]}/result   (a flipped one)")

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # keep the audit moving; report the failure plainly
        print(f"live_checks failed: {e}", file=sys.stderr)
        sys.exit(1)
