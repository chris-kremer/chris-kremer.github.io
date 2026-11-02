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
