#!/usr/bin/env bash
# Overnight agent runs: small batches paced across the night so the
# dashboard shows realistic activity by morning. Sized to stay well
# under Gemini free-tier quota (15 RPM, 1500 RPD) and Upstash free-tier
# command budget. Total ~10 agents and ~80 LLM calls across ~7.5 hours.

set -u
cd "$(dirname "$0")/.."

LOG="${LOG:-/tmp/coincanvas-overnight.log}"
BASE_URL="${BASE_URL:-https://coincanvas-e977azqdf-rcz-05s-projects.vercel.app}"

run_batch() {
  local count="$1"
  local label="$2"
  {
    echo ""
    echo "===== batch $label @ $(date) ====="
  } >> "$LOG"
  BASE_URL="$BASE_URL" AGENT_COUNT="$count" node scripts/agents.mjs >> "$LOG" 2>&1 || \
    echo "[overnight] batch $label failed (continuing)" >> "$LOG"
}

{
  echo "===== overnight runner started @ $(date) ====="
  echo "base: $BASE_URL"
} >> "$LOG"

# Batch 1 — now: 3 agents (~3 min)
run_batch 3 "1/4"
sleep 5400      # 1h 30m

# Batch 2 — ~1.5h in: 2 agents (~2 min)
run_batch 2 "2/4"
sleep 10800     # 3h

# Batch 3 — ~4.5h in: 2 agents (~2 min)
run_batch 2 "3/4"
sleep 10800     # 3h

# Batch 4 — ~7.5h in: 3 agents (~3 min)
run_batch 3 "4/4"

{
  echo ""
  echo "===== overnight runner finished @ $(date) ====="
} >> "$LOG"
