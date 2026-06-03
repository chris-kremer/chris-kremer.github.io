---
layout: page
title: World Cup xG Analysis
subtitle: Expected-goals summaries for complete StatsBomb World Cup data.
permalink: /projects/world-cup-xg-analysis/
---

Expected Goals (xG) is a relatively new stat that despite its flaws often gives us interesting insights. Here are some of them on past World Cups. Which World Cup champions had the best attack? Which one the best defense? What seems more important? Who were the teams that could have won but underperformed?

## Coverage

| World Cup | Team-level xG source | Match-level xG source |
|---:|---|---|
| 2022 | StatsBomb Open Data | StatsBomb Open Data, 64 matches |
| 2018 | StatsBomb Open Data | StatsBomb Open Data, 64 matches |
| 2014 | American Soccer Analysis | Not currently included |

Historical FIFA rankings are available from December 1992 to September 2024 in the GitHub dataset, which makes them usable for World Cups from 1994 onward. For this project I use the last FIFA ranking release before tournament kickoff:

| World Cup | Ranking date | Top five before tournament |
|---:|---|---|
| 2022 | 2022-10-06 | Brazil, Belgium, Argentina, France, England |
| 2018 | 2018-06-07 | Germany, Brazil, Belgium, Portugal, Argentina |
| 2014 | 2014-06-05 | Spain, Germany, Brazil, Portugal, Argentina |

StatsBomb partial match-level coverage is also archived for older tournaments:

| World Cup | StatsBomb matches available | Full tournament? |
|---:|---:|:---:|
| 1990 | 1 | No |
| 1986 | 3 | No |
| 1974 | 6 | No |
| 1970 | 6 | No |
| 1962 | 1 | No |
| 1958 | 2 | No |

## Top 3 teams by xG per game

### 2022 World Cup

| Rank | Team | Matches | xG/game | xG against/game | Tournament result |
|---:|---|---:|---:|---:|---|
| 1 | Germany | 3 | 2.74 | 0.97 | Group stage exit |
| 2 | Brazil | 5 | 2.10 | 0.36 | Quarter-finals exit |
| 3 | Argentina | 7 | 1.99 | 0.61 | Winner |

### 2018 World Cup

| Rank | Team | Matches | xG/game | xG against/game | Tournament result |
|---:|---|---:|---:|---:|---|
| 1 | Brazil | 5 | 2.46 | 0.51 | Quarter-finals exit |
| 2 | Germany | 3 | 2.11 | 1.19 | Group stage exit |
| 3 | Spain | 4 | 1.98 | 1.08 | Round of 16 exit |

### 2014 World Cup

| Rank | Team | Matches | xG/game | xG against/game | Tournament result |
|---:|---|---:|---:|---:|---|
| 1 | France | 5 | 2.10 | 0.50 | Quarter-finals exit |
| 2 | Germany | 7 | 1.80 | 0.90 | Winner |
| 3 | Switzerland | 4 | 1.60 | 0.80 | Round of 16 exit |

## World Cup winners by xG per game

| World Cup | Winner | Matches | xG/game | xG against/game | Total xG |
|---:|---|---:|---:|---:|---:|
| 2022 | Argentina | 7 | 1.99 | 0.61 | 13.94 |
| 2018 | France | 7 | 1.26 | 0.85 | 8.80 |
| 2014 | Germany | 7 | 1.80 | 0.90 | 12.60 |

By net xG per game, Argentina 2022 finished at +1.39, Germany 2014 at +0.90, and France 2018 at +0.41.

## FIFA rank context

| World Cup | Winner | Pre-tournament FIFA rank | Ranking date | xG/game | Net xG/game |
|---:|---|---:|---|---:|---:|
| 2022 | Argentina | 3 | 2022-10-06 | 1.99 | +1.39 |
| 2018 | France | 7 | 2018-06-07 | 1.26 | +0.41 |
| 2014 | Germany | 2 | 2014-06-05 | 1.80 | +0.90 |

The xG leaders were not always the top-ranked teams entering the tournament:

| World Cup | xG/game rank | Team | xG/game | Pre-tournament FIFA rank | Tournament result |
|---:|---:|---|---:|---:|---|
| 2022 | 1 | Germany | 2.74 | 11 | Group stage exit |
| 2022 | 2 | Brazil | 2.10 | 1 | Quarter-finals exit |
| 2022 | 3 | Argentina | 1.99 | 3 | Winner |
| 2018 | 1 | Brazil | 2.46 | 2 | Quarter-finals exit |
| 2018 | 2 | Germany | 2.11 | 1 | Group stage exit |
| 2018 | 3 | Spain | 1.98 | 10 | Round of 16 exit |
| 2014 | 1 | France | 2.10 | 17 | Quarter-finals exit |
| 2014 | 2 | Germany | 1.80 | 2 | Winner |
| 2014 | 3 | Switzerland | 1.60 | 6 | Round of 16 exit |

This gives the project a useful contrast between prior team strength and tournament chance creation. Early examples: France 2014 and Germany 2022 produced elite xG profiles despite entering outside the top ten by FIFA rank, while Germany 2014 and Argentina 2022 combined strong pre-tournament rank with strong xG profiles.

## Team xG over time

![Scatterplot of World Cup team xG per game by tournament year](/assets/images/world-cup-xg/team_xg_per_game_scatter.svg)

With three team-level xG tournaments, this is still more of a baseline view than a trend analysis. The main visual takeaway is that high xG per game does not map neatly to tournament success: Germany 2014 and Argentina 2022 won with strong attacking profiles, but Brazil 2018, Germany 2022, and France 2014 all ranked very high and exited earlier.

## Team xG by tournament result

![Scatterplot of World Cup team xG per game by tournament result](/assets/images/world-cup-xg/result_xg_per_game_scatter.svg)

This view makes the same point from the result side: xG/game is noisy in a short knockout tournament. The 2018 and 2022 winners are not the highest-xG teams in their tournaments, while some of the strongest xG/game teams exited in the group stage or quarter-finals.

## Team net xG over time

![Scatterplot of World Cup team net xG per game by tournament year](/assets/images/world-cup-xg/team_net_xg_per_game_scatter.svg)

Net xG adds defensive shot quality to the same view. Brazil 2018, Germany 2022, and Brazil 2022 lead the current complete-tournament sample, while Argentina 2022 is the strongest winner by net xG/game.

## Team net xG by tournament result

![Scatterplot of World Cup team net xG per game by tournament result](/assets/images/world-cup-xg/result_net_xg_per_game_scatter.svg)

This result view makes the over-performance question clearer: France 2018 won the tournament with a much lower net xG/game than several teams that exited earlier, while Argentina 2022 sits closer to the top tier.

This first pass sums all non-shootout StatsBomb shots for 2018 and 2022, including penalties taken during normal or extra time. Penalty-shootout attempts are excluded from match xG totals, but shootout outcomes are used to infer tournament results for tied knockout matches. The 2014 rows use American Soccer Analysis's team-level xGF/xGA rates rather than shot-level StatsBomb events.
