import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';
const root=new URL('../projects/market-atlas/app/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,root),'utf8'));
const node={addEventListener(){},querySelectorAll(){return[]}},ctx={window:{addEventListener(){}},document:{querySelector(){return {...node}},getElementById(){return {...node}},querySelectorAll(){return[]},addEventListener(){}},fetch:()=>new Promise(()=>{}),console,setTimeout,clearTimeout};vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('app.js',root),'utf8'),ctx);
const {comparisonUSD,buildComparisonData,comparisonReferenceCaps,comparisonGeometry,mergeHistoricalData,dollarObservation,monthKey,selectionForDataset}=ctx.window.MarketAtlasMath;
const p={month:'2026-09',date:'2026-09-30',capDate:'2026-09-30',marketCap:100,fpe:17,sourceMarketCap:110,sourceCurrency:'USD',fxRate:100/110};const saved=JSON.stringify(p);
const usd=comparisonUSD(p,'EUR',{'2026-09-30':{EUR:1,USD:1.12}});assert.equal(usd.marketCap,112.00000000000001);assert.equal(usd.fpe,17);assert.equal(usd.indexMarketCap,100);assert.equal(usd.indexCurrency,'EUR');assert.equal(usd.comparisonFXDate,p.capDate);assert.equal(usd.sourceMarketCap,110);assert.equal(usd.sourceCurrency,'USD');assert.ok(Math.abs(usd.sourceMarketCap*usd.fxRate-usd.marketCap)<1e-10);assert.equal(JSON.stringify(p),saved);
const gbp=comparisonUSD(p,'GBP',{'2026-09-30':{GBP:.8,USD:1.2}});assert.ok(Math.abs(gbp.marketCap-150)<1e-10);
const missing=comparisonUSD(p,'EUR',{'2026-09-29':{EUR:1,USD:1.12}});assert.equal(missing.marketCap,null);assert.equal(missing.fpe,17);assert.equal(missing.month,p.month);assert.equal(missing.comparisonFXUnavailable,true,'Never substitute a prior FX date');assert.equal(comparisonUSD(p,'USD',{}),p);
const data=mergeHistoricalData(read('data.json'),read('data-history.json')),europe=read('data-europe.json'),cpi=read('data-inflation.json');Object.assign(data,europe.markets);data.europe=europe;
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex'),before=hash([data.companies,europe]);const all=buildComparisonData(data);
assert.equal(all.length,680);assert.equal(new Set(all.map(e=>e.id)).size,680);assert.equal(all.filter(e=>e.comparisonMarket==='us').length,500);assert.equal(all.filter(e=>e.comparisonMarket==='de').length,40);assert.equal(all.filter(e=>e.comparisonMarket==='fr').length,40);assert.equal(all.filter(e=>e.comparisonMarket==='uk').length,100);
assert.ok(all.find(e=>e.id==='de:AIR')&&all.find(e=>e.id==='fr:AIR'),'Shared issuers stay independent in each index');
const totals={};let converted=0;
for(const e of all){
 const market=e.comparisonMarket,source=data[e.comparisonDataset].find(c=>c.id===e.comparisonSourceId);assert.equal(e.name,source.name);assert.deepEqual(e.symbols,source.symbols);
 for(const p of e.monthly){
  const native=source.monthly.find(n=>n.month===p.month);assert.equal(p.date,native.date);assert.equal(p.fpe,native.fpe);
  if(market!=='us'){
   const fx=europe.fxRates[p.capDate],rate=fx.USD/fx[e.comparisonCurrency];assert.equal(p.marketCap,native.marketCap>0?native.marketCap*rate:null);assert.equal(p.comparisonFXDate,p.capDate);assert.equal(p.currency,'USD');converted++;
  }
  if(p.month==='2026-10')totals[market]=(totals[market]||0)+p.marketCap;
 }
}
assert.ok(converted>10000);assert.equal(hash([data.companies,europe]),before,'Never rewrite source baskets');
const references=comparisonReferenceCaps(all,'nominal',cpi);const geometry=comparisonGeometry(Object.entries(totals).map(([key,cap])=>({key,cap,referenceCap:references[key]})),1292,620);
const us=geometry.groups.find(g=>g.key==='us');for(const group of geometry.groups){assert.ok(Math.abs((group.r/us.r)**2-totals[group.key]/totals.us)<1e-12,'All country areas use one scale');assert.ok(group.x-group.referenceR>=0&&group.x+group.referenceR<=1292);assert.ok(group.y-group.referenceR>=70&&group.y+group.referenceR<=600);}
for(let i=1;i<geometry.groups.length;i++)assert.ok(geometry.groups[i].x-geometry.groups[i].referenceR>geometry.groups[i-1].x+geometry.groups[i-1].referenceR);
const older=comparisonGeometry(Object.entries(totals).map(([key,cap])=>({key,cap:cap/4,referenceCap:references[key]})),1292,620);for(let i=0;i<4;i++){assert.equal(older.groups[i].x,geometry.groups[i].x);assert.equal(older.groups[i].r,geometry.groups[i].r/2);}
const real=comparisonReferenceCaps(all,'real',cpi);assert.ok(real.us>0&&real.de>0);for(const e of all){const p=e.monthly.find(p=>p.month==='2026-10');if(p)assert.equal(dollarObservation(p,'real',cpi).marketCap,null,'Missing October CPI does not become a nominal cap');}
const choice=selectionForDataset({frequency:'annual',year:2000,baseline:1995,color:'fpe',dollars:'real'},'compare');assert.equal(choice.frequency,'monthly');assert.equal(choice.year,2000*12);assert.equal(choice.dollars,'real');
console.log('PASS: 680 independent index slots; exact-date USD conversions; missing-FX/CPI rules; immutable source baskets; proportional country areas, fixed centers and non-touching bounds.');console.log('October USD basket caps:',totals);
