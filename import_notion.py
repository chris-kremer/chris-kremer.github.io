#!/usr/bin/env python3
"""
Import Notion book notes into _books/*.md as prose.
Matches by title, strips Notion metadata, adds a disclaimer.
Skips books that already have hand-written prose.
Run: python3 import_notion.py
"""

import os
import re
from pathlib import Path

NOTION_DIR = Path(__file__).parent / "Notion"
BOOKS_DIR  = Path(__file__).parent / "_books"

DISCLAIMER = (
    "*These notes are old and were written while reading — "
    "they don't necessarily reflect my current views.*\n"
)

# Notion metadata field names to strip from the top of each file
META_KEYS = {"status", "author", "genre", "start", "prog bar", "progress",
             "rating", "end", "date", "finished"}


def normalize(s):
    """Lowercase, strip punctuation and articles for fuzzy matching."""
    s = s.lower()
    s = re.sub(r"\b(the|a|an|der|die|das|ein|eine)\b", "", s)
    s = re.sub(r"[^\w\s]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def notion_title_from_filename(fname):
    """'Antifragile 493ee4df02d4435fadb72fc6c6f71332.md' → 'Antifragile'"""
    name = Path(fname).stem
    # strip trailing UUID (32 hex chars, optionally with spaces/hyphens before)
    name = re.sub(r"\s+[0-9a-f]{32}$", "", name, flags=re.IGNORECASE)
    return name.strip()


def clean_notion_content(raw):
    """Strip H1 title, metadata lines, image embeds. Return cleaned prose."""
    lines = raw.splitlines()
    cleaned = []
    in_meta = True  # skip header block at top

    for line in lines:
        stripped = line.strip()

        # Skip the H1 title
        if stripped.startswith("# ") and not cleaned:
            continue

        # Skip metadata key: value lines at the top
        if in_meta:
            key = stripped.split(":")[0].lower().strip()
            if key in META_KEYS or stripped == "":
                continue
            else:
                in_meta = False  # first non-meta, non-empty line = prose starts

        # Strip image lines (broken paths after export)
        if re.match(r"!\[.*?\]\(.*?\)", stripped):
            continue

        cleaned.append(line)

    # Trim leading/trailing blank lines
    text = "\n".join(cleaned).strip()
    return text


def parse_book_file(path):
    """Return (frontmatter_str, existing_prose)."""
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return text, ""
    parts = text.split("---", 2)
    if len(parts) < 3:
        return text, ""
    fm   = "---" + parts[1] + "---"
    prose = parts[2].strip()
    return fm, prose


def build_books_index():
    """Return dict: normalized_title -> Path for all _books/*.md files."""
    index = {}
    for path in BOOKS_DIR.glob("*.md"):
        text = path.read_text(encoding="utf-8")
        m = re.search(r'^title:\s*["\']?(.*?)["\']?\s*$', text, re.MULTILINE)
        if m:
            title = m.group(1).strip().strip('"\'')
        else:
            title = path.stem.replace("-", " ")
        index[normalize(title)] = path
    return index


def main():
    books_index = build_books_index()

    notion_files = sorted(
        f for f in NOTION_DIR.iterdir()
        if f.suffix == ".md" and re.search(r"[0-9a-f]{32}", f.stem, re.IGNORECASE)
    )

    matched = skipped_prose = no_match = updated = 0

    for nf in notion_files:
        notion_title = notion_title_from_filename(nf.name)
        norm = normalize(notion_title)

        # Find matching book
        book_path = books_index.get(norm)
        if book_path is None:
            # Try partial match (notion title contained in book title or vice versa)
            candidates = [(k, v) for k, v in books_index.items()
                          if norm in k or k in norm]
            if len(candidates) == 1:
                book_path = candidates[0][1]
            else:
                print(f"  NO MATCH  {notion_title!r}")
                no_match += 1
                continue

        matched += 1
        fm, existing_prose = parse_book_file(book_path)

        # Skip if there's already real hand-written prose
        # (heuristic: more than 80 chars and doesn't start with disclaimer)
        if existing_prose and len(existing_prose) > 80 and not existing_prose.startswith("*These notes"):
            print(f"  SKIP (has prose)  {notion_title!r}")
            skipped_prose += 1
            continue

        raw = nf.read_text(encoding="utf-8", errors="replace")
        notes = clean_notion_content(raw)

        if not notes:
            print(f"  SKIP (empty notes)  {notion_title!r}")
            continue

        prose = DISCLAIMER + "\n" + notes
        new_content = fm + "\n\n" + prose + "\n"
        book_path.write_text(new_content, encoding="utf-8")
        print(f"  OK  {notion_title!r} → {book_path.name}")
        updated += 1

    print(f"\nDone: {updated} updated, {skipped_prose} skipped (had prose), "
          f"{no_match} no match (out of {matched + no_match} Notion files)")


if __name__ == "__main__":
    main()
