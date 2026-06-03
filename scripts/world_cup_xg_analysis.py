#!/usr/bin/env python3
"""Fetch StatsBomb World Cup xG data and build team-level summaries."""

from __future__ import annotations

import csv
import json
import math
from collections import defaultdict
from io import StringIO
from pathlib import Path

import pandas as pd
import requests


BASE_URL = "https://raw.githubusercontent.com/statsbomb/open-data/master/data"
ASA_2014_URL = "https://www.americansocceranalysis.com/world-cup-expected-goals-by-team"
FIFA_RANKING_URL = "https://raw.githubusercontent.com/Dato-Futbol/fifa-ranking/master/ranking_fifa_historical.csv"
OUT_DIR = Path("assets/data/world-cup-xg")
IMG_DIR = Path("assets/images/world-cup-xg")

EXPECTED_MATCHES = {
    "2022": 64,
    "2018": 64,
    "1990": 52,
    "1986": 52,
    "1974": 38,
    "1970": 32,
    "1962": 32,
    "1958": 35,
}

STAGE_RANK = {
    "Group Stage": 0,
    "1st Group Stage": 0,
    "Round of 16": 1,
    "Quarter-finals": 2,
    "Semi-finals": 3,
    "3rd Place Final": 4,
    "Final": 5,
}

ASA_2014_TEAMS = {
    "ALG": ("Algeria", 4, "Round of 16 exit"),
    "ARG": ("Argentina", 7, "Runner-up"),
    "AUS": ("Australia", 3, "Group stage exit"),
    "BEL": ("Belgium", 5, "Quarter-finals exit"),
    "BIH": ("Bosnia and Herzegovina", 3, "Group stage exit"),
    "BRA": ("Brazil", 7, "Fourth place"),
    "CHI": ("Chile", 4, "Round of 16 exit"),
    "CIV": ("Ivory Coast", 3, "Group stage exit"),
    "CMR": ("Cameroon", 3, "Group stage exit"),
    "COL": ("Colombia", 5, "Quarter-finals exit"),
    "CRC": ("Costa Rica", 5, "Quarter-finals exit"),
    "CRO": ("Croatia", 3, "Group stage exit"),
    "ECU": ("Ecuador", 3, "Group stage exit"),
    "ENG": ("England", 3, "Group stage exit"),
    "ESP": ("Spain", 3, "Group stage exit"),
    "FRA": ("France", 5, "Quarter-finals exit"),
    "GER": ("Germany", 7, "Winner"),
    "GHA": ("Ghana", 3, "Group stage exit"),
    "GRE": ("Greece", 4, "Round of 16 exit"),
    "HON": ("Honduras", 3, "Group stage exit"),
    "IRN": ("Iran", 3, "Group stage exit"),
    "ITA": ("Italy", 3, "Group stage exit"),
    "JPN": ("Japan", 3, "Group stage exit"),
    "KOR": ("South Korea", 3, "Group stage exit"),
    "MEX": ("Mexico", 4, "Round of 16 exit"),
    "NED": ("Netherlands", 7, "Third place"),
    "NGA": ("Nigeria", 4, "Round of 16 exit"),
    "POR": ("Portugal", 3, "Group stage exit"),
    "RUS": ("Russia", 3, "Group stage exit"),
    "SUI": ("Switzerland", 4, "Round of 16 exit"),
    "URU": ("Uruguay", 4, "Round of 16 exit"),
    "USA": ("United States", 4, "Round of 16 exit"),
}

TEAM_FIFA_CODES = {
    "Algeria": "ALG",
    "Argentina": "ARG",
    "Australia": "AUS",
    "Belgium": "BEL",
    "Bosnia and Herzegovina": "BIH",
    "Brazil": "BRA",
    "Cameroon": "CMR",
    "Canada": "CAN",
    "Chile": "CHI",
    "Colombia": "COL",
    "Costa Rica": "CRC",
    "Croatia": "CRO",
    "Denmark": "DEN",
    "Ecuador": "ECU",
    "Egypt": "EGY",
    "England": "ENG",
    "France": "FRA",
    "Germany": "GER",
    "Ghana": "GHA",
    "Greece": "GRE",
    "Honduras": "HON",
    "Iceland": "ISL",
    "Iran": "IRN",
    "Italy": "ITA",
    "Ivory Coast": "CIV",
    "Japan": "JPN",
    "Mexico": "MEX",
    "Morocco": "MAR",
    "Netherlands": "NED",
    "Nigeria": "NGA",
    "Panama": "PAN",
    "Peru": "PER",
    "Poland": "POL",
    "Portugal": "POR",
    "Qatar": "QAT",
    "Russia": "RUS",
    "Saudi Arabia": "KSA",
    "Senegal": "SEN",
    "Serbia": "SRB",
    "South Korea": "KOR",
    "Spain": "ESP",
    "Sweden": "SWE",
    "Switzerland": "SUI",
    "Tunisia": "TUN",
    "United States": "USA",
    "Uruguay": "URU",
    "Wales": "WAL",
}

WORLD_CUP_START_DATES = {
    "2014": "2014-06-12",
    "2018": "2018-06-14",
    "2022": "2022-11-20",
}

