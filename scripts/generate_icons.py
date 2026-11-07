#!/usr/bin/env python3
"""Produit gratuitement les icônes PNG PWA avec la bibliothèque standard Python."""
from pathlib import Path
import struct
import zlib

OUT = Path(__file__).resolve().parents[1] / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

def chunk(typ, payload):
    return struct.pack(">I", len(payload)) + typ + payload + struct.pack(">I", zlib.crc32(typ + payload) & 0xffffffff)

def png(size):
    data = []
    for y in range(size):
        row = bytearray()
        Y = y / size
        for x in range(size):
            X = x / size
            stem = .24 < X < .34 and .20 < Y < .80
            upper = .26 < X < .65 and .20 < Y < .29
            middle = .30 < X < .62 and .46 < Y < .56
            bowl = .59 < X < .68 and .25 < Y < .50
            dot = .65 < X < .72 and .70 < Y < .79
            row += bytes((244, 238, 224, 255) if stem or upper or middle or bowl or dot else (12, 23, 35, 255))
        data.append(b"\x00" + row)
    raw = zlib.compress(b"".join(data), 9)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) + chunk(b"IDAT", raw) + chunk(b"IEND", b""))

for size in (192, 512):
    target = OUT / f"icon-{size}.png"
    target.write_bytes(png(size))
    print("Icône produite :", target.name)
