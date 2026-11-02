from pathlib import Path
from bs4 import BeautifulSoup
import json,gzip,subprocess,concurrent.futures,time
ROOT=APP;(C/'profiles').mkdir(exist_ok=True)
r=json.loads((C/'roster-raw.json').read_text());old={s:c for c in json.loads((ROOT/'data.json').read_text())['companies'] for s in c['symbols']}
candidates=[x for x in r[:1150] if x['s'] not in old and x.get('industry')!='Shell Companies' and '.PR' not in x['s'] and not x['s'].endswith('.WI') and x['s']!='SOMN']
def fetch(x):
 symbol=x['s'];p=C/'profiles'/f'{symbol}.json';url=f'https://stockanalysis.com/stocks/{symbol.lower()}/company/'
 if p.exists():return json.loads(p.read_text())
 for attempt in range(3):
  try:
   raw=subprocess.check_output(['curl','-fsSL','--max-time','30','--compressed',url],stderr=subprocess.PIPE)
   soup=BeautifulSoup(raw,'html.parser');fields={}
   for tr in soup.select('tr'):
    cells=[c.get_text(' ',strip=True) for c in tr.select('td')]
    if len(cells)==2:fields[cells[0]]=cells[1]
   assert fields.get('Ticker Symbol')==symbol,(symbol,fields.get('Ticker Symbol'))
   assert fields.get('Sector') and fields.get('CIK Code'),symbol
   result={'symbol':symbol,'url':url,'retrieved':ASOF,'fields':fields};p.write_text(json.dumps(result));return result
  except Exception as ex:
   err=str(ex);time.sleep(.5*(attempt+1))
 return {'symbol':symbol,'error':err}
print('Profiles to collect',len(candidates),flush=True)
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 for x in pool.map(fetch,candidates):
  results.append(x)
  if len(results)%50==0:print(len(results),'/',len(candidates),'errors',sum('error' in x for x in results),flush=True)
(C/'profiles-all.json').write_text(json.dumps(results));errors=[x for x in results if 'error' in x];assert not errors,errors
