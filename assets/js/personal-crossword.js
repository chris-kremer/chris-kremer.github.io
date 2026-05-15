(function () {
  const samples = [
    { answer: "BERLIN", clue: "City with the rainy museum day" },
    { answer: "SPREE", clue: "River that kept showing up on our walks" },
    { answer: "TEMPELHOFER", clue: "The old airport field with endless sky" },
    { answer: "KAFFEE", clue: "Default answer to any morning plan" },
    { answer: "KREUZBERG", clue: "Neighborhood for late dinners" },
    { answer: "UBAHN", clue: "Yellow trains under the city" },
    { answer: "MUSEUM", clue: "A strong rainy-day fallback" },
    { answer: "JULY", clue: "Month of the warmest trip" }
  ];

  const state = {
    entries: samples.map((entry) => ({ ...entry })),
    puzzle: null,
    selectedKey: null,
    direction: "across"
  };

  const app = document.querySelector("[data-crossword-app]");
  if (!app) return;

  const entryList = app.querySelector("[data-entry-list]");
  const boardEl = app.querySelector("[data-board]");
  const statusEl = app.querySelector("[data-status]");
  const acrossEl = app.querySelector("[data-clues-across]");
  const downEl = app.querySelector("[data-clues-down]");
  const titleEl = app.querySelector("[data-puzzle-title]");
  const kickerEl = app.querySelector("[data-puzzle-kicker]");

  app.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "add-entry") addEntry();
    if (action === "generate") generate();
    if (action === "export") exportPuzzle();
    if (action === "check") checkAnswers();
    if (action === "reveal") revealAnswers();
    if (action === "clear") clearAnswers();
  });

  entryList.addEventListener("input", (event) => {
    const row = event.target.closest("[data-index]");
    if (!row) return;
    const index = Number(row.dataset.index);
    state.entries[index][event.target.name] = event.target.value;
  });

  entryList.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove]");
    if (!remove) return;
    const index = Number(remove.closest("[data-index]").dataset.index);
    state.entries.splice(index, 1);
    renderEntries();
  });

  boardEl.addEventListener("focusin", (event) => {
    const input = event.target.closest("[data-cell]");
    if (!input || !state.puzzle) return;
    selectCell(Number(input.dataset.row), Number(input.dataset.col));
  });

  boardEl.addEventListener("input", (event) => {
    const input = event.target.closest("[data-cell]");
    if (!input) return;
    input.value = normalizeAnswer(input.value).slice(-1);
    moveFrom(input, 1);
  });

  boardEl.addEventListener("keydown", (event) => {
    const input = event.target.closest("[data-cell]");
    if (!input) return;
    if (event.key === "Backspace" && input.value === "") {
      event.preventDefault();
      moveFrom(input, -1, true);
    }
    if (event.key === "ArrowRight") moveDirection(event, input, "across", 1);
    if (event.key === "ArrowLeft") moveDirection(event, input, "across", -1);
    if (event.key === "ArrowDown") moveDirection(event, input, "down", 1);
    if (event.key === "ArrowUp") moveDirection(event, input, "down", -1);
    if (event.key === " " || event.key === "Tab") {
      state.direction = state.direction === "across" ? "down" : "across";
      highlight();
      if (event.key === " ") event.preventDefault();
    }
  });

  acrossEl.addEventListener("click", clueClick);
  downEl.addEventListener("click", clueClick);
  window.addEventListener("hashchange", () => {
    if (window.location.hash.startsWith("#puzzle=")) loadExportedPuzzle(window.location.href);
  });

  function renderEntries() {
    entryList.innerHTML = state.entries.map((entry, index) => `
      <div class="entry-row" data-index="${index}">
        <div class="entry-fields">
          <input name="answer" value="${escapeHtml(entry.answer)}" placeholder="Answer" aria-label="Answer ${index + 1}">
          <button class="entry-remove" type="button" data-remove aria-label="Remove entry">x</button>
          <textarea name="clue" placeholder="Clue" aria-label="Clue ${index + 1}">${escapeHtml(entry.clue)}</textarea>
        </div>
      </div>
    `).join("");
  }

  function addEntry() {
    state.entries.push({ answer: "", clue: "" });
    renderEntries();
    const last = entryList.querySelector("[data-index]:last-child input");
    if (last) last.focus();
  }

  function generate() {
    const entries = state.entries
      .map((entry) => ({ answer: normalizeAnswer(entry.answer), clue: entry.clue.trim() }))
      .filter((entry) => entry.answer.length > 1 && entry.clue);

    if (entries.length < 2) {
      setStatus("Add at least two answers with clues.");
      return;
    }

    const puzzle = buildPuzzle(entries);
    state.puzzle = puzzle;
    state.selectedKey = puzzle.placed[0] ? puzzle.placed[0].key : null;
    state.direction = puzzle.placed[0] ? puzzle.placed[0].dir : "across";
    renderPuzzle();
    setStatus(`${puzzle.placed.length} entries placed${puzzle.unplaced.length ? `, ${puzzle.unplaced.length} did not cross cleanly` : ""}.`);
  }

  function exportPuzzle() {
    if (!state.puzzle) generate();
    if (!state.puzzle || state.puzzle.placed.length < 2) return;

    const name = window.prompt("Name this crossword", titleEl.textContent.trim() || "Personal Crossword");
    if (!name) return;

    const payload = encodePuzzle({ title: name.trim(), puzzle: state.puzzle });
    const url = `${window.location.origin}${window.location.pathname}#puzzle=${payload}`;
    window.history.pushState(null, "", url);
    loadExportedPuzzle(url);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setStatus(`Exported unlisted puzzle URL: ${url}`);
  }

  function buildPuzzle(entries) {
    const words = [...entries].sort((a, b) => b.answer.length - a.answer.length);
    const placed = [];
    const grid = new Map();

    placeWord({ ...words.shift(), row: 0, col: 0, dir: "across", key: "0-across" }, grid, placed);

    const unplaced = [];
    for (const word of words) {
      const candidates = findCandidates(word, placed, grid).sort((a, b) => b.score - a.score);
      let done = false;
      for (const candidate of candidates) {
        if (canPlace(candidate, grid)) {
          placeWord(candidate, grid, placed);
          done = true;
          break;
        }
      }
      if (!done) unplaced.push(word);
    }

    return finalize(placed, grid, unplaced);
  }

  function findCandidates(word, placed, grid) {
    const candidates = [];
    for (const existing of placed) {
      for (let i = 0; i < word.answer.length; i += 1) {
        for (let j = 0; j < existing.answer.length; j += 1) {
          if (word.answer[i] !== existing.answer[j]) continue;
          const dir = existing.dir === "across" ? "down" : "across";
          const row = existing.row + (existing.dir === "down" ? j : 0) - (dir === "down" ? i : 0);
          const col = existing.col + (existing.dir === "across" ? j : 0) - (dir === "across" ? i : 0);
          const candidate = { ...word, row, col, dir, key: `${placed.length}-${dir}` };
          if (canPlace(candidate, grid)) candidates.push({ ...candidate, score: scoreCandidate(candidate, grid) });
        }
      }
    }
    return candidates;
  }

  function canPlace(word, grid) {
    let crossings = 0;
    for (let i = 0; i < word.answer.length; i += 1) {
      const row = word.row + (word.dir === "down" ? i : 0);
      const col = word.col + (word.dir === "across" ? i : 0);
      const cell = grid.get(coord(row, col));
      if (cell && cell.letter !== word.answer[i]) return false;
      if (cell) crossings += 1;
      if (!cell && touchesSide(row, col, word.dir, grid)) return false;
    }

    const before = endpoint(word, -1);
    const after = endpoint(word, word.answer.length);
    return !grid.has(coord(before.row, before.col)) && !grid.has(coord(after.row, after.col)) && crossings > 0;
  }

  function touchesSide(row, col, dir, grid) {
    if (dir === "across") return grid.has(coord(row - 1, col)) || grid.has(coord(row + 1, col));
    return grid.has(coord(row, col - 1)) || grid.has(coord(row, col + 1));
  }

  function endpoint(word, index) {
    return {
      row: word.row + (word.dir === "down" ? index : 0),
      col: word.col + (word.dir === "across" ? index : 0)
    };
  }

  function scoreCandidate(word, grid) {
    let crossings = 0;
    let minRow = Infinity;
    let maxRow = -Infinity;
    let minCol = Infinity;
    let maxCol = -Infinity;
    for (let i = 0; i < word.answer.length; i += 1) {
      const row = word.row + (word.dir === "down" ? i : 0);
      const col = word.col + (word.dir === "across" ? i : 0);
      if (grid.has(coord(row, col))) crossings += 1;
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
    }
    return crossings * 100 - ((maxRow - minRow) + (maxCol - minCol));
  }

  function placeWord(word, grid, placed) {
    word.key = `${placed.length}-${word.dir}`;
    for (let i = 0; i < word.answer.length; i += 1) {
      const row = word.row + (word.dir === "down" ? i : 0);
      const col = word.col + (word.dir === "across" ? i : 0);
      const key = coord(row, col);
      const cell = grid.get(key) || { row, col, letter: word.answer[i], words: [] };
      cell.words.push(word.key);
      grid.set(key, cell);
    }
    placed.push(word);
  }

  function finalize(placed, grid, unplaced) {
    const cells = [...grid.values()];
    const minRow = Math.min(...cells.map((cell) => cell.row));
    const minCol = Math.min(...cells.map((cell) => cell.col));
    const maxRow = Math.max(...cells.map((cell) => cell.row));
    const maxCol = Math.max(...cells.map((cell) => cell.col));
    const normalizedGrid = new Map();
    cells.forEach((cell) => {
      cell.row -= minRow;
      cell.col -= minCol;
      normalizedGrid.set(coord(cell.row, cell.col), cell);
    });
    placed.forEach((word) => {
      word.row -= minRow;
      word.col -= minCol;
    });
    assignNumbers(placed);
    return { placed, grid: normalizedGrid, unplaced, rows: maxRow - minRow + 1, cols: maxCol - minCol + 1 };
  }

  function assignNumbers(placed) {
    let next = 1;
    const starts = new Map();
    [...placed].sort((a, b) => a.row - b.row || a.col - b.col).forEach((word) => {
      const key = coord(word.row, word.col);
      if (!starts.has(key)) starts.set(key, next++);
      word.number = starts.get(key);
    });
  }

  function renderPuzzle() {
    const puzzle = state.puzzle;
    boardEl.style.gridTemplateColumns = `repeat(${puzzle.cols}, var(--cw-cell))`;
    boardEl.innerHTML = "";

    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        const cell = puzzle.grid.get(coord(row, col));
        const square = document.createElement("div");
        square.className = cell ? "cw-cell" : "cw-cell is-block";
        if (cell) {
          const number = startNumber(row, col);
          square.innerHTML = `${number ? `<span class="cw-number">${number}</span>` : ""}<input data-cell data-row="${row}" data-col="${col}" maxlength="1" inputmode="text" aria-label="Row ${row + 1}, column ${col + 1}">`;
        }
        boardEl.append(square);
      }
    }
    renderClues();
    highlight();
  }

  function renderClues() {
    renderClueList(acrossEl, state.puzzle.placed.filter((word) => word.dir === "across"));
    renderClueList(downEl, state.puzzle.placed.filter((word) => word.dir === "down"));
  }

  function renderClueList(target, words) {
    target.innerHTML = words.sort((a, b) => a.number - b.number).map((word) => `
      <li class="clue-item" data-clue="${word.key}">
        <span class="clue-number">${word.number}</span>
        <span>${escapeHtml(word.clue)}</span>
      </li>
    `).join("");
  }

  function startNumber(row, col) {
    const word = state.puzzle.placed.find((placedWord) => placedWord.row === row && placedWord.col === col);
    return word ? word.number : "";
  }

  function selectCell(row, col) {
    const cell = state.puzzle.grid.get(coord(row, col));
    const options = state.puzzle.placed.filter((word) => cell.words.includes(word.key));
    const preferred = options.find((word) => word.dir === state.direction) || options[0];
    state.selectedKey = preferred.key;
    state.direction = preferred.dir;
    highlight();
  }

  function highlight() {
    const selected = state.puzzle && state.puzzle.placed.find((word) => word.key === state.selectedKey);
    boardEl.querySelectorAll(".cw-cell").forEach((cell) => cell.classList.remove("is-active", "is-selected"));
    app.querySelectorAll(".clue-item").forEach((clue) => clue.classList.toggle("is-active", clue.dataset.clue === state.selectedKey));
    if (!selected) return;
    wordCells(selected).forEach(({ row, col }, index) => {
      const input = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      if (input) input.parentElement.classList.add(index === 0 ? "is-selected" : "is-active");
    });
  }

  function clueClick(event) {
    const clue = event.target.closest("[data-clue]");
    if (!clue) return;
    const word = state.puzzle.placed.find((item) => item.key === clue.dataset.clue);
    state.selectedKey = word.key;
    state.direction = word.dir;
    focusCell(word.row, word.col);
    highlight();
  }

  function checkAnswers() {
    if (!state.puzzle) return;
    let wrong = 0;
    boardEl.querySelectorAll("[data-cell]").forEach((input) => {
      const cell = state.puzzle.grid.get(coord(Number(input.dataset.row), Number(input.dataset.col)));
      const isWrong = input.value && input.value !== cell.letter;
      input.parentElement.classList.toggle("is-wrong", isWrong);
      if (isWrong) wrong += 1;
    });
    setStatus(wrong ? `${wrong} filled square${wrong === 1 ? "" : "s"} need another look.` : "All filled letters are correct.");
  }

  function revealAnswers() {
    if (!state.puzzle) return;
    boardEl.querySelectorAll("[data-cell]").forEach((input) => {
      const cell = state.puzzle.grid.get(coord(Number(input.dataset.row), Number(input.dataset.col)));
      input.value = cell.letter;
      input.parentElement.classList.remove("is-wrong");
    });
    setStatus("Puzzle revealed.");
  }

  function clearAnswers() {
    boardEl.querySelectorAll("[data-cell]").forEach((input) => {
      input.value = "";
      input.parentElement.classList.remove("is-wrong");
    });
    setStatus("Board cleared.");
  }

  function loadExportedPuzzle(url) {
    const encoded = new URL(url).hash.replace(/^#puzzle=/, "");
    const data = decodePuzzle(encoded);
    if (!data) {
      setStatus("That puzzle URL could not be loaded.");
      return false;
    }

    app.classList.add("is-exported");
    kickerEl.textContent = "Unlisted puzzle";
    titleEl.textContent = data.title || "Personal Crossword";
    state.puzzle = revivePuzzle(data.puzzle);
    state.selectedKey = state.puzzle.placed[0] ? state.puzzle.placed[0].key : null;
    state.direction = state.puzzle.placed[0] ? state.puzzle.placed[0].dir : "across";
    renderPuzzle();
    setStatus("Unlisted puzzle loaded.");
    return true;
  }

  function encodePuzzle({ title, puzzle }) {
    const compact = {
      title,
      puzzle: {
        rows: puzzle.rows,
        cols: puzzle.cols,
        placed: puzzle.placed.map(({ answer, clue, row, col, dir, key, number }) => ({ answer, clue, row, col, dir, key, number }))
      }
    };
    return btoa(unescape(encodeURIComponent(JSON.stringify(compact)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodePuzzle(encoded) {
    try {
      const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
      return JSON.parse(decodeURIComponent(escape(atob(base64))));
    } catch (error) {
      return null;
    }
  }

  function revivePuzzle(puzzle) {
    const grid = new Map();
    puzzle.placed.forEach((word) => {
      for (let i = 0; i < word.answer.length; i += 1) {
        const row = word.row + (word.dir === "down" ? i : 0);
        const col = word.col + (word.dir === "across" ? i : 0);
        const key = coord(row, col);
        const cell = grid.get(key) || { row, col, letter: word.answer[i], words: [] };
        cell.words.push(word.key);
        grid.set(key, cell);
      }
    });
    return { ...puzzle, grid, unplaced: [] };
  }

  function moveDirection(event, input, direction, delta) {
    event.preventDefault();
    state.direction = direction;
    state.selectedKey = containingWord(input, direction) || state.selectedKey;
    moveFrom(input, delta);
  }

  function moveFrom(input, delta, erase) {
    const word = state.puzzle.placed.find((item) => item.key === state.selectedKey);
    if (!word) return;
    const cells = wordCells(word);
    const index = cells.findIndex((cell) => cell.row === Number(input.dataset.row) && cell.col === Number(input.dataset.col));
    const next = cells[index + delta];
    if (!next) return;
    focusCell(next.row, next.col);
    if (erase) {
      const nextInput = boardEl.querySelector(`[data-row="${next.row}"][data-col="${next.col}"]`);
      if (nextInput) nextInput.value = "";
    }
  }

  function containingWord(input, direction) {
    const cell = state.puzzle.grid.get(coord(Number(input.dataset.row), Number(input.dataset.col)));
    const word = state.puzzle.placed.find((item) => item.dir === direction && cell.words.includes(item.key));
    return word ? word.key : null;
  }

  function focusCell(row, col) {
    const input = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (input) input.focus();
  }

  function wordCells(word) {
    return Array.from({ length: word.answer.length }, (_, index) => endpoint(word, index));
  }

  function normalizeAnswer(value) {
    return String(value || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");
  }

  function coord(row, col) {
    return `${row},${col}`;
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  if (!window.location.hash.startsWith("#puzzle=") || !loadExportedPuzzle(window.location.href)) {
    renderEntries();
    generate();
  }
})();