NEXT_STAGE = {
    "Round of 16": "Quarter-finals",
    "Quarter-finals": "Semi-finals",
    "Semi-finals": "Final",
}


def fetch_json(path: str) -> object:
    response = requests.get(f"{BASE_URL}/{path}", timeout=30)
    response.raise_for_status()
    return response.json()


def fetch_asa_2014_team_rows() -> list[dict]:
    response = requests.get(ASA_2014_URL, timeout=30)
    response.raise_for_status()
    table = pd.read_html(StringIO(response.text))[0]

    rows = []
    for item in table.to_dict("records"):
        code = item["Team"]
        team, matches, result = ASA_2014_TEAMS[code]
        xg_for_per_game = float(item["xGF"])
        xg_against_per_game = float(item["xGA"])
        rows.append(
            {
                "season": "2014",
                "team": team,
                "matches": matches,
                "xg_for": round(xg_for_per_game * matches, 4),
                "xg_against": round(xg_against_per_game * matches, 4),
                "xg_per_game": round(xg_for_per_game, 4),
                "xg_against_per_game": round(xg_against_per_game, 4),
                "net_xg_per_game": round(xg_for_per_game - xg_against_per_game, 4),
                "tournament_result": result,
                "data_source": "American Soccer Analysis",
                "metric_note": "Team-level xGF/xGA per 99m38s of play; not match-level StatsBomb xG.",
            }
        )
    return rows


def fifa_rank_lookup() -> dict[tuple[str, str], dict]:
    response = requests.get(FIFA_RANKING_URL, timeout=30)
    response.raise_for_status()
    rankings = pd.read_csv(StringIO(response.text), parse_dates=["date"])
    rankings = rankings.sort_values(["date", "total_points"], ascending=[True, False], na_position="last")
    rankings["rank"] = rankings.groupby("date").cumcount() + 1

    lookup = {}
    for season, start_date in WORLD_CUP_START_DATES.items():
        ranking_date = rankings.loc[rankings["date"] <= pd.Timestamp(start_date), "date"].max()
        release = rankings[rankings["date"] == ranking_date]
        for item in release.to_dict("records"):
            lookup[(season, item["team_short"])] = {
                "fifa_rank_date": ranking_date.strftime("%Y-%m-%d"),
                "fifa_rank_pre_tournament": int(item["rank"]),
                "fifa_points_pre_tournament": round(float(item["total_points"]), 2)
                if pd.notna(item["total_points"])
                else "",
            }
    return lookup


def add_fifa_rankings(rows: list[dict]) -> list[dict]:
    lookup = fifa_rank_lookup()
    for row in rows:
        code = TEAM_FIFA_CODES[row["team"]]
        rank = lookup.get((row["season"], code), {})
        row["fifa_code"] = code
        row["fifa_rank_date"] = rank.get("fifa_rank_date", "")
        row["fifa_rank_pre_tournament"] = rank.get("fifa_rank_pre_tournament", "")
        row["fifa_points_pre_tournament"] = rank.get("fifa_points_pre_tournament", "")
    return rows


def world_cup_seasons() -> list[dict]:
    competitions = fetch_json("competitions.json")
    return sorted(
        [
            item
            for item in competitions
            if item["competition_id"] == 43
            and item["competition_name"] == "FIFA World Cup"
            and item["competition_gender"] == "male"
        ],
        key=lambda item: int(item["season_name"]),
        reverse=True,
    )


def team_name(match: dict, side: str) -> str:
    return match[f"{side}_team"][f"{side}_team_name"]


def penalty_shootout_winner(match_id: int) -> str | None:
    events = fetch_json(f"events/{match_id}.json")
    shootout_goals = defaultdict(int)
    for event in events:
        if event.get("type", {}).get("name") != "Shot" or event.get("period") != 5:
            continue
        shot = event.get("shot", {})
        if shot.get("outcome", {}).get("name") == "Goal":
            shootout_goals[event["team"]["name"]] += 1

    if len(shootout_goals) < 2:
        return None

    ordered = sorted(shootout_goals.items(), key=lambda item: item[1], reverse=True)
    if ordered[0][1] == ordered[1][1]:
        return None
    return ordered[0][0]


def match_xg(match: dict) -> dict[str, float]:
    totals = defaultdict(float)
    events = fetch_json(f"events/{match['match_id']}.json")
    for event in events:
        if event.get("type", {}).get("name") != "Shot" or event.get("period", 0) >= 5:
            continue
        shot = event.get("shot", {})
        xg = shot.get("statsbomb_xg")
        if xg is not None:
            totals[event["team"]["name"]] += float(xg)
    return totals


