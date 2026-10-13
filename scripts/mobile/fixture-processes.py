#!/usr/bin/env python3
"""Track only this checkout's fixture process groups; never kill by port."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

root = Path(__file__).resolve().parents[2]
registry = root / "apps/web/.data/mobile-fixture-processes.json"

def started(pid):
    return subprocess.run(["ps", "-p", str(pid), "-o", "lstart="], text=True, capture_output=True).stdout.strip()

if sys.argv[1] == "start":
    args = sys.argv[2:]
    if args and args[0] == "--":
        args = args[1:]
    registry.parent.mkdir(parents=True, exist_ok=True)
    process = subprocess.Popen(args, stdin=subprocess.DEVNULL, start_new_session=True)
    entries = json.loads(registry.read_text()) if registry.exists() else []
    entries.append({"pid": process.pid, "started": started(process.pid)})
    registry.write_text(json.dumps(entries))
elif sys.argv[1] == "stop":
    entries = json.loads(registry.read_text()) if registry.exists() else []
    for entry in reversed(entries):
        pid = entry["pid"]
        if entry["started"] and started(pid) == entry["started"]:
            try:
                if os.getpgid(pid) == pid:
                    os.killpg(pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
    if entries:
        time.sleep(1)
    registry.unlink(missing_ok=True)
else:
    raise SystemExit("Use start -- command... or stop")
