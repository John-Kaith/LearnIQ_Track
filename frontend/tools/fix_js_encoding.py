import pathlib

root = pathlib.Path(__file__).resolve().parent.parent / "js"
# Common mojibake from Windows-1252 misread UTF-8 dashes/bullets in source
repls = [
    ("\u2014\u2014", "\u2014"),
    ("\u00e2\u20ac\u2122", "\u2014"),  # â€™ style → em dash (approx; file-specific)
]
# Direct broken sequences as stored in repo (UTF-8 bytes mis-decoded)
raw_fixes = [
    ("â€”", "\u2014"),
    ("â€¢", "\u2022"),
    ("â€¦", "\u2026"),
    ("â†’", "\u2192"),
    ("Â·", "\u00b7"),
    ("âœ…", "\u2705"),
]

for p in root.rglob("*.js"):
    if p.name == "script.monolith.backup.js":
        continue
    t = p.read_text(encoding="utf-8")
    o = t
    for a, b in raw_fixes:
        t = t.replace(a, b)
    if t != o:
        p.write_text(t, encoding="utf-8")
        print("fixed", p.relative_to(root))