def infer_results(season: str, matches: list[dict]) -> dict[str, str]:
    teams = {team_name(match, "home") for match in matches}
    teams.update(team_name(match, "away") for match in matches)

    played_stages = defaultdict(set)
    for match in matches:
        stage = match["competition_stage"]["name"]
        played_stages[team_name(match, "home")].add(stage)
        played_stages[team_name(match, "away")].add(stage)

    advanced_from_tied_knockout: dict[int, str] = {}
    for match in matches:
        stage = match["competition_stage"]["name"]
        if stage not in STAGE_RANK or STAGE_RANK[stage] == 0:
            continue
        if match["home_score"] == match["away_score"]:
            advanced_from_tied_knockout[match["match_id"]] = penalty_shootout_winner(match["match_id"]) or ""

    results = {}
    for team in sorted(teams):
        stages = played_stages[team]
        if "Final" in stages:
            final = next(match for match in matches if match["competition_stage"]["name"] == "Final")
            home = team_name(final, "home")
            away = team_name(final, "away")
            if final["home_score"] != final["away_score"]:
                winner = home if final["home_score"] > final["away_score"] else away
            else:
                winner = advanced_from_tied_knockout.get(final["match_id"], "")
            results[team] = "Winner" if team == winner else "Runner-up"
        elif "3rd Place Final" in stages:
            third_place = next(match for match in matches if match["competition_stage"]["name"] == "3rd Place Final")
            home = team_name(third_place, "home")
            away = team_name(third_place, "away")
            if third_place["home_score"] != third_place["away_score"]:
                winner = home if third_place["home_score"] > third_place["away_score"] else away
            else:
                winner = advanced_from_tied_knockout.get(third_place["match_id"], "")
            results[team] = "Third place" if team == winner else "Fourth place"
        elif "Semi-finals" in stages:
            results[team] = "Semi-finals exit"
        elif "Quarter-finals" in stages:
            results[team] = "Quarter-finals exit"
        elif "Round of 16" in stages:
            results[team] = "Round of 16 exit"
        else:
            results[team] = "Group stage exit"
    return results


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def write_team_xg_scatter(rows: list[dict]) -> None:
    width = 920
    height = 560
    margin = {"top": 48, "right": 48, "bottom": 70, "left": 78}
    plot_w = width - margin["left"] - margin["right"]
    plot_h = height - margin["top"] - margin["bottom"]
    seasons = sorted({int(row["season"]) for row in rows})
    max_y = max(float(row["xg_per_game"]) for row in rows)
    y_top = round(max_y + 0.35, 1)

    def x_pos(season: int) -> float:
        if len(seasons) == 1:
            return margin["left"] + plot_w / 2
        return margin["left"] + (season - seasons[0]) / (seasons[-1] - seasons[0]) * plot_w

    def y_pos(value: float) -> float:
        return margin["top"] + (y_top - value) / y_top * plot_h

    def esc(value: object) -> str:
        return str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

    winner_teams = {row["team"] for row in rows if row["tournament_result"] == "Winner"}
    elements = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
        "<title id=\"title\">World Cup team xG per game by tournament year</title>",
        "<desc id=\"desc\">Scatterplot of every team in complete StatsBomb World Cup tournaments, with tournament year on the x axis and xG per game on the y axis.</desc>",
        '<rect width="920" height="560" fill="#fbfaf7"/>',
        '<text x="78" y="30" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="700" fill="#222">Team xG per game by World Cup</text>',
        '<text x="78" y="52" font-family="Inter, Arial, sans-serif" font-size="12" fill="#666">StatsBomb Open Data for 2018/2022; American Soccer Analysis team xG for 2014</text>',
    ]

    for tick in [0, 0.5, 1.0, 1.5, 2.0, 2.5]:
        y = y_pos(tick)
        elements.append(f'<line x1="{margin["left"]}" y1="{y:.1f}" x2="{width - margin["right"]}" y2="{y:.1f}" stroke="#e5e0d8" stroke-width="1"/>')
        elements.append(f'<text x="{margin["left"] - 12}" y="{y + 4:.1f}" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="12" fill="#666">{tick:.1f}</text>')

    elements.append(f'<line x1="{margin["left"]}" y1="{height - margin["bottom"]}" x2="{width - margin["right"]}" y2="{height - margin["bottom"]}" stroke="#333" stroke-width="1.2"/>')
    elements.append(f'<line x1="{margin["left"]}" y1="{margin["top"]}" x2="{margin["left"]}" y2="{height - margin["bottom"]}" stroke="#333" stroke-width="1.2"/>')

    for season in seasons:
        x = x_pos(season)
        elements.append(f'<line x1="{x:.1f}" y1="{height - margin["bottom"]}" x2="{x:.1f}" y2="{height - margin["bottom"] + 6}" stroke="#333" stroke-width="1"/>')
        elements.append(f'<text x="{x:.1f}" y="{height - margin["bottom"] + 25}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#333">{season}</text>')

    sorted_rows = sorted(rows, key=lambda item: (item["season"], item["team"]))
    for index, row in enumerate(sorted_rows):
        season = int(row["season"])
        value = float(row["xg_per_game"])
        # Stable small offset so teams in the same tournament do not sit on a single vertical line.
        jitter = ((index * 37) % 31 - 15) * 1.4
        x = min(max(x_pos(season) + jitter, margin["left"] + 8), width - margin["right"] - 8)
        y = y_pos(value)
        is_winner = row["tournament_result"] == "Winner"
        fill = "#ca472f" if is_winner else "#246a8f"
        radius = 6.5 if is_winner else 4.8
        opacity = "0.95" if is_winner else "0.72"
        elements.append(
            f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{radius}" fill="{fill}" fill-opacity="{opacity}">'
            f'<title>{esc(row["season"])} {esc(row["team"])}: {value:.2f} xG/game, {esc(row["tournament_result"])}</title>'
            "</circle>"
        )

    label_rows = [
        row
        for row in rows
        if row["team"] in winner_teams or float(row["xg_per_game"]) >= 2.1
    ]
    for row in sorted(label_rows, key=lambda item: float(item["xg_per_game"]), reverse=True):
        season = int(row["season"])
        value = float(row["xg_per_game"])
        index = sorted_rows.index(row)
        jitter = ((index * 37) % 31 - 15) * 1.4
        x = min(max(x_pos(season) + jitter, margin["left"] + 8), width - margin["right"] - 8) + 9
        y = y_pos(value) + 4
        elements.append(f'<text x="{x:.1f}" y="{y:.1f}" font-family="Inter, Arial, sans-serif" font-size="12" fill="#222">{esc(row["team"])}</text>')

    elements.extend(
        [
            f'<text x="{width / 2:.1f}" y="{height - 18}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#333">World Cup year</text>',
            f'<text transform="translate(22 {height / 2:.1f}) rotate(-90)" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#333">xG per game</text>',
            '<circle cx="742" cy="32" r="5" fill="#246a8f" fill-opacity="0.72"/><text x="754" y="36" font-family="Inter, Arial, sans-serif" font-size="12" fill="#333">Team</text>',
            '<circle cx="810" cy="32" r="6.5" fill="#ca472f" fill-opacity="0.95"/><text x="823" y="36" font-family="Inter, Arial, sans-serif" font-size="12" fill="#333">Winner</text>',
            "</svg>",
        ]
    )

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    (IMG_DIR / "team_xg_per_game_scatter.svg").write_text("\n".join(elements), encoding="utf-8")


