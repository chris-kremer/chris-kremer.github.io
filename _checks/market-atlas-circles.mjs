import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../projects/market-atlas/app/',import.meta.url);
const node={addEventListener(){},querySelectorAll(){return[];}};
const ctx={window:{addEventListener(){}},document:{querySelector(){return {...node}},getElementById(){return {...node}},querySelectorAll(){return[]},addEventListener(){}},fetch:()=>new Promise(()=>{}),console,setTimeout,clearTimeout};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('lib/d3.min.js',root),'utf8'),ctx);vm.runInContext(fs.readFileSync(new URL('app.js',root),'utf8'),ctx);
const {groupSectorCaps,packSectorCircles,sectorShelfLayout,groupSmallSlices,sizeSectorCircles,companyPieSlices,circleLabelBox}=ctx.window.MarketAtlasMath;
const items=[
 {id:'A',name:'A',industry:'Software',sector:'Technology',cap:60},
 {id:'B',name:'B',industry:'Software',sector:'Technology',cap:40},
 {id:'C',name:'C',industry:'Chips',sector:'Technology',cap:25},
 {id:'D',name:'D',industry:'Banks',sector:'Financials',cap:50},
 {id:'E',name:'E',industry:'Insurance',sector:'Financials',cap:10},
 {id:'F',name:'F',industry:'Oil',sector:'Energy',cap:30},
 {id:'G',name:'G',industry:'Missing',sector:'Utilities',cap:null}
];
const groups=groupSectorCaps(items,e=>e.cap);
assert.equal(groups.reduce((n,g)=>n+g.cap,0),215);
const tech=groups.find(g=>g.name==='Technology');assert.equal(tech.cap,125);
const arcs=companyPieSlices(tech.members,20);
assert.ok(Math.abs((arcs[0].endAngle-arcs[0].startAngle)/(Math.PI*2)-60/125)<1e-12);
assert.ok(Math.abs(arcs.at(-1).endAngle-Math.PI*2)<1e-12);
for(const [width,height] of [[1280,600],[700,530],[360,480]]){
 const layout=packSectorCircles(groups,width,height);
 assert.equal(layout.sectors.length,3,'Missing sector caps must create no area');
 assert.ok(layout.capScale>=sectorShelfLayout(groups,width,height).capScale,'Densification must never shrink the circles');
 for(const disk of layout.sectors){
  assert.ok(Math.abs(disk.r*disk.r/disk.cap-layout.capScale**2)<1e-9,'All sectors must share a cap-to-area scale');
  assert.ok(disk.x-disk.r>=-1e-8&&disk.x+disk.r<=width+1e-8&&disk.y-disk.r>=-1e-8&&disk.y+disk.r<=height+1e-8);
 }
 for(let i=0;i<layout.sectors.length;i++)for(let j=0;j<i;j++){
  const a=layout.sectors[i],b=layout.sectors[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>a.r+b.r,'Sector circles must not touch');
 }
 const smaller=sizeSectorCircles(layout,groupSectorCaps(items,e=>e.cap/4));
 for(const disk of smaller){
  const original=layout.sectors.find(s=>s.key===disk.key);
  assert.equal(disk.x,original.x);assert.equal(disk.y,original.y);
  assert.ok(Math.abs(disk.r/original.r-.5)<1e-12,'Quarter the cap must halve the radius');
 }
}
const marketCaps=[26.7,7.49,6.46,3.4,8.11,6.35,5.44,2.28,1.09,1.25,1.13];
const market=marketCaps.map((cap,i)=>({key:String(i),name:'Sector '+i,cap,members:[]}));
const roomy=packSectorCircles(market,1260,590),shelves=sectorShelfLayout(market,1260,590);
assert.ok(roomy.capScale>shelves.capScale*1.25,'The 11-sector map should make every circle substantially larger');
assert.equal(JSON.stringify(roomy),JSON.stringify(packSectorCircles(market,1260,590)),'Reference packing must be deterministic');
const detailed=[{entity:{id:'LEADER'},cap:90},...Array.from({length:10},(_,i)=>({entity:{id:'SMALL'+i},cap:1})),{entity:{id:'MISSING'},cap:null}];
const snapshot=JSON.stringify(detailed),grouped=groupSmallSlices(detailed,'Technology'),other=grouped.find(m=>m.isOther);
assert.equal(grouped.length,2);assert.equal(other.cap,10);assert.equal(other.children.length,10);
assert.equal(grouped.reduce((n,m)=>n+m.cap,0),100,'Other must preserve the entire sector total');
assert.equal(JSON.stringify(detailed),snapshot,'Grouping must never mutate source entities or observations');
assert.ok(groupSmallSlices([{entity:{id:'A'},cap:98},{entity:{id:'B'},cap:2}],'Sector').every(m=>!m.isOther),'A slice exactly at 2% must remain separate');
assert.equal(groupSmallSlices([{entity:{id:'A'},cap:null}],'Sector').length,0,'Missing caps are not added to Other');
assert.equal(other.entity.history.length,0,'Other must not invent a valuation history');
assert.ok(Math.abs(companyPieSlices(grouped,20).at(-1).value/100-.1)<1e-12);
for(const angle of [.04,Math.PI/6,Math.PI,1.5*Math.PI,2*Math.PI]){
 const box=circleLabelBox(0,angle,100);
 for(const dx of [-box.side/2,box.side/2])for(const dy of [-box.side/2,box.side/2]){
  const x=box.x+dx,y=box.y+dy;assert.ok(Math.hypot(x,y)<=100+1e-8,'Labels must stay inside the circle');
  if(angle<2*Math.PI){const a=(Math.atan2(x,-y)+2*Math.PI)%(2*Math.PI);assert.ok(a<=angle+1e-8,'Labels must stay inside their company slice');}
 }
}
const archive=groupSectorCaps(items.slice(0,2),e=>e.cap);assert.equal(archive.length,1);assert.equal(archive[0].members.length,2,'Known industry observations become slices; no company breakdown is invented');
console.log('PASS: sector areas and slice areas preserve cap ratios, circles stay separated and bounded, dated caps change radii at fixed centers, Other preserves source totals without synthetic valuations, and labels remain inside their slices.');
