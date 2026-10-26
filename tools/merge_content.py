"""Merge WS-D's Module 2 data into elf-content.json and validate it.

    python3 tools/merge_content.py <path/to/elf-content.m2.json> [--heldout <Midterm-heldout-lines.md>]

Takes meta, settings, groups, professions and rooms from the WS-D file; keeps this app's uiText
(adds any uiText keys the WS-D file brings). Then validates against elf-content.schema.json.
Run `node tools/uitext.js --write` and both test suites afterwards.
"""
import json, sys, re, datetime, pathlib
import jsonschema

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = json.load(open(sys.argv[1], encoding="utf-8"))
out_path = ROOT / "elf-content.json"
cur = json.load(open(out_path, encoding="utf-8"))

merged = {k: src[k] for k in ("meta", "settings", "groups", "professions", "rooms")}
merged["meta"] = dict(src["meta"])
merged["meta"]["app"] = "ELF Studio"
merged["meta"]["dataStatus"] = "WS-D Module 2 data, merged " + datetime.date.today().isoformat()
ui = {k: v for k, v in cur.get("uiText", {}).items()}
for k, v in (src.get("uiText") or {}).items():
    ui.setdefault(k, v)
merged["uiText"] = ui

schema = json.load(open(ROOT / "elf-content.schema.json", encoding="utf-8"))
jsonschema.Draft202012Validator(schema).validate(merged)

if "--heldout" in sys.argv:
    md = open(sys.argv[sys.argv.index("--heldout") + 1], encoding="utf-8").read().lower()
    blob = json.dumps(merged["rooms"], ensure_ascii=False).lower()
    found = []
    for row in re.findall(r"^\|\s*h\d+\s*\|([^|]+)\|([^|]+)\|", md, re.M):
        for cell in row:
            cell = cell.strip()
            if len(cell) > 12 and cell in blob:
                found.append(cell)
    if found:
        sys.exit("held-out midterm lines found in the app data:\n  " + "\n  ".join(found))
    print("held-out check: none of the midterm lines are in the app data")

json.dump(merged, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
open(out_path, "a").write("\n")
print("merged and valid:", out_path)
