#!/usr/bin/env python3
"""
Convert a Goodreads library export CSV into Jekyll book collection entries.

Usage:
    python3 import_goodreads.py                 # read + currently-reading only
    python3 import_goodreads.py --all           # include to-read backlog too

Skips files that already exist (won't overwrite manually edited entries).
"""

import csv
import os
import re
import sys

CSV_NAME = "goodreads_library_export(4).csv"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(SCRIPT_DIR, "_books", CSV_NAME)
OUT_DIR = os.path.join(SCRIPT_DIR, "_books")


def slugify(text):
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def clean_title(title):
    """Strip series annotations like '(Series Name, #3)'."""
    return re.sub(r"\s*\([^)]*#\d+[^)]*\)\s*$", "", title).strip()


def clean_author(name):
    """Collapse multiple spaces (Goodreads sometimes has double spaces)."""
    return re.sub(r"\s+", " ", name).strip()


def format_date(date_str):
    """YYYY/MM/DD → DD/MM/YYYY."""
    if not date_str:
        return ""
    parts = date_str.split("/")
    if len(parts) == 3:
        return f"{parts[2]}/{parts[1]}/{parts[0]}"
    return date_str


def make_status(shelf, read_count_str):
    try:
        n = int(read_count_str)
    except (ValueError, TypeError):
        n = 0

    if shelf == "currently-reading":
        return "currently reading"
    if shelf == "to-read":
        return "to read"
    if shelf == "read":
        if n >= 3:
            return f"read {n} times"
        if n == 2:
            return "read twice"
        return "read"
    return shelf


def yaml_str(text):
    """Return a safely quoted YAML string value."""
    if not text:
        return '""'
    # Characters that require quoting in YAML
    needs_quote = any(
        c in text for c in ':#{}[]|>&*!,%\'"@`\\'
    ) or text[0] in "-?|>"
    if needs_quote:
        escaped = text.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'
    return text


def unique_slug(base, used):
    slug = base
    n = 2
    while slug in used:
        slug = f"{base}-{n}"
        n += 1
    used.add(slug)
    return slug


def main():
    include_all = "--all" in sys.argv

    if not os.path.exists(CSV_PATH):
        print(f"CSV not found: {CSV_PATH}")
        sys.exit(1)

    existing_files = {f for f in os.listdir(OUT_DIR) if f.endswith(".md")}
    used_slugs = {os.path.splitext(f)[0] for f in existing_files}

    created = skipped_existing = skipped_shelf = 0

    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            shelf = row.get("Exclusive Shelf", "").strip()

            if not include_all and shelf == "to-read":
                skipped_shelf += 1
                continue

            raw_title = row.get("Title", "").strip()
            title = clean_title(raw_title)
            author = clean_author(row.get("Author", "").strip())

            if not title or not author:
                continue

            # Check pre-existing file before slug deduplication
            base_slug = slugify(title)[:60]
            if f"{base_slug}.md" in existing_files:
                skipped_existing += 1
                used_slugs.add(base_slug)
                continue

            title_slug = unique_slug(base_slug, used_slugs)
            filename = f"{title_slug}.md"

            author_slug = slugify(author)
            date_read = format_date(row.get("Date Read", "").strip())
            read_count = row.get("Read Count", "0").strip()
            status = make_status(shelf, read_count)

            gr_rating_raw = row.get("My Rating", "0").strip()
            gr_rating = int(gr_rating_raw) if gr_rating_raw.isdigit() else 0

            pages = row.get("Number of Pages", "").strip()
            year = (
                row.get("Original Publication Year", "").strip()
                or row.get("Year Published", "").strip()
            )
            review = row.get("My Review", "").strip()
            gr_id = row.get("Book Id", "").strip()

            lines = [
                "---",
                "layout: book",
                f"title: {yaml_str(title)}",
                f"author: {author_slug}",
                f"author_name: {yaml_str(author)}",
            ]
            if date_read:
                lines.append(f'date_read: "{date_read}"')
            lines.append(f'status: "{status}"')
            if year:
                lines.append(f"year_published: {year}")
            if pages:
                lines.append(f"pages: {pages}")
            if gr_rating > 0:
                lines.append(f"goodreads_rating: {gr_rating}")
            lines += [
                f"goodreads_id: {gr_id}",
                "people: []",
                "---",
            ]
            if review:
                lines += ["", review, ""]

            out_path = os.path.join(OUT_DIR, filename)
            with open(out_path, "w", encoding="utf-8") as out:
                out.write("\n".join(lines) + "\n")

            created += 1

    mode = "all shelves" if include_all else "read + currently-reading"
    print(
        f"Done ({mode}): {created} created, "
        f"{skipped_existing} skipped (file existed), "
        f"{skipped_shelf} skipped (to-read — use --all to include)"
    )


if __name__ == "__main__":
    main()
