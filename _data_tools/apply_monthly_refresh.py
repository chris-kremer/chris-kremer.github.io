"""Apply verified public daily-series cache entries to specific completed months.

Cache entries contain symbol, field, URL, metadata and the final dated source
row for each requested month. Older saved observations and index rosters are
preserved. No price/current-share, annual, prior-month, or CPI proxies are made.
"""
import argparse,calendar,csv,datetime as dt,gzip,hashlib,json,math,pathlib,re,zipfile
parser=argparse.ArgumentParser();parser.add_argument('--cache',type=pathlib.Path,required=True);parser.add_argument('--retrieved',default='2026-11-02');parser.add_argument('--months',nargs='+',default=['2026-09','2026-10']);args=parser.parse_args()
APP=pathlib.Path(__file__).resolve().parents[1]/'projects/market-atlas/app';CACHE=args.cache;MONTHS=set(args.months);ASOF=args.retrieved
for month in MONTHS:
 y,m=map(int,month.split('-'));assert dt.date(y,m,calendar.monthrange(y,m)[1])<dt.date.fromisoformat(ASOF).replace(day=1)
def load(name):return json.loads((APP/name).read_text())
def write(name,data):(APP/name).write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False))
def positive(value):return isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value) and value>0
us=load('data.json');eu=load('data-europe.json');inflation=load('data-inflation.json');history=load('data-history.json')
def older_hash(entities):
 rows=[{'id':e['id'],'monthly':[p for p in e.get('monthly',[]) if p['month'] not in MONTHS]} for e in entities]
 return hashlib.sha256(json.dumps(rows,sort_keys=True,separators=(',',':')).encode()).hexdigest()
before={'companies':older_hash(us['companies']),**{k:older_hash(v) for k,v in eu['markets'].items()}}
report={'retrieved':ASOF,'requestedMonths':sorted(MONTHS),'scope':'Only the requested company-month observations and matching FX are refreshed; rosters, annual data and older saved company months remain unchanged.','sourcePolicy':'Final dated daily cap observation within three calendar days of month-end. Forward P/E must match its exact date. Missing CPI remains unavailable.','markets':{},'missing':[],'preservedSavedObservations':[],'errors':[],'sources':{'market':'https://stockanalysis.com/fundamental-chart/','fx':'https://data.ecb.europa.eu/data/datasets/EXR','additionalFX':'https://nbg.gov.ge/en/monetary-policy/currency'}}
series={}
for path in CACHE.glob('*.json.gz'):
 data=json.loads(gzip.decompress(path.read_bytes()));series[(data['symbol'],data['field'])]=data
required={(e['id'],f) for e in us['companies'] for f in ['calculated_market_cap','peForward']}
required|={(e.get('valuationSourceSymbol') or e.get('providerSymbol') or e['exchange'].upper()+'-'+e['id'],f) for rows in eu['markets'].values() for e in rows for f in ['calculated_market_cap','peForward']}
assert required<=series.keys(),f'{len(required-series.keys())} source downloads are not finished'
assert all(series[key].get('retrieved')==ASOF for key in required),'A source cache has a different retrieval date; do not mislabel old downloads as fresh'
fx={}
for row in csv.DictReader((CACHE/'ecb.csv').read_text().splitlines()):fx.setdefault(row['TIME_PERIOD'],{'EUR':1})[row['CURRENCY']]=float(row['OBS_VALUE'])
for path in CACHE.glob('gel-*.json'):
 data=json.loads(path.read_text());date=path.stem[4:]
 if data[0]['date'][:10]!=date:continue
 euro=next(r for r in data[0]['currencies'] if r['code']=='EUR')
 if euro['validFromDate'][:10]==date and date in fx:fx[date]['GEL']=euro['rate']/euro['quantity']
