from pathlib import Path
import gzip,json,json5,re,statistics,subprocess,concurrent.futures
(C/'unit-checks').mkdir(exist_ok=True);r=json.loads((C/'selected-roster.json').read_text())
def check(c):
 symbol=c['id'];series=C/'series'/f'{symbol}-calculated_market_cap.json.gz'
 if c.get('baseId') or not series.exists():return None
 d=json.loads(gzip.decompress(series.read_bytes()))
 if d.get('meta',{}).get('currency')=='USD':return None
 p=C/'unit-checks'/f'{symbol}.json'
 if p.exists() and json.loads(p.read_text()).get('verifiedUSD'):return json.loads(p.read_text())
 url=f"https://stockanalysis.com/stocks/{c.get('providerSymbol',symbol).lower()}/market-cap/"
 try:
  raw=subprocess.check_output(['curl','-fsSL','--max-time','30','--compressed',url],stderr=subprocess.PIPE).decode();currency=re.search(r'curr:\{main:"([A-Z]+)"',raw).group(1)
  at=raw.rindex('monthly:[')+8;monthly=json5.loads(raw[at:raw.index('],quarterly:',at)+1]);table={p['d']:p['v'] for p in monthly if isinstance(p['v'],(int,float))};pairs=[]
  for point in d['monthly'].values():
   if point['date'] in table and table[point['date']]>0 and isinstance(point['value'],(int,float)):pairs.append({'date':point['date'],'series':point['value'],'page':table[point['date']],'relativeDifference':point['value']/table[point['date']]-1})
  result={'symbol':symbol,'sourceURL':url,'mainCurrency':currency,'apiMetadata':d['meta'],'matchedObservations':len(pairs),'medianRelativeError':statistics.median(abs(x['relativeDifference']) for x in pairs) if pairs else None,'pairs':pairs}
  result['verifiedUSD']=currency=='USD' and len(pairs)>=1 and result['medianRelativeError']<=.02
 except Exception as ex:result={'symbol':symbol,'sourceURL':url,'verifiedUSD':False,'error':str(ex)}
 p.write_text(json.dumps(result));return result
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:checks=[x for x in pool.map(check,r) if x]
print('Unit checks',len(checks),'failed',[{k:v for k,v in x.items() if k!='pairs'} for x in checks if not x['verifiedUSD']],flush=True)
(C/'unit-checks-all.json').write_text(json.dumps(checks))
