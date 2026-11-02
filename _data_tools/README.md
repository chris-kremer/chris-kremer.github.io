# Saved monthly source updates

The November 2, 2026 refresh updates only September and October 2026 company
observations. Membership and annual observations stay as retrieved October 29.
The app's `data-refresh.json` records coverage, source dates, missing observations,
pending CPI and hashes of untouched older company months.

`collect_monthly_series.py --cache CACHE --retrieved YYYY-MM-DD --months YYYY-MM ...`
collects public Stock Analysis daily-series endpoints and retains only the final
dated row in each requested month, plus response metadata. It uses three workers
by default. A new retrieval date/month set requires a new download. These are
source-reported historical forward ratios, not verified point-in-time forecasts.

`apply_monthly_refresh.py --cache CACHE --retrieved YYYY-MM-DD --months YYYY-MM ...`
validates all expected downloads before writing. It rejects incomplete months,
stale cap dates, unverified currencies and missing exact-date FX; P/E must have
the cap's exact date. It preserves older rows, roster and annual data. If a fresh
source is missing, an existing dated observation is retained and disclosed in the
report; it is never reused for a different month.

Before applying, the cache also needs dated official auxiliary sources:

- `ecb.csv`: EXR daily USD/GBP per EUR rates for all target cap dates.
- `gel-YYYY-MM-DD.json`: NBG official EUR/GEL rates with exact valid-from dates.
- `us-cpi.csv`: FRED CPIAUCNS CSV.
- `hicp-DE.json` / `hicp-FR.json`: Eurostat prc_hicp_minr, TOTAL, I25 JSON-stat.
- `ons.csv`: ONS D7BT generator CSV.
- `french.zip`: official 49_Industry_Portfolios_CSV.zip.

Official source URLs are retained in the app's source metadata and refresh report.
The purchasing-power base stays September 2026. New exact CPI is added only when
published; there is no October 2026 carry-forward. The separately configured
October 2025 CPI fallback remains unchanged. The French archive is updated only
for months actually present in its firm-count and average-size source sections.

Run the monthly-refresh Python check, the CPI/name/circle JavaScript checks, and
the Jekyll production build. Review coverage and check the actual date/basis in
the browser before publishing. The scripts intentionally do not schedule updates.

## Independent US-listed large caps

`python3 _data_tools/refresh_largecaps.py --cache /private/tmp/atlas-YYYY-MM-DD --as-of YYYY-MM-DD --through YYYY-MM`

This separately refreshes `data-largecaps.json`; it does not change the S&P 500
or European index files. Python dependencies: `beautifulsoup4` and `json5`.
The roster stage parses public serialized data with JSON5, never by executing
third-party JavaScript. It screens the US-listed stock directory, screens by
source USD company capitalization, excludes shells / preferred-only securities /
when-issued listings and corporate-unit symbol SOMN, and consolidates SEC CIKs.
It inspects the leading 1,150 symbols to collect candidates, then rank 1,000 by dated cap; missing profiles
or too few verified issuers fail the refresh rather than silently shrinking it.
US-listed foreign companies and ADRs are included, so the universe differs from
a US-domiciled-company ranking. The current roster applies to every past month.

A new dated cache is required for every retrieval date/window. Raw source pages,
profiles, response metadata and derived monthly series stay in that external
cache. The free five-year window supplies added-company monthly observations;
only completed months and actual month-end rows within three days are accepted.
Known IPO dates exclude pre-listing rows. Missing / nonpositive P/E is not filled;
its source date must exactly match the cap. Existing overlapping S&P histories
are reused. The runtime adds the same saved FinHacker cap archive for overlapping
issuers, keeping earlier coverage visibly partial.

US-listing daily caps are USD. Some API metadata repeats the issuer's financial
reporting currency even when the values are USD. Such series require an
independent currency check against exact dated observations on the public USD
market-cap page (at least one overlap, median relative error <=2%). Raw metadata,
matched observation count and source URL are retained. Already-USD caps are never
converted again. The directory's current-cap field is used for candidate
screening only: the final 1,000 are ranked by verified dated month-end caps, with
a buffer below the cutoff. This excludes the directory's implausible Telesat
value. November 2 collection coverage is 1,000 October caps / 821 positive P/Es.

Collected observations and dated membership snapshots remain in the permanent
archive on refresh; inactive issuers are not removed from `entities`. Canonical
IDs are retained by CIK. This preserves collected history without claiming the
archive is a historical top-1,000 or delisted-stock database. New eligible IPOs
enter on a manual refresh as soon as public source data is available; there is
no index-admission delay and no scheduled/live feed. Private companies receive
no invented ticker, cap, or P/E. `--build-only` reconstructs from a complete,
date-matched cache without network calls. Run the large-cap regression check
alongside the existing checks and production build before publication.

## Japan / Nikkei 225

`refresh_nikkei.py --cache CACHE --roster VERIFIED_ROSTER_JSON --as-of YYYY-MM-DD --through YYYY-MM --cpi-url OFFICIAL_CPI_CSV_URL [--build-only]`

The roster JSON is a dated transcription of the public official Nikkei component
list (`retrieved`, `source`, and 225 `companies` records containing `id`,
`officialName`, `officialIndustry`). The November 2, 2026 roster includes the
October review replacements. An inaccessible official page must be resolved
using its public listing; do not substitute a stale Wikipedia roster or silently
ignore new constituents. This is a company-cap basket, not a calculation or
redistribution of the Nikkei's price-weighted index levels/weights.

Dependencies: Python `beautifulsoup4`; public curl downloads. Cache manifests
lock the retrieval date/window. Before running, place the official auxiliary
inputs in that external cache: `ecb.csv` (full daily USD/JPY per EUR),
`usdjpy.csv` (FRED DEXJPUS daily JPY per USD), and `japan-cpi.csv` (Statistics
Bureau/e-Stat linked national all-items index, CP932 CSV). The CPI source is
explicitly supplied via `--cpi-url`; `--cpi-base-year` defaults to 2025 and the
purchasing-power reference `--base-month` stays September 2026 by default.
Do not use Tokyo flash CPI as a replacement for missing national CPI.

Provider symbols are verified TYO listings. Daily public free-window observations
supply monthly caps and exactly date-matched forward P/E. Main/listing currency
and cap metadata must both be JPY. Only actual month-end rows within three days
are accepted. Earlier downloaded months are retained on refresh, previous roster
snapshots are preserved, and removed companies remain in the archive.

Standalone view uses nominal JPY or Japan CPI-adjusted JPY. Country comparison
uses USD conversion at each exact cap date, then the common US CPI adjustment.
JPY FX is merged separately and never overwrites existing EUR/GBP rates. ECB
covers all saved cap dates except March 29, 2024 (ECB holiday); the exact-date
Federal Reserve H.10 rate 151.22 JPY/USD covers that date. No previous-day FX or
monthly average is used. October 2026: 225 cap observations, 222 positive FPEs;
September: 225 / 223. Both have complete exact-date USD conversion. National CPI
ends September 2026 (102.2 on the 2025 base); missing October remains unavailable.

Run the Japan and country-comparison checks plus existing relevant regressions,
and inspect standalone JPY, common-USD sizing and missing-CPI behavior before
publishing. This is a saved data refresh, not a live or scheduled feed.
