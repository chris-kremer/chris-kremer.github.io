"""Check dated observations, source coverage, FX, and saved-history preservation."""
import datetime as dt,hashlib,json,math,pathlib,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1];APP=ROOT/'projects/market-atlas/app'
def load(name):return json.loads((APP/name).read_text())
report=load('data-refresh.json');us=load('data.json');eu=load('data-europe.json');inflation=load('data-inflation.json');history=load('data-history.json');months=set(report['requestedMonths'])
def good(value):return isinstance(value,(int,float)) and math.isfinite(value) and value>0
def older_hash(entities):
 rows=[{'id':e['id'],'monthly':[p for p in e.get('monthly',[]) if p['month'] not in months]} for e in entities]
 return hashlib.sha256(json.dumps(rows,sort_keys=True,separators=(',',':')).encode()).hexdigest()
expected={'companies':{'marketCap':500,'forwardPE':489},'dax':{'marketCap':40,'forwardPE':40},'cac':{'marketCap':40,'forwardPE':39},'ftse':{'marketCap':94,'forwardPE':91}}
for market,entities in [('companies',us['companies']),*eu['markets'].items()]:
 assert older_hash(entities)==report['unchangedOlderCompanyHistorySHA256'][market],market+' old history changed'
 for e in entities:
  assert len({p['month'] for p in e['monthly']})==len(e['monthly']),e['id']+' duplicate month'
  for p in e['monthly']:
   if p['month'] not in months:continue
   assert p['date']==p['capDate']=={'2026-09':'2026-09-30','2026-10':'2026-10-30'}[p['month']]
   assert good(p['marketCap']) and p['retrieved']=='2026-11-02'
   if good(p['fpe']):assert p['fpeDate']==p['capDate']
   if market!='companies':
    assert p['currency']==eu['meta'][market]['currency']
    assert math.isclose(p['marketCap'],p['sourceMarketCap']*p['fxRate'],rel_tol=1e-12)
    if p['sourceCurrency']!=p['currency']:
     assert p['fxDate']==p['capDate'];rates=eu['fxRates'][p['fxDate']]
     assert math.isclose(p['fxRate'],rates[p['currency']]/rates[p['sourceCurrency']],rel_tol=1e-12)
 assert report['markets'][market]['coverage']['2026-10']==expected[market]
 assert report['inflation'][market]['unavailable']==['2026-10']
 assert '2026-10' not in (inflation if market=='companies' else eu['meta'][market]['inflation'])['observations']
# Independently compare pre-refresh source files when this check runs before commit.
base_us=json.loads(subprocess.check_output(['git','show','HEAD:projects/market-atlas/app/data.json'],cwd=ROOT))
for before,after in zip(base_us['companies'],us['companies']):
 assert before['id']==after['id'] and before['history']==after['history'],'Annual data/universe must not change'
 assert [p for p in before['monthly'] if p['month'] not in months]==[p for p in after['monthly'] if p['month'] not in months]
apple=next(c for c in us['companies'] if c['id']=='AAPL');october=next(p for p in apple['monthly'] if p['month']=='2026-10')
assert october['marketCap']==5050935189300 and math.isclose(october['fpe'],37.512381491439086)
assert us['meta']['monthly']['end']=='2026-10' and eu['windowEnd']=='2026-10-31'
assert inflation['baseMonth']=='2026-09' and inflation['baseIndex']==inflation['observations']['2026-09']==336.94
assert inflation['fallbacks']['2025-10']['month']=='2025-09' and '2026-10' not in inflation['fallbacks']
assert history['longrun']['end']=='2026-09' and report['longrun']['unavailable']==['2026-10']
assert report['errors']==[]
print('PASS: September/October company data, exact cap/P/E dates, exact-date FX, unchanged earlier history and roster, and explicit pending October CPI / long-run coverage.')
