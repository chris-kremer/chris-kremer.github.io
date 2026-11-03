---
layout: page
title: Index Performance
subtitle: Work in progress · Exploring index performance by company age
description: An interactive mockup exploring how company founding dates affect the interpretation of stock-market index performance.
permalink: /projects/index-performance/
status: Work in progress
---

**Work in progress — interactive mockup**

How much of a stock-market index’s performance comes from businesses that were already around decades ago? This project explores that question by filtering companies according to their economic founding year, with spin-offs inheriting the origins of their underlying businesses.

The mockup compares the S&P 500, Dow Jones, DAX, CAC 40, FTSE 100 and Nikkei 225. Adjust the founding-year cutoff, explore the distribution of company ages, and inspect the constituent tables.

[Open the interactive mockup →]({{ '/projects/index-performance/app/' | relative_url }})

### Current status

This is a design and methodology prototype, **not an empirical backtest**. Index paths are approximated from historical anchor levels; company-level paths are stylised, and some indices use founding-era cohorts rather than full constituent histories. The visualisations illustrate the proposed experiment, not measured historical returns from an investable strategy.

The next stage is to replace the illustrative paths with verified historical data and make membership, weighting, corporate lineage and treatment of exits explicit. Company age and the date a company enters an index are separate dimensions.