def write_result_xg_scatter(rows: list[dict]) -> None:
    width = 980
    height = 600
    margin = {"top": 54, "right": 42, "bottom": 116, "left": 78}
    plot_w = width - margin["left"] - margin["right"]
    plot_h = height - margin["top"] - margin["bottom"]
    result_order = [
        "Group stage exit",
        "Round of 16 exit",
        "Quarter-finals exit",
        "Semi-finals exit",
        "Fourth place",
        "Third place",
        "Runner-up",
        "Winner",
    ]
    x_index = {result: index for index, result in enumerate(result_order)}
    max_y = max(float(row["xg_per_game"]) for row in rows)
    y_top = round(max_y + 0.35, 1)

    def x_pos(result: str) -> float:
        return margin["left"] + x_index[result] / (len(result_order) - 1) * plot_w

    def y_pos(value: float) -> float:
        return margin["top"] + (y_top - value) / y_top * plot_h

    def esc(value: object) -> str:
        return str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

    sorted_rows = sorted(rows, key=lambda item: (x_index[item["tournament_result"]], item["season"], item["team"]))
    elements = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
        "<title id=\"title\">World Cup team xG per game by tournament result</title>",
        "<desc id=\"desc\">Scatterplot of every team in complete StatsBomb World Cup tournaments, with tournament result on the x axis and xG per game on the y axis.</desc>",
        '<rect width="980" height="600" fill="#fbfaf7"/>',
        '<text x="78" y="32" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="700" fill="#222">Team xG per game by tournament result</text>',
        '<text x="78" y="54" font-family="Inter, Arial, sans-serif" font-size="12" fill="#666">StatsBomb Open Data for 2018/2022; American Soccer Analysis team xG for 2014</text>',
    ]

    for tick in [0, 0.5, 1.0, 1.5, 2.0, 2.5]:
        y = y_pos(tick)
        elements.append(f'<line x1="{margin["left"]}" y1="{y:.1f}" x2="{width - margin["right"]}" y2="{y:.1f}" stroke="#e5e0d8" stroke-width="1"/>')
        elements.append(f'<text x="{margin["left"] - 12}" y="{y + 4:.1f}" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="12" fill="#666">{tick:.1f}</text>')

    elements.append(f'<line x1="{margin["left"]}" y1="{height - margin["bottom"]}" x2="{width - margin["right"]}" y2="{height - margin["bottom"]}" stroke="#333" stroke-width="1.2"/>')
    elements.append(f'<line x1="{margin["left"]}" y1="{margin["top"]}" x2="{margin["left"]}" y2="{height - margin["bottom"]}" stroke="#333" stroke-width="1.2"/>')

    for result in result_order:
        x = x_pos(result)
        elements.append(f'<line x1="{x:.1f}" y1="{height - margin["bottom"]}" x2="{x:.1f}" y2="{height - margin["bottom"] + 6}" stroke="#333" stroke-width="1"/>')
        elements.append(
            f'<text transform="translate({x:.1f} {height - margin["bottom"] + 16}) rotate(38)" '
            'text-anchor="start" font-family="Inter, Arial, sans-serif" font-size="12" fill="#333">'
            f'{esc(result)}</text>'
        )

    colors = {
        "2014": "#6d6a61",
        "2018": "#246a8f",
        "2022": "#ca472f",
    }
    for index, row in enumerate(sorted_rows):
        value = float(row["xg_per_game"])
        result = row["tournament_result"]
        jitter = ((index * 41) % 29 - 14) * 1.1
        x = min(max(x_pos(result) + jitter, margin["left"] + 8), width - margin["right"] - 8)
        y = y_pos(value)
        is_winner = result == "Winner"
        radius = 6.4 if is_winner else 4.8
        stroke = "#222" if is_winner else "none"
        stroke_attr = f' stroke="{stroke}" stroke-width="1.4"' if is_winner else ""
        fill = colors.get(row["season"], "#666")
        elements.append(
            f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{radius}" fill="{fill}" fill-opacity="0.78"{stroke_attr}>'
            f'<title>{esc(row["season"])} {esc(row["team"])}: {value:.2f} xG/game, {esc(result)}</title>'
            "</circle>"
        )

    label_rows = [
        row
        for row in rows
        if row["tournament_result"] == "Winner" or float(row["xg_per_game"]) >= 2.1
    ]
    for row in sorted(label_rows, key=lambda item: float(item["xg_per_game"]), reverse=True):
        index = sorted_rows.index(row)
        jitter = ((index * 41) % 29 - 14) * 1.1
        x = min(max(x_pos(row["tournament_result"]) + jitter, margin["left"] + 8), width - margin["right"] - 8) + 9
        y = y_pos(float(row["xg_per_game"])) + 4
        elements.append(f'<text x="{x:.1f}" y="{y:.1f}" font-family="Inter, Arial, sans-serif" font-size="12" fill="#222">{esc(row["team"])} {esc(row["season"])}</text>')

    elements.extend(
        [
            f'<text x="{width / 2:.1f}" y="{height - 18}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#333">Tournament result</text>',
            f'<text transform="translate(22 {height / 2:.1f}) rotate(-90)" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#333">xG per game</text>',
            '<circle cx="748" cy="32" r="5" fill="#6d6a61" fill-opacity="0.78"/><text x="760" y="36" font-family="Inter, Arial, sans-serif" font-size="12" fill="#333">2014</text>',
            '<circle cx="810" cy="32" r="5" fill="#246a8f" fill-opacity="0.78"/><text x="822" y="36" font-family="Inter, Arial, sans-serif" font-size="12" fill="#333">2018</text>',
            '<circle cx="872" cy="32" r="5" fill="#ca472f" fill-opacity="0.78"/><text x="884" y="36" font-family="Inter, Arial, sans-serif" font-size="12" fill="#333">2022</text>',
            "</svg>",
        ]
    )

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    (IMG_DIR / "result_xg_per_game_scatter.svg").write_text("\n".join(elements), encoding="utf-8")


