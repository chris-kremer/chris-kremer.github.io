---
layout: page
title: Working-Age Population Trajectories
subtitle: Interactive East-West demographic scenarios
description: How will the populations the US and China (with their respective allies) evolve?
permalink: /projects/working-age-population-dashboard/
---

<link rel="stylesheet" href="{{ '/assets/css/population-dashboard.css' | relative_url }}">

<section class="popdash" aria-label="Working-age population block dashboard">
  <p class="popdash__intro">
    It has become a popular belief that demographics is destiny. There are heated debates about fertility crises that might hit countries like China, Japan, and South Korea especially hard. In the current conflict between the US and China, this affects both sides. This dashboard allows you to make your assumptions explicit and see how they shift the dynamics of the China-affiliated and US-affiliated blocks.
  </p>

  <div class="popdash__intro-gap" aria-hidden="true"></div>

  <div class="popdash__grid">
    <section class="popdash__main">
      <div class="popdash__chart-panel">
        <div class="popdash__chart-head">
          <div>
            <h3>Working-age population</h3>
            <p>Millions of people, 2000-2050</p>
          </div>
          <div class="popdash__legend" aria-hidden="true">
            <span><i class="popdash__swatch popdash__swatch--east"></i>Eastern block</span>
            <span><i class="popdash__swatch popdash__swatch--west"></i>Western block</span>
          </div>
        </div>
        <canvas id="popdashChart" width="1280" height="560"></canvas>
      </div>
    </section>

    <aside class="popdash__controls" aria-label="Scenario controls">
      <div class="popdash__tabs" role="tablist" aria-label="Dashboard controls">
        <button type="button" id="popdashBlocTab" class="is-active" role="tab" aria-selected="true" aria-controls="popdashBlocPanel" data-panel="bloc">Block assignment</button>
        <button type="button" id="popdashChinaTab" role="tab" aria-selected="false" aria-controls="popdashChinaPanel" data-panel="china">China adjustment</button>
      </div>

      <section id="popdashBlocPanel" class="popdash__panel" role="tabpanel" aria-labelledby="popdashBlocTab">
        <div class="popdash__panel-head">
          <h3>Block assignment</h3>
          <button type="button" id="popdashReset">Reset</button>
        </div>
        <div id="popdashCountryList" class="popdash__blocks" aria-label="Drag countries between blocks"></div>
      </section>

      <section id="popdashChinaPanel" class="popdash__panel" role="tabpanel" aria-labelledby="popdashChinaTab" hidden>
        <div class="popdash__panel-head">
          <h3>China adjustment</h3>
          <output id="popdashChinaOutput" for="popdashChinaAdjust">0%</output>
        </div>
        <label class="popdash__range">
          <input id="popdashChinaAdjust" type="range" min="-35" max="10" step="1" value="-15">
        </label>
        <div class="popdash__presets" aria-label="China adjustment presets">
          <button type="button" data-adjust="0">Official baseline</button>
          <button type="button" data-adjust="-15" class="is-active">Moderate skepticism</button>
          <button type="button" data-adjust="-25">Yi-style low case</button>
        </div>
      </section>
    </aside>
  </div>

  <div class="popdash__section-gap" aria-hidden="true"></div>

  <p class="popdash__followup">
    Working population does not automatically translate into economic prowess. In 2025 the US accounted for less than a quarter of China's population while accounting for a similar share of the world's economic output. Here is how the assumed population dynamics could manifest in economic indicators:
  </p>

  <div class="popdash__economic-gap" aria-hidden="true"></div>

  <div class="popdash__chart-panel popdash__chart-panel--economic">
    <div class="popdash__chart-head">
      <div>
        <h3>Cumulative GDP</h3>
        <p>Trillions of constant 2015 US dollars, 2000-2050</p>
      </div>
      <div class="popdash__legend" aria-hidden="true">
        <span><i class="popdash__swatch popdash__swatch--east"></i>Eastern block</span>
        <span><i class="popdash__swatch popdash__swatch--west"></i>Western block</span>
      </div>
    </div>
    <canvas id="popdashGdpChart" width="1280" height="500"></canvas>
  </div>

  <p class="popdash__source-note">
    GDP model uses separate total-population paths and real GDP-per-capita paths for each country. Historical anchors follow <a href="https://data.worldbank.org/indicator/NY.GDP.PCAP.KD">World Bank constant-dollar GDP per capita</a> and <a href="https://datacatalog.worldbank.org/search/dataset/0037655/Population-Estimates-and-Projections">population estimate/projection</a> series; projection years use medium-variant demographic paths and conservative continuation assumptions for GDP per capita. The China adjustment discounts both total population and working-age population for China.
  </p>
</section>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<script src="{{ '/assets/js/population-dashboard.js' | relative_url }}"></script>
