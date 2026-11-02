from pathlib import Path
import concurrent.futures,subprocess,json5,json,re

def fetch(i):
 p=C/f'stocks-{i}.html'
 if not p.exists():p.write_bytes(subprocess.check_output(['curl','-fsSL','--max-time','40',f'https://stockanalysis.com/stocks/?page={i}']))
 s=p.read_text();k=s.index('defaultCount:500,data:')+len('defaultCount:500,data:');return json5.loads(s[k:s.index('],',k)+1])
first=fetch(1);html=(C/'stocks-1.html').read_text();count=int(re.search(r'resultsCount:(\d+)',html).group(1))
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:r=first+[x for a in pool.map(fetch,range(2,(count+499)//500+1)) for x in a]
assert len({x['s'] for x in r})==count
r.sort(key=lambda x:x.get('marketCap') or 0,reverse=True)
(C/'roster-raw.json').write_text(json.dumps(r))
print(len(r),r[:5],r[999:1002])
