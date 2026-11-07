#!/usr/bin/env python3
"""LOD géographique persistant pour PARIS SKYLINES.

Les 287 075 emprises IGN de l'extension métropolitaine sont converties
en volumes légers à partir de leurs enveloppes mesurées. Ce niveau de
détail est une approximation visuelle documentée, jamais un toit LiDAR.
Le maillage exact des emprises reste réservé aux tuiles proches.
Format binaire par cellule de 3,2 km : int16 x,z ; uint16 largeur,
profondeur, hauteur ; valeurs en quarts de mètre.
"""
from __future__ import annotations

import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/data/metropole/buildings"
TARGET = ROOT / "public/data/metropole/overview"
STEP = 0.25
CELLS = 4


def record(building, ix, iz, tile_size):
    xs = []
    zs = []
    for polygon in building["polygons"]:
        for ring in polygon:
            for point in ring:
                xs.append(float(point[0]))
                zs.append(float(point[1]))
    if not xs or not zs:
        raise ValueError("Emprise IGN sans coordonnées : " + str(building.get("id")))
    if not all(map(math.isfinite, xs + zs)):
        raise ValueError("Coordonnées IGN non finies")
    center_x = (min(xs) + max(xs)) / 2 - ix * tile_size
    center_z = (min(zs) + max(zs)) / 2 - iz * tile_size
    width = max(STEP, max(xs) - min(xs))
    depth = max(STEP, max(zs) - min(zs))
    height = max(2.0, float(building["height"]))
    nums = [round(center_x / STEP), round(center_z / STEP),
            round(width / STEP), round(depth / STEP), round(height / STEP)]
    if not (-32768 <= nums[0] <= 32767 and -32768 <= nums[1] <= 32767 and
            all(1 <= v <= 65535 for v in nums[2:])):
        raise ValueError("Géométrie hors plage int16 : " + str(building.get("id")))
    return struct.pack("<hhHHH", *nums)


def main():
    manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    if manifest["schema"] != 2 or manifest["buildingsStoredIn4e"] != 2696:
        raise ValueError("Manifeste métropolitain incorrect")
    size = manifest["tileMeters"]
    groups: dict[tuple[int, int], dict] = {}
    total = 0
    for tile in manifest["tiles"]:
        ix, iz = int(tile["ix"]), int(tile["iz"])
        key = (ix // CELLS, iz // CELLS)
        entry = groups.setdefault(key, {"tiles": [], "data": bytearray(), "count": 0})
        path = SOURCE / "tiles" / (tile["id"] + ".json")
        document = json.loads(path.read_text(encoding="utf-8"))
        buildings = document["buildings"]
        if document["id"] != tile["id"] or len(buildings) != tile["count"]:
            raise ValueError("Tuile IGN incohérente : " + tile["id"])
        offset = entry["count"]
        for building in buildings:
            entry["data"].extend(record(building, ix, iz, size))
        entry["count"] += len(buildings)
        total += len(buildings)
        entry["tiles"].append({"id": tile["id"], "ix": ix, "iz": iz,
                               "offset": offset, "count": len(buildings)})
    if total != manifest["totalBuildings"]:
        raise ValueError("Effectifs de l'aperçu différents de la source IGN")
    TARGET.mkdir(parents=True, exist_ok=True)
    output = {"schema": 1, "tileMeters": size, "cellsPerGroup": CELLS,
              "quantizationMeters": STEP, "totalBuildings": total,
              "source": manifest["source"], "geometry": "bbox-approximation",
              "groups": []}
    for (gx, gz), entry in sorted(groups.items()):
        name = f"{gx}_{gz}.bin"
        payload = entry["data"]
        if len(payload) != entry["count"] * 10:
            raise ValueError("Longueur d'aperçu invalide")
        (TARGET / name).write_bytes(payload)
        output["groups"].append({
            "id": f"{gx}_{gz}", "gx": gx, "gz": gz,
            "count": entry["count"], "bytes": len(payload),
            "tiles": entry["tiles"]})
    (TARGET / "manifest.json").write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8")
    print(f"LOD IGN : {total} enveloppes, {len(groups)} groupes, "
          f"{total * 10 / 1e6:.2f} Mo binaires")


if __name__ == "__main__":
    main()