def write_team_net_xg_scatter(rows: list[dict]) -> None:
    width = 920
    height = 560
    margin = {"top": 48, "right": 48, "bottom": 70, "left": 78}
    plot_w = width - margin["left"] - margin["right"]
    plot_h = height - margin["top"] - margin["bottom"]
    seasons = sorted({int(row["season"]) for row in rows})
    values = [float(row["net_xg_per_game"]) for row in rows]
    y_top = math.ceil((max(values) + 0.25) * 2) / 2
    y_bottom = math.floor((min(values) - 0.25) * 2) / 2

    def x_pos(season: int) -> float:
        if len(seasons) == 1:
            return margin["left"] + plot_w / 2
        return margin["left"] + (season - seasons[0]) / (seasons[-1] - seasons[0]) * plot_w

    def y_pos(value: float) -> float:
        return margin["top"] + (y_top - value) / (y_top - y_bottom) * plot_h

    def esc(value: object) -> str:
        return str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

    elements = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
        "<title id=\"title\">World Cup team net xG per game by tournament year</title>",
        "<desc id=\"desc\">Scatterplot of every team in complete StatsBomb World Cup tournaments, with tournament year on the x axis and net xG per game on the y axis.</desc>",
        '<rect width="920" height="560" fill="#fbfaf7"/>',
        '<text x="78" y="30" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="700" fill="#222">Team net xG per game by World Cup</text>',
        '<text x="78" y="52" font-family="Inter, Arial, sans-serif" font-size="12" fill="#666">Net xG/game = xG for/game minus xG against/game</text>',
    ]

    tick = y_bottom
    while tick <= y_top + 0.001:
        y = y_pos(tick)
        stroke = "#b8b0a5" if abs(tick) < 0.001 else "#e5e0d8"
        elements.append(f'<line x1="{margin["left"]}" y1="{y:.1f}" x2="{width - margin["right"]}" y2="{y:.1f}" stroke="{stroke}" stroke-width="1"/>')
        elements.append(f'<text x="{margin["left"] - 12}" y="{y + 4:.1f}" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="12" fill="#666">{tick:.1f}</text>')
        tick += 0.5

    elements.append(f'<line x1="{margin["left"]}" y1="{height - margin["bottom"]}" x2="{width - margin["right"]}" y2="{height - margin["bottom"]}" stroke="#333" stroke-width="1.2"/>')
    elements.append(f'<line x1="{margin["left"]}" y1="{margin["top"]}" x2="{margin["left"]}" y2="{height - margin["bottom"]}" stroke="#333" stroke-width="1.2"/>')

    for season in seasons:
        x = x_pos(season)
        elements.append(f'<line x1="{x:.1f}" y1="{height - margin["bottom"]}" x2="{x:.1f}" y2="{height - margin["bottom"] + 6}" stroke="#333" stroke-width="1"/>')
        elements.append(f'<text x="{x:.1f}" y="{height - margin["bottom"] + 25}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#333">{season}</text>')

    sorted_rows = sorted(rows, key=lambda item: (item["season"], item["team"]))
    for index, row in enumerate(sorted_rows):
        season = int(row["season"])
        value = float(row["net_xg_per_game"])
        jitter = ((index * 37) % 31 - 15) * 1.4
        x = min(max(x_pos(season) + jitter, margin["left"] + 8), width - margin["right"] - 8)
        y = y_pos(value)
        is_winner = row["tournament_result"] == "Winner"
        fill = "#ca472f" if is_winner else "#246a8f"
        radius = 6.5 if is_winner else 4.8
        opacity = "0.95" if is_winner else "0.72"
        elements.append(
            f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{radius}" fill="{fill}" fill-opacity="{opacity}">'
            f'<title>{esc(row["season"])} {esc(row["team"])}: {value:.2f} net xG/game, {esc(row["tournament_result"])}</title>'
            "</circle>"
        )

    label_rows = [row for row in rows if row["tournament_result"] == "Winner" or float(row["net_xg_per_game"]) >= 1.5]
    for row in sorted(label_rows, key=lambda item: float(item["net_xg_per_game"]), reverse=True):
        index = sorted_rows.index(row)
        season = int(row["season"])
        value = float(row["net_xg_per_game"])
        jitter = ((index * 37) % 31 - 15) * 1.4
        x = min(max(x_pos(season) + jitter, margin["left"] + 8), width - margin["right"] - 8) + 9
        y = y_pos(value) + 4
        elements.append(f'<text x="{x:.1f}" y="{y:.1f}" font-family="Inter, Arial, sans-serif" font-size="12" fill="#222">{esc(row["team"])}</text>')

    elements.extend(
        [
            f'<text x="{width / 2:.1f}" y="{height - 18}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#333">World Cup year</text>',
            f'<text transform="translate(22 {height / 2:.1f}) rotate(-90)" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#333">net xG per game</text>',
            '<circle cx="742" cy="32" r="5" fill="#246a8f" fill-opacity="0.72"/><text x="754" y="36" font-family="Inter, Arial, sans-serif" font-size="12" fill="#333">Team</text>',
            '<circle cx="810" cy="32" r="6.5" fill="#ca472f" fill-opacity="0.95"/><text x="823" y="36" font-family="Inter, Arial, sans-serif" font-size="12" fill="#333">Winner</text>',
            "</svg>",
        ]
    )

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    (IMG_DIR / "team_net_xg_per_game_scatter.svg").write_text("\n".join(elements), encoding="utf-8")


