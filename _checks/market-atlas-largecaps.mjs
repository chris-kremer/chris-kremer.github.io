import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../projects/market-atlas/app/',import.meta.url);
const load=name=>JSON.parse(fs.readFileSync(new URL(name,root),'utf8'));
const data=load('data-largecaps.json'),us=load('data.json'),archive=load('data-history.json');
const active=data.entities.filter(c=>data.activeIds.includes(c.id));
assert.equal(active.length,1000);assert.equal(new Set(data.activeIds).size,1000);
assert.equal(new Set(active.map(c=>c.cik.replace(/^0+/,''))).size,1000,'Each issuer counts once');
for(const symbols of [['GOOG','GOOGL'],['BRK.A','BRK.B'],['FOX','FOXA'],['HEI','HEI.A']])assert.equal(active.filter(c=>symbols.some(s=>c.symbols.includes(s))).length,1);
assert.ok(active.every(c=>!c.symbols.includes('SOMN')&&!c.symbols.some(s=>s.includes('.PR')||s.endsWith('.WI'))));
assert.ok(active.every(c=>c.rankingCap>=active.at(-1).rankingCap));
assert.ok(!active.some(c=>/anthropic|openai/i.test(c.name)),'No private/pre-listing valuation mixed in');
const spcx=active.find(c=>c.id==='SPCX');assert.equal(spcx.ipoDate,'2026-06-12');
assert.deepEqual(spcx.monthly.map(p=>p.month),['2026-06','2026-07','2026-08','2026-09','2026-10']);assert.equal(spcx.monthly[0].fpe,null);
assert.equal(spcx.monthly.at(-1).marketCap,1829640902876);
const oldById=new Map(us.companies.map(c=>[c.id,c]));let checkedUnits=0;
for(const c of active){
 assert.ok(c.history.length===0,'Expanded universe is monthly only');
 assert.ok(!c.ipoDate||c.monthly.every(p=>p.capDate>=c.ipoDate));
 if(c.baseId)assert.deepEqual(c.monthly,oldById.get(c.baseId).monthly,'Reuse saved monthly history without changing the index');
 for(const p of c.monthly){
  assert.equal(p.month,p.capDate.slice(0,7));assert.ok(p.marketCap>0);assert.ok(p.month<='2026-10');
  assert.ok((Date.parse(new Date(Date.UTC(p.year,Number(p.month.slice(5)),0)).toISOString().slice(0,10))-Date.parse(p.capDate))/86400000<=3);
  if(p.fpe!=null)assert.equal(p.fpeDate,p.capDate);
  if(p.rawSeriesCurrency&&p.rawSeriesCurrency!=='USD'){assert.equal(p.sourceCurrency,'USD');assert.equal(p.marketCap,p.sourceMarketCap);assert.equal(p.fxRate,1);assert.ok(c.capCurrencyVerification.verifiedUSD);assert.ok(c.capCurrencyVerification.matchedObservations>=1);checkedUnits++;}
 }
}
assert.ok(checkedUnits>5000);assert.equal(active.filter(c=>c.monthly.some(p=>p.month==='2026-10')).length,1000);
assert.equal(active.filter(c=>c.monthly.some(p=>p.month==='2026-10'&&p.fpe>0)).length,821);
const twd=active.find(c=>c.id==='TSM').monthly.find(p=>p.month==='2026-10');assert.equal(twd.sourceCurrency,'USD');assert.equal(twd.rawSeriesCurrency,'TWD');assert.equal(twd.marketCap,1883534064175);assert.equal(twd.fxRate,1);
assert.ok(!active.some(c=>c.id==='TSAT'),'Directory outlier must be corrected with dated cap ranking');
const node={addEventListener(){},querySelectorAll(){return[];}};
const ctx={window:{addEventListener(){}},document:{querySelector(){return {...node}},getElementById(){return {...node}},querySelectorAll(){return[]},addEventListener(){}},fetch:()=>new Promise(()=>{}),console,setTimeout,clearTimeout};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('app.js',root),'utf8'),ctx);
const math=ctx.window.MarketAtlasMath;
assert.equal(math.listingStatus(spcx,'monthly',2026*12+4),'Not yet public');assert.equal(math.listingStatus(spcx,'monthly',2026*12+5),null);
assert.equal(math.listingStatus({id:'UNKNOWN'},'monthly',1984*12),null,'Missing listing date is not evidence of a later IPO');
const choice=math.selectionForDataset({frequency:'annual',year:2020,baseline:2010,color:'fpe',dollars:'real'},'largecaps');
assert.equal(choice.frequency,'monthly');assert.equal(choice.year,2020*12);assert.equal(choice.color,'fpe');assert.equal(choice.dollars,'real');
const before=JSON.stringify(us),expanded=math.mergeHistoricalData({companies:structuredClone(active)},archive,false);
assert.ok(expanded.companies.some(c=>c.monthly.some(p=>p.month<'2021-11')));assert.equal(JSON.stringify(us),before);
assert.equal(us.companies.length,500);assert.ok(!us.companies.some(c=>c.id==='SPCX'));
assert.ok(data.rosters.some(r=>r.ids.length===1000));assert.equal(data.meta.rosterSourceCount,5615);
console.log(`PASS: 1,000 unique issuers; deduplicated classes; 1000 October caps / 821 positive P/Es; ${checkedUnits} USD observations with independent unit checks; SpaceX listing boundary; source currency metadata checks; independent S&P roster and preserved history.`);
