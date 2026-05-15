(function () {
  const years = [2000, 2010, 2020, 2025, 2030, 2040, 2050];
  const anchors = new Set(["United States", "China"]);
  const chinaAdjustmentWeights = [0.35, 0.55, 0.75, 0.85, 0.95, 1.12, 1.25];
  const defaultWest = new Set(["United States", "Canada", "European Union", "United Kingdom", "Switzerland", "Norway", "Australia", "New Zealand", "Japan", "South Korea", "Taiwan", "Israel", "Saudi Arabia", "United Arab Emirates", "Kuwait", "Qatar"]);
  const defaultEast = new Set(["China", "North Korea"]);
  const countries = [
    { name: "China", region: "East Asia", values: [835, 942, 989, 982, 960, 875, 770], totalPop: [1263, 1348, 1411, 1410, 1395, 1325, 1260], gdpPerCapita: [1.8, 4.6, 10.6, 13.4, 16.2, 22.0, 28.0] },
    { name: "United States", region: "North America", values: [186, 206, 216, 223, 229, 239, 248], totalPop: [282, 309, 331, 342, 351, 370, 389], gdpPerCapita: [46.0, 51.0, 58.5, 66.0, 72.5, 84.0, 97.0] },
    { name: "Canada", region: "North America", values: [21, 23, 26, 27, 29, 31, 33], totalPop: [31, 34, 38, 40, 42, 46, 50], gdpPerCapita: [39.0, 43.0, 43.5, 46.0, 49.0, 56.0, 64.0] },
    { name: "European Union", region: "Europe", values: [204, 208, 205, 203, 197, 181, 170], totalPop: [427, 441, 447, 449, 447, 439, 425], gdpPerCapita: [28.0, 33.5, 36.0, 39.0, 42.0, 48.0, 55.0] },
    { name: "United Kingdom", region: "Europe", values: [38, 40, 42, 43, 43, 42, 41], totalPop: [59, 63, 67, 69, 71, 74, 77], gdpPerCapita: [37.0, 41.0, 43.0, 46.0, 49.0, 56.0, 64.0] },
    { name: "Switzerland", region: "Europe", values: [5, 5, 6, 6, 6, 6, 6], totalPop: [7, 8, 9, 9, 9, 10, 10], gdpPerCapita: [72.0, 80.0, 86.0, 91.0, 97.0, 110.0, 125.0] },
    { name: "Norway", region: "Europe", values: [3, 3, 4, 4, 4, 4, 4], totalPop: [4, 5, 5, 6, 6, 6, 6], gdpPerCapita: [76.0, 86.0, 88.0, 95.0, 100.0, 112.0, 126.0] },
    { name: "Australia", region: "Oceania", values: [13, 15, 17, 18, 19, 21, 22], totalPop: [19, 22, 26, 27, 29, 33, 36], gdpPerCapita: [43.0, 50.0, 55.0, 59.0, 64.0, 75.0, 88.0] },
    { name: "New Zealand", region: "Oceania", values: [3, 3, 3, 3, 3, 3, 3], totalPop: [4, 4, 5, 5, 5, 6, 6], gdpPerCapita: [31.0, 35.0, 40.0, 42.0, 45.0, 52.0, 60.0] },
    { name: "Japan", region: "East Asia", values: [86, 82, 74, 72, 67, 58, 51], totalPop: [127, 128, 126, 124, 120, 111, 104], gdpPerCapita: [38.0, 40.0, 41.0, 43.0, 45.0, 51.0, 57.0] },
    { name: "South Korea", region: "East Asia", values: [34, 36, 37, 36, 34, 29, 24], totalPop: [47, 50, 52, 52, 51, 49, 46], gdpPerCapita: [18.0, 29.0, 33.0, 37.0, 41.0, 52.0, 65.0] },
    { name: "Taiwan", region: "East Asia", values: [16, 17, 17, 16, 15, 13, 11], totalPop: [22, 23, 24, 23, 23, 21, 19], gdpPerCapita: [22.0, 31.0, 36.0, 42.0, 48.0, 63.0, 82.0] },
    { name: "Israel", region: "Middle East", values: [4, 5, 6, 6, 7, 8, 9], totalPop: [6, 8, 9, 10, 11, 13, 15], gdpPerCapita: [30.0, 36.0, 44.0, 49.0, 54.0, 66.0, 80.0] },
    { name: "Saudi Arabia", region: "Middle East", values: [13, 18, 24, 26, 28, 30, 31], totalPop: [22, 29, 36, 37, 40, 45, 49], gdpPerCapita: [22.0, 24.0, 25.0, 27.0, 30.0, 37.0, 45.0] },
    { name: "United Arab Emirates", region: "Middle East", values: [2, 6, 8, 8, 8, 8, 8], totalPop: [3, 8, 9, 10, 10, 11, 12], gdpPerCapita: [55.0, 48.0, 43.0, 47.0, 51.0, 62.0, 75.0] },
    { name: "Kuwait", region: "Middle East", values: [2, 3, 3, 3, 3, 3, 3], totalPop: [2, 3, 4, 4, 5, 5, 6], gdpPerCapita: [36.0, 43.0, 34.0, 36.0, 39.0, 47.0, 56.0] },
    { name: "Qatar", region: "Middle East", values: [1, 1, 2, 2, 2, 2, 2], totalPop: [1, 2, 3, 3, 3, 3, 3], gdpPerCapita: [61.0, 78.0, 60.0, 65.0, 70.0, 83.0, 99.0] },
    { name: "India", region: "South Asia", values: [620, 765, 905, 980, 1025, 1090, 1105], totalPop: [1056, 1241, 1396, 1464, 1515, 1610, 1670], gdpPerCapita: [0.8, 1.4, 1.9, 2.4, 3.2, 5.4, 8.8] },
    { name: "Russia", region: "Eurasia", values: [102, 101, 99, 96, 92, 86, 79], totalPop: [147, 143, 146, 144, 141, 135, 129], gdpPerCapita: [7.2, 11.0, 11.5, 12.2, 12.8, 14.0, 15.5] },
    { name: "Iran", region: "Middle East", values: [40, 52, 62, 65, 67, 68, 66], totalPop: [66, 75, 87, 92, 96, 103, 108], gdpPerCapita: [5.1, 6.6, 5.4, 5.8, 6.2, 7.5, 9.1] },
    { name: "North Korea", region: "East Asia", values: [15, 17, 18, 18, 18, 17, 16], totalPop: [23, 25, 26, 26, 27, 27, 26], gdpPerCapita: [0.7, 0.7, 0.7, 0.7, 0.8, 0.9, 1.0] },
    { name: "Turkey", region: "Eurasia", values: [43, 50, 56, 58, 59, 58, 56], totalPop: [64, 72, 84, 88, 91, 96, 99], gdpPerCapita: [8.0, 11.0, 12.0, 13.5, 15.0, 19.0, 24.0] },
    { name: "Brazil", region: "Latin America", values: [112, 132, 148, 151, 150, 142, 132], totalPop: [176, 196, 213, 216, 219, 220, 215], gdpPerCapita: [8.6, 10.8, 9.0, 9.7, 10.5, 12.5, 15.0] },
    { name: "Mexico", region: "Latin America", values: [63, 76, 85, 87, 89, 90, 87], totalPop: [98, 113, 126, 130, 134, 140, 143], gdpPerCapita: [9.5, 10.0, 9.4, 10.4, 11.5, 14.5, 18.0] },
    { name: "Vietnam", region: "Southeast Asia", values: [50, 61, 68, 69, 70, 68, 63], totalPop: [79, 88, 97, 101, 104, 108, 109], gdpPerCapita: [1.0, 1.7, 2.8, 3.6, 4.8, 8.0, 13.0] },
    { name: "Indonesia", region: "Southeast Asia", values: [134, 158, 181, 190, 199, 211, 213], totalPop: [214, 244, 274, 285, 296, 318, 330], gdpPerCapita: [2.1, 3.3, 3.9, 4.8, 6.0, 9.5, 14.8] }
  ];

  const state = {
    chinaAdjust: 0,
    showDifference: false,
    showGdpDifference: false,
    blocsExpanded: false,
    growthExpanded: false,
    growthAdjustments: Object.fromEntries(countries.map((country) => [country.name, 0])),
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
    growthReset: document.getElementById("popdashGrowthReset"),
    tabs: document.querySelectorAll(".popdash__tabs button"),
    list: document.getElementById("popdashCountryList"),
    growthList: document.getElementById("popdashGrowthList"),
    differenceToggle: document.getElementById("popdashDifferenceToggle"),
    gdpDifferenceToggle: document.getElementById("popdashGdpDifferenceToggle"),
    chart: document.getElementById("popdashChart"),
    gdpChart: document.getElementById("popdashGdpChart")
  };

  function adjustedValues(country) {
    if (country.name !== "China") return country.values;
    return country.values.map((value, index) => {
      const factor = 1 + (state.chinaAdjust * chinaAdjustmentWeights[index]) / 100;
      return Math.round(value * factor);
    });
  }

  function adjustedTotalPopulation(country) {
    if (country.name !== "China") return country.totalPop;
    return country.totalPop.map((value, index) => {
      const factor = 1 + (state.chinaAdjust * chinaAdjustmentWeights[index]) / 100;
      return Math.round(value * factor);
    });
  }

  function baselineGrowth(country) {
    const start = country.gdpPerCapita[3];
    const end = country.gdpPerCapita[country.gdpPerCapita.length - 1];
    return (Math.pow(end / start, 1 / 25) - 1) * 100;
  }

  function expectedGrowth(country) {
    return baselineGrowth(country) + state.growthAdjustments[country.name];
  }

  function adjustedGdpPerCapita(country, index) {
    if (index <= 3) return country.gdpPerCapita[index];
    const yearsAfter2025 = years[index] - 2025;
    return country.gdpPerCapita[3] * Math.pow(1 + expectedGrowth(country) / 100, yearsAfter2025);
  }

  function blockSeries(block) {
    return years.map((_, index) => countries.reduce((sum, country) => {
      if (state.assignments[country.name] !== block) return sum;
      return sum + adjustedValues(country)[index];
    }, 0));
  }

  function gdpSeries(block) {
    return years.map((_, index) => countries.reduce((sum, country) => {
      if (state.assignments[country.name] !== block) return sum;
      return sum + (adjustedTotalPopulation(country)[index] * adjustedGdpPerCapita(country, index)) / 1000;
    }, 0));
  }

  function fmt(value) {
    return `${Math.round(value).toLocaleString()}m`;
  }

  function fmtTrillion(value) {
    return `$${value.toFixed(1)}T`;
  }

  function blockLabel(block) {
    return { west: "US", none: "Unaligned", east: "China" }[block];
  }

  function blockShortLabel(block) {
    return { west: "US", none: "U", east: "CN" }[block];
  }

  function fmtGrowth(value) {
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}pp`;
  }

  function fmtRate(value) {
    return `${value.toFixed(1)}%`;
  }

  function moveCountry(countryName, block) {
    if (anchors.has(countryName)) return;
    state.assignments[countryName] = block;
    buildCountries();
    buildGrowth();
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

    let hiddenCount = 0;
    els.list.querySelectorAll(".popdash__block").forEach((column) => {
      const cards = Array.from(column.querySelectorAll(".popdash__country"));
      const count = cards.length;
      column.querySelector(".popdash__block-head span").textContent = count;
      cards.forEach((card, index) => {
        const hidden = !state.blocsExpanded && index >= 5;
        card.hidden = hidden;
        if (hidden) hiddenCount += 1;
      });
    });

    if (hiddenCount > 0 || state.blocsExpanded) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "popdash__block-toggle";
      toggle.textContent = state.blocsExpanded ? "Show fewer" : "Show more";
      toggle.addEventListener("click", () => {
        state.blocsExpanded = !state.blocsExpanded;
        buildCountries();
      });
      const panel = document.getElementById("popdashBlocPanel");
      if (panel) {
        const oldToggle = panel.querySelector(".popdash__block-toggle");
        if (oldToggle) oldToggle.remove();
        panel.appendChild(toggle);
      }
    }
  }

  function changeGrowth(countryName, delta) {
    state.growthAdjustments[countryName] = Math.round((state.growthAdjustments[countryName] + delta) * 10) / 10;
    buildGrowth();
    update();
  }

  function buildGrowth() {
    els.growthList.innerHTML = "";
    ["west", "none", "east"].forEach((block) => {
      const column = document.createElement("section");
      column.className = "popdash__block popdash__block--growth";
      column.dataset.block = block;
      column.innerHTML = `
        <div class="popdash__block-head">
          <strong>${blockLabel(block)}</strong>
          <span>0</span>
        </div>
        <div class="popdash__block-items"></div>
      `;
      els.growthList.appendChild(column);
    });

    countries.forEach((country) => {
      const block = state.assignments[country.name];
      const column = els.growthList.querySelector(`[data-block="${block}"]`);
      const items = column.querySelector(".popdash__block-items");
      const adjustment = state.growthAdjustments[country.name];
      const card = document.createElement("article");
      card.className = "popdash__country popdash__country--growth";
      card.dataset.country = country.name;
      card.innerHTML = `
        <div class="popdash__growth-card-head">
          <div>
            <strong>${country.name}</strong>
            <small>${country.region}</small>
          </div>
          <div class="popdash__growth-controls">
            <button type="button" data-growth-country="${country.name}" data-growth-delta="0.1" aria-label="Increase ${country.name} growth by 0.1 percentage points">↑</button>
            <button type="button" data-growth-country="${country.name}" data-growth-delta="-0.1" aria-label="Decrease ${country.name} growth by 0.1 percentage points">↓</button>
          </div>
        </div>
        <div class="popdash__growth-rate">
          <span>${fmtRate(expectedGrowth(country))}</span>
          <em>${adjustment === 0 ? "baseline" : fmtGrowth(adjustment)}</em>
        </div>
      `;
      items.appendChild(card);
    });

    let hiddenCount = 0;
    els.growthList.querySelectorAll(".popdash__block").forEach((column) => {
      const cards = Array.from(column.querySelectorAll(".popdash__country"));
      const count = cards.length;
      column.querySelector(".popdash__block-head span").textContent = count;
      cards.forEach((card, index) => {
        const hidden = !state.growthExpanded && index >= 5;
        card.hidden = hidden;
        if (hidden) hiddenCount += 1;
      });
    });

    document.querySelectorAll("[data-growth-country]").forEach((button) => {
      button.addEventListener("click", () => changeGrowth(button.dataset.growthCountry, Number(button.dataset.growthDelta)));
    });

    const oldToggle = document.querySelector(".popdash__growth-toggle");
    if (oldToggle) oldToggle.remove();
    if (hiddenCount > 0 || state.growthExpanded) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "popdash__block-toggle popdash__growth-toggle";
      toggle.textContent = state.growthExpanded ? "Show fewer" : "Show more";
      toggle.addEventListener("click", () => {
        state.growthExpanded = !state.growthExpanded;
        buildGrowth();
      });
      document.getElementById("popdashGrowthPanel").appendChild(toggle);
    }
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
    state.chinaAdjust = 0;
    state.blocsExpanded = false;
    state.growthExpanded = false;
    Object.keys(state.growthAdjustments).forEach((countryName) => {
      state.growthAdjustments[countryName] = 0;
    });
    buildCountries();
    buildGrowth();
    setAdjustment(0);
  }

  function resetGrowth() {
    Object.keys(state.growthAdjustments).forEach((countryName) => {
      state.growthAdjustments[countryName] = 0;
    });
    buildGrowth();
    update();
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
        },
        {
          label: "West-East difference",
          data: [],
          borderColor: "#6d6259",
          backgroundColor: "rgba(109, 98, 89, 0.06)",
          borderDash: [6, 5],
          fill: false,
          hidden: true,
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

  const gdpChart = new Chart(els.gdpChart, {
    type: "line",
    data: {
      labels: years,
      datasets: [
        {
          label: "Eastern block",
          data: [],
          borderColor: "#9d3f3a",
          backgroundColor: "rgba(157, 63, 58, 0.10)",
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
        },
        {
          label: "West-East difference",
          data: [],
          borderColor: "#6d6259",
          backgroundColor: "rgba(109, 98, 89, 0.06)",
          borderDash: [6, 5],
          fill: false,
          hidden: true,
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
            label: (context) => `${context.dataset.label}: ${fmtTrillion(context.parsed.y)}`
          }
        }
      },
      scales: {
        x: { grid: { color: "rgba(31,37,34,0.08)" } },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(31,37,34,0.08)" },
          ticks: { callback: (value) => `$${value}T` }
        }
      }
    }
  });

  function update() {
    const east = blockSeries("east");
    const west = blockSeries("west");
    const difference = west.map((value, index) => value - east[index]);
    chart.data.datasets[0].data = east;
    chart.data.datasets[1].data = west;
    chart.data.datasets[2].data = difference;
    chart.data.datasets[2].hidden = !state.showDifference;
    chart.update();
    const gdpEast = gdpSeries("east");
    const gdpWest = gdpSeries("west");
    const gdpDifference = gdpWest.map((value, index) => value - gdpEast[index]);
    gdpChart.data.datasets[0].data = gdpEast;
    gdpChart.data.datasets[1].data = gdpWest;
    gdpChart.data.datasets[2].data = gdpDifference;
    gdpChart.data.datasets[2].hidden = !state.showGdpDifference;
    gdpChart.update();
  }

  els.adjust.addEventListener("input", (event) => setAdjustment(event.target.value));
  els.presets.forEach((button) => button.addEventListener("click", () => setAdjustment(button.dataset.adjust)));
  els.reset.addEventListener("click", reset);
  els.growthReset.addEventListener("click", resetGrowth);
  els.tabs.forEach((tab) => tab.addEventListener("click", () => showPanel(tab.dataset.panel)));
  els.differenceToggle.addEventListener("change", (event) => {
    state.showDifference = event.target.checked;
    update();
  });
  els.gdpDifferenceToggle.addEventListener("change", (event) => {
    state.showGdpDifference = event.target.checked;
    update();
  });
  buildCountries();
  buildGrowth();
  setAdjustment(state.chinaAdjust);
}());
