import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../projects/market-atlas/app/',import.meta.url);
const node={addEventListener(){},querySelectorAll(){return[];}};
const ctx={window:{addEventListener(){}},document:{querySelector(){return {...node}},getElementById(){return {...node}},querySelectorAll(){return[]},addEventListener(){}},fetch:()=>new Promise(()=>{}),console,setTimeout,clearTimeout};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('lib/d3.min.js',root),'utf8'),ctx);vm.runInContext(fs.readFileSync(new URL('app.js',root),'utf8'),ctx);
const {groupIndustryCaps,packIndustryClusters,companyPieSlices,circleLabelBox}=ctx.window.MarketAtlasMath;
const items=[
 {id:'A',name:'A',industry:'Software',sector:'Technology',cap:60},
 {id:'B',name:'B',industry:'Software',sector:'Technology',cap:40},
 {id:'C',name:'C',industry:'Chips',sector:'Technology',cap:25},
 {id:'D',name:'D',industry:'Banks',sector:'Financials',cap:50},
 {id:'E',name:'E',industry:'Insurance',sector:'Financials',cap:10},
 {id:'F',name:'F',industry:'Oil',sector:'Energy',cap:30},
 {id:'G',name:'G',industry:'Missing',sector:'Energy',cap:null}
];
const groups=groupIndustryCaps(items,e=>e.cap);
assert.equal(groups.reduce((n,g)=>n+g.cap,0),215);
const software=groups.find(g=>g.name==='Software');assert.equal(software.cap,100);
const arcs=companyPieSlices(software.members,20);
assert.ok(Math.abs((arcs[0].endAngle-arcs[0].startAngle)/(Math.PI*2)-.6)<1e-12);
assert.ok(Math.abs(arcs.at(-1).endAngle-Math.PI*2)<1e-12);
for(const [width,height] of [[1280,600],[700,530],[360,480]]){
 const layout=packIndustryClusters(groups,width,height);
 assert.equal(layout.industries.length,5,'Missing caps must create no area');
 for(const disk of layout.industries){
  assert.ok(Math.abs(disk.r*disk.r/disk.cap-layout.capScale**2)<1e-9,'All industries must share a cap-to-area scale');
  assert.ok(disk.x-disk.r>=-1e-8&&disk.x+disk.r<=width+1e-8&&disk.y-disk.r>=-1e-8&&disk.y+disk.r<=height+1e-8);
  const sector=layout.sectors.find(s=>s.name===disk.sector);
  assert.ok(Math.hypot(disk.x-sector.x,disk.y-sector.y)+disk.r<=sector.r+1e-8);
 }
 for(let i=0;i<layout.sectors.length;i++)for(let j=0;j<i;j++){
  const a=layout.sectors[i],b=layout.sectors[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>a.r+b.r,'Sector clusters must not touch');
 }
 for(let i=0;i<layout.industries.length;i++)for(let j=0;j<i;j++){
  const a=layout.industries[i],b=layout.industries[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>a.r+b.r,'Industry circles must not touch');
 }
}
for(const angle of [.04,Math.PI/6,Math.PI,1.5*Math.PI,2*Math.PI]){
 const box=circleLabelBox(0,angle,100);
 for(const dx of [-box.side/2,box.side/2])for(const dy of [-box.side/2,box.side/2]){
  const x=box.x+dx,y=box.y+dy;assert.ok(Math.hypot(x,y)<=100+1e-8,'Labels must stay inside the circle');
  if(angle<2*Math.PI){const a=(Math.atan2(x,-y)+2*Math.PI)%(2*Math.PI);assert.ok(a<=angle+1e-8,'Labels must stay inside their company slice');}
 }
}
const archive=groupIndustryCaps(items.slice(0,2),e=>e.cap,false);assert.equal(archive.length,2,'Industry-only data must not invent company breakdowns');
console.log('PASS: circle/slice areas preserve cap ratios, sector and industry circles remain separated and bounded, missing caps have no area, and label boxes stay inside slices.');
