(function () {
  const years = [2000, 2010, 2020, 2025, 2030, 2040, 2050];
  const anchors = new Set(["United States", "China"]);
  const chinaAdjustmentWeights = [0.35, 0.55, 0.75, 0.85, 0.95, 1.12, 1.25];
  const defaultWest = new Set(["United States", "Canada", "European Union", "United Kingdom", "Switzerland", "Norway", "Australia", "New Zealand", "Japan", "South Korea", "Taiwan", "Israel", "Saudi Arabia", "United Arab Emirates", "Kuwait", "Qatar"]);
  const defaultEast = new Set(["China", "North Korea"]);
  const countries = [
    { name: "China", region: "East Asia", values: [835, 942, 989, 982, 960, 875, 770] },
    { name: "United States", region: "North America", values: [186, 206, 216, 223, 229, 239, 248] },
    { name: "Canada", region: "North America", values: [21, 23, 26, 27, 29, 31, 33] },
    { name: "European Union", region: "Europe", values: [204, 208, 205, 203, 197, 181, 170] },
    { name: "United Kingdom", region: "Europe", values: [38, 40, 42, 43, 43, 42, 41] },
    { name: "Switzerland", region: "Europe", values: [5, 5, 6, 6, 6, 6, 6] },
    { name: "Norway", region: "Europe", values: [3, 3, 4, 4, 4, 4, 4] },
    { name: "Australia", region: "Oceania", values: [13, 15, 17, 18, 19, 21, 22] },
    { name: "New Zealand", region: "Oceania", values: [3, 3, 3, 3, 3, 3, 3] },
    { name: "Japan", region: "East Asia", values: [86, 82, 74, 72, 67, 58, 51] },
    { name: "South Korea", region: "East Asia", values: [34, 36, 37, 36, 34, 29, 24] },
    { name: "Taiwan", region: "East Asia", values: [16, 17, 17, 16, 15, 13, 11] },
    { name: "Israel", region: "Middle East", values: [4, 5, 6, 6, 7, 8, 9] },
    { name: "Saudi Arabia", region: "Middle East", values: [13, 18, 24, 26, 28, 30, 31] },
    { name: "United Arab Emirates", region: "Middle East", values: [2, 6, 8, 8, 8, 8, 8] },
    { name: "Kuwait", region: "Middle East", values: [2, 3, 3, 3, 3, 3, 3] },
    { name: "Qatar", region: "Middle East", values: [1, 1, 2, 2, 2, 2, 2] },
    { name: "India", region: "South Asia", values: [620, 765, 905, 980, 1025, 1090, 1105] },
    { name: "Russia", region: "Eurasia", values: [102, 101, 99, 96, 92, 86, 79] },
    { name: "Iran", region: "Middle East", values: [40, 52, 62, 65, 67, 68, 66] },
    { name: "North Korea", region: "East Asia", values: [15, 17, 18, 18, 18, 17, 16] },
    { name: "Turkey", region: "Eurasia", values: [43, 50, 56, 58, 59, 58, 56] },
    { name: "Brazil", region: "Latin America", values: [112, 132, 148, 151, 150, 142, 132] },
    { name: "Mexico", region: "Latin America", values: [63, 76, 85, 87, 89, 90, 87] },
    { name: "Vietnam", region: "Southeast Asia", values: [50, 61, 68, 69, 70, 68, 63] },
    { name: "Indonesia", region: "Southeast Asia", values: [134, 158, 181, 190, 199, 211, 213] }
  ];

  const state = {
    chinaAdjust: -15,
    expandedBlocks: new Set(),
    assignments: Object.fromEntries(countries.map((country) => {
      if (defaultEast.has(country.name)) return [country.name, "east"];
      if (defaultWest.has(country.name)) return [country.name, "west"];
      return [country.name, "none"];
    }))
  };

  const els = {
    adjust: document.getElementById("popdashChinaAdjust"),
    output: document.getElementById("popdashChinaOutput"),
    presets: document.querySelectorAll("[data-adjust]"),
    reset: document.getElementById("popdashReset"),
    tabs: document.querySelectorAll(".popdash__tabs button"),
    list: document.getElementById("popdashCountryList"),
    chart: document.getElementById("popdashChart")
  };

  function adjustedValues(country) {
    if (country.name !== "China") return country.values;
    return country.values.map((value, index) => {
      const factor = 1 + (state.chinaAdjust * chinaAdjustmentWeights[index]) / 100;
      return Math.round(value * factor);
    });
  }

  function blockSeries(block) {
    return years.map((_, index) => countries.reduce((sum, country) => {
      if (state.assignments[country.name] !== block) return sum;
      return sum + adjustedValues(country)[index];
    }, 0));
  }

  function fmt(value) {
    return `${Math.round(value).toLocaleString()}m`;
  }

  function blockLabel(block) {
    return { west: "US", none: "Unaligned", east: "China" }[block];
  }

  function blockShortLabel(block) {
    return { west: "US", none: "U", east: "CN" }[block];
  }

  function moveCountry(countryName, block) {
    if (anchors.has(countryName)) return;
    state.assignments[countryName] = block;
    buildCountries();
    update();
  }

  function buildCountries() {
    els.list.innerHTML = "";
    ["west", "none", "east"].forEach((block) => {
      const column = document.createElement("section");
      column.className = "popdash__block";
      column.dataset.block = block;
      column.innerHTML = `
        <div class="popdash__block-head">
          <strong>${blockLabel(block)}</strong>
          <span>0</span>
        </div>
        <div class="popdash__block-items"></div>
        <button type="button" class="popdash__block-toggle" data-block-toggle="${block}" hidden></button>
      `;
      column.addEventListener("dragover", (event) => {
        event.preventDefault();
        column.classList.add("is-over");
      });
      column.addEventListener("dragleave", () => column.classList.remove("is-over"));
      column.addEventListener("drop", (event) => {
        event.preventDefault();
        column.classList.remove("is-over");
        const countryName = event.dataTransfer.getData("text/plain");
        if (countryName && !anchors.has(countryName)) moveCountry(countryName, block);
      });
      els.list.appendChild(column);
    });

    countries.forEach((country) => {
      const block = state.assignments[country.name];
      const column = els.list.querySelector(`[data-block="${block}"]`);
      const items = column.querySelector(".popdash__block-items");
      const card = document.createElement("article");
      const locked = anchors.has(country.name);
      card.className = `popdash__country${locked ? " popdash__country--locked" : ""}`;
      card.draggable = !locked;
      card.dataset.country = country.name;
      card.innerHTML = `
        <strong>${country.name}</strong>
        <small>${country.region}</small>
        ${locked ? "<em>Fixed anchor</em>" : ""}
      `;
      card.addEventListener("dragstart", (event) => {
        if (locked) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData("text/plain", country.name);
        event.dataTransfer.effectAllowed = "move";
        card.classList.add("is-dragging");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
        els.list.querySelectorAll(".popdash__block").forEach((target) => target.classList.remove("is-over"));
      });
      items.appendChild(card);
    });

    els.list.querySelectorAll(".popdash__block").forEach((column) => {
      const block = column.dataset.block;
      const expanded = state.expandedBlocks.has(block);
      const cards = Array.from(column.querySelectorAll(".popdash__country"));
      const count = cards.length;
      column.querySelector(".popdash__block-head span").textContent = count;
      cards.forEach((card, index) => {
        card.hidden = !expanded && index >= 5;
      });
      const toggle = column.querySelector(".popdash__block-toggle");
      if (count > 5) {
        toggle.hidden = false;
        toggle.textContent = expanded ? "Show fewer" : `Show ${count - 5} more`;
        toggle.addEventListener("click", () => {
          if (expanded) {
            state.expandedBlocks.delete(block);
          } else {
            state.expandedBlocks.add(block);
          }
          buildCountries();
        });
      }
    });
  }

  function setAdjustment(value) {
    state.chinaAdjust = Number(value);
    els.adjust.value = state.chinaAdjust;
    els.output.value = `${state.chinaAdjust}%`;
    els.presets.forEach((button) => button.classList.toggle("is-active", Number(button.dataset.adjust) === state.chinaAdjust));
    update();
  }

  function reset() {
    countries.forEach((country) => {
      state.assignments[country.name] = defaultEast.has(country.name) ? "east" : defaultWest.has(country.name) ? "west" : "none";
    });
    state.chinaAdjust = -15;
    buildCountries();
    setAdjustment(-15);
  }

  function showPanel(panelName) {
    els.tabs.forEach((tab) => {
      const active = tab.dataset.panel === panelName;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    document.getElementById("popdashBlocPanel").hidden = panelName !== "bloc";
    document.getElementById("popdashChinaPanel").hidden = panelName !== "china";
  }

  const chart = new Chart(els.chart, {
    type: "line",
    data: {
      labels: years,
      datasets: [
        {
          label: "Eastern block",
          data: [],
          borderColor: "#9d3f3a",
          backgroundColor: "rgba(157, 63, 58, 0.12)",
          fill: true,
          tension: 0.32,
          pointRadius: 3
        },
        {
          label: "Western block",
          data: [],
          borderColor: "#245e6f",
          backgroundColor: "rgba(36, 94, 111, 0.10)",
          fill: true,
          tension: 0.32,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${fmt(context.parsed.y)}`
          }
        }
      },
      scales: {
        x: { grid: { color: "rgba(31,37,34,0.08)" } },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(31,37,34,0.08)" },
          ticks: { callback: (value) => `${value}m` }
        }
      }
    }
  });

  function update() {
    const east = blockSeries("east");
    const west = blockSeries("west");
    chart.data.datasets[0].data = east;
    chart.data.datasets[1].data = west;
    chart.update();
  }

  els.adjust.addEventListener("input", (event) => setAdjustment(event.target.value));
  els.presets.forEach((button) => button.addEventListener("click", () => setAdjustment(button.dataset.adjust)));
  els.reset.addEventListener("click", reset);
  els.tabs.forEach((tab) => tab.addEventListener("click", () => showPanel(tab.dataset.panel)));
  buildCountries();
  setAdjustment(state.chinaAdjust);
}());
