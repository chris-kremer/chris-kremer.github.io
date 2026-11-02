from pathlib import Path
import json,datetime as dt,collections
R=APP
previous=json.loads((R/'data-largecaps.json').read_text()) if (R/'data-largecaps.json').exists() else {'entities':[]}
previous_cik={c['cik'].lstrip('0'):c for c in previous['entities']}
old=json.loads((R/'data.json').read_text())['companies'];by_symbol={s:c for c in old for s in c['symbols']}
by_cik={c['cik'].lstrip('0'):c for c in old}
sector={'Basic Materials':'Materials','Communication Services':'Communication services','Consumer Discretionary':'Consumer discretionary','Consumer Staples':'Consumer staples','Consumer Cyclical':'Consumer discretionary','Consumer Defensive':'Consumer staples','Financial Services':'Financials','Healthcare':'Health care','Real Estate':'Real estate'}
rows=json.loads((C/'roster-raw.json').read_text());groups={};skipped=[]
for x in rows[:1150]:
 s=x['s'];p=C/'profiles'/f'{s}.json'
 if x.get('industry')=='Shell Companies' or '.PR' in s or s.endswith('.WI') or s=='SOMN':continue
 if s in by_symbol:
  o=by_symbol[s];c={k:o[k] for k in ['id','name','sector','industry','cik','symbols']};c['baseId']=o['id']
 else:
  if not p.exists():raise RuntimeError('Profile missing: '+s)
  p=json.loads(p.read_text());f=p['fields']
  if f.get('Stock Type') not in [None,'Common Stock','ADR']:skipped.append((s,f.get('Stock Type')));continue
  c={'id':s,'name':x['n'],'sector':sector.get(f['Sector'],f['Sector']),'industry':f['Industry'],'cik':f['CIK Code'],'symbols':[s],'sourceURL':p['url'],'profileRetrieved':p['retrieved'],'exchange':f.get('Exchange'),'country':f.get('Country')}
  if f.get('IPO Date'):
   try:c['ipoDate']=dt.datetime.strptime(f['IPO Date'],'%b %d, %Y').date().isoformat()
   except ValueError:pass
 key=c['cik'].lstrip('0')
 if key in by_cik:
  o=by_cik[key];c.update({k:o[k] for k in ['id','name','sector','industry']});c['baseId']=o['id'];c['symbols']=sorted(set(c['symbols']+o['symbols']))
 if key in groups:
  groups[key]['symbols']=sorted(set(groups[key]['symbols']+[s]));continue
 if key in previous_cik:c['id']=previous_cik[key]['id']
 c['providerSymbol']=s
 c['rankingCap']=x['marketCap'];c['rankingSymbol']=s;c['membership']='US large caps';groups[key]=c
selected=list(groups.values());assert len(selected)>=1000,len(selected)
(C/'selected-roster.json').write_text(json.dumps(selected,indent=2));print('selected',len(selected),'new',sum('baseId' not in c for c in selected),'skipped',skipped);print('types',collections.Counter(json.loads(p.read_text())['fields'].get('Stock Type') for p in (C/'profiles').glob('*.json')));print('groups',{c['id']:c['symbols'] for c in selected if len(c['symbols'])>1});print('cutoff',selected[-1]);print('missing_high',[s for s in skipped if isinstance(s,str) and next(i for i,x in enumerate(rows) if x['s']==s)<1030])
