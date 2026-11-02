from pathlib import Path
import concurrent.futures,datetime as dt,gzip,json,subprocess,time
(C/'series').mkdir(exist_ok=True);r=json.loads((C/'selected-roster.json').read_text())
providers={c['id']:c.get('providerSymbol',c['id']) for c in r}
requests=[(c['id'],field) for c in r if not c.get('baseId') for field in ['calculated_market_cap','peForward']]
def fetch(item):
 symbol,field=item;p=C/'series'/f'{symbol}-{field}.json.gz';url=f'https://stockanalysis.com/_api/fundamental/timeseries/s/{providers[symbol]}/{field}?range=daily&source=fai_ratios'
 if p.exists():
  d=json.loads(gzip.decompress(p.read_bytes()))
  if not d.get('error'):return d
 for attempt in range(3):
  try:
   raw=subprocess.check_output(['curl','-fLsS','--max-time','30','--compressed',url],stderr=subprocess.PIPE);raw=json.loads(raw);assert isinstance(raw.get('data'),list)
   months={}
   for row in raw['data']:
    date=dt.datetime.fromtimestamp(row[0]/1000,dt.timezone.utc).date().isoformat();month=date[:7]
    if not START<=month<=THROUGH:continue
    if month not in months or date>months[month]['date']:months[month]={'date':date,'value':row[1]}
   result={'symbol':symbol,'field':field,'url':url,'retrieved':ASOF,'meta':raw.get('meta',{}),'monthly':months};break
  except Exception as ex:
   result={'symbol':symbol,'field':field,'url':url,'retrieved':ASOF,'error':str(ex),'monthly':{}};time.sleep(.4*(attempt+1))
 p.write_bytes(gzip.compress(json.dumps(result,separators=(',',':')).encode()));return result
results=[];print('Collecting',len(requests),'series',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 for result in pool.map(fetch,requests):
  results.append(result)
  if len(results)%50==0:print(len(results),'/',len(requests),'errors',sum('error' in x for x in results),flush=True)
(C/'series-all.json').write_text(json.dumps(results));print('Errors',[x for x in results if x.get('error')],flush=True)
