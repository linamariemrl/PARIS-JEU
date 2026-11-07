#!/usr/bin/env python3
from pathlib import Path
import sys
root = Path(sys.argv[1] if len(sys.argv)>1 else "dist")
if not root.is_dir():
    raise SystemExit(f"Dossier introuvable : {root}")
total = sum(p.stat().st_size for p in root.rglob("*") if p.is_file())
print(f"Site : {total/1_000_000:.1f} Mo")
if total > 900_000_000:
    raise SystemExit("Taille excessive : les ressources doivent etre reparties en paquets.")
