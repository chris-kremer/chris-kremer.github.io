from pathlib import Path
import json,gzip,calendar,math,csv,re,collections

roster=json.loads((C/'roster.json').read_text());profiles=json.loads((C/'profiles-all.json').read_text());assert len(profiles)==225 and len({c['id'] for c in profiles})==225
sector={'Consumer Discretionary':'Consumer discretionary','Consumer Staples':'Consumer staples','Communication Services':'Communication services','Healthcare':'Health care','Real Estate':'Real estate'}
shorts={'7203':'Toyota','6758':'Sony','9984':'SoftBank Group','9434':'SoftBank','7974':'Nintendo','8306':'Mitsubishi UFJ','8316':'SMFG','8411':'Mizuho','6501':'Hitachi','6305':'Hitachi Construction','8035':'Tokyo Electron','6857':'Advantest','6861':'Keyence','9983':'Fast Retailing','6098':'Recruit','8001':'Itochu','8058':'Mitsubishi Corp.','8031':'Mitsui & Co.','8053':'Sumitomo Corp.','8015':'Toyota Tsusho','7267':'Honda','6367':'Daikin','4502':'Takeda','4519':'Chugai','4543':'Terumo','8766':'Tokio Marine','8750':'Daiichi Life','8309':'Sumitomo Mitsui Trust','285A':'Kioxia','5016':'JX Advanced Metals','9432':'NTT','9433':'KDDI','4063':'Shin-Etsu','6981':'Murata','4661':'Oriental Land','7733':'Olympus','4901':'Fujifilm','6701':'NEC','6702':'Fujitsu','6503':'Mitsubishi Electric','7011':'Mitsubishi Heavy','7012':'Kawasaki Heavy','9020':'JR East','9021':'JR West','9022':'JR Central','9101':'NYK Line','9104':'Mitsui O.S.K. Lines','9107':'K Line','9201':'Japan Airlines','9202':'ANA','3382':'Seven & i','6752':'Panasonic','7751':'Canon','2914':'Japan Tobacco','5020':'ENEOS','9843':'Nitori','7453':'Muji','7532':'Pan Pacific','7832':'Bandai Namco','9697':'Capcom','9766':'Konami'}
def positive(x):return isinstance(x,(int,float)) and math.isfinite(x) and x>0
rows=[];dates=set();stale=[]
for p in profiles:
 assert not p.get('error') and p['mainCurrency']=='JPY' and p['industry']!='By Industry'
 code=p['id'];source={f:json.loads(gzip.decompress((C/'series'/f'{code}-{f}.json.gz').read_bytes())) for f in ['calculated_market_cap','peForward']};cap=source['calculated_market_cap'];pe=source['peForward'];assert not cap.get('error') and not pe.get('error');assert cap['meta']['currency']=='JPY'
 monthly=[]
 for month,point in sorted(cap['monthly'].items()):
  date=point['date'];y,m,d=map(int,date.split('-'))
  if not positive(point['value']):continue
  if calendar.monthrange(y,m)[1]-d>3:stale.append({'id':code,'month':month,'date':date});continue
  q=pe['monthly'].get(month);same=q and q['date']==date;ratio=q['value'] if same and isinstance(q['value'],(int,float)) and math.isfinite(q['value']) else None
  monthly.append({'month':month,'year':y,'date':date,'capDate':date,'fpeDate':date if same else None,'marketCap':point['value'],'fpe':ratio,'sourceMarketCap':point['value'],'sourceCurrency':'JPY','currency':'JPY','fxRate':1,'fxDate':None,'fxRateSource':None,'revenue':None,'netIncome':None,'provider':'stockanalysis','kind':'monthly','retrieved':ASOF,'capSeriesSource':cap['meta'].get('source'),'forwardPESeriesSource':pe['meta'].get('source')});dates.add(date)
 entity={**p,'sector':sector.get(p['sector'],p['sector']),'symbols':[code,code+'.T','TYO:'+code],'exchange':'tyo','currency':'JPY','membership':'Nikkei 225','history':[],'monthly':monthly,'marketCapSourceURL':cap['url'],'forwardPESourceURL':pe['url'],'capSourceMetadata':cap['meta'],'forwardPESourceMetadata':pe['meta'],'sourceAvailability':'monthly history available' if monthly else 'No monthly cap supplied'}
 if code in shorts:entity['shortName']=shorts[code]
 rows.append(entity)
