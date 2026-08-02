#!/usr/bin/env bash
# Runs the full national OSM beach harvest (scripts/harvestBeachesOsm.mjs) with the
# shingle-blindspot fix from 02/08/2026, retrying failed tiles automatically.
#
# Per-cell results are cached (.tmp/beach-audit-cache/osm-national-gr3/), so a retry only
# re-fetches the tiles that failed last time — it does not re-download the whole country.
# This IS the run meant to become the new national baseline (scripts/data/osm-beaches-national.json),
# unlike the scoped Attica probe earlier today which was restored from git afterwards.
#
# Usage:
#   nohup scripts/runNationalHarvestWithRetries.sh > /dev/null 2>&1 &
#   tail -f .tmp/national-harvest.log
#
# Safe to leave running unattended — every attempt appends to the log, and the final line
# says DONE or GAVE UP.

set -uo pipefail
cd "$(dirname "$0")/.."

LOG=".tmp/national-harvest.log"
BACKUP=".tmp/osm-national-backup-$(date +%Y%m%d-%H%M%S).json"
MAX_ATTEMPTS=6
SLEEP_BETWEEN_S=60

mkdir -p .tmp
cp scripts/data/osm-beaches-national.json "$BACKUP" 2>/dev/null || true
echo "[$(date -u +%FT%TZ)] starting national harvest, backup at $BACKUP" | tee -a "$LOG"

attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  echo "[$(date -u +%FT%TZ)] attempt $attempt/$MAX_ATTEMPTS" | tee -a "$LOG"
  npm run coverage:harvest >> "$LOG" 2>&1

  failed=$(node -e "
    try {
      const s = require('./reports/coverage/harvest-summary.json');
      console.log(s.failedTiles ?? 0);
    } catch { console.log('unknown'); }
  ")

  echo "[$(date -u +%FT%TZ)] attempt $attempt finished, failedTiles=$failed" | tee -a "$LOG"

  if [ "$failed" = "0" ]; then
    echo "[$(date -u +%FT%TZ)] DONE — 0 failed tiles" | tee -a "$LOG"
    node -e "const d=JSON.parse(require('fs').readFileSync('scripts/data/osm-beaches-national.json','utf8'));console.log('national seed candidates:', (d.candidates||d).length)" | tee -a "$LOG"
    exit 0
  fi

  attempt=$((attempt + 1))
  if [ "$attempt" -le "$MAX_ATTEMPTS" ]; then
    echo "[$(date -u +%FT%TZ)] sleeping ${SLEEP_BETWEEN_S}s before retry (cache keeps successes, only failed tiles re-fetch)" | tee -a "$LOG"
    sleep "$SLEEP_BETWEEN_S"
  fi
done

echo "[$(date -u +%FT%TZ)] GAVE UP after $MAX_ATTEMPTS attempts — check $LOG and reports/coverage/harvest-summary.json for the remaining failed tiles" | tee -a "$LOG"
exit 1