def write_result_net_xg_scatter(rows: list[dict]) -> None:
    width = 980
    height = 600
    margin = {"top": 54, "right": 42, "bottom": 116, "left": 78}
    plot_w = width - margin["left"] - margin["right"]
    plot_h = height - margin["top"] - margin["bottom"]
    result_order = [
        "Group stage exit",
        "Round of 16 exit",
        "Quarter-finals exit",
        "Semi-finals exit",
        "Fourth place",
        "Third place",
        "Runner-up",
        "Winner",
    ]
    x_index = {result: index for index, result in enumerate(result_order)}
    values = [float(row["net_xg_per_game"]) for row in rows]
    y_top = math.ceil((max(values) + 0.25) * 2) / 2
    y_bottom = math.floor((min(values) - 0.25) * 2) / 2

    def x_pos(result: str) -> float:
        return margin["left"] + x_index[result] / (len(result_order) - 1) * plot_w

    def y_pos(value: float) -> float:
        return margin["top"] + (y_top - value) / (y_top - y_bottom) * plot_h

    def esc(value: object) -> str:
        return str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

    sorted_rows = sorted(rows, key=lambda item: (x_index[item["tournament_result"]], item["season"], item["team"]))
    elements = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
        "<title id=\"title\">World Cup team net xG per game by tournament result</title>",
        "<desc id=\"desc\">Scatterplot of every team in complete StatsBomb World Cup tournaments, with tournament result on the x axis and net xG per game on the y axis.</desc>",
        '<rect width="980" height="600" fill="#fbfaf7"/>',
        '<text x="78" y="32" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="700" fill="#222">Team net xG per game by tournament result</text>',
        '<text x="78" y="54" font-family="Inter, Arial, sans-serif" font-size="12" fill="#666">Net xG/game = xG for/game minus xG against/game</text>',
    ]

    tick = y_bottom
    while tick <= y_top + 0.001:
        y = y_pos(tick)
        stroke = "#b8b0a5" if abs(tick) < 0.001 else "#e5e0d8"
        elements.append(f'<line x1="{margin["left"]}" y1="{y:.1f}" x2="{width - margin["right"]}" y2="{y:.1f}" stroke="{stroke}" stroke-width="1"/>')
        elements.append(f'<text x="{margin["left"] - 12}" y="{y + 4:.1f}" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="12" fill="#666">{tick:.1f}</text>')
        tick += 0.5

    elements.append(f'<line x1="{margin["left"]}" y1="{height - margin["bottom"]}" x2="{width - margin["right"]}" y2="{height - margin["bottom"]}" stroke="#333" stroke-width="1.2"/>')
    elements.append(f'<line x1="{margin["left"]}" y1="{margin["top"]}" x2="{margin["left"]}" y2="{height - margin["bottom"]}" stroke="#333" stroke-width="1.2"/>')

    for result in result_order:
        x = x_pos(result)
        elements.append(f'<line x1="{x:.1f}" y1="{height - margin["bottom"]}" x2="{x:.1f}" y2="{height - margin["bottom"] + 6}" stroke="#333" stroke-width="1"/>')
        elements.append(
            f'<text transform="translate({x:.1f} {height - margin["bottom"] + 16}) rotate(38)" '
            'text-anchor="start" font-family="Inter, Arial, sans-serif" font-size="12" fill="#333">'
            f'{esc(result)}</text>'
        )

    colors = {"2014": "#6d6a61", "2018": "#246a8f", "2022": "#ca472f"}
    for index, row in enumerate(sorted_rows):
        value = float(row["net_xg_per_game"])
        result = row["tournament_result"]
        jitter = ((index * 41) % 29 - 14) * 1.1
        x = min(max(x_pos(result) + jitter, margin["left"] + 8), width - margin["right"] - 8)
        y = y_pos(value)
        is_winner = result == "Winner"
        radius = 6.4 if is_winner else 4.8
        stroke_attr = ' stroke="#222" stroke-width="1.4"' if is_winner else ""
        fill = colors.get(row["season"], "#666")
        elements.append(
            f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{radius}" fill="{fill}" fill-opacity="0.78"{stroke_attr}>'
            f'<title>{esc(row["season"])} {esc(row["team"])}: {value:.2f} net xG/game, {esc(result)}</title>'
            "</circle>"
        )

    label_rows = [row for row in rows if row["tournament_result"] == "Winner" or float(row["net_xg_per_game"]) >= 1.5]
    for row in sorted(label_rows, key=lambda item: float(item["net_xg_per_game"]), reverse=True):
        index = sorted_rows.index(row)
        jitter = ((index * 41) % 29 - 14) * 1.1
        x = min(max(x_pos(row["tournament_result"]) + jitter, margin["left"] + 8), width - margin["right"] - 8) + 9
        y = y_pos(float(row["net_xg_per_game"])) + 4
        elements.append(f'<text x="{x:.1f}" y="{y:.1f}" font-family="Inter, Arial, sans-serif" font-size="12" fill="#222">{esc(row["team"])} {esc(row["season"])}</text>')

    elements.extend(
        [
            f'<text x="{width / 2:.1f}" y="{height - 18}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#333">Tournament result</text>',
            f'<text transform="translate(22 {height / 2:.1f}) rotate(-90)" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#333">net xG per game</text>',
            '<circle cx="748" cy="32" r="5" fill="#6d6a61" fill-opacity="0.78"/><text x="760" y="36" font-family="Inter, Arial, sans-serif" font-size="12" fill="#333">2014</text>',
            '<circle cx="810" cy="32" r="5" fill="#246a8f" fill-opacity="0.78"/><text x="822" y="36" font-family="Inter, Arial, sans-serif" font-size="12" fill="#333">2018</text>',
            '<circle cx="872" cy="32" r="5" fill="#ca472f" fill-opacity="0.78"/><text x="884" y="36" font-family="Inter, Arial, sans-serif" font-size="12" fill="#333">2022</text>',
            "</svg>",
        ]
    )

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    (IMG_DIR / "result_net_xg_per_game_scatter.svg").write_text("\n".join(elements), encoding="utf-8")


