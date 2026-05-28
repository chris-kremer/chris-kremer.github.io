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

  const fillBank = [
    { answer: "ARIA", clue: "Opera showpiece" },
    { answer: "ABLE", clue: "Up to the task" },
    { answer: "ACRE", clue: "Plot unit" },
    { answer: "ACE", clue: "Top card" },
    { answer: "ACID", clue: "Tart substance" },
    { answer: "ACT", clue: "Stage segment" },
    { answer: "ADO", clue: "Fuss" },
    { answer: "AGE", clue: "Number on a birthday card" },
    { answer: "AGO", clue: "Back in time" },
    { answer: "ALT", clue: "Keyboard key" },
    { answer: "AMP", clue: "Concert gear" },
    { answer: "AID", clue: "Assist" },
    { answer: "AIM", clue: "Target" },
    { answer: "AIR", clue: "Podcast medium, once" },
    { answer: "ALE", clue: "Pub pour" },
    { answer: "ANT", clue: "Picnic intruder" },
    { answer: "APE", clue: "Primate" },
    { answer: "APT", clue: "Fitting" },
    { answer: "ARC", clue: "Curved path" },
    { answer: "ARCH", clue: "Curved support" },
    { answer: "AREA", clue: "Geometric measure" },
    { answer: "ARE", clue: "Exist, plurally" },
    { answer: "ARISE", clue: "Come up" },
    { answer: "ART", clue: "Gallery offering" },
    { answer: "ARM", clue: "Sleeve filler" },
    { answer: "ATOM", clue: "Tiny particle" },
    { answer: "ASH", clue: "Fireplace residue" },
    { answer: "ASK", clue: "Pose a question" },
    { answer: "ATLAS", clue: "Book with borders" },
    { answer: "ATE", clue: "Had dinner" },
    { answer: "AURORA", clue: "Dawn, poetically" },
    { answer: "AVE", clue: "City map abbr." },
    { answer: "AXE", clue: "Chopping tool" },
    { answer: "BAR", clue: "Lawyer's hurdle" },
    { answer: "BEAM", clue: "Structural support" },
    { answer: "BEAN", clue: "Chili ingredient" },
    { answer: "BASIL", clue: "Pesto herb" },
    { answer: "BAT", clue: "Diamond club" },
    { answer: "BAY", clue: "Coastal indentation" },
    { answer: "BED", clue: "Sleep spot" },
    { answer: "BEE", clue: "Spelling contest" },
    { answer: "BET", clue: "Wager" },
    { answer: "BETA", clue: "Test release" },
    { answer: "BIRD", clue: "Feathered flier" },
    { answer: "BOB", clue: "Short haircut" },
    { answer: "BOLT", clue: "Fastener" },
    { answer: "BOW", clue: "Ship's front" },
    { answer: "BOX", clue: "Shipping container" },
    { answer: "BUN", clue: "Bakery roll" },
    { answer: "CAB", clue: "Taxi" },
    { answer: "CAD", clue: "Dishonorable sort" },
    { answer: "CANAL", clue: "Waterway through a city" },
    { answer: "CAP", clue: "Bottle top" },
    { answer: "CAR", clue: "Road vehicle" },
    { answer: "CAT", clue: "Small feline" },
    { answer: "COW", clue: "Dairy animal" },
    { answer: "CRY", clue: "Sob" },
    { answer: "CAVE", clue: "Spelunker's site" },
    { answer: "CITY", clue: "Urban center" },
    { answer: "CIVIC", clue: "Like town hall business" },
    { answer: "COD", clue: "Fish in chips" },
    { answer: "COG", clue: "Gear tooth" },
    { answer: "CON", clue: "Opposing argument" },
    { answer: "COP", clue: "Officer, informally" },
    { answer: "CORE", clue: "Center" },
    { answer: "CUE", clue: "Pool stick" },
    { answer: "CUP", clue: "Trophy shape" },
    { answer: "CUT", clue: "Edit down" },
    { answer: "DAY", clue: "Calendar square" },
    { answer: "DATA", clue: "Spreadsheet contents" },
    { answer: "DELTA", clue: "River mouth shape" },
    { answer: "DEN", clue: "Cozy room" },
    { answer: "DEW", clue: "Morning moisture" },
    { answer: "DIM", clue: "Not bright" },
    { answer: "DIP", clue: "Salsa, e.g." },
    { answer: "DOG", clue: "Kennel sound source" },
    { answer: "DRY", clue: "Not wet" },
    { answer: "DUE", clue: "Owed" },
    { answer: "DUO", clue: "Pair" },
    { answer: "EASE", clue: "Lack of difficulty" },
    { answer: "EAR", clue: "Corn unit" },
    { answer: "EMBER", clue: "Campfire remnant" },
    { answer: "ENCORE", clue: "Call after a strong set" },
    { answer: "END", clue: "Finale" },
    { answer: "EPOCH", clue: "Distinct period" },
    { answer: "EQUAL", clue: "Evenly matched" },
    { answer: "ERA", clue: "Historical stretch" },
    { answer: "ERR", clue: "Goof" },
    { answer: "ESSAY", clue: "Short-form argument" },
    { answer: "ETHER", clue: "Old-timey upper air" },
    { answer: "EAT", clue: "Take in, as a meal" },
    { answer: "EEL", clue: "Slippery swimmer" },
    { answer: "EON", clue: "Vast stretch of time" },
    { answer: "EVE", clue: "Night before" },
    { answer: "EWE", clue: "Female sheep" },
    { answer: "EYE", clue: "Needle opening" },
    { answer: "FAN", clue: "Stadium supporter" },
    { answer: "FABLE", clue: "Moral tale" },
    { answer: "FAR", clue: "Not close" },
    { answer: "FIG", clue: "Newton fruit" },
    { answer: "FIN", clue: "Shark feature" },
    { answer: "FIR", clue: "Evergreen tree" },
    { answer: "FIX", clue: "Repair" },
    { answer: "FLY", clue: "Take wing" },
    { answer: "FOG", clue: "Low cloud" },
    { answer: "FOR", clue: "In favor of" },
    { answer: "FUR", clue: "Coat material" },
    { answer: "GALA", clue: "Fancy fundraiser" },
    { answer: "GAME", clue: "Match or pastime" },
    { answer: "GEL", clue: "Hair product" },
    { answer: "GEM", clue: "Jewel" },
    { answer: "GET", clue: "Obtain" },
    { answer: "GIN", clue: "Martini spirit" },
    { answer: "GUM", clue: "Chewy candy" },
    { answer: "GUN", clue: "Starter's prop" },
    { answer: "GYM", clue: "Workout room" },
    { answer: "GRID", clue: "Crossword framework" },
    { answer: "HARBOR", clue: "Safe port" },
    { answer: "HAT", clue: "Headwear" },
    { answer: "HEN", clue: "Coop layer" },
    { answer: "HER", clue: "That woman's" },
    { answer: "HEX", clue: "Spell" },
    { answer: "HID", clue: "Kept out of sight" },
    { answer: "HIM", clue: "That man" },
    { answer: "HIP", clue: "Trendy" },
    { answer: "HIT", clue: "Chart-topper" },
    { answer: "HOME", clue: "Place to return to" },
    { answer: "ICE", clue: "Cube in a drink" },
    { answer: "INK", clue: "Pen fluid" },
    { answer: "IDEAL", clue: "Model of perfection" },
    { answer: "INLET", clue: "Small coastal opening" },
    { answer: "INN", clue: "Roadside lodging" },
    { answer: "IONIC", clue: "Column style with scrolls" },
    { answer: "IRE", clue: "Anger" },
    { answer: "IVY", clue: "Climbing plant" },
    { answer: "JAR", clue: "Jam container" },
    { answer: "JET", clue: "Fast aircraft" },
    { answer: "JOB", clue: "Work assignment" },
    { answer: "JOY", clue: "Great happiness" },
    { answer: "JAZZ", clue: "Improvisational genre" },
    { answer: "KEY", clue: "Piano part" },
    { answer: "KIT", clue: "Set of tools" },
    { answer: "LAX", clue: "Not strict" },
    { answer: "LAB", clue: "Experiment site" },
    { answer: "LAKE", clue: "Inland water body" },
    { answer: "LAD", clue: "Young fellow" },
    { answer: "LAG", clue: "Fall behind" },
    { answer: "LAP", clue: "Pool length" },
    { answer: "LATER", clue: "Not now" },
    { answer: "LASER", clue: "Focused beam" },
    { answer: "LAW", clue: "Statute" },
    { answer: "LAY", clue: "Put down" },
    { answer: "LEAF", clue: "Tree part" },
    { answer: "LED", clue: "Guided" },
    { answer: "LEG", clue: "Table support" },
    { answer: "LEVEL", clue: "Perfectly flat" },
    { answer: "LET", clue: "Allow" },
    { answer: "LENS", clue: "Camera part" },
    { answer: "LIE", clue: "Fib, say" },
    { answer: "LID", clue: "Jar top" },
    { answer: "LINEN", clue: "Crisp sheet material" },
    { answer: "LOG", clue: "Captain's record" },
    { answer: "MAD", clue: "Angry" },
    { answer: "LORE", clue: "Collected legends" },
    { answer: "LOT", clue: "Parking area" },
    { answer: "LOW", clue: "Not high" },
    { answer: "MAZE", clue: "Labyrinth" },
    { answer: "MAP", clue: "Explorer's aid" },
    { answer: "MANGO", clue: "Fruit in a lassi" },
    { answer: "MAR", clue: "Damage the surface of" },
    { answer: "METRO", clue: "City rail system" },
    { answer: "MINOR", clue: "Not major" },
    { answer: "MOP", clue: "Cleanup tool" },
    { answer: "MUD", clue: "Wet dirt" },
    { answer: "MOON", clue: "Tidal influence" },
    { answer: "MUG", clue: "Coffee cup" },
    { answer: "NET", clue: "Goalie's barrier" },
    { answer: "NEW", clue: "Fresh" },
    { answer: "NOD", clue: "Silent yes" },
    { answer: "NOR", clue: "Neither partner" },
    { answer: "NOVA", clue: "Bright stellar event" },
    { answer: "NEXUS", clue: "Central link" },
    { answer: "NOBLE", clue: "High-minded" },
    { answer: "NOTE", clue: "Brief message" },
    { answer: "NOW", clue: "Right away" },
    { answer: "NUN", clue: "Convent resident" },
    { answer: "OAK", clue: "Acorn tree" },
    { answer: "OCEAN", clue: "Vast body of water" },
    { answer: "OASIS", clue: "Desert relief" },
    { answer: "ODD", clue: "Not even" },
    { answer: "OIL", clue: "Engine need" },
    { answer: "OLD", clue: "Not new" },
    { answer: "ONE", clue: "Single" },
    { answer: "OPEN", clue: "Not closed" },
    { answer: "OPERA", clue: "Work with many parts" },
    { answer: "OPT", clue: "Choose" },
    { answer: "ORB", clue: "Sphere" },
    { answer: "ORBIT", clue: "Path around a star" },
    { answer: "ORE", clue: "Mine find" },
    { answer: "OWL", clue: "Night hooter" },
    { answer: "PAGE", clue: "Book leaf" },
    { answer: "PANEL", clue: "Discussion group" },
    { answer: "PASTA", clue: "Rigatoni or rotini" },
    { answer: "PEN", clue: "Writer's tool" },
    { answer: "PET", clue: "Household companion" },
    { answer: "PIG", clue: "Sty resident" },
    { answer: "PIER", clue: "Docking place" },
    { answer: "PILOT", clue: "Episode before a series" },
    { answer: "PIN", clue: "Bowling target" },
    { answer: "PIT", clue: "Peach center" },
    { answer: "PIXEL", clue: "Tiny screen unit" },
    { answer: "POD", clue: "Pea holder" },
    { answer: "POP", clue: "Soda, regionally" },
    { answer: "PRO", clue: "Expert" },
    { answer: "PORT", clue: "Harbor city" },
    { answer: "POT", clue: "Stew vessel" },
    { answer: "QUARTZ", clue: "Common crystal" },
    { answer: "RADAR", clue: "Palindromic detection system" },
    { answer: "RAG", clue: "Cleaning cloth" },
    { answer: "RAM", clue: "Battering device" },
    { answer: "RAN", clue: "Managed, as a campaign" },
    { answer: "RAY", clue: "Beam of light" },
    { answer: "RATIO", clue: "Comparative figure" },
    { answer: "RED", clue: "Stop-sign color" },
    { answer: "REEF", clue: "Coral formation" },
    { answer: "RELAY", clue: "Pass along" },
    { answer: "RIB", clue: "Barbecue piece" },
    { answer: "RID", clue: "Free of" },
    { answer: "RHYME", clue: "Verse-ending echo" },
    { answer: "RIG", clue: "Set up" },
    { answer: "RIVER", clue: "Map feature with a mouth" },
    { answer: "ROAD", clue: "Map line" },
    { answer: "ROD", clue: "Fishing pole" },
    { answer: "ROT", clue: "Decay" },
    { answer: "ROW", clue: "Spreadsheet line" },
    { answer: "RULE", clue: "Guideline" },
    { answer: "RUG", clue: "Floor covering" },
    { answer: "RUN", clue: "Jog" },
    { answer: "RYE", clue: "Deli bread choice" },
    { answer: "SALON", clue: "Place for cuts and color" },
    { answer: "SATIN", clue: "Glossy fabric" },
    { answer: "SEA", clue: "Large body of water" },
    { answer: "SEE", clue: "Make out visually" },
    { answer: "SET", clue: "Tennis unit" },
    { answer: "SHORE", clue: "Water's edge" },
    { answer: "SIR", clue: "Polite address" },
    { answer: "SKI", clue: "Slope runner" },
    { answer: "SKY", clue: "Blue expanse" },
    { answer: "SOLAR", clue: "Sun-related" },
    { answer: "SONAR", clue: "Submarine detection aid" },
    { answer: "SUN", clue: "Solar center" },
    { answer: "TABLE", clue: "Dining room fixture" },
    { answer: "TAB", clue: "Browser feature" },
    { answer: "TAG", clue: "Price marker" },
    { answer: "TAP", clue: "Faucet" },
    { answer: "TAX", clue: "April concern" },
    { answer: "TEA", clue: "Steeped drink" },
    { answer: "TENOR", clue: "High male voice" },
    { answer: "TIE", clue: "Neckwear" },
    { answer: "TIDAL", clue: "Governed by the moon" },
    { answer: "TIN", clue: "Can material" },
    { answer: "TIP", clue: "Gratuity" },
    { answer: "TOE", clue: "Shoe filler" },
    { answer: "TOKEN", clue: "Small sign of appreciation" },
    { answer: "TONE", clue: "Writer's attitude" },
    { answer: "TOP", clue: "Summit" },
    { answer: "TOW", clue: "Haul away" },
    { answer: "TOY", clue: "Plaything" },
    { answer: "TRY", clue: "Attempt" },
    { answer: "TREE", clue: "Oak or elm" },
    { answer: "TUB", clue: "Bath fixture" },
    { answer: "ULTRA", clue: "Beyond the usual" },
    { answer: "UNION", clue: "Organized labor group" },
    { answer: "URN", clue: "Vase for ashes" },
    { answer: "USE", clue: "Put to work" },
    { answer: "VALET", clue: "One taking keys, maybe" },
    { answer: "VAN", clue: "Moving vehicle" },
    { answer: "VAT", clue: "Brewing tub" },
    { answer: "VECTOR", clue: "Quantity with direction" },
    { answer: "VIEW", clue: "Scenic outlook" },
    { answer: "VELVET", clue: "Soft-napped fabric" },
    { answer: "VET", clue: "Animal doctor" },
    { answer: "VIVID", clue: "Strikingly bright" },
    { answer: "WAR", clue: "Armed conflict" },
    { answer: "WAX", clue: "Candle stuff" },
    { answer: "WEB", clue: "Spider's creation" },
    { answer: "WED", clue: "Marry" },
    { answer: "WET", clue: "Not dry" },
    { answer: "WIN", clue: "Victory" },
    { answer: "WIT", clue: "Clever humor" },
    { answer: "WORD", clue: "Crossword unit" },
    { answer: "YAK", clue: "Chat at length" },
    { answer: "YAM", clue: "Thanksgiving tuber" },
    { answer: "YEN", clue: "Japanese currency" },
    { answer: "YES", clue: "Affirmative" },
    { answer: "YET", clue: "So far" },
    { answer: "ZIP", clue: "Energy" },
    { answer: "ZENITH", clue: "Highest point" }
  ];
  const fillClues = new Map(fillBank.map((entry) => [entry.answer, entry.clue]));
  const tinyFillBank = [
    { answer: "AM", clue: "Morning hrs." },
    { answer: "FM", clue: "Radio band" },
    { answer: "TV", clue: "Living room screen" },
    { answer: "PC", clue: "Desktop option" },
    { answer: "ID", clue: "Bouncer's request" },
    { answer: "OK", clue: "All right" },
    { answer: "AD", clue: "Marketing spot" },
    { answer: "AI", clue: "Modern bot tech" },
    { answer: "IT", clue: "Tech dept." },
    { answer: "IO", clue: "Jupiter moon" },
    { answer: "OX", clue: "Draft animal" },
    { answer: "UP", clue: "Awake, as a child" }
    ,{ answer: "BY", clue: "Next to" }
    ,{ answer: "GO", clue: "Green-light word" }
    ,{ answer: "HE", clue: "That man" }
    ,{ answer: "IF", clue: "Conditional word" }
    ,{ answer: "IN", clue: "Fashionable" }
    ,{ answer: "ME", clue: "Speaker's self" }
    ,{ answer: "MY", clue: "Possessive cry" }
    ,{ answer: "NO", clue: "Negative vote" }
    ,{ answer: "ON", clue: "Operating" }
    ,{ answer: "OR", clue: "Choice word" }
    ,{ answer: "SO", clue: "Therefore" }
    ,{ answer: "TO", clue: "Toward" }
    ,{ answer: "US", clue: "The two of us" }
    ,{ answer: "WE", clue: "Speaker's group" }
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
    if (action === "suggest-fill") suggestFill();
    if (action === "export") exportPuzzle();
    if (action === "edit-puzzle") editExportedPuzzle();
    if (action === "check") checkAnswers();
    if (action === "reveal-word") revealSelectedWord();
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
        ${entry.generated ? '<div class="entry-meta"><span>Suggested fill</span></div>' : ""}
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
      .map((entry) => ({ answer: normalizeAnswer(entry.answer), clue: entry.clue.trim(), generated: Boolean(entry.generated) }))
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

    const payload = encodePuzzle({ title: name.trim(), puzzle: state.puzzle, entries: state.entries });
    const url = `${window.location.origin}${window.location.pathname}#puzzle=${payload}`;
    window.history.pushState(null, "", url);
    loadExportedPuzzle(url);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setStatus(`Exported unlisted puzzle URL: ${url}`);
  }

  function suggestFill() {
    if (!state.puzzle) generate();
    if (!state.puzzle) return;

    const before = unusedStats(state.puzzle);
    const existingAnswers = new Set(state.entries.map((entry) => normalizeAnswer(entry.answer)));
    const personalAnswers = new Set(state.entries.filter((entry) => !entry.generated).map((entry) => normalizeAnswer(entry.answer)));
    const suggestions = [];
    let directPlacements = 0;

    for (const candidate of fillBank) {
      if (directPlacements >= 48) break;
      if (existingAnswers.has(candidate.answer)) continue;

      const placement = bestFillPlacement(candidate, state.puzzle, existingAnswers, false);
      if (!placement) continue;

      const added = placeGeneratedFill({ ...candidate, generated: true }, placement);
      directPlacements += 1;
      suggestions.push(...added);
      added.forEach((entry) => existingAnswers.add(entry.answer));
      if (before.unused > 0 && unusedStats(state.puzzle).unused <= before.unused / 2) break;
    }

    if (before.unused > 0 && unusedStats(state.puzzle).unused > before.unused / 2) {
      for (const candidate of fillBank) {
        if (existingAnswers.has(candidate.answer)) continue;
        const placement = bestFillPlacement(candidate, state.puzzle, existingAnswers, true) || bestDetachedPlacement(candidate, state.puzzle);
        if (!placement) continue;
        const added = placeGeneratedFill({ ...candidate, generated: true }, placement);
        suggestions.push(...added);
        added.forEach((entry) => existingAnswers.add(entry.answer));
        if (unusedStats(state.puzzle).unused <= before.unused / 2) break;
      }
    }

    if (before.unused > 0 && unusedStats(state.puzzle).unused > before.unused / 2) {
      for (const candidate of tinyFillBank) {
        if (existingAnswers.has(candidate.answer)) continue;
        const placement = bestLooseDetachedPlacement(candidate, state.puzzle, personalAnswers);
        if (!placement) continue;
        const added = placeGeneratedFill({ ...candidate, generated: true }, placement);
        suggestions.push(...added);
        added.forEach((entry) => existingAnswers.add(entry.answer));
        if (unusedStats(state.puzzle).unused <= before.unused / 2) break;
      }
    }

    if (before.unused > 0 && unusedStats(state.puzzle).unused > before.unused / 2) {
      for (const candidate of fillBank) {
        if (existingAnswers.has(candidate.answer)) continue;
        const placement = bestLooseDetachedPlacement(candidate, state.puzzle, personalAnswers);
        if (!placement) continue;
        const added = placeGeneratedFill({ ...candidate, generated: true }, placement);
        suggestions.push(...added);
        added.forEach((entry) => existingAnswers.add(entry.answer));
        if (unusedStats(state.puzzle).unused <= before.unused / 2) break;
      }
    }

    if (!suggestions.length) {
      setStatus("No clean fill suggestions found for this layout. Try regenerating the base puzzle first.");
      return;
    }

    reconcileVisibleSlots();
    assignNumbers(state.puzzle.placed);
    compactSuggestedFill();
    state.selectedKey = state.puzzle.placed[0] ? state.puzzle.placed[0].key : null;
    state.direction = state.puzzle.placed[0] ? state.puzzle.placed[0].dir : "across";
    renderEntries();
    renderPuzzle();

    const after = unusedStats(state.puzzle);
    const reduction = before.unused ? Math.round(((before.unused - after.unused) / before.unused) * 100) : 0;
    setStatus(`Added ${suggestions.length} editable fill suggestion${suggestions.length === 1 ? "" : "s"} and reduced unused squares by ${reduction}%.`);
  }

  function bestDetachedPlacement(candidate, puzzle) {
    for (const dir of ["across", "down"]) {
      const rowLimit = dir === "down" ? puzzle.rows - candidate.answer.length : puzzle.rows - 1;
      const colLimit = dir === "across" ? puzzle.cols - candidate.answer.length : puzzle.cols - 1;
      for (let row = 0; row <= rowLimit; row += 1) {
        for (let col = 0; col <= colLimit; col += 1) {
          const placement = {
            row,
            col,
            dir,
            implicitSlots: [],
            score: candidate.answer.length
          };
          if (canPlaceDetached(candidate.answer, placement, puzzle.grid)) return placement;
        }
      }
    }
    return null;
  }

  function bestLooseDetachedPlacement(candidate, puzzle, existingAnswers) {
    let best = null;
    for (const dir of ["across", "down"]) {
      const rowLimit = dir === "down" ? puzzle.rows - candidate.answer.length : puzzle.rows - 1;
      const colLimit = dir === "across" ? puzzle.cols - candidate.answer.length : puzzle.cols - 1;
      for (let row = 0; row <= rowLimit; row += 1) {
        for (let col = 0; col <= colLimit; col += 1) {
          const placement = { row, col, dir, implicitSlots: [], score: candidate.answer.length };
          if (!canPlaceLooseDetached(candidate.answer, placement, puzzle, existingAnswers)) continue;
          if (!best || placement.score > best.score) best = placement;
        }
      }
    }
    return best;
  }

  function canPlaceLooseDetached(answer, placement, puzzle, existingAnswers) {
    const trialGrid = cloneGrid(puzzle.grid);
    for (let i = 0; i < answer.length; i += 1) {
      const row = placement.row + (placement.dir === "down" ? i : 0);
      const col = placement.col + (placement.dir === "across" ? i : 0);
      if (trialGrid.has(coord(row, col))) return false;
      trialGrid.set(coord(row, col), { row, col, letter: answer[i], words: ["trial"] });
    }

    return !extractSlots(trialGrid, puzzle.rows, puzzle.cols)
      .some((slot) => [...existingAnswers].some((existing) => slot.answer.includes(existing) && slot.answer !== existing));
  }

  function canPlaceDetached(answer, placement, grid) {
    const before = endpoint(placement, -1);
    const after = endpoint(placement, answer.length);
    if (grid.has(coord(before.row, before.col)) || grid.has(coord(after.row, after.col))) return false;

    for (let i = 0; i < answer.length; i += 1) {
      const row = placement.row + (placement.dir === "down" ? i : 0);
      const col = placement.col + (placement.dir === "across" ? i : 0);
      if (grid.has(coord(row, col))) return false;
      if (placement.dir === "across" && (grid.has(coord(row - 1, col)) || grid.has(coord(row + 1, col)))) return false;
      if (placement.dir === "down" && (grid.has(coord(row, col - 1)) || grid.has(coord(row, col + 1)))) return false;
    }
    return true;
  }

  function compactSuggestedFill() {
    const requiredAnswers = new Set(state.entries.filter((entry) => !entry.generated).map((entry) => normalizeAnswer(entry.answer)));
    const compact = buildPuzzle(normalizedEntries(state.entries));
    const placedAnswers = new Set(compact.placed.map((word) => word.answer));
    const allRequiredPlaced = [...requiredAnswers].every((answer) => placedAnswers.has(answer));
    const compactSlots = extractSlots(compact.grid, compact.rows, compact.cols);
    const mutatesRequired = compactSlots.some((slot) => [...requiredAnswers].some((answer) => slot.answer.includes(answer) && slot.answer !== answer));
    if (!allRequiredPlaced || unusedStats(compact).unused >= unusedStats(state.puzzle).unused) return;
    if (mutatesRequired) return;

    state.puzzle = compact;
    state.entries = compact.placed.map(({ answer, clue, generated }) => ({ answer, clue, generated: Boolean(generated) }));
  }

  function reconcileVisibleSlots() {
    const personalEntries = state.entries
      .filter((entry) => !entry.generated)
      .map((entry) => ({ answer: normalizeAnswer(entry.answer), clue: entry.clue, generated: false }));
    const personalClues = new Map(personalEntries.map((entry) => [entry.answer, entry.clue]));
    const personalAnswers = new Set(personalClues.keys());
    const slots = extractSlots(state.puzzle.grid, state.puzzle.rows, state.puzzle.cols)
      .filter((slot) => slot.answer.length > 1);

    const reconciled = [];
    slots.forEach((slot) => {
      const isPersonal = personalAnswers.has(slot.answer);
      reconciled.push({
        ...slot,
        clue: isPersonal ? personalClues.get(slot.answer) : fillClues.get(slot.answer) || clueForGenerated(slot.answer),
        generated: !isPersonal,
        key: `${reconciled.length}-${slot.dir}`
      });
    });

    const presentPersonal = new Set(reconciled.filter((word) => !word.generated).map((word) => word.answer));
    const allPersonalPresent = [...personalAnswers].every((answer) => presentPersonal.has(answer));
    if (!allPersonalPresent) return;

    const nextGrid = new Map();
    reconciled.forEach((word) => writeWordToGrid(word, nextGrid));
    state.puzzle = { ...state.puzzle, placed: reconciled, grid: nextGrid };
    state.entries = reconciled.map(({ answer, clue, generated }) => ({ answer, clue, generated }));
  }

  function normalizedEntries(entries) {
    return entries
      .map((entry) => ({ answer: normalizeAnswer(entry.answer), clue: entry.clue.trim(), generated: Boolean(entry.generated) }))
      .filter((entry) => entry.answer.length > 1 && entry.clue);
  }

  function bestFillPlacement(candidate, puzzle, existingAnswers, allowDetached) {
    let best = null;
    for (const dir of ["across", "down"]) {
      const rowLimit = dir === "down" ? puzzle.rows - candidate.answer.length : puzzle.rows - 1;
      const colLimit = dir === "across" ? puzzle.cols - candidate.answer.length : puzzle.cols - 1;
      for (let row = 0; row <= rowLimit; row += 1) {
        for (let col = 0; col <= colLimit; col += 1) {
          const placement = scoreFillPlacement(candidate.answer, row, col, dir, puzzle, existingAnswers, allowDetached);
          if (placement && (!best || placement.score > best.score)) best = placement;
        }
      }
    }
    return best;
  }

  function scoreFillPlacement(answer, row, col, dir, puzzle, existingAnswers, allowDetached) {
    let crossings = 0;
    let contacts = 0;
    let newCells = 0;

    for (let i = 0; i < answer.length; i += 1) {
      const cellRow = row + (dir === "down" ? i : 0);
      const cellCol = col + (dir === "across" ? i : 0);
      const existing = puzzle.grid.get(coord(cellRow, cellCol));
      if (existing && existing.letter !== answer[i]) return null;
      if (existing) crossings += 1;
      if (!existing) newCells += 1;
      contacts += neighborContacts(cellRow, cellCol, puzzle.grid);
    }

    if (newCells < 1 || (!allowDetached && contacts === 0)) return null;
    const before = endpoint({ row, col, dir }, -1);
    const after = endpoint({ row, col, dir }, answer.length);
    if (puzzle.grid.has(coord(before.row, before.col)) || puzzle.grid.has(coord(after.row, after.col))) return null;

    const trialGrid = cloneGrid(puzzle.grid);
    writeWordToGrid({ answer, row, col, dir, key: "trial" }, trialGrid);
    const missingSlots = newImplicitSlots(trialGrid, puzzle, existingAnswers, { answer, row, col, dir });
    if (!missingSlots) return null;

    return {
      row,
      col,
      dir,
      implicitSlots: missingSlots,
      score: newCells * 10 + crossings * 12 + contacts + missingSlots.length * 6
    };
  }

  function neighborContacts(row, col, grid) {
    return [
      coord(row - 1, col),
      coord(row + 1, col),
      coord(row, col - 1),
      coord(row, col + 1)
    ].filter((key) => grid.has(key)).length;
  }

  function placeGeneratedFill(entry, placement) {
    const key = `${state.puzzle.placed.length}-${placement.dir}`;
    const word = { ...entry, row: placement.row, col: placement.col, dir: placement.dir, key };
    writeWordToGrid(word, state.puzzle.grid);
    state.puzzle.placed.push(word);
    const added = [{ answer: entry.answer, clue: entry.clue, generated: true }];

    placement.implicitSlots.forEach((slot) => {
      const slotKey = `${state.puzzle.placed.length}-${slot.dir}`;
      const implicitWord = { ...slot, clue: fillClues.get(slot.answer) || clueForGenerated(slot.answer), generated: true, key: slotKey };
      writeWordToGrid(implicitWord, state.puzzle.grid);
      state.puzzle.placed.push(implicitWord);
      added.push({ answer: implicitWord.answer, clue: implicitWord.clue, generated: true });
    });

    state.entries.push(...added);
    return added;
  }

  function writeWordToGrid(word, grid) {
    for (let i = 0; i < word.answer.length; i += 1) {
      const row = word.row + (word.dir === "down" ? i : 0);
      const col = word.col + (word.dir === "across" ? i : 0);
      const cellKey = coord(row, col);
      const cell = grid.get(cellKey) || { row, col, letter: word.answer[i], words: [] };
      if (!cell.words.includes(word.key)) cell.words.push(word.key);
      grid.set(cellKey, cell);
    }
  }

  function cloneGrid(grid) {
    const copy = new Map();
    grid.forEach((cell, key) => {
      copy.set(key, { ...cell, words: [...cell.words] });
    });
    return copy;
  }

  function newImplicitSlots(trialGrid, puzzle, existingAnswers, primarySlot) {
    const existingSlots = new Map(puzzle.placed.map((word) => [slotId(word), word.answer]));
    const allSlots = extractSlots(trialGrid, puzzle.rows, puzzle.cols);

    for (const slot of allSlots) {
      const existingAnswer = existingSlots.get(slotId(slot));
      if (existingAnswer && existingAnswer !== slot.answer) return null;
      if ([...existingAnswers].some((answer) => slot.answer.includes(answer) && slot.answer !== answer)) return null;
    }

    const slots = allSlots
      .filter((slot) => !existingSlots.has(slotId(slot)))
      .filter((slot) => slotId(slot) !== slotId(primarySlot))
      .filter((slot) => !existingAnswers.has(slot.answer));

    for (const slot of slots) {
      if (slot.answer.length < 3) return null;
    }
    return slots;
  }

  function clueForGenerated(answer) {
    if (answer.length <= 3) return "Short crossing fill";
    if (answer.endsWith("ER")) return "One associated with the clue's base word, maybe";
    if (answer.endsWith("ED")) return "Past-tense fill";
    if (answer.endsWith("ING")) return "Gerund-style fill";
    return "Generated crossing fill";
  }

  function extractSlots(grid, rows, cols) {
    const slots = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (grid.has(coord(row, col)) && !grid.has(coord(row, col - 1))) {
          const answer = collectSlot(grid, row, col, "across");
          if (answer.length > 1) slots.push({ answer, row, col, dir: "across" });
        }
        if (grid.has(coord(row, col)) && !grid.has(coord(row - 1, col))) {
          const answer = collectSlot(grid, row, col, "down");
          if (answer.length > 1) slots.push({ answer, row, col, dir: "down" });
        }
      }
    }
    return slots;
  }

  function collectSlot(grid, row, col, dir) {
    let answer = "";
    let index = 0;
    while (true) {
      const cell = grid.get(coord(row + (dir === "down" ? index : 0), col + (dir === "across" ? index : 0)));
      if (!cell) break;
      answer += cell.letter;
      index += 1;
    }
    return answer;
  }

  function slotId(slot) {
    return `${slot.row},${slot.col},${slot.dir}`;
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
    app.style.setProperty("--cw-puzzle-cols", puzzle.cols);
    app.classList.toggle("is-wide-puzzle", puzzle.cols >= 14);
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

  function revealSelectedWord() {
    if (!state.puzzle) return;
    const word = state.puzzle.placed.find((item) => item.key === state.selectedKey);
    if (!word) {
      setStatus("Select a clue or square first.");
      return;
    }

    wordCells(word).forEach(({ row, col }) => {
      const input = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      const cell = state.puzzle.grid.get(coord(row, col));
      if (!input || !cell) return;
      input.value = cell.letter;
      input.parentElement.classList.remove("is-wrong");
    });
    setStatus(`${word.number} ${word.dir} revealed.`);
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
    state.entries = sourceEntriesFromData(data);
    state.puzzle = revivePuzzle(data.puzzle);
    state.selectedKey = state.puzzle.placed[0] ? state.puzzle.placed[0].key : null;
    state.direction = state.puzzle.placed[0] ? state.puzzle.placed[0].dir : "across";
    renderPuzzle();
    setStatus("Unlisted puzzle loaded.");
    return true;
  }

  function editExportedPuzzle() {
    if (!state.entries.length && state.puzzle) {
      state.entries = state.puzzle.placed.map(({ answer, clue, generated }) => ({ answer, clue, generated: Boolean(generated) }));
    }
    app.classList.remove("is-exported");
    kickerEl.textContent = "Playable maker";
    renderEntries();
    generate();
    setStatus("Puzzle reopened for editing. Export again when you want a new unlisted URL.");
  }

  function encodePuzzle({ title, puzzle, entries }) {
    const compact = {
      title,
      entries: entries.map(({ answer, clue, generated }) => ({ answer, clue, generated: Boolean(generated) })),
      puzzle: {
        rows: puzzle.rows,
        cols: puzzle.cols,
        placed: puzzle.placed.map(({ answer, clue, row, col, dir, key, number, generated }) => ({ answer, clue, row, col, dir, key, number, generated: Boolean(generated) }))
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

  function sourceEntriesFromData(data) {
    const entries = Array.isArray(data.entries) && data.entries.length ? data.entries : data.puzzle.placed;
    return entries.map(({ answer, clue, generated }) => ({ answer, clue, generated: Boolean(generated) }));
  }

  function unusedStats(puzzle) {
    return {
      total: puzzle.rows * puzzle.cols,
      used: puzzle.grid.size,
      unused: (puzzle.rows * puzzle.cols) - puzzle.grid.size
    };
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
