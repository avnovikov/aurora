"""Writes aurora-palettes.ase (Adobe Swatch Exchange) and aurora-palettes.gpl (GIMP/Inkscape).
Shipped values are read from src/brand/palettes.ts; the two drafts are listed here.
Run from the repo root: python3 docs/working/2026-11-21-zorya-shachar-palettes/make_swatches.py"""
import re, struct, pathlib
here = pathlib.Path(__file__).parent
ts = pathlib.Path("src/brand/palettes.ts").read_text()

def parse_ts():
    out = []
    for m in re.finditer(r'key: "(\w+)",\s*label: "([^"]+)".*?colors: \{(.*?)\}.*?heartRate: \{(.*?)\}', ts, re.S):
        roles = re.findall(r'(\w+): "(#[0-9a-f]{6})"', m.group(3))
        hr = [("hr " + k, v) for k, v in re.findall(r'(\w+): "(#[0-9a-f]{6})"', m.group(4))]
        out.append((m.group(2), roles + hr))
    return out

DRAFTS = [
    ("Zorya (draft)", [("background","#0057b7"),("surface","#004a9c"),("foreground","#ffffff"),("muted","#d6e6ff"),("accent","#ffd500"),("onAccent","#0b1a33"),("alert","#ffccd5"),("edge","#2a74c9"),("controlEdge","#9fc3f0"),
        ("hr easy","#bfe0ff"),("hr steady","#a8f0c0"),("hr work","#ffd500"),("hr hard","#ffb15a"),("hr max","#ffb0dc")]),
    ("Shachar (draft)", [("background","#ffd9c7"),("surface","#ffe9de"),("foreground","#1a0f14"),("muted","#5c4038"),("accent","#1f4fa3"),("onAccent","#ffffff"),("alert","#a3001b"),("edge","#f2bfa8"),("controlEdge","#8a6a5e"),
        ("hr easy","#1a4f8b"),("hr steady","#146c3e"),("hr work","#7a4a00"),("hr hard","#a33b00"),("hr max","#9a0058")]),
]
palettes = DRAFTS + parse_ts()
assert len(palettes) == 8 and all(len(c) == 14 for _, c in palettes), [(n, len(c)) for n, c in palettes]

def name_bytes(s):
    b = (s + "\0").encode("utf-16-be")
    return struct.pack(">H", len(s) + 1) + b

blocks = []
for group, colours in palettes:
    body = name_bytes(group); blocks.append(struct.pack(">HI", 0xC001, len(body)) + body)
    for role, hexv in colours:
        r, g, b = (int(hexv[i:i+2], 16) / 255 for i in (1, 3, 5))
        body = name_bytes(f"{group.split()[0]} {role} {hexv}") + b"RGB " + struct.pack(">fffH", r, g, b, 2)
        blocks.append(struct.pack(">HI", 0x0001, len(body)) + body)
    blocks.append(struct.pack(">HI", 0xC002, 0))
(here / "aurora-palettes.ase").write_bytes(b"ASEF" + struct.pack(">HHI", 1, 0, len(blocks)) + b"".join(blocks))

lines = ["GIMP Palette", "Name: Aurora palettes", "Columns: 14", "#"]
for group, colours in palettes:
    lines.append(f"# {group}")
    for role, hexv in colours:
        r, g, b = (int(hexv[i:i+2], 16) for i in (1, 3, 5))
        lines.append(f"{r:3d} {g:3d} {b:3d}\t{group.split()[0]} {role} {hexv}")
(here / "aurora-palettes.gpl").write_text("\n".join(lines) + "\n")
print("wrote", len(palettes), "palettes,", sum(len(c) for _, c in palettes), "swatches")
