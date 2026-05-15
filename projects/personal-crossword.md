---
layout: default
title: Personal Crossword
subtitle: A playable crossword maker from your own clues.
permalink: /projects/personal-crossword/
---

<link rel="stylesheet" href="{{ '/assets/css/crossword.css' | relative_url }}">

<main class="crossword-app" data-crossword-app>
  <section class="crossword-shell">
    <header class="crossword-header">
      <div>
        <p class="crossword-kicker" data-puzzle-kicker>Playable maker</p>
        <h1 data-puzzle-title>Personal Crossword</h1>
      </div>
      <div class="crossword-actions" aria-label="Puzzle actions">
        <button class="cw-button cw-button--primary" type="button" data-action="generate">Generate</button>
        <button class="cw-button" type="button" data-action="export">Export</button>
        <button class="cw-button" type="button" data-action="check">Check</button>
        <button class="cw-button" type="button" data-action="reveal">Reveal</button>
        <button class="cw-button" type="button" data-action="clear">Clear</button>
      </div>
    </header>

    <section class="crossword-workspace">
      <aside class="crossword-editor" aria-label="Crossword entries">
        <div class="editor-head">
          <h2>Entries</h2>
          <button class="cw-icon-button" type="button" data-action="add-entry" aria-label="Add entry">+</button>
        </div>
        <div class="entry-list" data-entry-list></div>
        <p class="crossword-status" data-status aria-live="polite"></p>
      </aside>

      <section class="crossword-board-panel" aria-label="Crossword board">
        <div class="crossword-board-wrap">
          <div class="crossword-board" data-board></div>
        </div>
      </section>

      <aside class="crossword-clues" aria-label="Crossword clues">
        <div class="clue-group">
          <h2>Across</h2>
          <ol data-clues-across></ol>
        </div>
        <div class="clue-group">
          <h2>Down</h2>
          <ol data-clues-down></ol>
        </div>
      </aside>
    </section>
  </section>
</main>

<script src="{{ '/assets/js/personal-crossword.js' | relative_url }}" defer></script>
