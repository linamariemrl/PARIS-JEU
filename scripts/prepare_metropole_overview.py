#!/usr/bin/env python3
"""LOD géographique persistant pour PARIS SKYLINES.

Les 287 075 emprises IGN de l'extension métropolitaine sont converties
en volumes légers à partir de leurs enveloppes mesurées. Ce niveau de
détail est une approximation visuelle documentée, jamais un toit LiDAR.
Le maillage exact des emprises reste réservé aux tuiles proches.
Format binaire par cellule de 3,2 km : int16 x,z ; uint16 largeur,
profondeur, hauteur (quarts de mètre), puis int16 angle d'orientation.
"""
from __future__ import annotations

import json
import math
import struct
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/data/metropole/buildings"
TARGET = ROOT / "public/data/metropole/overview"
STEP = 0.25
CELLS = 4


def record(building, ix, iz, tile_size):
    """Rectangle orienté d'après l'axe dominant de l'emprise IGN.

    Il reste une approximation. Contrairement à une boîte alignée sur les
    axes mondiaux, le contour des rues reste cohérent à vue d'ensemble.
    """
    exterior = []
    coords = []
    for polygon in building["polygons"]:
        if not polygon:
            continue
        for ring in polygon:
            for point in ring:
                coords.append((float(point[0]), float(point[1])))
        if len(polygon[0]) > len(exterior):
            exterior = polygon[0]
    if not coords or len(exterior) < 3:
        raise ValueError("Emprise IGN sans coordonnées : " + str(building.get("id")))
    if not all(math.isfinite(v) for p in coords for v in p):
        raise ValueError("Coordonnées IGN non finies")
    longest = 0.0
    dx, dz = 1.0, 0.0
    for p, q in zip(exterior, exterior[1:] + exterior[:1]):
        vx, vz = q[0] - p[0], q[1] - p[1]
        length = math.hypot(vx, vz)
        if length > longest:
            longest, dx, dz = length, vx / length, vz / length
    vx, vz = -dz, dx
    uu = [x * dx + z * dz for x, z in coords]
    vv = [x * vx + z * vz for x, z in coords]
    u_mid = (min(uu) + max(uu)) / 2
    v_mid = (min(vv) + max(vv)) / 2
    center_x, center_z = u_mid * dx + v_mid * vx, u_mid * dz + v_mid * vz
    width = max(STEP, max(uu) - min(uu))
    depth = max(STEP, max(vv) - min(vv))
    height = max(2.0, float(building["height"]))
    angle = math.atan2(dz, dx)
    angle_code = round(angle * 32768 / math.pi)
    if angle_code >= 32768:
        angle_code -= 65536
    # Int16 pour le centre relatif à la tuile et la rotation.
    nums = [round((center_x - ix * tile_size) / STEP),
            round((center_z - iz * tile_size) / STEP),
            round(width / STEP), round(depth / STEP),
            round(height / STEP), angle_code]
    if not (-32768 <= nums[0] <= 32767 and
            -32768 <= nums[1] <= 32767 and
            -32768 <= nums[5] <= 32767 and
            all(1 <= v <= 65535 for v in nums[2:5])):
        raise ValueError("Géométrie hors plage int16 : " + str(building.get("id")))
    return struct.pack("<hhHHHh", *nums)


def major_footprints():
    """Emprises IGN des monuments MAJEURS (beige), d'après la table des
    emprises patrimoniales et la liste des références majeures du jeu.
    Même source que la scène proche : couleur cohérente à toute distance."""
    import re
    refs = set(re.findall(r'"(PA\d{8})"', (ROOT / "src/heritagePriorities.ts").read_text(encoding="utf-8")))
    table = json.loads((ROOT / "public/data/metropole/architecture/heritage-footprints.json")
                       .read_text(encoding="utf-8"))
    return {i for e in table["entries"] if e["ref"] in refs for i in e["ignIds"]}


def main():
    majors = major_footprints()
    manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    if manifest["schema"] != 2 or manifest["buildingsStoredIn4e"] != 2696:
        raise ValueError("Manifeste métropolitain incorrect")
    size = manifest["tileMeters"]
    groups: dict[tuple[int, int], dict] = {}
    total = 0
    for tile in manifest["tiles"]:
        ix, iz = int(tile["ix"]), int(tile["iz"])
        key = (ix // CELLS, iz // CELLS)
        entry = groups.setdefault(key, {"tiles": [], "data": bytearray(), "count": 0, "majors": []})
        path = SOURCE / "tiles" / (tile["id"] + ".json")
        document = json.loads(path.read_text(encoding="utf-8"))
        buildings = document["buildings"]
        if document["id"] != tile["id"] or len(buildings) != tile["count"]:
            raise ValueError("Tuile IGN incohérente : " + tile["id"])
        offset = entry["count"]
        for k, building in enumerate(buildings):
            entry["data"].extend(record(building, ix, iz, size))
            if building["id"] in majors:
                entry["majors"].append(offset + k)
        entry["count"] += len(buildings)
        total += len(buildings)
        entry["tiles"].append({"id": tile["id"], "ix": ix, "iz": iz,
                               "offset": offset, "count": len(buildings)})
    if total != manifest["totalBuildings"]:
        raise ValueError("Effectifs de l'aperçu différents de la source IGN")
    TARGET.mkdir(parents=True, exist_ok=True)
    output = {"schema": 2, "tileMeters": size, "cellsPerGroup": CELLS,
              "quantizationMeters": STEP, "totalBuildings": total,
              "source": manifest["source"], "geometry": "oriented-box-approximation",
              "sourceHash": sha256((SOURCE / "manifest.json").read_bytes()).hexdigest()[:12],
              "groups": []}
    for (gx, gz), entry in sorted(groups.items()):
        name = f"{gx}_{gz}.bin"
        payload = entry["data"]
        if len(payload) != entry["count"] * 12:
            raise ValueError("Longueur d'aperçu invalide")
        (TARGET / name).write_bytes(payload)
        output["groups"].append({
            "id": f"{gx}_{gz}", "gx": gx, "gz": gz,
            "count": entry["count"], "bytes": len(payload),
            "majors": entry["majors"], "tiles": entry["tiles"]})
    # Boîtes absolues des majeurs pour le panorama (> 5 km), où les groupes
    # de silhouettes sont remplacés par l'atlas agrégé : le beige y reste.
    boxes = []
    for (gx, gz), entry in sorted(groups.items()):
        for i in entry["majors"]:
            tile = next(t for t in entry["tiles"] if t["offset"] <= i < t["offset"] + t["count"])
            x, z, w, d, h, a = struct.unpack_from("<hhHHHh", entry["data"], i * 12)
            boxes.append([round(tile["ix"] * size + x * STEP, 2), round(tile["iz"] * size + z * STEP, 2),
                          round(w * STEP, 2), round(d * STEP, 2), round(h * STEP, 2),
                          round(a * math.pi / 32768, 5)])
    (TARGET / "majors.json").write_text(json.dumps({
        "schema": 1, "role": "monuments majeurs (beige) pour le panorama",
        "fields": ["x", "z", "largeur", "profondeur", "hauteur", "angle"], "boxes": boxes},
        separators=(",", ":")) + "\n", encoding="utf-8")
    (TARGET / "manifest.json").write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8")
    print(f"Monuments majeurs beiges dans le LOD : "
          f"{sum(len(e['majors']) for e in groups.values())}")
    print(f"LOD IGN : {total} enveloppes, {len(groups)} groupes, "
          f"{total * 12 / 1e6:.2f} Mo binaires")


if __name__ == "__main__":
    main()
