from pathlib import Path
import json,gzip,subprocess,concurrent.futures,re,time,datetime as dt
from bs4 import BeautifulSoup
(C/'profiles').mkdir(exist_ok=True);(C/'series').mkdir(exist_ok=True);roster=json.loads((C/'roster.json').read_text())['companies']
def fetch_profile(c):
 symbol=c['id'];p=C/'profiles'/f'{symbol}.json';url=f'https://stockanalysis.com/quote/tyo/{symbol}/'
 if p.exists() and json.loads(p.read_text()).get('industry')!='By Industry':return json.loads(p.read_text())
 for attempt in range(3):
  try:
   raw=subprocess.check_output(['curl','-fsSL','--compressed','--max-time','30',url],stderr=subprocess.PIPE).decode();soup=BeautifulSoup(raw,'html.parser')
   uid=re.search(r'uid:"(TYO-[^"]+)"',raw).group(1);assert uid=='TYO-'+symbol
   name=re.search(r'nameFull:"([^"]+)"',raw).group(1);main=re.search(r'curr:\{main:"([A-Z]+)"',raw).group(1)
   fields={}
   # The overview labels link to the provider sector/industry directories.
   industrylink=soup.select_one('a[href^="/stocks/industry/"]:not([href="/stocks/industry/"])');sectorlink=soup.select_one('a[href*="/sector/"]')
   sector=sectorlink.get_text(' ',strip=True) if sectorlink else None;industry=industrylink.get_text(' ',strip=True) if industrylink else None
   if not sector or not industry:
    profile=subprocess.check_output(['curl','-fsSL','--compressed','--max-time','30',url+'company/'],stderr=subprocess.PIPE).decode();bs=BeautifulSoup(profile,'html.parser')
    for tr in bs.select('tr'):
     cells=[c.get_text(' ',strip=True) for c in tr.select('td')]
     if len(cells)==2:fields[cells[0]]=cells[1]
    sector=fields.get('Sector');industry=fields.get('Industry')
   assert sector and industry
   result={**c,'name':name,'providerSymbol':uid,'sourceURL':url,'profileRetrieved':ASOF,'mainCurrency':main,'sector':sector,'industry':industry};p.write_text(json.dumps(result,ensure_ascii=False));return result
  except Exception as e:err=str(e);time.sleep(.3*(attempt+1))
 return {**c,'error':err}
def series(item):
 code,field=item;p=C/'series'/f'{code}-{field}.json.gz';url=f'https://stockanalysis.com/_api/fundamental/timeseries/s/TYO-{code}/{field}?range=daily&source=fai_ratios'
 if p.exists():
  saved=json.loads(gzip.decompress(p.read_bytes()))
  if not saved.get('error'):return saved
 for attempt in range(3):
  try:
   raw=json.loads(subprocess.check_output(['curl','-fsSL','--compressed','--max-time','30',url],stderr=subprocess.PIPE));assert isinstance(raw.get('data'),list)
   months={}
   for row in raw['data']:
    date=dt.datetime.fromtimestamp(row[0]/1000,dt.timezone.utc).date().isoformat();month=date[:7]
    if not START<=month<=THROUGH:continue
    if month not in months or date>months[month]['date']:months[month]={'date':date,'value':row[1]}
   result={'symbol':code,'field':field,'retrieved':ASOF,'url':url,'meta':raw.get('meta',{}),'monthly':months};break
  except Exception as e:result={'symbol':code,'field':field,'url':url,'error':str(e),'monthly':{}};time.sleep(.3*(attempt+1))
 p.write_bytes(gzip.compress(json.dumps(result,separators=(',',':')).encode()));return result
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 profiles=[]
 for i,r in enumerate(pool.map(fetch_profile,roster),1):
  profiles.append(r)
  if i%50==0:print('Profiles',i,'/',len(roster),'errors',sum('error' in r for r in profiles),flush=True)
(C/'profiles-all.json').write_text(json.dumps(profiles,ensure_ascii=False));print('profile errors',[r for r in profiles if 'error' in r],flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 results=[]
 for i,r in enumerate(pool.map(series,[(c['id'],f) for c in roster for f in ['calculated_market_cap','peForward']]),1):
  results.append(r)
  if i%50==0:print('Series',i,'/',len(roster)*2,'errors',sum('error' in r for r in results),flush=True)
print('series errors',[r for r in results if 'error' in r],flush=True)
