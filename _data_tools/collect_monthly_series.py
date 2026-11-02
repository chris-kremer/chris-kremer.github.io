"""Collect only requested dated months from public free-window chart series.

Never reuses a cache from a different retrieval date or requested-month set.
"""
import argparse,concurrent.futures,datetime as dt,gzip,json,pathlib,subprocess,time,sys
parser=argparse.ArgumentParser();parser.add_argument('--cache',type=pathlib.Path,required=True);parser.add_argument('--retrieved',required=True);parser.add_argument('--months',nargs='+',required=True);parser.add_argument('--workers',type=int,default=3);parser.add_argument('--eu',action='store_true');args=parser.parse_args()
ROOT=pathlib.Path(__file__).resolve().parents[1]/'projects/market-atlas/app'
CACHE=args.cache;CACHE.mkdir(parents=True,exist_ok=True)
data=json.loads((ROOT/'data.json').read_text());europe=json.loads((ROOT/'data-europe.json').read_text())
requests={}
for company in data['companies']:
 for field in ['calculated_market_cap','peForward']:
  url=f"https://stockanalysis.com/_api/fundamental/timeseries/s/{company['id']}/{field}?range=daily&source=fai_ratios"
  requests[(company['id'],field)]=url
for rows in europe['markets'].values():
 for company in rows:
  for field,key in [('calculated_market_cap','marketCapSourceURL'),('peForward','forwardPESourceURL')]:
   symbol=company.get('valuationSourceSymbol') or company.get('providerSymbol') or company['exchange'].upper()+'-'+company['id']
   requests[(symbol,field)]=company.get(key) or f'https://stockanalysis.com/_api/fundamental/timeseries/s/{symbol}/{field}?range=daily&source=fai_ratios'
if args.eu:
 europe_symbols={c.get('valuationSourceSymbol') or c.get('providerSymbol') or c['exchange'].upper()+'-'+c['id'] for rows in europe['markets'].values() for c in rows}
 requests={key:url for key,url in requests.items() if key[0] in europe_symbols}
def fetch(item):
 (symbol,field),url=item;path=CACHE/(symbol+'-'+field+'.json.gz')
 if path.exists():
  try:
   saved=json.loads(gzip.decompress(path.read_bytes()))
   if saved.get('retrieved')==args.retrieved and saved.get('requestedMonths')==sorted(args.months) and not saved.get('error'):return saved
  except Exception:pass
 result=None
 for attempt in range(3):
  response=subprocess.run(['curl','-fLsS','--max-time','25','--compressed',url],capture_output=True)
  try:
   if response.returncode:raise RuntimeError(response.stderr.decode()[:160])
   raw=json.loads(response.stdout)
   if not isinstance(raw,dict) or not isinstance(raw.get('data'),list):raise ValueError('No daily data array')
   monthly={};latest=None
   for row in raw['data']:
    date=dt.datetime.fromtimestamp(row[0]/1000,dt.timezone.utc).date().isoformat()
    if latest is None or date>latest:latest=date
    if date[:7] in args.months and (date[:7] not in monthly or date>monthly[date[:7]]['date']):monthly[date[:7]]={'date':date,'value':row[1]}
   result={'symbol':symbol,'field':field,'url':url,'retrieved':args.retrieved,'requestedMonths':sorted(args.months),'latestSourceDate':latest,'meta':raw.get('meta',{}),'monthly':monthly}
   break
  except Exception as error:
   result={'symbol':symbol,'field':field,'url':url,'retrieved':args.retrieved,'requestedMonths':sorted(args.months),'error':str(error),'monthly':{}}
   time.sleep(.5*(attempt+1))
 path.write_bytes(gzip.compress(json.dumps(result,separators=(',',':')).encode()))
 time.sleep(.1)
 return result
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(6,args.workers))) as pool:
 for i,result in enumerate(pool.map(fetch,requests.items()),1):
  results.append(result)
  if i%50==0:print(f'{i}/{len(requests)} series · errors {sum(bool(x.get("error")) for x in results)}',flush=True)
(CACHE/('collection-europe.json' if args.eu else 'collection.json')).write_text(json.dumps(results,separators=(',',':')))
print(json.dumps({'series':len(results),'errors':[x for x in results if x.get('error')]}),flush=True)
