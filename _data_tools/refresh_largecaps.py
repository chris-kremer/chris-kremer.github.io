"""Refresh the independent US-listed issuer universe from public free sources.

Run from any directory; the cache must be outside the deployed app. A dated
cache cannot be reused with a new retrieval date. Prior entities, roster
snapshots and monthly observations remain in the permanent issuer archive.
"""
import argparse,calendar,datetime as dt,json,pathlib,runpy,subprocess
p=argparse.ArgumentParser();p.add_argument('--cache',type=pathlib.Path,required=True);p.add_argument('--as-of',required=True);p.add_argument('--through',required=True);p.add_argument('--build-only',action='store_true');args=p.parse_args()
asof=dt.date.fromisoformat(args.as_of);through=dt.date.fromisoformat(args.through+'-01')
assert through<asof.replace(day=1),'Only completed calendar months can be collected'
app=pathlib.Path(__file__).resolve().parents[1]/'projects/market-atlas/app';cache=args.cache.resolve();cache.mkdir(parents=True,exist_ok=True)
assert not cache.is_relative_to(app),'Download cache must not be deployed'
start=f'{asof.year-5}-{asof.month:02d}'
manifest={'retrieved':args.as_of,'historyStart':start,'through':args.through}
path=cache/'manifest.json'
if path.exists():assert json.loads(path.read_text())==manifest,'Use a new dated cache for a new retrieval date/window'
else:path.write_text(json.dumps(manifest))
globals={'APP':app,'C':cache,'ASOF':args.as_of,'START':start,'THROUGH':args.through}
stages=pathlib.Path(__file__).resolve().parent/'largecaps'
if not args.build_only:
 for name in ['roster','profiles','select','series','units']:runpy.run_path(str(stages/(name+'.py')),init_globals=globals)
runpy.run_path(str(stages/'build.py'),init_globals=globals)
