"""Contrat partagé de la bascule extrusion IGN <-> maquette (R02 D1/D2/D3/D7).

Les tests unittest ne se contentent pas de chercher du texte : ils exécutent
le test de comportement `scripts/check_heritage_swap.mjs` (Node 22, sans
dépendance npm), qui rejoue le cycle chargement, masquage, sélection,
changement de LOD, retour arrière et rejet, et vérifie la table publiée.
"""
import re
import shutil
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT/path).read_text(encoding="utf-8")

def run_behaviour_test():
    """Exécute le test de comportement ; renvoie (code, sortie)."""
    node=shutil.which("node")
    if node is None:
        return 127,"Node.js introuvable : le test de comportement est requis"
    done=subprocess.run([node,"--experimental-strip-types",
        "scripts/check_heritage_swap.mjs"],cwd=ROOT,capture_output=True,
        text=True,timeout=300)
    return done.returncode,done.stdout+done.stderr

def function_body(source,name):
    """Corps d'une fonction TypeScript de premier niveau (accolades équilibrées)."""
    match=re.search(r"(?:export\s+)?(?:async\s+)?function\s+"+name+r"\s*\(",source)
    if not match:
        raise AssertionError("fonction absente : "+name)
    start=source.index("{",source.index(")",match.end()))
    # Sauter les accolades d'un type de retour éventuel n'est pas nécessaire :
    # les fonctions visées ont un type de retour sans accolades.
    depth=0
    for i in range(start,len(source)):
        if source[i]=="{":depth+=1
        elif source[i]=="}":
            depth-=1
            if depth==0:return source[start:i+1]
    raise AssertionError("corps non fermé : "+name)
