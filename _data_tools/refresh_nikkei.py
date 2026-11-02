"""Build a saved Nikkei company basket from a verified official roster and public sources.

Keep the dated download cache outside the deployed app. No index levels/price
weights are used; this is a full-company-cap basket of current constituents.
"""
import argparse,datetime as dt,json,pathlib,runpy,shutil
p=argparse.ArgumentParser();p.add_argument('--cache',type=pathlib.Path,required=True);p.add_argument('--roster',type=pathlib.Path,required=True);p.add_argument('--as-of',required=True);p.add_argument('--through',required=True);p.add_argument('--base-month',default='2026-09');p.add_argument('--cpi-base-year',type=int,default=2025);p.add_argument('--cpi-url',required=True);p.add_argument('--build-only',action='store_true');args=p.parse_args()
asof=dt.date.fromisoformat(args.as_of);assert dt.date.fromisoformat(args.through+'-01')<asof.replace(day=1),'Use completed months only'
cache=args.cache.resolve();cache.mkdir(parents=True,exist_ok=True);app=pathlib.Path(__file__).resolve().parents[1]/'projects/market-atlas/app';assert not cache.is_relative_to(app)
roster=json.loads(args.roster.read_text());assert roster['retrieved']==args.as_of;assert len(roster['companies'])==225 and len({c['id'] for c in roster['companies']})==225
start=f'{asof.year-5}-{asof.month:02d}';manifest={'retrieved':args.as_of,'through':args.through,'start':start,'cpiURL':args.cpi_url}
path=cache/'manifest.json'
if path.exists():assert json.loads(path.read_text())==manifest,'Use a new dated cache'
else:path.write_text(json.dumps(manifest))
if args.roster.resolve()!=cache/'roster.json':shutil.copyfile(args.roster,cache/'roster.json')
# Auxiliary inputs are fetched from their documented official sources by the
# operator: full ECB daily CSV, FRED DEXJPUS daily CSV and the linked national
# all-items CPI CSV. Do not replace them with current rates or Tokyo flash CPI.
for name in ['ecb.csv','usdjpy.csv','japan-cpi.csv']:assert (cache/name).exists(),'Missing auxiliary input: '+name
values={'APP':app,'C':cache,'ASOF':args.as_of,'START':start,'THROUGH':args.through,'BASE':args.base_month,'CPI_BASE_YEAR':args.cpi_base_year,'CPI_URL':args.cpi_url};stages=pathlib.Path(__file__).resolve().parent/'nikkei'
if not args.build_only:runpy.run_path(str(stages/'collect.py'),init_globals=values)
runpy.run_path(str(stages/'build.py'),init_globals=values)
