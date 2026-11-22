#!/usr/bin/env bash
# Shared helpers, sourced by rebuild.sh and destroy.sh (not meant to be run alone).
#   journal_add ACTION SECONDS RESULT   one line in docs/journal-destructions.md
#   credit_add  LEFT_USD                one line in docs/compte-aws.md (credit log)
#   ask_credit                          asks the remaining Learner Lab credit, then credit_add
#
# The remaining credit is shown on the AWS Academy page and is not reliably available
# from the CLI, so it is typed once per session (or passed as CREDIT_LEFT=38.50).
# Never write account IDs, keys or session tokens in these files.

LOG_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
JOURNAL="$LOG_ROOT/docs/journal-destructions.md"
ACCOUNT_DOC="$LOG_ROOT/docs/compte-aws.md"

journal_add() {
  local action="$1" secs="$2" result="$3"
  mkdir -p "$LOG_ROOT/docs"
  if [ ! -f "$JOURNAL" ]; then
    {
      echo "# Destruction and rebuild journal"
      echo
      echo "Written automatically by destroy.sh and rebuild.sh."
      echo
      echo "| Date (UTC) | Action | Duration | Result |"
      echo "|---|---|---|---|"
    } > "$JOURNAL"
  fi
  printf '| %s | %s | %dm %02ds | %s |\n' \
    "$(date -u +'%Y-%m-%d %H:%M')" "$action" $(( secs / 60 )) $(( secs % 60 )) "$result" >> "$JOURNAL"
  echo "Journal updated: docs/journal-destructions.md ($action: $result)"
}

ensure_account_doc() {
  [ -f "$ACCOUNT_DOC" ] && return 0
  mkdir -p "$LOG_ROOT/docs"
  cat > "$ACCOUNT_DOC" <<'EOF'
# AWS account verification

## Carrier account
- Deployed on: <member name> (fill in once, declared in L1)
- Switch order if the credit runs out: <member 2> -> <member 3> -> <member 4>

## Credit log (end of each session)

Keep this section LAST in the file: destroy.sh appends one row at the end.

| Date (UTC) | Member | Credit left (USD) | Everything destroyed? |
|---|---|---|---|
EOF
}

credit_add() {
  local left="$1" who destroyed="${2:-yes}"
  who="${CREDIT_OWNER:-$(git config user.name 2>/dev/null || true)}"
  who="${who:-unknown}"; who="${who//|/ }"
  ensure_account_doc
  printf '| %s | %s | %s | %s |\n' "$(date -u +'%Y-%m-%d %H:%M')" "$who" "$left" "$destroyed" >> "$ACCOUNT_DOC"
  echo "Credit logged: docs/compte-aws.md ($left USD left)"
}

ask_credit() { # ask_credit [destroyed: yes|no]
  local destroyed="${1:-yes}" left="${CREDIT_LEFT:-}"
  if [ -z "$left" ] && [ -t 0 ]; then
    read -r -p "Remaining Learner Lab credit in USD (Enter to skip): " left || left=""
  fi
  left="${left//,/.}"
  if [ -z "$left" ]; then
    echo "Credit not logged (skipped). The cahier asks for it after every session: add it to docs/compte-aws.md."
  elif [[ "$left" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
    credit_add "$left" "$destroyed"
  else
    echo "Credit not logged: '$left' is not a number."
  fi
}
