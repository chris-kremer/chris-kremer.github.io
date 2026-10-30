---
layout: page
title: Market Atlas
subtitle: Work in progress · Market caps and valuations through time
description: An interactive map of company and industry market caps and valuations through time.
permalink: /projects/market-atlas/
status: Work in progress
---

<link rel="stylesheet" href="{{ '/assets/css/market-atlas-project.css' | relative_url }}">

<div class="atlas-project">
  <p class="atlas-project__status">Work in progress</p>
  <p>Market Atlas explores how company and industry market caps and valuations change over time. Move through monthly snapshots, play the timeline, and select a company to explore its market cap and valuation history.</p>
  <p>The S&amp;P 500, DAX, CAC 40 and FTSE 100 have separate views. You can filter by sector, switch between tickers and company names, compare market size on a fixed scale, and adjust historical market caps for inflation.</p>
  <p class="atlas-project__actions"><a class="atlas-project__open" href="{{ '/projects/market-atlas/app/' | relative_url }}">Open Market Atlas <span aria-hidden="true">↗</span></a></p>
  <a class="atlas-project__preview" href="{{ '/projects/market-atlas/app/' | relative_url }}" aria-label="Open the interactive Market Atlas"><img src="{{ '/assets/images/market-atlas/preview.png' | relative_url }}" alt="Market Atlas showing DAX companies sized by market capitalization and colored by forward P/E, with a monthly timeline below." width="1280" height="720" loading="lazy"></a>
  <p class="atlas-project__note">This is an evolving project using saved public-source data, not a live feed. Coverage varies by company, market and date; missing values are shown explicitly in the app. Historical company views use current index membership. Source details and methodology are included in the tool.</p>
</div>