# Separate Japan FX records never overwrite the established European rates.
ecb={}
for r in csv.DictReader((C/'ecb.csv').read_text().splitlines()):
 if r['CURRENCY'] in ['USD','JPY']:
  try:ecb.setdefault(r['TIME_PERIOD'],{})[r['CURRENCY']]=float(r['OBS_VALUE'])
  except ValueError:pass
fed={}
for r in csv.DictReader((C/'usdjpy.csv').read_text().splitlines()):
 try:value=float(r['DEXJPUS'])
 except ValueError:continue
 if positive(value):fed[r['observation_date']]=value
usd={}
for date in sorted(dates):
 r=ecb.get(date,{})
 if positive(r.get('USD')) and positive(r.get('JPY')):usd[date]={'rate':r['USD']/r['JPY'],'source':'ECB','date':date,'usdPerEUR':r['USD'],'jpyPerEUR':r['JPY']}
 elif date in fed:usd[date]={'rate':1/fed[date],'source':'Federal Reserve H.10 / FRED DEXJPUS','date':date,'jpyPerUSD':fed[date]}
existing=json.loads((APP/'data-japan.json').read_text()) if (APP/'data-japan.json').exists() else {}
previous={c['id']:c for c in existing.get('markets',{}).get('nikkei',[])}
for c in rows:
 saved={p['month']:p for p in previous.get(c['id'],{}).get('monthly',[])};saved.update({p['month']:p for p in c['monthly']});c['monthly']=[saved[m] for m in sorted(saved)]
retired={c['id']:c for c in existing.get('archivedCompanies',[])}
retired.update({k:c for k,c in previous.items() if k not in {r['id'] for r in rows}})
usd={**existing.get('usdRates',{}),**usd}
months=sorted({p['month'] for c in rows for p in c['monthly']});coverage={m:{'marketCap':sum(any(p['month']==m for p in c['monthly']) for c in rows),'forwardPE':sum(any(p['month']==m and positive(p['fpe']) for p in c['monthly']) for c in rows),'usdCap':sum(any(p['month']==m and p['capDate'] in usd for p in c['monthly']) for c in rows)} for m in months}
cpi={}
reader=list(csv.reader((C/'japan-cpi.csv').read_bytes().decode('cp932').splitlines()));assert reader[1][1]=='All items' and reader[2][1]=='0001'
for r in reader:
 if re.fullmatch(r'\d{6}',r[0]):cpi[r[0][:4]+'-'+r[0][4:]]=float(r[1])
assert BASE in cpi,'Reference CPI month absent';inflation={'name':'Japan national all-items CPI · Statistics Bureau / e-Stat · '+str(CPI_BASE_YEAR)+'=100, not seasonally adjusted','source':CPI_URL,'retrieved':ASOF,'baseMonth':BASE,'baseIndex':cpi[BASE],'observations':cpi,'fallbacks':{},'pendingMonths':{THROUGH:{'reason':'Not published in the saved national CPI source as of '+ASOF}} if THROUGH not in cpi else {}}
meta={'name':'Nikkei 225','country':'Japan','currency':'JPY','symbol':'¥','count':225,'retrieved':ASOF,'dataRetrieved':ASOF,'rosterURL':roster['source'],'rosterAsOf':ASOF,'coverage':coverage,'frequency':'monthly','inflation':inflation,'start':min(months),'end':max(months),'weighting':'Full company market caps; not the official price-weighted Nikkei index weights.','membershipBasis':'Current Nikkei 225 members used throughout history; not historical membership.','sectorBasis':'Provider sector/industry classifications, normalized to app groups. Official Nikkei industry retained separately.','missingFX':[d for d in dates if d not in usd],'staleCapRowsExcluded':stale}
out={'meta':{'nikkei':meta},'markets':{'nikkei':rows},'usdRates':usd,'fxSources':['https://data.ecb.europa.eu/data/datasets/EXR','https://fred.stlouisfed.org/series/DEXJPUS'],'sourcePolicy':'Actual final dated daily observation within three days of completed month-end; PE must match the exact cap date. No annual/price-share/private-value or other-month substitution. JPY→USD uses exact-date ECB rates; exact-date Federal Reserve H.10 covers an ECB holiday.','retrieved':ASOF}
out['archivedCompanies']=list(retired.values());out['rosters']=[r for r in existing.get('rosters',[]) if r['retrieved']!=ASOF]+[{'retrieved':ASOF,'ids':[c['id'] for c in rows],'source':roster['source']}]
(APP/'data-japan.json').write_text(json.dumps(out,separators=(',',':'),ensure_ascii=False));print('Coverage',coverage.get(THROUGH),'FX missing',meta['missingFX'],'stale',len(stale),'reference CPI',inflation['baseIndex'])
