"""Build a USD issuer archive after validating conflicting currency metadata."""
from pathlib import Path
import json,gzip,calendar,math
roster=json.loads((C/'selected-roster.json').read_text());base={c['id']:c for c in json.loads((APP/'data.json').read_text())['companies']}
def positive(x):return isinstance(x,(int,float)) and math.isfinite(x) and x>0
rows=[];unranked=[]
for original in roster:
 c=dict(original);c['history']=[];c['symbols']=[s for s in c['symbols'] if s!='SOMN']
 if c.get('baseId'):
  b=base[c['baseId']];c['monthly']=b['monthly'];c['historicalCapId']=b['id']
 else:
  sources={f:json.loads(gzip.decompress((C/'series'/f"{c['id']}-{f}.json.gz").read_bytes())) for f in ['calculated_market_cap','peForward']};cap=sources['calculated_market_cap'];pe=sources['peForward'];raw_currency=cap.get('meta',{}).get('currency');evidence=None
  if raw_currency!='USD':
   evidence=json.loads((C/'unit-checks'/f"{c['id']}.json").read_text());assert evidence.get('verifiedUSD'),f"Unresolved cap currency: {c['id']}"
  c.update(marketCapSourceURL=cap['url'],forwardPESourceURL=pe['url'],capSourceMetadata=cap.get('meta',{}),forwardPESourceMetadata=pe.get('meta',{}))
  if evidence:c['capCurrencyVerification']={k:v for k,v in evidence.items() if k!='pairs'}
  points=[]
  for month,p in sorted(cap.get('monthly',{}).items()):
   date=p['date'];y,m,d=map(int,date.split('-'))
   if not positive(p['value']) or calendar.monthrange(y,m)[1]-d>3 or date<c.get('ipoDate','1900-01-01'):continue
   q=pe.get('monthly',{}).get(month);same=q and q['date']==date;ratio=q['value'] if same and isinstance(q['value'],(int,float)) and math.isfinite(q['value']) else None
   points.append({'month':month,'year':y,'date':date,'capDate':date,'fpeDate':date if same else None,'marketCap':p['value'],'fpe':ratio,'revenue':None,'netIncome':None,'currency':'USD','sourceMarketCap':p['value'],'sourceCurrency':'USD','rawSeriesCurrency':raw_currency,'capCurrencyEvidenceURL':evidence['sourceURL'] if evidence else cap['url'],'fxRate':1,'fxDate':None,'fxRateSource':None,'provider':'stockanalysis','retrieved':ASOF,'capSeriesSource':cap.get('meta',{}).get('source'),'forwardPESeriesSource':pe.get('meta',{}).get('source')})
  c['monthly']=points
 latest=next((p for p in c['monthly'] if p['month']==THROUGH),None)
 if not latest:unranked.append(c['id']);continue
 c['directoryCap']=c['rankingCap'];c['rankingCap']=latest['marketCap'];c['rankingDate']=latest['capDate'];rows.append(c)
rows.sort(key=lambda c:c['rankingCap'],reverse=True);rows=rows[:1000];assert len(rows)==1000,'Insufficient verified ranked issuers'
# The screened directory extends below the selected cutoff. Fail on an inadequate buffer.
assert rows[-1]['rankingCap']>roster[-1]['rankingCap'],'Screen more directory candidates before ranking'
ids=[c['id'] for c in rows];existing=json.loads((APP/'data-largecaps.json').read_text()) if (APP/'data-largecaps.json').exists() else {'entities':[],'rosters':[]}
archive={c['id']:c for c in existing['entities']}
for c in rows:
 previous=archive.get(c['id'],{});saved={p['month']:p for p in previous.get('monthly',[])};saved.update({p['month']:p for p in c['monthly']});c['monthly']=[saved[m] for m in sorted(saved)];archive[c['id']]=c
coverage={m:{'marketCap':sum(any(p['month']==m for p in archive[i]['monthly']) for i in ids),'forwardPE':sum(any(p['month']==m and positive(p.get('fpe')) for p in archive[i]['monthly']) for i in ids)} for m in sorted({p['month'] for i in ids for p in archive[i]['monthly']})}
snapshot={'retrieved':ASOF,'through':THROUGH,'ids':ids,'rankingBasis':'Verified dated month-end company caps in USD, screened from the public US-listed directory; one issuer per SEC CIK.'}
rosters=[r for r in existing['rosters'] if r['retrieved']!=ASOF]+[snapshot]
meta={'name':'US-listed large caps','retrieved':ASOF,'count':1000,'currency':'USD','historyStartAdded':START,'through':THROUGH,'source':'https://stockanalysis.com/stocks/','rosterSourceCount':len(json.loads((C/'roster-raw.json').read_text())),'screenedIssuers':len(roster),'unranked':unranked,'rankingCutoffUSD':rows[-1]['rankingCap'],'rankingPolicy':snapshot['rankingBasis'],'deduplication':'One full company cap per SEC CIK; share-class caps are never summed. Canonical IDs are retained on refresh.','membershipBasis':'Current screened top 1000 applied to all months; not historical membership. Survivorship bias.','coverage':coverage,'currencyPolicy':'US-listing cap series are USD. Conflicting financial-currency API metadata is overridden only after matching dated values against the public USD market-cap page (minimum one exact-date overlap; median error <=2%). Raw metadata and validation evidence are retained. No FX conversion is applied to already-USD caps.','rankingCorrections':[{'id':c['id'],'directoryCap':c['directoryCap'],'datedCap':c['rankingCap'],'date':c['rankingDate']} for c in rows if abs(c['rankingCap']/c['directoryCap']-1)>.15]}
(APP/'data-largecaps.json').write_text(json.dumps({'meta':meta,'activeIds':ids,'rosters':rosters,'entities':list(archive.values())},separators=(',',':'),ensure_ascii=False))
print('Updated',len(ids),'active issuers;',len(archive),'archived issuers; coverage',coverage.get(THROUGH),'cutoff',meta['rankingCutoffUSD'])