def main() -> None:
    coverage_rows = []
    match_rows = []
    team_totals = defaultdict(lambda: {"matches": 0, "xg_for": 0.0, "xg_against": 0.0})
    complete_matches_by_season = {}

    for season in world_cup_seasons():
        season_name = season["season_name"]
        season_id = season["season_id"]
        matches = fetch_json(f"matches/43/{season_id}.json")
        expected = EXPECTED_MATCHES.get(season_name)
        is_complete = expected is not None and len(matches) == expected

        coverage_rows.append(
            {
                "season": season_name,
                "statsbomb_season_id": season_id,
                "matches_available": len(matches),
                "expected_tournament_matches": expected or "",
                "complete_tournament": is_complete,
            }
        )

        if is_complete:
            complete_matches_by_season[season_name] = matches

        for match in sorted(matches, key=lambda item: (item["match_date"], item["match_id"])):
            home = team_name(match, "home")
            away = team_name(match, "away")
            totals = match_xg(match)
            home_xg = totals.get(home, 0.0)
            away_xg = totals.get(away, 0.0)
            row = {
                "season": season_name,
                "match_id": match["match_id"],
                "match_date": match["match_date"],
                "stage": match["competition_stage"]["name"],
                "home_team": home,
                "away_team": away,
                "home_score": match["home_score"],
                "away_score": match["away_score"],
                "home_xg": round(home_xg, 4),
                "away_xg": round(away_xg, 4),
                "complete_tournament": is_complete,
            }
            match_rows.append(row)

            if is_complete:
                for team, xg_for, xg_against in [(home, home_xg, away_xg), (away, away_xg, home_xg)]:
                    key = (season_name, team)
                    team_totals[key]["matches"] += 1
                    team_totals[key]["xg_for"] += xg_for
                    team_totals[key]["xg_against"] += xg_against

    result_rows = []
    for season, matches in complete_matches_by_season.items():
        for team, result in infer_results(season, matches).items():
            result_rows.append({"season": season, "team": team, "tournament_result": result})

    result_lookup = {(row["season"], row["team"]): row["tournament_result"] for row in result_rows}
    summary_rows = []
    for (season, team), totals in sorted(team_totals.items(), key=lambda item: (item[0][0], item[0][1]), reverse=True):
        matches = totals["matches"]
        summary_rows.append(
            {
                "season": season,
                "team": team,
                "matches": matches,
                "xg_for": round(totals["xg_for"], 4),
                "xg_against": round(totals["xg_against"], 4),
                "xg_per_game": round(totals["xg_for"] / matches, 4),
                "xg_against_per_game": round(totals["xg_against"] / matches, 4),
                "net_xg_per_game": round((totals["xg_for"] - totals["xg_against"]) / matches, 4),
                "tournament_result": result_lookup.get((season, team), ""),
                "data_source": "StatsBomb Open Data",
                "metric_note": "Shot-level StatsBomb xG summed over complete tournament matches.",
            }
        )

    summary_rows.extend(fetch_asa_2014_team_rows())
    summary_rows = add_fifa_rankings(summary_rows)
    result_rows.extend(
        {
            "season": row["season"],
            "team": row["team"],
            "tournament_result": row["tournament_result"],
        }
        for row in summary_rows
        if row["season"] == "2014"
    )

    top_rows = []
    summary_seasons = sorted({row["season"] for row in summary_rows}, reverse=True)
    for season in summary_seasons:
        season_rows = [row for row in summary_rows if row["season"] == season]
        season_rows.sort(key=lambda row: row["xg_per_game"], reverse=True)
        for rank, row in enumerate(season_rows[:3], start=1):
            top_rows.append({"rank": rank, **row})

    winner_rows = [row for row in summary_rows if row["tournament_result"] == "Winner"]
    winner_rows.sort(key=lambda row: row["season"], reverse=True)

    fifa_rank_rows = sorted(
        summary_rows,
        key=lambda row: (-int(row["season"]), int(row["fifa_rank_pre_tournament"])),
    )

    write_csv(
        OUT_DIR / "statsbomb_world_cup_coverage.csv",
        sorted(coverage_rows, key=lambda row: row["season"], reverse=True),
        ["season", "statsbomb_season_id", "matches_available", "expected_tournament_matches", "complete_tournament"],
    )
    write_csv(
        OUT_DIR / "world_cup_match_xg.csv",
        match_rows,
        [
            "season",
            "match_id",
            "match_date",
            "stage",
            "home_team",
            "away_team",
            "home_score",
            "away_score",
            "home_xg",
            "away_xg",
            "complete_tournament",
        ],
    )
    write_csv(
        OUT_DIR / "world_cup_team_results.csv",
        sorted(result_rows, key=lambda row: (row["season"], row["team"]), reverse=True),
        ["season", "team", "tournament_result"],
    )
    write_csv(
        OUT_DIR / "world_cup_team_xg_summary.csv",
        summary_rows,
        [
            "season",
            "team",
            "matches",
            "xg_for",
            "xg_against",
            "xg_per_game",
            "xg_against_per_game",
            "net_xg_per_game",
            "tournament_result",
            "fifa_code",
            "fifa_rank_date",
            "fifa_rank_pre_tournament",
            "fifa_points_pre_tournament",
            "data_source",
            "metric_note",
        ],
    )
    write_csv(
        OUT_DIR / "world_cup_top_3_xg_per_game.csv",
        top_rows,
        [
            "season",
            "rank",
            "team",
            "matches",
            "xg_for",
            "xg_against",
            "xg_per_game",
            "xg_against_per_game",
            "net_xg_per_game",
            "tournament_result",
            "fifa_code",
            "fifa_rank_date",
            "fifa_rank_pre_tournament",
            "fifa_points_pre_tournament",
            "data_source",
            "metric_note",
        ],
    )
    write_csv(
        OUT_DIR / "world_cup_winners_xg_per_game.csv",
        winner_rows,
        [
            "season",
            "team",
            "matches",
            "xg_for",
            "xg_against",
            "xg_per_game",
            "xg_against_per_game",
            "net_xg_per_game",
            "tournament_result",
            "fifa_code",
            "fifa_rank_date",
            "fifa_rank_pre_tournament",
            "fifa_points_pre_tournament",
            "data_source",
            "metric_note",
        ],
    )
    write_csv(
        OUT_DIR / "world_cup_team_fifa_rank_xg.csv",
        fifa_rank_rows,
        [
            "season",
            "team",
            "fifa_code",
            "fifa_rank_date",
            "fifa_rank_pre_tournament",
            "fifa_points_pre_tournament",
            "matches",
            "xg_per_game",
            "net_xg_per_game",
            "tournament_result",
            "data_source",
        ],
    )
    write_team_xg_scatter(summary_rows)
    write_result_xg_scatter(summary_rows)
    write_team_net_xg_scatter(summary_rows)
    write_result_net_xg_scatter(summary_rows)


if __name__ == "__main__":
    main()
