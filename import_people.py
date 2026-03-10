#!/usr/bin/env python3
"""
Generate _people/ stub files for every primary author in the Goodreads CSV.
Skips files that already exist (won't overwrite manually enriched entries).
"""

import csv
import os
import re

CSV_NAME = "goodreads_library_export(4).csv"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(SCRIPT_DIR, "_books", CSV_NAME)
OUT_DIR = os.path.join(SCRIPT_DIR, "_people")


def slugify(text):
    text = re.sub(r"\s+", " ", text).strip().lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    return re.sub(r"-+", "-", text).strip("-")


def yaml_str(text):
    if not text:
        return '""'
    needs_quote = any(c in text for c in ':#{}[]|>&*!,%\'"@`\\') or text[0] in "-?|>"
    if needs_quote:
        return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'
    return text


def main():
    if not os.path.exists(CSV_PATH):
        print(f"CSV not found: {CSV_PATH}")
        return

    existing = {os.path.splitext(f)[0] for f in os.listdir(OUT_DIR) if f.endswith(".md")}

    # Collect unique primary authors: slug -> display name
    authors = {}
    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            name = re.sub(r"\s+", " ", row.get("Author", "").strip())
            if name:
                slug = slugify(name)
                if slug and slug not in authors:
                    authors[slug] = name

    created = skipped = 0
    for slug, name in sorted(authors.items()):
        if slug in existing:
            skipped += 1
            continue
        content = "\n".join([
            "---",
            "layout: person",
            f"name: {yaml_str(name)}",
            "---",
            "",
        ])
        with open(os.path.join(OUT_DIR, f"{slug}.md"), "w", encoding="utf-8") as f:
            f.write(content)
        created += 1

    print(f"Done: {created} created, {skipped} skipped (already existed)")


if __name__ == "__main__":
    main()
