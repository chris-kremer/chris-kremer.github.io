---
layout: bench_page
title: Behavior Bench (Beta)
subtitle: How do AI models behave compared to humans?
permalink: /projects/behavior-bench/
---

**Behavior Bench** is an AI benchmark modeled after classic experiments from behavioral economics. Rather than testing reasoning or factual recall, it measures the *preferences* AI models reveal when making decisions under uncertainty, trade-offs across time, and choices involving others.

The benchmark recreates the methodology of [Falk et al. (2018)](https://doi.org/10.1093/qje/qjy013), whose Global Preferences Survey (GPS) measured six fundamental behavioral dimensions across 80,000 people in 76 countries.
**Six dimensions measured:**

- **Risk Tolerance** — willingness to take gambles vs. prefer certainty
- **Patience** — preference for delayed vs. immediate rewards
- **Positive Reciprocity** — tendency to return favors
- **Negative Reciprocity** — tendency to retaliate against unfair treatment
- **Altruism** — willingness to give to others at personal cost
- **Trust** — baseline willingness to trust strangers

Each model was run through the same incentivized choice tasks used with human participants. Scores are normalized to 0–10 (matching the original GPS scale).
