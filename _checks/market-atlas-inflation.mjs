import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../projects/market-atlas/app/',import.meta.url);
const load=name=>JSON.parse(fs.readFileSync(new URL(name,root),'utf8'));
const series=load('data-inflation.json');
const node={addEventListener(){},querySelectorAll(){return[];}};
const ctx={window:{addEventListener(){}},document:{getElementById(){return {...node}},querySelectorAll(){return[]},addEventListener(){}},fetch:()=>new Promise(()=>{}),console,setTimeout,clearTimeout};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('app.js',root),'utf8'),ctx);
const {inflationPoint,dollarObservation}=ctx.window.MarketAtlasMath;
assert.ok(!('2025-10' in series.observations),'The unavailable official CPI must remain absent');
const sample={month:'2025-10',year:2025,date:'2025-10-31',capDate:'2025-10-31',marketCap:100,fpe:15};
const copy=JSON.stringify(sample),point=inflationPoint(sample,series),adjusted=dollarObservation(sample,'real',series);
assert.equal(point.month,'2025-09');assert.equal(point.observationMonth,'2025-10');assert.equal(point.proxy,true);assert.equal(point.index,324.8);
assert.ok(Math.abs(adjusted.marketCap-100*series.baseIndex/324.8)<1e-10);
assert.equal(adjusted.month,'2025-10');assert.equal(adjusted.date,sample.date);assert.equal(adjusted.fpe,15);assert.equal(adjusted.cpiMonth,'2025-09');assert.equal(adjusted.cpiObservationMonth,'2025-10');assert.equal(adjusted.cpiProxy,true);assert.equal(JSON.stringify(sample),copy,'Never overwrite source market data');
assert.equal(dollarObservation(sample,'nominal',series),sample,'Nominal data must not change');
for(const month of ['2025-09','2025-11'])assert.equal(inflationPoint({month},series).proxy,false);
assert.equal(inflationPoint({month:'2026-10'},series),null,'Do not extrapolate other missing months');
assert.equal(inflationPoint({month:'1900-01'},series),null,'Do not fill pre-source history');
const noPolicy={...series,fallbacks:{}};assert.equal(inflationPoint(sample,noPolicy),null,'A fallback must be explicitly configured');
const laterSource={...series,observations:{...series.observations,'2025-10':325}};assert.equal(inflationPoint(sample,laterSource).proxy,false,'Actual CPI takes priority over any proxy');
const companies=load('data.json').companies;let count=0;
for(const e of companies){const p=e.monthly.find(p=>p.month==='2025-10');if(!p)continue;const a=dollarObservation(p,'real',series);assert.ok(a.marketCap>0);assert.equal(a.cpiProxy,true);assert.equal(a.fpe,p.fpe);assert.equal(a.date,p.date);assert.equal(a.marketCap,p.marketCap*series.baseIndex/series.observations['2025-09']);count++;}
assert.equal(count,498);
for(const [key,meta] of Object.entries(load('data-europe.json').meta)){
 const p=inflationPoint(sample,meta.inflation);assert.equal(p.month,'2025-10',key+' must keep its own October CPI');assert.equal(p.proxy,false);
}
console.log('PASS: October uses an explicit September US CPI proxy; actual market data, adjacent months, European CPI, missing-date rules, and export provenance are preserved.');
