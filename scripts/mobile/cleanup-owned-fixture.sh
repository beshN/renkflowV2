#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../apps/web"
pid_file='.data/mobile-fixture.pids'
if [ -f "$pid_file" ]; then
  while read -r pid; do
    case "$pid" in ''|*[!0-9]*) continue ;; esac
    # A stale PID file must not kill a reused PID from a different workspace.
    actual_cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' || true)
    if [ "$actual_cwd" = "$(pwd -P)" ]; then
      kill "$pid" 2>/dev/null || true
    fi
  done < "$pid_file"
  rm -f "$pid_file"
fi