eu['fxRates'].update(fx)
def row_for(entity,market,month,target):
 symbol=entity['id'] if market=='companies' else entity.get('valuationSourceSymbol') or entity.get('providerSymbol') or entity['exchange'].upper()+'-'+entity['id']
 cap=series[(symbol,'calculated_market_cap')];pe=series[(symbol,'peForward')]
 for field,data in [('cap',cap),('forwardPE',pe)]:
  if data.get('error'):report['errors'].append({'market':market,'id':entity['id'],'field':field,'error':data['error']})
 point=cap.get('monthly',{}).get(month)
 if not point or not positive(point['value']):return None,'No positive dated month-end cap supplied by the current source'
 date=point['date'];y,m,day=map(int,date.split('-'))
 if date[:7]!=month or calendar.monthrange(y,m)[1]-day>3:return None,'Cap observation is too early to represent completed month-end'
 currency=cap.get('meta',{}).get('currency')
 if currency not in ['USD','EUR','GBP','GEL'] or market=='companies' and currency!='USD':return None,'Unverified or unexpected cap currency: '+str(currency)
 if currency==target:value,rate=point['value'],1
 else:
  rates=fx.get(date,{})
  if currency not in rates or target not in rates:return None,'Exact-date FX unavailable for '+currency+' to '+target
  rate=rates[target]/rates[currency];value=point['value']*rate
 pe_point=pe.get('monthly',{}).get(month);same=pe_point and pe_point['date']==date
 ratio=pe_point['value'] if same and isinstance(pe_point['value'],(int,float)) and math.isfinite(pe_point['value']) else None
 row={'month':month,'year':y,'date':date,'capDate':date,'fpeDate':date if same else None,'marketCap':value,'fpe':ratio,'revenue':None,'netIncome':None,'provider':'stockanalysis','kind':'monthly','retrieved':ASOF,'capSeriesSource':cap.get('meta',{}).get('source'),'forwardPESeriesSource':pe.get('meta',{}).get('source')}
 if market!='companies':row.update(sourceMarketCap=point['value'],sourceCurrency=currency,currency=target,fxRate=rate,fxRateSource='ECB + NBG' if currency=='GEL' else 'ECB' if currency!=target else None,fxDate=date if currency!=target else None)
 return row,None
def coverage(entities):
 out={}
 for month in sorted({p['month'] for e in entities for p in e.get('monthly',[])}):
  points=[p for e in entities for p in e.get('monthly',[]) if p['month']==month]
  out[month]={'marketCap':sum(positive(p.get('marketCap')) for p in points),'forwardPE':sum(positive(p.get('fpe')) for p in points)}
 return out
for market,entities in [('companies',us['companies']),*eu['markets'].items()]:
 target='USD' if market=='companies' else eu['meta'][market]['currency'];changed=0;dates={}
 for entity in entities:
  saved={p['month']:p for p in entity.get('monthly',[])}
  for month in sorted(MONTHS):
   row,reason=row_for(entity,market,month,target)
   if row:
    saved[month]=row;changed+=1;dates.setdefault(month,set()).add(row['date'])
   else:
    entry={'market':market,'id':entity['id'],'month':month,'reason':reason}
    if month in saved:report['preservedSavedObservations'].append({**entry,'savedDate':saved[month].get('date')})
    else:report['missing'].append(entry)
  entity['monthly']=[saved[m] for m in sorted(saved)]
 cov=coverage(entities);report['markets'][market]={'members':len(entities),'currency':target,'refreshedPoints':changed,'coverage':{m:cov.get(m,{'marketCap':0,'forwardPE':0}) for m in sorted(MONTHS)},'sourceDates':{m:sorted(v) for m,v in dates.items()}}
 assert older_hash(entities)==before[market],market+' older history changed'
 if market=='companies':
  meta=us['meta']['monthly'];meta.update(retrieved=ASOF,end=max(cov),coverage={m:{'companies':v['marketCap'],'forwardPE':v['forwardPE']} for m,v in cov.items()},refreshedMonths=sorted(MONTHS),historyWindow='Saved public five-year-window observations; older saved downloads are retained.',refreshReport='data-refresh.json')
 else:eu['meta'][market].update(dataRetrieved=ASOF,coverage=cov,refreshedMonths=sorted(MONTHS))
report['unchangedOlderCompanyHistorySHA256']=before
us['meta']['monthly']['errors']={e['market']+':'+e['id']+':'+e['field']:e['error'] for e in report['errors'] if e['market']=='companies'}
eu.update(monthlyRetrieved=ASOF,windowEnd=max(MONTHS)+'-'+str(calendar.monthrange(*map(int,max(MONTHS).split('-')))[1]),refreshReport='data-refresh.json')
# Keep the established September 2026 purchasing-power reference. Add only
# exact newly published target-month CPI observations, never a carry-forward.
source_cpi={}
for row in csv.DictReader((CACHE/'us-cpi.csv').read_text().splitlines()):
 try:value=float(row['CPIAUCNS'])
 except ValueError:continue
 source_cpi[row['observation_date'][:7]]=value
