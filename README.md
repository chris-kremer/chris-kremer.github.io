# CK Personal Website

This repository contains the source for my personal website built with [Jekyll](https://jekyllrb.com/).

## Running locally

1. Install Ruby and Bundler.
2. Install dependencies:
   ```bash
   bundle install
   ```
3. Start a development server:
   ```bash
   bundle exec jekyll serve
   ```
4. Visit `http://localhost:4000` in your browser.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Visual library

`/media/` renders an interactive bookshelf and searchable cover grid. Book metadata is generated from `_books` into `/assets/data/library.json` on every Jekyll build. The original media view remains at `/media/archive/`, including access without JavaScript.

`_data/library_artwork.json` maps book slugs to ISBNs from the Goodreads export and optional cached cover paths. Cached covers in `assets/images/library/` and on-demand ISBN covers come from Open Library; missing artwork uses a typographic fallback. Add an `isbn` to a new book’s front matter for automatic cover loading. The shelf interaction was inspired by [Matthew Lee’s library](https://www.matthewlee.xyz/thoughts/library).
