---
layout: post
title: "Market Selection Simulation (DRAFT)"
date: 2024-12-01 10:00:00 +0100
categories: simulation
---

## Predictive Ability of Markets

Markets like the ones for capital allocation and predictions fulfill the function of allocating resources. They provide a selection mechnaism to differentitiate between productive and less productive projects (or likely versus unlikely outcomes). But the important mechanism for why markets have such nice outcomes is not the way allocators influence which projects to fund (which predictions to make), its the way the real world outcomes are able to shape the allocators. 

To illustrate this point I created a very simple toy model. It simulates a market by taking 4 inputs paramters: The number of bettors, the variance of their predictive ability (we assume normal distribution), the number of rounds and the fraction they bet in each round. 
All bettors have the same initial endowment and invest the same fixed fraction of their current net worth in each round. Each round they eigther win, in which case their input is doubled, or loose, in which case their input is lost.  

# Effects on Inequality

Running this market for a given number of rounds quickly shows increasing between bettors. The higher the predictive ability of a bettor, the faster she accumulates capital. 

# Effects on Market Efficiency

The bets placed scale linearly with the wealth of the bettor. The higher the bettors wealth, the more sway she has in the market prediction. 
We found: predictive ability correlates with wealth and wealth correlates (perfectly) with influence in the market. Thus, the participants makeing the best predctions influence market predictions most. 

# Comparative Static Analysis

Now we can examine how this selction effect for capital allocators responds to changes in our four input vriables: 
1. Number of bettors 
The higher the number of bettors, the higher the predictive ability the market can achive, as the market benefits from outliers in predictive ability
2. Variance in Ability
Market efficiency also increases in variance of ability, for the same reason. 
3. Number of Rounds
All of the described effect are long term effects, only in repeated games does this mechnism matter. The higher the number of rounds the closer we asymptically converge to the optimal predictive power of the participants.
4. Bet Fraction
Impacts the volatility of the results. If participants bet a large fraction, few perticularly lucky or unlucky outcomes might bring bring bettors to a net worth that does not reflect their predictive ability. 

Feel free to play around with the model here: 

# Market Selection Simulation

<a href="https://market-selection.streamlit.app/" target="_blank">
    <button>Open Market Selection Simulation</button>
</a>

Feel free to adjust the parameters and see how they affect the outcomes.