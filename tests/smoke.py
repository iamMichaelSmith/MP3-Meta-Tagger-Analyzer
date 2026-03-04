from pathlib import Path
req=["README.md","backend"]
miss=[p for p in req if not Path(p).exists()]
if miss:
    raise SystemExit(f"Missing: {miss}")
print("Smoke OK")
