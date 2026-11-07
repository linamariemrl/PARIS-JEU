#!/usr/bin/env python3
"""Exclut totalement les photos aériennes de la publication monochrome.

Les fichiers historiques du dépôt demeurent dans git pour traçabilité, mais
ne sont plus livrés à l'application PWA ni à un Android.
"""
import shutil
import sys
from pathlib import Path

if len(sys.argv)!=2:
    raise SystemExit("Usage: python scripts/strip_aerial_dist.py dist")
root=Path(sys.argv[1]).resolve()
if root.name!="dist" or not root.is_dir():
    raise SystemExit("Le dossier de distribution 'dist' doit exister.")
photos=root/"data/4e/aerial"
if photos.exists():
    removed=sum(p.stat().st_size for p in photos.rglob("*") if p.is_file())
    shutil.rmtree(photos)
    print(f"Suppression des photos IGN historiques du déploiement: {removed/1e6:.1f} Mo")
else:
    print("Maquette sans photos aériennes: distribution déjà propre")