for month in MONTHS:
 if month in source_cpi and month not in inflation['observations']:inflation['observations'][month]=source_cpi[month]
inflation['retrieved']=ASOF
inflation['pendingMonths']={m:{'reason':'Not yet published in the source as of '+ASOF,**({'releaseDate':'2026-11-10','source':'https://www.bls.gov/schedule/news_release/cpi.htm'} if m=='2026-10' else {})} for m in sorted(MONTHS) if m not in inflation['observations']}
report['inflation']={'companies':{'latest':max(inflation['observations']),'unavailable':[m for m in sorted(MONTHS) if m not in inflation['observations']]}}
for market,country in [('dax','DE'),('cac','FR'),('ftse',None)]:
 if country:
  data=json.loads((CACHE/('hicp-'+country+'.json')).read_text());index=data['dimension']['time']['category']['index'];values=data['value'];points={m:values[str(i)] for m,i in index.items() if str(i) in values}
 else:
  points={dt.datetime.strptime(r[0],'%Y %b').strftime('%Y-%m'):float(r[1]) for r in csv.reader((CACHE/'ons.csv').read_text().splitlines()) if len(r)==2 and re.fullmatch(r'\d{4} [A-Z]{3}',r[0])}
 saved=eu['meta'][market]['inflation']
 for month in MONTHS:
  if month in points and month not in saved['observations']:saved['observations'][month]=points[month]
 saved['retrieved']=ASOF;saved['pendingMonths']={m:{'reason':'Not yet published in the source as of '+ASOF} for m in sorted(MONTHS) if m not in saved['observations']}
 report['inflation'][market]={'latest':max(saved['observations']),'unavailable':[m for m in sorted(MONTHS) if m not in saved['observations']]}
# The French archive is independent and may lag company data.
with zipfile.ZipFile(CACHE/'french.zip') as archive:lines=archive.read(archive.namelist()[0]).decode('utf-8-sig').splitlines()
def section(title):
 at=next(i for i,line in enumerate(lines) if line.strip()==title);headers=[v.strip() for v in lines[at+1].split(',')[1:]];rows={}
 for line in lines[at+2:]:
  if not re.match(r'^\d{6},',line):break
  values=line.split(',');rows[values[0]]={k:float(v) for k,v in zip(headers,values[1:])}
 return rows
counts=section('Number of Firms in Portfolios');sizes=section('Average Firm Size');returns=section('Average Value Weighted Returns -- Monthly')
latest=max(counts.keys()&sizes.keys());updated=0
for entity in history['longrun']['industries']:
 saved={p[0]:p for p in entity['rows']};code=entity['code']
 for month in MONTHS:
  raw=month.replace('-','')
  if raw not in counts or raw not in sizes:continue
  n=counts[raw][code];avg=sizes[raw][code]
  if n<=0 or avg<=0:continue
  ret=returns.get(raw,{}).get(code);point=[month,round(n*avg*1e6),int(n),avg,ret if ret is not None and ret>-99 else None]
  if saved.get(month)!=point:updated+=1
  saved[month]=point
 entity['rows']=[saved[m] for m in sorted(saved)]
history['longrun']['checked']=ASOF;history['longrun']['end']=max(p[0] for e in history['longrun']['industries'] for p in e['rows'])
report['longrun']={'latestSourceMonth':latest[:4]+'-'+latest[4:],'unavailable':[m for m in sorted(MONTHS) if m.replace('-','') not in counts],'updatedPoints':updated,'source':history['longrun']['source']}
report['note']='October 2026 nominal company caps and forward P/E are available where supplied. Exact October CPI is not yet published, so real caps remain unavailable without changing the selected basis. The existing explicit October 2025 CPI fallback is unchanged.'
for name,data in [('data.json',us),('data-europe.json',eu),('data-inflation.json',inflation),('data-history.json',history),('data-refresh.json',report)]:write(name,data)
print(json.dumps({'markets':report['markets'],'inflation':report['inflation'],'longrun':report['longrun'],'missing':len(report['missing']),'preserved':len(report['preservedSavedObservations']),'errors':report['errors']},indent=2))
