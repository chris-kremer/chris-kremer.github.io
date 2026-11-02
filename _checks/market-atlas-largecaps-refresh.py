"""Exercise archive refresh with isolated synthetic retirement/history fixtures."""
import contextlib,io,json,pathlib,runpy,tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1];APP=ROOT/'projects/market-atlas/app'
# Build from a tiny deterministic cache representing 1,001 screened issuers.
# Fixtures never enter the deployed app or masquerade as actual market data.
with tempfile.TemporaryDirectory() as directory:
 work=pathlib.Path(directory);app=work/'app';cache=work/'cache';app.mkdir();cache.mkdir()
 entities=[];roster=[]
 for i in range(1001):
  key=f'TEST{i}';cap=2000-i
  entities.append({'id':key,'monthly':[{'month':'2026-10','capDate':'2026-10-30','date':'2026-10-30','marketCap':cap,'fpe':10}]})
  roster.append({'id':key,'baseId':key,'rankingCap':cap,'symbols':[key],'cik':str(i+1),'name':key,'sector':'Industrials','industry':'Fixture'})
 (app/'data.json').write_text(json.dumps({'companies':entities}))
 saved={'id':'TEST0','monthly':[{'month':'2021-01','date':'2021-01-29','capDate':'2021-01-29','marketCap':100,'fpe':None}]}
 inactive={'id':'RETIRED_TEST','monthly':[{'month':'2020-01','marketCap':50}]}
 (app/'data-largecaps.json').write_text(json.dumps({'entities':[saved,inactive],'rosters':[{'retrieved':'2026-10-01','ids':['RETIRED_TEST']}]}))
 (cache/'selected-roster.json').write_text(json.dumps(roster));(cache/'roster-raw.json').write_text(json.dumps(roster))
 with contextlib.redirect_stdout(io.StringIO()):runpy.run_path(str(ROOT/'_data_tools/largecaps/build.py'),init_globals={'APP':app,'C':cache,'ASOF':'2026-11-02','START':'2021-11','THROUGH':'2026-10'})
 result=json.loads((app/'data-largecaps.json').read_text());archive={c['id']:c for c in result['entities']}
 assert len(result['activeIds'])==1000
 assert 'RETIRED_TEST' in archive and 'RETIRED_TEST' not in result['activeIds']
 assert archive['TEST0']['monthly'][0]['month']=='2021-01'
 assert len(result['rosters'])==2 and result['rosters'][0]['ids']==['RETIRED_TEST']
 assert result['meta']['coverage']['2021-01']['marketCap']==1
 assert result['meta']['coverage']['2026-10']['marketCap']==1000
print('PASS: roster refresh retains inactive issuer histories, older monthly observations and past membership snapshots; coverage follows retained observations.')
