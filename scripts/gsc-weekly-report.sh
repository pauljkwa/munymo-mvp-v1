#!/bin/sh
# Weekly Search Console health report for munymo.com (read-only).
# Runs scripts/gsc-weekly-report.py with the local gsc connector's Python
# environment, which already has the Google API client and the OAuth token.
#
#   scripts/gsc-weekly-report.sh              this week's report
#   scripts/gsc-weekly-report.sh --end 2026-10-26
#   scripts/gsc-weekly-report.sh --json
set -e
GSC_DIR="${GSC_MCP_DIR:-$HOME/WorkSpace/tools/google-search-console-mcp}"
PY="$GSC_DIR/.venv/bin/python"
if [ ! -x "$PY" ]; then
  echo "Search Console report could not run: no Python environment at $PY." >&2
  echo "The gsc connector is expected at $GSC_DIR (set GSC_MCP_DIR to override)." >&2
  exit 1
fi
exec "$PY" "$(dirname "$0")/gsc-weekly-report.py" "$@"
