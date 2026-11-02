/* Market Time Lapse. All calculations use dated observations; missing years stay missing. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const palettes = {
 atlas:{colors:['#2d7564','#4c8261','#718b5e','#99945e','#ad805b','#ae6555','#a54e4b'],missing:'#47554f'},
 finviz:{colors:['#30cc5a','#2f9e4f','#35764e','#414554','#8b444e','#bf4045','#f63538'],missing:'#4b5261'}
};
let colors = palettes.atlas.colors, missingColor = palettes.atlas.missing;
const sectors = ['Technology','Communication services','Consumer discretionary','Consumer staples','Financials','Health care','Industrials','Energy','Materials','Utilities','Real estate'];
const sectorColors=['#547fa3','#9b718e','#b58959','#7c945c','#5c9295','#a37665','#8189a5','#a38c4c','#7a987d','#64888c','#947a9c','#77827b'];
const industryMode=()=>['industries','longrun','spIndustries'].includes(state.dataset);
const europeanDataset=()=>['dax','cac','ftse'].includes(state.dataset);
const companyMode=()=>['companies','largecaps','compare'].includes(state.dataset)||europeanDataset();
const marketInfo=()=>europeanDataset()?db.europe.meta[state.dataset]:{name:state.dataset==='compare'?'Country baskets':state.dataset==='largecaps'?'US-listed large caps':'S&P 500',currency:'USD',symbol:'$'};
const inflationSeries=()=>europeanDataset()?db.europe.meta[state.dataset].inflation:db.inflation;
const sectorRank=name=>sectors.includes(name)?sectors.indexOf(name):sectors.length;
const state = {dataset:'largecaps',frequency:'monthly',dollars:'nominal',scale:'absolute',palette:'atlas',labels:'ticker',layout:'treemap',year:24321,baseline:24261,sector:'All sectors',industry:null,query:'',color:'fpe',selected:'MSFT',historyMetric:'fpe'};
let db, mapLayoutCache=null, resizeTimer, framesCache = new Map(), peakCache = new Map(), observationCache = new WeakMap(), searchIndex = -1, viewNotice = "", noticeSignature = "", availabilityCache = new Map();
const esc = text => String(text ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validPE = v => Number.isFinite(v) && v > 0;
const currency = v => !Number.isFinite(v) ? '—' : marketInfo().symbol+(v>=1e12?(v/1e12).toFixed(2)+'T':v>=1e9?(v/1e9).toFixed(v>=1e11?0:1)+'B':(v/1e6).toFixed(0)+'M');
const multiple = v => validPE(v) ? (v>=100?v.toFixed(0):v.toFixed(1))+'×' : '—';
const pct = (v,d=1) => Number.isFinite(v) ? (v>0?'+':'')+v.toFixed(d)+'%' : '—';
const peColor = v => validPE(v) ? colors[d3.bisectRight([10,15,20,30,40,60],v)] : missingColor;
const percentile = (values,v) => values.length>=2 && Number.isFinite(v) ? 100*(values.filter(x=>x<v).length + .5*values.filter(x=>x===v).length)/values.length : null;
const change = (a,b) => Number.isFinite(a) && Number.isFinite(b) && b>0 ? (a/b-1)*100 : null;
const cagr = (end,start,n) => Number.isFinite(end) && Number.isFinite(start) && end>0 && start>0 && n>0 ? (Math.pow(end/start,1/n)-1)*100 : null;
const monthKey = month => {const [y,m]=month.split('-').map(Number);return y*12+m-1;};
const monthString = key => `${Math.floor(key/12)}-${String(key%12+1).padStart(2,'0')}`;
const monthlyMode = () => state.frequency==='monthly';
const emptyHistory=[];
const historyOf = entity => monthlyMode() ? (entity.monthly||emptyHistory) : entity.history;
const frameKey = h => monthlyMode() ? monthKey(h.month) : h.year;
const rawObservation = (entity,year=state.year) => {const rows=historyOf(entity);if(!observationCache.has(rows))observationCache.set(rows,new Map(rows.map(h=>[frameKey(h),h])));return observationCache.get(rows).get(Number(year));};
const observation = (entity,year=state.year) => displayedObservation(rawObservation(entity,year));
const entities = () => {if(state.dataset==='spIndustries'&&!db.spIndustries)db.spIndustries=aggregateCompanyIndustries(db.companies);if(state.dataset==='compare'&&!db.compare)db.compare=buildComparisonData(db);return db[state.dataset] || [];};
const universe = () => entities().filter(e=>(state.sector==='All sectors'||e.sector===state.sector)&&(!state.industry||e.industry===state.industry));
const matches = (e,q=state.query) => !q || [e.id,e.name,companyShortName(e),e.comparisonCountry,e.comparisonName,e.sector,e.industry,...(e.symbols||[])].join(' ').toLowerCase().includes(q.trim().toLowerCase());
function timelineFrames(items,frequency,requested){
 const monthly=frequency==='monthly',values=items.flatMap(e=>(monthly?e.monthly||[]:e.history||[]).map(p=>monthly?monthKey(p.month):p.year));
 if(Number.isInteger(requested))values.push(requested);
 if(!values.length)return [];
 let lo=Infinity,hi=-Infinity;for(const v of values){lo=Math.min(lo,v);hi=Math.max(hi,v);}
 return Array.from({length:hi-lo+1},(_,i)=>lo+i);
}
const years = () => {const key=state.dataset+'|'+state.frequency;if(!framesCache.has(key))framesCache.set(key,timelineFrames(entities(),state.frequency,state.year));return framesCache.get(key);};
function selectionForDataset(current,dataset){
 const frequency=dataset==='industries'?'annual':['longrun','spIndustries','largecaps','compare','dax','cac','ftse'].includes(dataset)?'monthly':current.frequency;
 const convert=v=>!Number.isFinite(v)?v:current.frequency===frequency?v:frequency==='monthly'?v*12:Math.floor(v/12);
 return {...current,dataset,frequency,year:convert(current.year),baseline:convert(current.baseline)};
}
function listingStatus(entity,frequency,frame){
 const month=frequency==='monthly'?monthString(frame):String(frame)+'-12';
 return entity.ipoDate&&month<entity.ipoDate.slice(0,7)?'Not yet public':null;
}
function coverageWindow(items,frequency,metric){
 const monthly=frequency==='monthly';let first=Infinity,last=-Infinity,count=0;
 for(const e of items)for(const p of (monthly?e.monthly||[]:e.history||[]))if(validPE(p[metric])){const frame=monthly?monthKey(p.month):p.year;first=Math.min(first,frame);last=Math.max(last,frame);count++;}
 return count?{first,last,count}:null;
}
function aggregateCompanyIndustries(companies){
 const groups=new Map();
 for(const company of companies){
  const key=company.sector+'|'+company.industry;
  if(!groups.has(key))groups.set(key,{id:'SPIND:'+key,name:company.industry,sector:company.sector,industry:company.industry,members:[],symbols:[],periods:new Map()});
  const group=groups.get(key);group.members.push(company.id);group.symbols.push(...(company.symbols||[company.id]));
  for(const p of company.monthly||[]){
   if(!Number.isFinite(p.marketCap)||p.marketCap<=0)continue;
   if(!group.periods.has(p.month))group.periods.set(p.month,[]);
   group.periods.get(p.month).push(p);
  }
 }
 return [...groups.values()].map(group=>{
  const monthly=[...group.periods].sort(([a],[b])=>a.localeCompare(b)).map(([month,rows])=>{
   const marketCap=rows.reduce((sum,p)=>sum+p.marketCap,0),covered=rows.filter(p=>validPE(p.fpe)),coveredCap=covered.reduce((sum,p)=>sum+p.marketCap,0),earnings=covered.reduce((sum,p)=>sum+p.marketCap/p.fpe,0);
   const dates=[...new Set(rows.map(p=>p.capDate||p.date).filter(Boolean))].sort(),date=dates.length===1&&rows.every(p=>p.capDate||p.date)?dates[0]:null;
   return {month,year:+month.slice(0,4),date,capDate:date,fpeDate:date,sourceDateFrom:dates[0]||null,sourceDateTo:dates.at(-1)||null,marketCap,fpe:earnings>0?coveredCap/earnings:null,pe:null,revenue:null,netIncome:null,memberCount:rows.length,memberTotal:group.members.length,fpeMemberCount:covered.length,fpeCoveredMarketCap:coveredCap,fpeMarketCapCoverage:coveredCap/marketCap,provider:'sp500-aggregate',kind:'aggregate'};
  });
  const {periods,...entity}=group;return {...entity,history:[],monthly};
 }).sort((a,b)=>a.sector.localeCompare(b.sector)||a.name.localeCompare(b.name));
}
function sourceWindows(){const key=state.dataset+'|'+state.frequency;if(!availabilityCache.has(key))availabilityCache.set(key,{cap:coverageWindow(entities(),state.frequency,'marketCap'),pe:coverageWindow(entities(),state.frequency,'fpe')});return availabilityCache.get(key);}
function renderAvailability(){
 const windows=sourceWindows(),range=w=>w?frameLabel(w.first)+'–'+frameLabel(w.last):'unavailable';
 $('monthly-industries-shortcut').hidden=state.dataset!=='industries';
 $('availability-range').textContent=`Source ranges · Market cap ${range(windows.cap)} · Forward P/E ${range(windows.pe)}`;
 const items=universe(),displayCaps=items.filter(e=>observation(e)?.marketCap>0),metricNames={fpe:'Forward P/E',percentile:'P/E vs own past',change:'P/E change vs baseline',growth:'Market-cap growth',sector:'Sector colors / market cap'},usable=displayCaps.filter(e=>state.color==='sector'||Number.isFinite(colorValue(e,observation(e))));
 $('availability-current').textContent=usable.length<items.length?`${metricNames[state.color]}: ${usable.length}/${items.length} usable values${!usable.length?' at '+frameLabel(state.year):''}. ${!displayCaps.length?'No sized tiles in the selected value basis.':usable.length<displayCaps.length?'Unavailable values stay gray.':'Missing caps have no tile.'} Settings unchanged.`:'';
 $('availability-box').dataset.incomplete=String(usable.length===0);const rawPE=items.filter(e=>validPE(rawObservation(e)?.fpe)).length,explain=!usable.length||['percentile','change','growth'].includes(state.color)&&usable.length<items.length||state.color==='fpe'&&usable.length<rawPE;$('availability-current').hidden=!explain||!$('availability-current').textContent;
 if(europeanDataset()||state.dataset==='largecaps'){
  const missing=items.filter(e=>!rawObservation(e)?.marketCap);
  if(missing.length){$('availability-current').textContent=`${missing.length}/${items.length} members have no available ${marketInfo().currency} market cap at ${frameLabel(state.year)}${missing.length<=6?': '+missing.map(e=>e.name).join(', '):''}. They remain in the constituent roster; missing caps have no tile. No other month is substituted.`;$('availability-current').hidden=false;}
 }
 if(state.dataset==='largecaps'){const notPublic=items.filter(e=>listingStatus(e,state.frequency,state.year)).length,missing=items.filter(e=>!rawObservation(e)?.marketCap).length;$('availability-current').textContent=`${items.length-missing}/${items.length} source caps available at ${frameLabel(state.year)}${notPublic?' · '+notPublic+' not yet public (known IPO dates)':''}. ${missing&&missing<=10?'Missing: '+items.filter(e=>!rawObservation(e)?.marketCap).map(e=>e.id).join(', ')+'. ':''}Missing caps have no tile; unavailable P/E stays gray. Added companies have free monthly source history from Nov 2021 or later. Earlier coverage mainly contains today’s S&P 500 members. No other date or metric is substituted.`;$('availability-current').hidden=false;}
 if(state.dataset==='compare'){$('availability-current').textContent=comparisonGroups(items).map(g=>`${g.country} (${g.name}): ${g.available}/${g.count} displayed caps, ${g.peCount} positive P/Es${g.missingFX?', '+g.missingFX+' missing exact-date FX':''}`).join(' · ')+'. Missing caps have no area; missing P/E is gray. No other date is substituted. European source history starts in late 2021; earlier US history is partial.';$('availability-current').hidden=false;}
 $('view-notice').textContent=viewNotice;$('view-notice').hidden=!viewNotice;
}

const annualObservation = (e,y) => displayedObservation(e.history.find(h=>h.year===Number(y)&&h.kind!=='latest'));
const priorHistory = entity => historyOf(entity).filter(h=>frameKey(h)>=years()[0] && frameKey(h)<=state.year && validPE(h.fpe));
const frameLabel = y => monthlyMode()?new Date(monthString(Number(y))+'-15T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'}):state.dataset==='companies'?(Number(y)===db.meta.latestFrameYear?'Latest':'FY '+y):state.dataset==='industries'?'Jan '+y:String(y);
const dateLabel = date => date ? new Date(date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : 'Date unavailable';
const shortMonth = month => new Date(month+'-15T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'});
const capBasis = () => state.dollars==='real' ? shortMonth(inflationSeries().baseMonth)+' '+marketInfo().currency : 'nominal '+marketInfo().currency;
const realObservationCache=new WeakMap();
function inflationPoint(h,series){
 if(!h||!series)return null;
 const month=h.capDate?.slice(0,7)||h.month||h.date?.slice(0,7);
 if(!month)return null;
 const index=series.observations[month];
 if(Number.isFinite(index)&&index>0)return {month,index,observationMonth:month,proxy:false};
 const fallbackMonth=series.fallbacks?.[month]?.month,fallbackIndex=series.observations[fallbackMonth];
 return Number.isFinite(fallbackIndex)&&fallbackIndex>0?{month:fallbackMonth,index:fallbackIndex,observationMonth:month,proxy:true}:null;
}
function adjustMarketCap(value,index,base){return Number.isFinite(value)&&value>0&&Number.isFinite(index)&&index>0&&Number.isFinite(base)&&base>0?value*base/index:null;}
function dollarObservation(h,basis,series){
 if(!h||basis!=='real')return h;
 const point=inflationPoint(h,series);
 return {...h,nominalMarketCap:h.marketCap,marketCap:adjustMarketCap(h.marketCap,point?.index,series?.baseIndex),cpiMonth:point?.month||null,cpiProxy:point?.proxy||false,cpiObservationMonth:point?.observationMonth||h.capDate?.slice(0,7)||h.month||h.date?.slice(0,7)||null};
}
function displayedObservation(h){
 if(!h||state.dollars!=='real')return h;
 if(!realObservationCache.has(h))realObservationCache.set(h,dollarObservation(h,'real',inflationSeries()));
 return realObservationCache.get(h);
}
function renderDollarBasis(){
 $('dollar-basis').value=state.dollars;
 $('dollar-real-option').textContent='Inflation adjusted · '+shortMonth(inflationSeries().baseMonth)+' '+marketInfo().symbol;
 const series=inflationSeries(),months=Object.keys(series.observations).sort(),cpiRange=shortMonth(months[0])+'–'+shortMonth(months.at(-1));
 $('dollar-basis').querySelector('option[value=nominal]').textContent='Nominal '+marketInfo().currency;
 const proxyPolicy=series.fallbacks?.['2025-10']?' October 2025 uses September 2025 CPI, with a visible warning; other missing CPI stays unavailable.':' Missing CPI stays unavailable.';
 $('dollar-note').textContent=state.dollars==='real'?`Market caps in ${capBasis()} · ${series.name||'US CPI-U (BLS / FRED)'}. Source range ${cpiRange}.${proxyPolicy} P/E and market-data dates are unchanged.`:`Market caps in nominal ${marketInfo().currency}. Inflation adjustment uses ${series.name||'US CPI-U (BLS / FRED)'}; no currency conversion is performed by this toggle.`;
 if(state.dataset==='compare')$('dollar-note').textContent+=' All baskets are first expressed in USD at each cap’s exact observation-date ECB rate. Inflation adjustment then uses US CPI for every basket, expressing comparable USD purchasing power; local HICP/UK CPI is not mixed into this view.';
 const frames=[state.year];
 const points=universe().flatMap(e=>frames.map(frame=>observation(e,frame))).filter(p=>p?.nominalMarketCap>0),missing=points.filter(p=>!p.marketCap),proxies=points.filter(p=>p.cpiProxy),messages=[];
 if(proxies.length){const pairs=[...new Set(proxies.map(p=>`${shortMonth(p.cpiObservationMonth)} CPI unavailable; using ${shortMonth(p.cpiMonth)} CPI for inflation adjustment.`))];messages.push(pairs.join(' ')+' Actual market-data dates are unchanged.');}
 if(missing.length){const months=[...new Set(missing.map(p=>p.cpiObservationMonth?shortMonth(p.cpiObservationMonth):'unknown month'))];messages.push(`Adjusted cap unavailable for ${missing.length} observations (${months.join(', ')}): no matching CPI. Inflation adjustment remains selected; source caps are not substituted.`);}
 $('dollar-warning').hidden=!messages.length;$('dollar-warning').textContent=messages.join(' ');
 $('snapshot-warning').hidden=!proxies.length&&!missing.length;$('snapshot-warning').textContent=proxies.length?'Sep CPI used for Oct 2025':missing.length?frameLabel(state.year)+' CPI unavailable':'';$('snapshot-warning').title=messages.join(' ');
 $('detail-cap-label').textContent=state.dollars==='real'?'Market cap · '+shortMonth(inflationSeries().baseMonth)+' '+marketInfo().symbol:'Market cap';
}
function mergeHistoricalData(data,archive,includeResearch=true){
 for(const e of data.companies){
  const source=archive.companies[e.historicalCapId||e.id],recent=new Set(e.monthly.map(h=>h.month));
  e.historicalSourceURL=source?.url;
  const old=(source?.rows||[]).filter(([date])=>!recent.has(date.slice(0,7))).map(([date,marketCap])=>({month:date.slice(0,7),year:+date.slice(0,4),date,capDate:date,marketCap,fpe:null,pe:null,revenue:null,netIncome:null,kind:'historical',provider:'finhacker'}));
  e.monthly=[...old,...e.monthly].sort((a,b)=>a.month.localeCompare(b.month));
 }
 if(includeResearch)data.longrun=archive.longrun.industries.map(e=>({...e,history:[],monthly:e.rows.map(([month,marketCap,firmCount,averageFirmSizeMillions])=>({month,year:+month.slice(0,4),date:null,capDate:null,marketCap,firmCount,averageFirmSizeMillions,fpe:null,pe:null,revenue:null,netIncome:null,kind:'research',provider:'fama-french'}))}));
 data.historical=archive;
 return data;
}
function persist(){try{localStorage.setItem('market-atlas-v3',JSON.stringify({...state,query:''}));}catch{}}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;setTimeout(()=>$('toast').hidden=true,3200);}
function stop(){player.stop();}
function select(id){state.selected=id;render();}
function focusGroup(sector,industry=null){state.sector=sector;state.industry=industry;state.query='';if(!universe().some(e=>e.id===state.selected))state.selected=null;render();}
function setupDataset(){
 framesCache.clear();peakCache.clear();availabilityCache.clear();circleReferenceCache.clear();comparisonPeakCache.clear();comparisonLayoutCache=null;mapLayoutCache=null;circleLayoutCache=null;
 const ys=years(); if(!ys.length)throw new Error('Dataset contains no dated snapshots.');
 if(!Number.isInteger(state.year))state.year=ys.at(-1);
 if(!Number.isInteger(state.baseline))state.baseline=ys[0];
 const opts=['All sectors',...new Set(entities().map(e=>e.sector))];
 if(!opts.includes(state.sector)){viewNotice+=' Sector filter '+state.sector+' is absent from this dataset and has been cleared.';state.sector='All sectors';}
 if(state.industry&&!entities().some(e=>e.industry===state.industry&&(state.sector==='All sectors'||e.sector===state.sector))){viewNotice+=' The sub-industry filter is absent from this dataset and has been cleared.';state.industry=null;}
 $('sector').innerHTML=opts.map(s=>`<option>${esc(s)}</option>`).join('');$('sector').value=state.sector;
 $('baseline').innerHTML=[...new Set([...ys,state.baseline])].sort((a,b)=>a-b).map(y=>`<option value="${y}">${frameLabel(y)}</option>`).join('');
 $('timeline').max=ys.length-1;
 const yearStep=Math.max(1,Math.ceil((ys.at(-1)-ys[0])/12/8/5)*5);
 const ticks=monthlyMode()?ys.filter((y,i)=>i===0||i===ys.length-1||y%12===0&&Math.floor(y/12)%yearStep===0&&i>12&&i<ys.length-13):ys.length>10?ys.filter((y,i)=>i===0||i===ys.length-1||y%Math.max(5,Math.ceil((ys.at(-1)-ys[0])/8/5)*5)===0):ys;
 $('year-ticks').innerHTML=ticks.map(y=>`<button type="button" data-year="${y}">${frameLabel(y)}</button>`).join('');
 $('month-picker').hidden=false;$('month-picker').setAttribute('aria-label',monthlyMode()?'Choose snapshot month':'Choose snapshot year');$('month-picker').innerHTML=ys.map(y=>`<option value="${y}">${frameLabel(y)}</option>`).join('');
 $('frequency').value=state.frequency;$('frequency-wrap').hidden=false;$('frequency').disabled=industryMode()||europeanDataset()||['largecaps','compare'].includes(state.dataset);
 $('timeline').setAttribute('aria-label',monthlyMode()?'Snapshot month':'Snapshot year');
 $('year-ticks').querySelectorAll('button').forEach(b=>b.onclick=()=>{stop();state.year=+b.dataset.year;render();});
 const capWindow=sourceWindows().cap;$('coverage').textContent=`${entities().length} ${state.dataset==='compare'?'index slots in 4 baskets':industryMode()?'industries':'current companies'} · source cap ${capWindow?frameLabel(capWindow.first)+'–'+frameLabel(capWindow.last):'unavailable'} · ${state.frequency}`;
 $('dataset-picker').value=state.dataset;$('imported-option').hidden=!db.imported;
 if(!universe().some(e=>e.id===state.selected))state.selected=null;
 noticeSignature=JSON.stringify(state);
}
function renderCoverage(){
 const all=universe(),frame=state.year,caps=all.filter(e=>rawObservation(e,frame)?.marketCap>0),pes=all.filter(e=>validPE(rawObservation(e,frame)?.fpe)),adjusted=all.filter(e=>observation(e,frame)?.marketCap>0);
 $('coverage-summary').textContent=`Market cap ${caps.length}/${all.length} · Forward P/E ${pes.length}/${all.length}${state.dollars==='real'?' · CPI-adjusted '+adjusted.length+'/'+all.length:''}`;
 if(state.dataset==='compare')$('coverage-summary').textContent+=' · index slots, shared issuers retained';
 if(state.dataset==='spIndustries'){const observed=caps.reduce((n,e)=>n+rawObservation(e,frame).memberCount,0),peMembers=caps.reduce((n,e)=>n+rawObservation(e,frame).fpeMemberCount,0),total=all.reduce((n,e)=>n+e.members.length,0);$('coverage-summary').textContent+=` · Company caps ${observed}/${total} · P/E ${peMembers}/${observed}`;}
 $('coverage-open').textContent=state.dataset==='compare'?'Browse index constituents ↗':state.dataset==='companies'?`Browse all ${db.meta.constituentCount} constituent tickers ↗`:'Browse all '+entities().length+(companyMode()?' companies ↗':' industries ↗');
 $('coverage-description').textContent=state.dataset==='companies'?`All ${db.meta.constituentCount} current constituent symbols, grouped into ${db.meta.issuerCount} companies to avoid counting the same company market cap twice. Membership verified October 29, 2026. This list includes members with missing historical data.`:`All ${entities().length} names in this dataset. Coverage is for ${frameLabel(state.year)}.`;
 if(europeanDataset())$('coverage-description').textContent=`All ${entities().length} current ${marketInfo().name} companies. Roster retrieved October 29, 2026. Current membership is used throughout; this is not a historical index reconstruction. Caps are in ${marketInfo().currency}, with full company capitalization rather than free-float index weights. Missing observations remain in the roster.`;
 if(state.dataset==='compare')$('coverage-description').textContent='Four independent current index baskets, with full company caps converted to USD at exact cap-date ECB rates. This is not a measure of entire country stock markets. Counts differ; shared issuers such as Airbus remain in each index’s own basket and are not presented as a combined unique-company total. ';
 if(state.dataset==='largecaps')$('coverage-description').textContent=`The 1,000 largest eligible US-listed issuers by dated October 2026 company cap, screened November 2, 2026. Includes US-listed foreign companies and ADRs; excludes ETFs, preferred-only listings, notes and shell companies. Share classes share one issuer tile. This is a fixed current roster throughout history, not the historical top 1,000. Companies with missing data remain listed. New listings join on a data refresh, without waiting for index membership.`;
 if(state.dataset==='spIndustries')$('coverage-description').textContent='Current S&P 500 companies grouped into '+entities().length+' GICS sub-industries. Market cap is the sum of observed company caps. Forward P/E is calculated only from firms with positive reported ratios; the covered company count and cap share are shown for every industry. This is not the broader annual NYU industry universe.';
 if($('coverage-dialog').open)renderRoster();
}
function renderRoster(){
 const q=$('roster-search').value.trim(),all=entities().filter(e=>matches(e,q)).sort((a,b)=>a.name.localeCompare(b.name));
 const caps=entities().filter(e=>rawObservation(e)?.marketCap>0),pes=entities().filter(e=>validPE(rawObservation(e)?.fpe));
 $('coverage-totals').textContent=`${frameLabel(state.year)} · source caps ${caps.length}/${entities().length} · displayed caps ${entities().filter(e=>observation(e)?.marketCap>0).length}/${entities().length} (${capBasis()}) · ${pes.length}/${entities().length} forward P/E ratios · matches: ${all.length}`;
 $('roster-table').innerHTML=`<table><thead><tr><th>${industryMode()?'INDUSTRY':'COMPANY / TICKERS'}</th><th>SECTOR</th><th>MARKET CAP · ${esc(capBasis())}</th><th>FWD P/E</th></tr></thead><tbody>${all.map(e=>{const p=observation(e);return `<tr><td><button data-roster="${esc(e.id)}">${esc(e.name)}<small>${esc(state.dataset==='spIndustries'?e.members.length+' current companies':(e.symbols||[e.id]).join(' / '))}${e.comparisonCountry?' · '+esc(e.comparisonCountry)+' · '+esc(e.comparisonName):''}</small></button></td><td>${esc(e.sector)}</td><td>${currency(p?.marketCap)}${!p&&listingStatus(e,state.frequency,state.year)?`<small class="ratio-coverage">Not yet public · IPO ${esc(e.ipoDate)}</small>`:''}</td><td>${multiple(p?.fpe)}${state.dataset==='spIndustries'&&p?`<small class="ratio-coverage">${p.fpeMemberCount}/${p.memberCount} firms · ${(p.fpeMarketCapCoverage*100).toFixed(0)}% cap</small>`:''}</td></tr>`;}).join('')}</tbody></table>`;
 $('roster-table').querySelectorAll('[data-roster]').forEach(b=>b.onclick=()=>{state.selected=b.dataset.roster;state.query='';state.sector='All sectors';state.industry=null;$('coverage-dialog').close();render();});
}
function renderSearch(){
 const holder=$('search-results'),show=state.query.trim().length>0;
 holder.hidden=!show;$('search').setAttribute('aria-expanded',String(show));if(!show){holder.innerHTML='';searchIndex=-1;return;}
 const fieldBox=document.querySelector('.search').getBoundingClientRect(),workspaceBox=document.querySelector('.workspace').getBoundingClientRect(),resultsWidth=Math.min(430,workspaceBox.width-24);
 holder.style.top=(fieldBox.bottom-workspaceBox.top+8)+'px';holder.style.left=Math.max(12,Math.min(fieldBox.left-workspaceBox.left,workspaceBox.width-resultsWidth-12))+'px';holder.style.width=resultsWidth+'px';
 const found=entities().filter(e=>matches(e));const exact=state.query.trim().toUpperCase();found.sort((a,b)=>Number((b.symbols||[b.id]).includes(exact))-Number((a.symbols||[a.id]).includes(exact))||a.name.localeCompare(b.name));
 holder.innerHTML=`<div class="search-count">${found.length} matches${found.length>8?' · showing the first 8, type more to narrow':''}</div>${found.slice(0,8).map(e=>`<button type="button" role="option" aria-selected="false" data-match="${esc(e.id)}"><span><strong>${esc(state.dataset==='spIndustries'?e.name:(e.symbols||[e.id]).join(' / '))}</strong> ${esc(state.dataset==='spIndustries'?e.members.length+' current companies':e.name)}</span><small>${e.comparisonCountry?esc(e.comparisonCountry)+' · '+esc(e.comparisonName)+' · ':''}${currency(observation(e)?.marketCap)} · ${multiple(observation(e)?.fpe)}</small></button>`).join('')}`;
 holder.querySelectorAll('[data-match]').forEach(b=>b.onclick=()=>{state.selected=b.dataset.match;const e=entities().find(e=>e.id===state.selected);if(state.sector!=='All sectors'&&state.sector!==e.sector)state.sector='All sectors';state.industry=null;state.query='';render();});
 searchIndex=-1;
}
function colorValue(e,h){
 if(state.color==='sector')return e.sector;
 if(state.color==='percentile')return percentile(priorHistory(e).map(p=>p.fpe),h.fpe);
 if(state.color==='change'){const p=observation(e,state.baseline);return p&&validPE(p.fpe)&&validPE(h.fpe)?change(h.fpe,p.fpe):null;}
 if(state.color==='growth'){const p=observation(e,state.baseline);return p?change(h.marketCap,p.marketCap):null;}
 return validPE(h.fpe)?h.fpe:null;
}
function colorOf(v){
 if(state.color==='sector')return sectorColors[sectorRank(v)];
 if(!Number.isFinite(v))return missingColor;
 if(state.color==='fpe')return peColor(v);
 if(state.color==='percentile')return d3.scaleQuantize([0,100],colors)(v);
 const c=state.color==='growth'?[...colors].reverse():colors;
 return d3.scaleQuantize([-100,100],c)(v);
}
function metricText(e,h){const v=colorValue(e,h);return state.color==='sector'?currency(h.marketCap):state.color==='fpe'?multiple(v):state.color==='percentile'?Number.isFinite(v)?Math.round(v)+'%':'—':pct(v,0);}
function renderLegend(){
 if(state.color==='sector'){$('legend-label').textContent='SECTOR · TILE VALUES = MARKET CAP';$('legend').innerHTML=[...new Set(universe().map(e=>e.sector))].map(s=>`<span class="sector-key" title="${esc(s)}"><i style="background:${colorOf(s)}"></i>${esc(s)}</span>`).join('');return;}
 const label={fpe:'FORWARD P/E',percentile:'OWN PAST PERCENTILE',change:'P/E CHANGE',growth:'CAP GROWTH'}[state.color];$('legend-label').textContent=label;
 let stops=state.color==='fpe'?[['<10',5],['15',12],['20',17],['30',25],['40',35],['60',50],['60+',75]]:state.color==='percentile'?[[0,0],[20,20],[35,35],[50,50],[65,65],[80,80],[100,100]]:[['−100',-100],['−60',-60],['−30',-30],['0',0],['30',30],['60',60],['100+',100]];
 $('legend').innerHTML=stops.map(([t,v])=>`<span class="legend-stop" style="background:${colorOf(v)}">${t}</span>`).join('')+`<span class="legend-stop na-stop" style="background:${missingColor}">N/A</span>`;
}
function showTip(html,x,y){const t=$('tooltip');t.innerHTML=html;t.hidden=false;const r=t.getBoundingClientRect();t.style.left=Math.max(8,Math.min(window.innerWidth-r.width-8,x+15))+'px';t.style.top=Math.max(8,Math.min(window.innerHeight-r.height-8,y+15))+'px';}
function hideTip(){$('tooltip').hidden=true;}
const PLAYBACK = {interval:200,transition:200};
const transitionMs = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : player.running?PLAYBACK.transition:450;
function createTimelinePlayer({getFrames,getFrame,showFrame,onChange,onProgress=()=>{},request=callback=>window.requestAnimationFrame(callback),cancel=id=>window.cancelAnimationFrame(id),clock=()=>performance.now()}){
 let running=false,handle=null,startedAt=0,startIndex=0,displayed=0;
 const stop=()=>{if(handle!==null)cancel(handle);handle=null;const changed=running;running=false;if(changed){onProgress(Math.max(0,getFrames().indexOf(getFrame())));onChange(false);}};
 const advanceTo=(index,frames)=>{for(let i=displayed+1;i<=index;i++){showFrame(frames[i]);displayed=i;}};
 const tick=time=>{if(!running)return;handle=null;const frames=getFrames(),last=frames.length-1,position=Math.min(last,startIndex+Math.max(0,time-startedAt)/PLAYBACK.interval);advanceTo(Math.min(last,Math.floor(position+1e-9)+1),frames);onProgress(position);if(position>=last){stop();return;}handle=request(tick);};
 return {get running(){return running;},stop,start(){if(running)return;const frames=getFrames();if(frames.length<2)return;let index=frames.indexOf(getFrame());if(index<0||index===frames.length-1){index=0;showFrame(frames[0],{instant:true});}startIndex=displayed=index;running=true;onChange(true);startedAt=clock();onProgress(startIndex);advanceTo(Math.min(frames.length-1,startIndex+1),frames);handle=request(tick);}};
}
function paintTimeline(position){
 const timeline=$('timeline');timeline.step=player.running?'any':'1';timeline.value=position;
 const fraction=Number(timeline.max)>0?Math.max(0,Math.min(1,position/Number(timeline.max))):0;
 timeline.style.background=`linear-gradient(to right,#39785f ${fraction*100}%,#dfe6dc ${fraction*100}%)`;
 timeline.setAttribute('aria-valuetext',frameLabel(state.year));
}
function peakMarketCap(items,frames,valueAt){
 let peak={total:0,frame:null};
 for(const frame of frames){const total=items.reduce((sum,e)=>{const cap=valueAt(e,frame);return sum+(Number.isFinite(cap)&&cap>0?cap:0);},0);if(total>peak.total)peak={total,frame};}
 return peak;
}
function marketScaleGeometry(total,peak,mode='absolute'){
 const ratio=Number.isFinite(total)&&total>0&&Number.isFinite(peak)&&peak>0?Math.min(1,total/peak):0;
 return {ratio,factor:mode==='relative'?1:Math.sqrt(ratio)};
}
function referenceMarket(){
 const key=state.dataset+'|'+state.frequency+'|'+state.dollars;
 if(!peakCache.has(key))peakCache.set(key,peakMarketCap(entities(),years(),(e,frame)=>observation(e,frame)?.marketCap));
 return peakCache.get(key);
}
function createStableTreemap(items,w,h,companyMode,anchorFor){
 const groups=d3.groups(items,e=>e.sector).sort((a,b)=>sectorRank(a[0])-sectorRank(b[0]));
 const root=d3.hierarchy({children:groups.map(([name,list])=>({name,children:companyMode?d3.groups(list,e=>e.industry).sort((a,b)=>a[0].localeCompare(b[0])).map(([industry,items])=>({name:industry,sector:name,children:items.map(entity=>({entity})).sort((a,b)=>a.entity.id.localeCompare(b.entity.id))})):list.map(entity=>({entity})).sort((a,b)=>a.entity.id.localeCompare(b.entity.id))}))});
 const layout=d3.treemap().tile(d3.treemapResquarify.ratio(1.3)).size([w,h]).paddingOuter(1).paddingInner(1).paddingTop(d=>d.depth===1?22:d.depth===2&&d.children&&d.x1-d.x0>95&&d.y1-d.y0>60?13:0).round(true);
 // Seed row membership once, then reuse the same hierarchy and cached rows.
 // Anchor weights only choose topology; every displayed area uses its dated cap.
 root.sum(d=>d.entity?Math.max(1,anchorFor(d.entity)||1):0);layout(root);
 // Freeze heading gutters so crossing a size threshold never repacks a group.
 root.each(d=>{d.labelPadding=d.depth===1?22:d.depth===2&&d.children&&d.x1-d.x0>95&&d.y1-d.y0>60?13:0;});
 layout.paddingTop(d=>d.labelPadding);layout(root);
 const update=valueFor=>{root.sum(d=>d.entity?Math.max(0,valueFor(d.entity)||0):0);layout(root);return root;};
 const prepareLabels=(frames,valueAt,scaleFor)=>{
  const groups=root.descendants().filter(d=>d.children&&d.depth>0),minimum=new Map(groups.map(d=>[d,{width:Infinity,height:Infinity,padding:Infinity}]));
  for(const frame of frames){update(e=>valueAt(e,frame));const factor=scaleFor(root.value,frame);for(const d of groups){if(d.value<=0||factor<=0)continue;const m=minimum.get(d);m.width=Math.min(m.width,(d.x1-d.x0)*factor);m.height=Math.min(m.height,(d.y1-d.y0)*factor);m.padding=Math.min(m.padding,d.labelPadding*factor);}}
  const names={'Technology':['TECHNOLOGY','TECH'],'Communication services':['COMM. SERVICES','COMM.'],'Consumer discretionary':['DISCRETIONARY','DISC.'],'Consumer staples':['STAPLES','STAP.'],'Financials':['FINANCIALS','FIN.'],'Health care':['HEALTH CARE','HEALTH'],'Industrials':['INDUSTRIALS','IND.'],'Energy':['ENERGY','EN.'],'Materials':['MATERIALS','MAT.'],'Utilities':['UTILITIES','UTIL.'],'Real estate':['REAL ESTATE','REAL EST.','RE']};
  for(const d of groups){const m=minimum.get(d);let text='';if(Number.isFinite(m.width)){if(d.depth===1&&m.height>=15&&m.padding>=10)text=(names[d.data.name]||[d.data.name.toUpperCase()]).find(name=>name.length*6<=m.width-10)||'';else if(d.depth===2&&m.width>=105&&m.height>=60&&m.padding>=7.5){const max=Math.floor((m.width-10)/4.5);text=d.data.name.length>max?d.data.name.slice(0,max-1)+'…':d.data.name;}}d.labelSpec={text,...m};}
 };
 return {root,frame:null,update,prepareLabels};
}
// Fit company names to their actual screen area, including small fixed-scale tiles.
function companyDisplayName(name){return String(name).replace(/,?\s+(?:(?:Inc(?:orporated)?|Corp(?:oration)?|Ltd|Limited)\.?|PLC)$/i,'').trim();}
// Aliases affect chart labels and search only. Identity, details and source rows
// keep the full name. Full-name keys avoid collisions between markets.
const shortCompanyNames = new Map(Object.entries({"Space Exploration Technologies Corp.":"SpaceX","Palantir Technologies":"Palantir","Advanced Micro Devices":"AMD","Meta Platforms":"Meta","Taiwan Semiconductor Manufacturing Company Limited":"TSMC","Lilly (Eli)":"Eli Lilly","Berkshire Hathaway":"Berkshire","JPMorgan Chase":"JPMorgan","Micron Technology":"Micron","Procter & Gamble":"P&G","Johnson & Johnson":"J&J","UnitedHealth Group":"UnitedHealth","Philip Morris International":"Philip Morris","Palo Alto Networks":"Palo Alto","Royal Bank of Canada":"RBC","Mitsubishi UFJ Financial Group, Inc.":"MUFG","Toyota Motor Corporation":"Toyota","Alibaba Group Holding Limited":"Alibaba","Arm Holdings plc":"Arm","Gilead Sciences":"Gilead","Citigroup":"Citi","The Toronto-Dominion Bank":"TD Bank","Walt Disney Company (The)":"Disney","Deere & Company":"Deere","Marvell Technology":"Marvell","Banco Santander, S.A.":"Santander","Anheuser-Busch InBev SA/NV":"AB InBev","UBS Group AG":"UBS","Sumitomo Mitsui Financial Group, Inc.":"SMFG","Charles Schwab Corporation":"Schwab","Southern Copper Corporation":"Southern Copper","Sony Group Corporation":"Sony","Seagate Technology":"Seagate","Petróleo Brasileiro S.A. - Petrobras":"Petrobras","Vertex Pharmaceuticals":"Vertex","Banco Bilbao Vizcaya Argentaria, S.A.":"BBVA","Abbott Laboratories":"Abbott","Thermo Fisher Scientific":"Thermo Fisher","Hewlett Packard Enterprise":"HPE","HP Inc.":"HP","Merck & Co.":"Merck","Fidelity National Information Services":"FIS","Dell Technologies":"Dell","Arista Networks":"Arista","NXP Semiconductors":"NXP","Novo Nordisk A/S":"Novo Nordisk","ASML Holding N.V.":"ASML","BHP Group Limited":"BHP","HSBC Holdings plc":"HSBC","Novartis AG":"Novartis","SAP SE":"SAP","América Móvil, S.A.B. de C.V.":"América Móvil","ASE Technology Holding Co., Ltd.":"ASE","Brookfield Asset Management Ltd.":"Brookfield AM","Brookfield Renewable Partners L.P.":"Brookfield Renewable","Brookfield Renewable Corporation":"Brookfield Renewable Corp.","Brookfield Infrastructure Partners L.P.":"Brookfield Infrastructure","Bio-Rad Laboratories, Inc.":"Bio-Rad","Brookfield Wealth Solutions Ltd.":"Brookfield Wealth","BioNTech SE":"BioNTech","Broadridge Financial Solutions":"Broadridge","Banco Santander (Brasil) S.A.":"Santander Brasil","Bentley Systems, Incorporated":"Bentley","British American Tobacco p.l.c.":"BAT","Coca-Cola Europacific Partners PLC":"Coca-Cola Europacific","Check Point Software Technologies Ltd.":"Check Point","Chunghwa Telecom Co., Ltd.":"Chunghwa Telecom","Canadian Imperial Bank of Commerce":"CIBC","Canadian National Railway Company":"Canadian National","Canadian Natural Resources Limited":"Canadian Natural","Coca-Cola Consolidated, Inc.":"Coca-Cola Consolidated","Canadian Pacific Kansas City Limited":"CPKC","Circle Internet Group, Inc.":"Circle","Credo Technology Group Holding Ltd":"Credo","Charles River Laboratories":"Charles River","Deutsche Bank Aktiengesellschaft":"Deutsche Bank","DICK'S Sporting Goods, Inc.":"Dick’s Sporting Goods","DigitalOcean Holdings, Inc.":"DigitalOcean","Estée Lauder Companies (The)":"Estée Lauder","Telefonaktiebolaget LM Ericsson (publ)":"Ericsson","First Citizens BancShares, Inc.":"First Citizens","Fomento Económico Mexicano, S.A.B. de C.V.":"FEMSA","Fidelity National Financial, Inc.":"Fidelity National","Federal Realty Investment Trust":"Federal Realty","HDFC Bank Limited":"HDFC Bank","ICICI Bank Limited":"ICICI Bank","ICON Public Limited Company":"ICON","International Flavors & Fragrances":"IFF","InterContinental Hotels Group PLC":"IHG","Itaú Unibanco Holding S.A.":"Itaú Unibanco","James Hardie Industries plc":"James Hardie","Jones Lang LaSalle Incorporated":"JLL","Korea Electric Power Corporation":"Korea Electric","Coca-Cola FEMSA, S.A.B. de C.V.":"Coca-Cola FEMSA","Joint Stock Company Kaspi.kz":"Kaspi.kz","Liberty Live Holdings, Inc.":"Liberty Live","Logitech International S.A.":"Logitech","LPL Financial Holdings Inc.":"LPL Financial","Lattice Semiconductor Corporation":"Lattice","Life Time Group Holdings, Inc.":"Life Time","Mid-America Apartment Communities":"Mid-America Apartments","Manulife Financial Corporation":"Manulife","Mizuho Financial Group, Inc.":"Mizuho","MACOM Technology Solutions Holdings, Inc.":"MACOM","Annaly Capital Management, Inc.":"Annaly","The New York Times Company":"New York Times","Grupo Aeroportuario del Pacífico, S.A.B. de C.V.":"Grupo Aeroportuario Pacífico","Pembina Pipeline Corporation":"Pembina","Procore Technologies, Inc.":"Procore","Public Service Enterprise Group":"PSEG","Performance Food Group Company":"Performance Food","Packaging Corporation of America":"Packaging Corp.","Restaurant Brands International Inc.":"Restaurant Brands","Rogers Communications Inc.":"Rogers","Dr. Reddy's Laboratories Limited":"Dr. Reddy’s","Reinsurance Group of America, Incorporated":"Reinsurance Group","Ryan Specialty Holdings, Inc.":"Ryan Specialty","Companhia de Saneamento Básico do Estado de São Paulo - SABESP":"Sabesp","Service Corporation International":"Service Corp.","Shinhan Financial Group Co., Ltd.":"Shinhan","J.M. Smucker Company (The)":"J.M. Smucker","SS&C Technologies Holdings, Inc.":"SS&C","Takeda Pharmaceutical Company Limited":"Takeda","Teva Pharmaceutical Industries Limited":"Teva","Millicom International Cellular S.A.":"Millicom","Perusahaan Perseroan (Persero) PT Telekomunikasi Indonesia Tbk":"Telkom Indonesia","Tencent Music Entertainment Group":"Tencent Music","Texas Pacific Land Corporation":"Texas Pacific Land","Thomson Reuters Corporation":"Thomson Reuters","United Microelectronics Corporation":"UMC","Vodafone Group Public Limited Company":"Vodafone","Woori Financial Group Inc.":"Woori","West Pharmaceutical Services":"West Pharma","Full Truck Alliance Co. Ltd.":"Full Truck Alliance","Zions Bancorporation, National Association":"Zions","BioMarin Pharmaceutical Inc.":"BioMarin","Corcept Therapeutics Incorporated":"Corcept","Alnylam Pharmaceuticals, Inc.":"Alnylam","Halozyme Therapeutics, Inc.":"Halozyme","Harmony Gold Mining Company Limited":"Harmony Gold","BrightSpring Health Services, Inc.":"BrightSpring","Somnigroup International Inc.":"Somnigroup","Sunbelt Rentals Holdings, Inc.":"Sunbelt Rentals","Solstice Advanced Materials, Inc.":"Solstice","The Magnum Ice Cream Company N.V.":"Magnum Ice Cream","Madison Air Solutions Corporation":"Madison Air","Advanced Energy Industries, Inc.":"Advanced Energy","Agnico Eagle Mines Limited":"Agnico Eagle","Applied Industrial Technologies, Inc.":"Applied Industrial","Affiliated Managers Group, Inc.":"Affiliated Managers","BJ's Wholesale Club Holdings, Inc.":"BJ’s Wholesale","Bitmine Immersion Technologies, Inc.":"Bitmine","H World Group Limited":"H World","Li Auto Inc.":"Li Auto","NetEase, Inc.":"NetEase","Trip.com Group Limited":"Trip.com","JD.com, Inc.":"JD.com","KE Holdings Inc.":"KE Holdings","Infineon Technologies":"Infineon","Mercedes-Benz Group":"Mercedes-Benz","Volkswagen Group":"Volkswagen","Deutsche Post":"DHL","GEA Group":"GEA","Aberdeen Group":"Aberdeen","Admiral Group":"Admiral","Autotrader Group":"Auto Trader","BT Group":"BT","Burberry Group":"Burberry","Compass Group":"Compass","Howdens Joinery":"Howdens","International Airlines Group":"IAG","Lion Finance Group":"Lion Finance","Lloyds Banking Group":"Lloyds","London Stock Exchange Group":"LSEG","NatWest Group":"NatWest","Rolls-Royce Holdings":"Rolls-Royce","Sage Group":"Sage","Spirax Group":"Spirax","Vodafone Group":"Vodafone","Associated British Foods":"AB Foods","Scottish Mortgage Investment Trust":"Scottish Mortgage","F & C Investment Trust":"F&C","Polar Capital Technology Trust":"Polar Capital Tech","British American Tobacco":"BAT","Coca-Cola Europacific Partners":"Coca-Cola Europacific"}).map(([name,label])=>[name.toLowerCase(),label]));
function companyShortName(entity){
 const name=String(entity.name||'').trim();
 return shortCompanyNames.get(name.toLowerCase())||name
  .replace(/\s*\(The\)$/i,'').replace(/^The\s+/i,'')
  .replace(/(?:,?\s+(?:Public Limited Company|S\.A\.B\. de C\.V\.|S\.A\. de C\.V\.|SA\/NV|N\.V\.|A\/S|S\.A\.|S\.E\.|SE|AG|p\.l\.c\.|PLC|L\.P\.|LP|Inc(?:orporated)?\.?|Corp(?:oration)?\.?|Ltd\.?|Limited))+$/i,'').trim()||name;
}
const companyTileName=entity=>state.labels==='short'?companyShortName(entity):companyDisplayName(entity.name);
function fitCompanyLabel(text,width,height,measure,dense=false){
 const minFont=dense?3:11,maxFont=26,step=.5,maxNameLines=dense?4:3,empty={lines:[],font:minFont,lineHeight:minFont*1.15,value:false};
 if(width<(dense?5:38)||height<(dense?4:20)||!text.trim())return empty;
 const available=width-(dense?2*Math.min(4,width*.08):10),contentHeight=height-(dense?2*Math.min(3,height*.08):8),words=text.trim().split(/\s+/);
 const wrap=(font,maxLines,breakWords=false)=>{
  const lines=[];let line='';
  for(const word of words){
   const next=line?line+' '+word:word;
   if(measure(next,font)<=available){line=next;continue;}
   if(line){lines.push(line);line='';}
   if(measure(word,font)>available){
    if(!breakWords)return null;
    for(const char of word){if(measure(line+char,font)>available){if(!line)return null;lines.push(line);line='';}line+=char;}
   }else line=word;
   if(lines.length>=maxLines)return null;
  }
  if(line)lines.push(line);return lines.length<=maxLines?lines:null;
 };
 const fit=(font,value,breakWords=false)=>{
  const lineHeight=font*1.15,maxLines=Math.min(maxNameLines,Math.floor((contentHeight-(value?18:0))/lineHeight));
  if(maxLines<1)return null;
  const lines=wrap(font,maxLines,breakWords);return lines?{lines,font,lineHeight,value}:null;
 };
 const largestFit=value=>{
  let lo=0,hi=Math.round((maxFont-minFont)/step),best=null;
  while(lo<=hi){const mid=Math.floor((lo+hi)/2),candidate=fit(minFont+mid*step,value);if(candidate){best=candidate;lo=mid+1;}else hi=mid-1;}
  return best;
 };
 // Names take precedence over the secondary numeric value in tight tiles.
 if(width>=68&&height>=60){const withValue=largestFit(true);if(withValue?.font>=10)return withValue;}
 const full=largestFit(false)||(dense?fit(minFont,false,true):null);if(full)return full;
 const font=minFont,lineHeight=font*1.15,maxLines=Math.min(maxNameLines,Math.floor(contentHeight/lineHeight));if(maxLines<1)return empty;
 const lines=[];let rest=text.trim();
 for(let i=0;i<maxLines&&rest;i++){
  if(measure(rest,font)<=available){lines.push(rest);rest='';break;}
  const last=i===maxLines-1;let count=0;
  while(count<rest.length&&measure(rest.slice(0,count+1)+(last?'…':''),font)<=available)count++;
  if(!count)break;
  lines.push(rest.slice(0,count).trimEnd()+(last?'…':''));rest=rest.slice(count).trimStart();
 }
 return {lines,font,lineHeight,value:false};
}
let companyTextContext;
const companyTextWidths=new Map();
function measureCompanyText(text,size){
 const key=size+'|'+text;if(companyTextWidths.has(key))return companyTextWidths.get(key);
 companyTextContext??=document.createElement('canvas').getContext('2d');companyTextContext.font=`600 ${size}px "DM Sans", sans-serif`;
 const width=companyTextContext.measureText(text).width;if(companyTextWidths.size>12000)companyTextWidths.clear();companyTextWidths.set(key,width);return width;
}
function groupSectorCaps(items,valueAt){
 const groups=new Map();
 for(const entity of items){
  const key=entity.sector;
  if(!groups.has(key))groups.set(key,{key,name:key,members:[],cap:0});
  const group=groups.get(key),value=valueAt(entity),cap=Number.isFinite(value)&&value>0?value:0;
  group.members.push({entity,cap});group.cap+=cap;
 }
 for(const group of groups.values())group.members.sort((a,b)=>a.entity.id.localeCompare(b.entity.id));
 return [...groups.values()].sort((a,b)=>sectorRank(a.name)-sectorRank(b.name)||a.name.localeCompare(b.name));
}
function referenceSectorCaps(items){
 const groups=groupSectorCaps(items,()=>0);
 for(const group of groups){
  const totals=new Map();
  for(const {entity} of group.members)for(const point of historyOf(entity)){
   const cap=displayedObservation(point)?.marketCap;if(!(cap>0))continue;
   const frame=frameKey(point);totals.set(frame,(totals.get(frame)||0)+cap);
  }
  group.cap=Math.max(0,...totals.values());
 }
 return groups.filter(g=>g.cap>0);
}
// A common cap-to-area scale makes the sector disks directly comparable.
function sectorShelfLayout(groups,width,height){
 const positive=groups.filter(g=>g.cap>0);if(!positive.length)return {sectors:[],capScale:0};
 const unit=Math.max(...positive.map(g=>g.cap)),gap=.24,caption=.23;
 const circles=positive.map(group=>({...group,r:Math.sqrt(group.cap/unit)}));
 const widest=Math.max(...circles.map(c=>2*c.r)),totalWidth=circles.reduce((n,c)=>n+2*c.r+gap,0);
 let best=null;
 for(let attempt=0;attempt<=32;attempt++){
  const limit=widest+(totalWidth-widest)*attempt/32,rows=[];let row={items:[],width:0,height:0};
  for(const circle of circles){
   const addition=2*circle.r+(row.items.length?gap:0);
   if(row.items.length&&row.width+addition>limit){rows.push(row);row={items:[],width:0,height:0};}
   row.width+=2*circle.r+(row.items.length?gap:0);row.height=Math.max(row.height,2*circle.r);row.items.push(circle);
  }
  if(row.items.length)rows.push(row);
  const bw=Math.max(...rows.map(r=>r.width)),bh=rows.reduce((n,r)=>n+r.height+caption,0)+gap*(rows.length-1),k=Math.min(Math.max(1,width-24)/bw,Math.max(1,height-24)/bh);
  if(!best||k>best.k)best={rows,bw,bh,k};
 }
 const sectors=[];let y=(height-best.bh*best.k)/2;
 for(const row of best.rows){
  let x=(width-row.width*best.k)/2;
  for(const circle of row.items){
   sectors.push({...circle,x:x+circle.r*best.k,y:y+(caption+row.height/2)*best.k,r:circle.r*best.k});
   x+=(2*circle.r+gap)*best.k;
  }
  y+=(row.height+caption+gap)*best.k;
 }
 return {sectors,capScale:best.k/Math.sqrt(unit)};
}
// Densify the stable reference layout with deterministic collision relaxation.
function packSectorCircles(groups,width,height){
 const baseline=sectorShelfLayout(groups,width,height);if(!baseline.sectors.length)return baseline;
 const unit=Math.max(...baseline.sectors.map(g=>g.cap)),radii=baseline.sectors.map(g=>Math.sqrt(g.cap/unit)),padding=18;
 const place=(k,seed)=>{
  let random=seed+19;
  const circles=baseline.sectors.map((g,i)=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return {x:g.x+(random%21-10)*seed*.2,y:g.y-8,r:radii[i]*k+padding};});
  for(let iteration=0;iteration<600;iteration++){
   for(const c of circles){c.x=Math.max(c.r+3,Math.min(width-c.r-3,c.x));c.y=Math.max(c.r+3,Math.min(height-c.r-3,c.y));}
   let worst=0;
   for(let i=0;i<circles.length;i++)for(let j=0;j<i;j++){
    const a=circles[i],b=circles[j];let dx=a.x-b.x,dy=a.y-b.y,distance=Math.hypot(dx,dy);
    const overlap=a.r+b.r+2-distance;if(overlap<=0)continue;
    if(distance<1e-6){dx=1;dy=.3;distance=Math.hypot(dx,dy);}
    worst=Math.max(worst,overlap);const fraction=b.r*b.r/(a.r*a.r+b.r*b.r),move=overlap*.65;
    dx/=distance;dy/=distance;a.x+=dx*move*fraction;a.y+=dy*move*fraction;b.x-=dx*move*(1-fraction);b.y-=dy*move*(1-fraction);
   }
   if(worst<.02)break;
  }
  for(const c of circles)if(c.x<c.r+2.9||c.x>width-c.r-2.9||c.y<c.r+2.9||c.y>height-c.r-2.9)return null;
  for(let i=0;i<circles.length;i++)for(let j=0;j<i;j++)if(Math.hypot(circles[i].x-circles[j].x,circles[i].y-circles[j].y)<circles[i].r+circles[j].r+.9)return null;
  return circles;
 };
 let low=baseline.capScale*Math.sqrt(unit),high=Math.min(width,height)/2-padding-5,best=null,bestK=low;
 for(let attempt=0;attempt<9&&high>low;attempt++){
  const k=(low+high)/2;let found=null;
  for(let seed=0;seed<5&&!found;seed++)found=place(k,seed);
  if(found){best=found;bestK=k;low=k;}else high=k;
 }
 return best?{sectors:baseline.sectors.map((g,i)=>({...g,x:best[i].x,y:best[i].y+8,r:radii[i]*bestK})),capScale:bestK/Math.sqrt(unit)}:baseline;
}
const OTHER_SHARE=.02;
function groupSmallSlices(members,sector,threshold=OTHER_SHARE){
 const observed=members.filter(m=>Number.isFinite(m.cap)&&m.cap>0),total=observed.reduce((n,m)=>n+m.cap,0);
 const small=observed.filter(m=>m.cap/total<threshold),kept=observed.filter(m=>m.cap/total>=threshold);
 if(!small.length)return observed;
 return [...kept,{isOther:true,children:small,cap:small.reduce((n,m)=>n+m.cap,0),entity:{id:'OTHER::'+sector,name:'Other',sector,industry:sector,history:[],monthly:[]}}];
}
function showOtherTip(member,sector,event){
 const unit=companyMode()?'companies':'industries';
 showTip(`<strong>Other · ${esc(sector.name)}</strong><span>${member.children.length} ${unit} below 2% each · ${esc(frameLabel(state.year))}</span><br>Market cap (${esc(capBasis())}) <b>${currency(member.cap)}</b><br>Sector share <b>${(member.cap/sector.cap*100).toFixed(1)}%</b><br><span>Neutral grouping color; no combined valuation assigned.</span><br>Click to see all members.`,event.clientX,event.clientY);
}
function openOtherGroup(sectorName){
 stop();hideTip();
 const sector=groupSectorCaps(universe(),e=>observation(e)?.marketCap).find(g=>g.name===sectorName);
 const other=sector&&groupSmallSlices(sector.members,sectorName).find(m=>m.isOther);if(!other)return;
 const unit=companyMode()?'companies':'source industries';
 $('other-title').textContent='Other · '+sectorName;
 $('other-description').textContent=`${frameLabel(state.year)} · ${other.children.length} ${unit}, each below 2% of the sector. Combined market cap ${currency(other.cap)} (${(other.cap/sector.cap*100).toFixed(1)}% of the sector), in ${capBasis()}. Their caps remain in the sector total. The patterned slice is neutral; no combined valuation is assigned.`;
 const members=[...other.children].sort((a,b)=>b.cap-a.cap);
 $('other-members').innerHTML=`<table><thead><tr><th>${companyMode()?'COMPANY / TICKER':'INDUSTRY'}</th><th>MARKET CAP</th><th>FWD P/E</th></tr></thead><tbody>${members.map(m=>`<tr><td><button data-other-id="${esc(m.entity.id)}" title="${esc(m.entity.name)}">${esc(m.entity.name)}${companyMode()?`<small>${esc(m.entity.id)}</small>`:''}</button></td><td>${currency(m.cap)}</td><td>${multiple(observation(m.entity)?.fpe)}</td></tr>`).join('')}</tbody></table>`;
 $('other-members').querySelectorAll('[data-other-id]').forEach(button=>button.onclick=()=>{$('other-dialog').close();select(button.dataset.otherId);if(expandedChart)$('fullscreen-toggle').click();});
 $('other-dialog').showModal();
}
function sizeSectorCircles(layout,current){
 const byKey=new Map(current.map(g=>[g.key,g]));
 return layout.sectors.map(g=>{const present=byKey.get(g.key);return {...g,members:present?.members||[],cap:present?.cap||0,r:Math.sqrt(present?.cap||0)*layout.capScale};}).filter(g=>g.cap>0);
}
function companyPieSlices(members,radius){return d3.pie().sort(null).value(d=>d.cap)(members).map(d=>({...d,radius}));}
function circleLabelBox(startAngle,endAngle,radius){
 const angle=endAngle-startAngle;if(!(radius>0)||!(angle>0))return {x:0,y:0,side:0};
 if(angle>=Math.PI*2-1e-7)return {x:0,y:0,side:radius*1.35};
 const half=Math.min(Math.PI,angle)/2,sine=Math.sin(half),distance=radius/(1+sine),inner=distance*sine,mid=(startAngle+endAngle)/2;
 return {x:Math.sin(mid)*distance,y:-Math.cos(mid)*distance,side:Math.max(0,inner*Math.SQRT2-2)};
}
function showEntityTip(e,event){
 const p=observation(e),base=observation(e,state.baseline);if(!p)return;
 showTip(`<strong>${esc(e.name)}${companyMode()?' · '+esc(e.comparisonSourceId||e.id):''}</strong><span>${e.comparisonCountry?esc(e.comparisonCountry)+' · '+esc(e.comparisonName)+' · ':''}${esc(e.industry)} · ${esc(frameLabel(state.year))}</span><br>Market cap (${esc(capBasis())}) <b>${currency(p.marketCap)}</b><br>Forward P/E <b>${multiple(p.fpe)}</b>${state.dataset==='spIndustries'?`<br>P/E coverage <b>${p.fpeMemberCount}/${p.memberCount} firms · ${(p.fpeMarketCapCoverage*100).toFixed(1)}% cap</b>`:''}<br>Cap change vs ${esc(frameLabel(state.baseline))} <b>${pct(base?change(p.marketCap,base.marketCap):null)}</b><br><span>${esc(dateLabel(p.date))}</span>${p.cpiProxy?'<br><span>Inflation adjustment: Sep CPI used for Oct 2025.</span>':''}`,event.clientX,event.clientY);
}
const circleReferenceCache=new Map();let circleLayoutCache=null;
function renderCircleMap(holder,w,h,items,total,peak){
 const referenceKey=state.dataset+'|'+state.frequency+'|'+state.dollars;
 if(!circleReferenceCache.has(referenceKey))circleReferenceCache.set(referenceKey,referenceSectorCaps(entities()));
 const current=groupSectorCaps(items,e=>observation(e)?.marketCap);
 const absolute=state.scale==='absolute',key=referenceKey+'|'+w+'|'+h+'|'+state.scale+'|'+state.sector+'|'+state.industry;
 const existing=circleLayoutCache?.key===key;
 if(!existing)circleLayoutCache={key,reference:packSectorCircles(circleReferenceCache.get(referenceKey),w,h)};
 const duration=existing&&circleLayoutCache.frame!==state.year?transitionMs():0;
 circleLayoutCache.frame=state.year;
 const relativeKey=state.year+'|'+current.map(g=>g.cap).join(',');
 if(!absolute&&circleLayoutCache.relativeKey!==relativeKey){circleLayoutCache.relative=packSectorCircles(current,w,h);circleLayoutCache.relativeKey=relativeKey;}
 const layout=absolute?circleLayoutCache.reference:circleLayoutCache.relative;
 const sectors=sizeSectorCircles(layout,current);
 $('scale-note').textContent=(absolute?`Total cap: ${peak.total?(total/peak.total*100).toFixed(1):'0'}% of peak. Sector circles grow and shrink on a fixed cap scale across dates; centers stay fixed.`:'Relative size · Sector circles are packed to fit this snapshot; positions can move as sizes change.')+(companyMode()?' Circle area = sector cap; each slice = company cap.':' Circle area = observed sector total; slices show source industries, with no company breakdown.')+' Other groups slices below 2% each; click it to inspect members. Value basis: '+capBasis()+'.';
 $('map-area-label').textContent=absolute?'SECTOR CIRCLES · FIXED CAP SCALE':'SECTOR CIRCLES · RELATIVE SIZE';
 const svg=d3.select(holder).selectAll('svg').data([null]).join('svg').attr('data-layout','circles').attr('viewBox',`0 0 ${w} ${h}`).attr('role','group').attr('aria-label',companyMode()?'Separate sector circles sized by market cap and divided into company slices':'Separate sector circles sized by market cap and divided into source industries').attr('data-current-total',total).attr('data-cap-scale',layout.capScale);
 svg.selectAll('*').interrupt('circles');
 const pattern=svg.selectAll('defs.other-defs').data([null]).join('defs').attr('class','other-defs').selectAll('pattern').data([null]).join('pattern').attr('id','other-sector-fill').attr('patternUnits','userSpaceOnUse').attr('width',7).attr('height',7);
 pattern.selectAll('rect').data([null]).join('rect').attr('width',7).attr('height',7).attr('fill',missingColor);
 pattern.selectAll('path').data([null]).join('path').attr('d','M-1,1L1,-1M0,7L7,0M6,8L8,6').attr('stroke','#9eafa5').attr('stroke-opacity',.35).attr('stroke-width',1);
 const motion=selection=>duration?selection.transition('circles').duration(duration).ease(player.running?d3.easeLinear:d3.easeCubicInOut):selection;
 const disks=svg.selectAll('g.sector-disk').data(sectors,g=>g.key).join(enter=>{const g=enter.append('g').attr('class','sector-disk');g.append('circle').attr('class','sector-rim');g.append('text').attr('class','sector-label-primary');g.append('text').attr('class','sector-cap-label');g.append('title');return g;});
 motion(disks).attr('transform',g=>`translate(${g.x},${g.y})`);
 motion(disks.select('circle')).attr('r',g=>g.r);
 disks.select('title').text(g=>`${g.name}\nSector market cap ${currency(g.cap)}\n${g.members.filter(m=>m.cap>0).length} observed ${companyMode()?'companies':'source industries'}`);
 const sectorTitles={'Communication services':'COMM. SERVICES','Consumer discretionary':'CONSUMER DISC.','Consumer staples':'CONSUMER STAPLES'};
 const captions=disks.select('text.sector-label-primary').attr('text-anchor','middle').attr('font-size',w<600?8:10.5).text(g=>sectorTitles[g.name]||g.name.toUpperCase()).attr('role','button').attr('tabindex',0).attr('aria-label',g=>'Explore '+g.name).on('click',(_,g)=>focusGroup(g.name)).on('keydown',(event,g)=>{if(event.key==='Enter')focusGroup(g.name);});
 motion(captions).attr('y',g=>-g.r-17);
 const totals=disks.select('text.sector-cap-label').attr('text-anchor','middle').text(g=>currency(g.cap));motion(totals).attr('y',g=>-g.r-5);
 const names=companyMode()&&state.labels!=='ticker',dense=state.labels==='nameDense',arc=d3.arc().innerRadius(0).outerRadius(d=>d.radius);
 disks.each(function(sector){
  const slices=d3.select(this).selectAll('g.company-slice').data(companyPieSlices(groupSmallSlices(sector.members,sector.name),sector.r).filter(d=>d.data.cap>0),d=>d.data.entity.id).join(enter=>{const g=enter.append('g').attr('class','company-slice tile').attr('tabindex',0).attr('role','button');g.append('path');g.append('text').attr('class','tile-name');g.append('text').attr('class','tile-value');g.append('title');return g;});
  slices.classed('company-names',names).classed('other-slice',d=>!!d.data.isOther).classed('is-selected',d=>d.data.isOther?d.data.children.some(m=>m.entity.id===state.selected):d.data.entity.id===state.selected).classed('is-dimmed',d=>d.data.isOther?!matches(d.data.entity)&&!d.data.children.some(m=>matches(m.entity)):!matches(d.data.entity)).attr('aria-label',d=>d.data.isOther?`Other in ${sector.name}, ${d.data.children.length} ${companyMode()?'companies':'industries'}, market cap ${currency(d.data.cap)}; inspect members`:`${d.data.entity.name}, market cap ${currency(d.data.cap)}, forward P/E ${multiple(observation(d.data.entity)?.fpe)}`);
  const paths=slices.select('path').attr('fill',d=>d.data.isOther?'url(#other-sector-fill)':colorOf(colorValue(d.data.entity,observation(d.data.entity))));
  if(duration)paths.transition('circles').duration(duration).ease(player.running?d3.easeLinear:d3.easeCubicInOut).attrTween('d',function(d){const previous=this._circleArc||{startAngle:d.startAngle,endAngle:d.startAngle,radius:d.radius},interpolate=d3.interpolate(previous,{startAngle:d.startAngle,endAngle:d.endAngle,radius:d.radius});return t=>{this._circleArc=interpolate(t);return arc(this._circleArc);};});
  else paths.attr('d',function(d){this._circleArc={startAngle:d.startAngle,endAngle:d.endAngle,radius:d.radius};return arc(d);});
  slices.each(function(d){
   const e=d.data.entity,box=circleLabelBox(d.startAngle,d.endAngle,d.radius),g=d3.select(this),text=companyMode()?(names?companyTileName(e):e.id):e.name;
   let fit;
   if(d.data.isOther){const font=Math.min(16,box.side/3.5,box.side*.4);fit={lines:font>=5?['Other']:[],font,lineHeight:font*1.15,value:false};}
   else if(names||!companyMode())fit=fitCompanyLabel(text,box.side,box.side,measureCompanyText,dense);
   else{const font=Math.min(20,box.side/Math.max(2,text.length*.65),box.side*.4);fit={lines:font>=7?[text]:[],font,lineHeight:font*1.15,value:false};}
   const block=fit.lines.length*fit.lineHeight+(fit.value?18:0),top=box.y-block/2;
   const label=g.select('.tile-name').text('').attr('text-anchor','middle').attr('font-size',fit.font).attr('x',box.x);
   label.selectAll('tspan').data(fit.lines).join('tspan').text(line=>line).attr('x',box.x).attr('y',(_,i)=>top+fit.font+i*fit.lineHeight);
   const metric=d.data.isOther?'':metricText(e,observation(e));
   g.select('.tile-value').attr('text-anchor','middle').attr('font-size',10).attr('x',box.x).attr('y',top+fit.lines.length*fit.lineHeight+13).text(fit.value&&metric.length*6<box.side-10?metric:'');
  });
  slices.select('title').text(d=>d.data.isOther?`Other · ${sector.name}\n${d.data.children.length} ${companyMode()?'companies':'industries'} below 2% each\nMarket cap ${currency(d.data.cap)}\nSector share ${(d.data.cap/sector.cap*100).toFixed(1)}%\nClick to inspect members; no combined valuation assigned.`:`${d.data.entity.name}\n${sector.name}\nMarket cap ${currency(d.data.cap)}\nSector share ${(d.data.cap/sector.cap*100).toFixed(1)}%\nForward P/E ${multiple(observation(d.data.entity)?.fpe)}`);
  slices.on('click',(_,d)=>d.data.isOther?openOtherGroup(sector.name):select(d.data.entity.id)).on('keydown',(event,d)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();d.data.isOther?openOtherGroup(sector.name):select(d.data.entity.id);}}).on('pointermove',(event,d)=>d.data.isOther?showOtherTip(d.data,sector,event):showEntityTip(d.data.entity,event)).on('pointerleave',hideTip);
 });
 const hasOther=sectors.some(g=>groupSmallSlices(g.members,g.name).some(m=>m.isOther));
 d3.select('#legend').selectAll('span.other-stop').data(hasOther?[null]:[]).join('span').attr('class','legend-stop other-stop').attr('title','Other: grouped slices below 2% of their sector; neutral color, no combined valuation.').text('Other');
}
// Country baskets remain independent, with exact-date conversion into common USD.
const comparisonMarkets = () => [
 {key:'us',dataset:'companies',country:'United States',name:'S&P 500',currency:'USD'},
 {key:'de',dataset:'dax',country:'Germany',name:'DAX',currency:'EUR'},
 {key:'fr',dataset:'cac',country:'France',name:'CAC 40',currency:'EUR'},
 {key:'uk',dataset:'ftse',country:'United Kingdom',name:'FTSE 100',currency:'GBP'}
];
function comparisonUSD(point,currency,rates){
 if(currency==='USD')return point;
 const date=point.capDate||point.date,fx=rates[date],rate=Number.isFinite(fx?.USD)&&fx.USD>0&&Number.isFinite(fx?.[currency])&&fx[currency]>0?fx.USD/fx[currency]:null;
 return {...point,indexMarketCap:point.marketCap,indexCurrency:currency,indexFXRate:point.fxRate??1,indexFXSource:point.fxRateSource||null,
  marketCap:rate&&Number.isFinite(point.marketCap)&&point.marketCap>0?point.marketCap*rate:null,currency:'USD',sourceMarketCap:point.sourceMarketCap??point.marketCap,sourceCurrency:point.sourceCurrency||currency,
  fxRate:rate?(point.fxRate??1)*rate:null,fxDate:rate?date:null,fxRateSource:rate?(point.fxRateSource?point.fxRateSource+' + ':'')+'ECB to USD':null,
  comparisonFXRate:rate,comparisonFXDate:rate?date:null,comparisonFXSource:'ECB',comparisonFXUnavailable:!rate};
}
function buildComparisonData(markets){
 return comparisonMarkets().flatMap(m=>(markets[m.dataset]||[]).map(c=>({...c,id:m.key+':'+c.id,comparisonSourceId:c.id,comparisonMarket:m.key,comparisonCountry:m.country,comparisonName:m.name,comparisonCurrency:m.currency,comparisonDataset:m.dataset,history:[],monthly:(c.monthly||[]).map(p=>comparisonUSD(p,m.currency,markets.europe.fxRates))})));
}
function comparisonReferenceCaps(items,basis,series,frame=null){
 const totals=new Map();
 for(const c of items)for(const p of c.monthly||[]){
  if(frame!==null&&monthKey(p.month)!==frame)continue;
  const cap=dollarObservation(p,basis,series).marketCap;if(!(cap>0))continue;
  const key=c.comparisonMarket+'|'+p.month;totals.set(key,(totals.get(key)||0)+cap);
 }
 const result={};for(const [key,total] of totals){const market=key.split('|')[0];result[market]=Math.max(result[market]||0,total);}return result;
}
function comparisonGeometry(groups,width,height){
 const peak=Math.max(0,...groups.map(g=>g.referenceCap||0)),gap=12,minColumn=Math.min(140,(width-3*gap)/4),plotHeight=Math.max(20,height-132),root=g=>peak>0?Math.sqrt((g.referenceCap||0)/peak):0;
 const span=k=>groups.reduce((n,g)=>n+Math.max(minColumn,2*root(g)*k+14),0)+gap*(groups.length-1);
 let lo=0,hi=plotHeight/2;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(span(mid)<=width)lo=mid;else hi=mid;}
 let x=(width-span(lo))/2;
 return {areaPerDollar:peak>0?Math.PI*lo*lo/peak:0,reference:peak,groups:groups.map(g=>{const column=Math.max(minColumn,2*root(g)*lo+14),out={...g,x:x+column/2,y:78+plotHeight/2,r:peak>0?Math.sqrt(Math.max(0,g.cap||0)/peak)*lo:0,referenceR:root(g)*lo,column};x+=column+gap;return out;})};
}
const COMPARISON_OTHER_SHARE=.002;
let comparisonLayoutCache=null;
const comparisonPeakCache=new Map();
function comparisonGroups(items,frame=state.year){
 return comparisonMarkets().map(m=>{
  const members=items.filter(c=>c.comparisonMarket===m.key),observed=members.map(entity=>({entity,cap:observation(entity,frame)?.marketCap||0})),raw=members.map(c=>rawObservation(c,frame));
  return {...m,members:observed,cap:observed.reduce((n,m)=>n+(m.cap>0?m.cap:0),0),count:members.length,available:observed.filter(m=>m.cap>0).length,sourceCount:raw.filter(p=>p?.marketCap>0).length,peCount:raw.filter(p=>validPE(p?.fpe)).length,missingFX:raw.filter(p=>p?.comparisonFXUnavailable).length};
 });
}
function openComparisonOther(group){
 stop();hideTip();const other=groupSmallSlices(group.members,group.key,COMPARISON_OTHER_SHARE).find(m=>m.isOther);if(!other)return;
 $('other-title').textContent='Other · '+group.country+' · '+group.name;
 $('other-description').textContent=`${frameLabel(state.year)} · ${other.children.length} companies individually below 0.2% of this basket’s observed cap. Combined cap ${currency(other.cap)}, in ${capBasis()}. No combined P/E is assigned.`;
 $('other-members').innerHTML=`<table><thead><tr><th>COMPANY / TICKER</th><th>MARKET CAP</th><th>FWD P/E</th></tr></thead><tbody>${[...other.children].sort((a,b)=>b.cap-a.cap).map(m=>`<tr><td><button data-other-id="${esc(m.entity.id)}">${esc(m.entity.name)}<small>${esc(m.entity.comparisonSourceId)}</small></button></td><td>${currency(m.cap)}</td><td>${multiple(observation(m.entity)?.fpe)}</td></tr>`).join('')}</tbody></table>`;
 $('other-members').querySelectorAll('[data-other-id]').forEach(b=>b.onclick=()=>{$('other-dialog').close();select(b.dataset.otherId);if(expandedChart)$('fullscreen-toggle').click();});$('other-dialog').showModal();
}
function renderComparisonMap(holder,width,height,items){
 const w=Math.max(900,width),h=height,groups=comparisonGroups(items),full=comparisonGroups(entities()),key=state.dollars;
 if(!comparisonPeakCache.has(key))comparisonPeakCache.set(key,comparisonReferenceCaps(entities(),state.dollars,inflationSeries()));
 const references=state.scale==='absolute'?comparisonPeakCache.get(key):Object.fromEntries(full.map(g=>[g.key,g.cap]));
 const geometry=comparisonGeometry(groups.map(g=>({...g,referenceCap:references[g.key]||0})),w,h),layoutKey=JSON.stringify(['indices',state.layout,state.sector,state.industry,w,h]);
 if(comparisonLayoutCache?.key!==layoutKey)comparisonLayoutCache={key:layoutKey,trees:new Map(),frame:null};
 const duration=comparisonLayoutCache.frame===null?0:transitionMs(),motion=s=>duration?s.transition('comparison').duration(duration).ease(player.running?d3.easeLinear:d3.easeCubicInOut):s;
 if(holder.querySelector('svg')?.getAttribute('data-layout')!=='compare-'+state.layout)holder.innerHTML='';
 holder.classList.add('comparing');
 const svg=d3.select(holder).selectAll('svg').data([null]).join('svg').attr('data-layout','compare-'+state.layout).attr('role','group').attr('aria-label','Four country index baskets on one common USD market-cap scale').attr('viewBox',`0 0 ${w} ${h}`).style('width',w+'px').style('height',h+'px').style('max-width','none');
 svg.selectAll('*').interrupt('comparison');
 const defs=svg.selectAll('defs').data([null]).join('defs');
 const pattern=defs.selectAll('pattern').data([null]).join('pattern').attr('id','comparison-other').attr('width',5).attr('height',5).attr('patternUnits','userSpaceOnUse');pattern.selectAll('rect').data([null]).join('rect').attr('width',5).attr('height',5).attr('fill','#45564c');pattern.selectAll('path').data([null]).join('path').attr('d','M-1,1L1,-1M0,5L5,0M4,6L6,4').attr('stroke','#78887c').attr('stroke-width',.7);
 const countries=svg.selectAll('g.comparison-country').data(geometry.groups,g=>g.key).join('g').attr('class','comparison-country').attr('data-market',g=>g.key).attr('data-total',g=>g.cap).attr('data-cap-radius',g=>g.r);
 countries.each(function(group){
  const country=d3.select(this),us=groups.find(g=>g.key==='us'),labelWidth=group.column-8;
  country.selectAll('text.country-name').data([group]).join('text').attr('class','country-name').attr('x',group.x).attr('y',17).text(group.country.toUpperCase()).attr('role','button').attr('tabindex',0).attr('aria-label','Open '+group.country+' · '+group.name).style('pointer-events','auto').on('click',()=>chooseDataset(group.dataset,group.name)).on('keydown',ev=>{if(['Enter',' '].includes(ev.key)){ev.preventDefault();chooseDataset(group.dataset,group.name);}});
  country.selectAll('text.country-cap').data([group]).join('text').attr('class','country-cap').attr('x',group.x).attr('y',42).style('font-size',group.available?'20px':'12px').text(group.available?currency(group.cap):!group.count?'No matches':group.sourceCount&&state.dollars==='real'?'CPI unavailable':'Cap unavailable');
  country.selectAll('text.country-index').data([group]).join('text').attr('class','country-index').attr('x',group.x).attr('y',59).text(group.name+' · '+group.count+' names');
  country.selectAll('text.country-coverage').data([group]).join('text').attr('class','country-coverage').attr('x',group.x).attr('y',h-28).text(`Cap ${group.available}/${group.count} · P/E ${group.peCount}/${group.count}`);
  country.selectAll('text.country-ratio').data([group]).join('text').attr('class','country-ratio').attr('x',group.x).attr('y',h-11).text(group.key==='us'?'US basket reference':group.cap>0&&us?.cap>0?(100*group.cap/us.cap).toFixed(1)+'% of US basket':'No comparable cap');
  country.selectAll('.country-outline').remove();
  const shape=state.layout==='circles'?'circle':'rect';
  if(state.scale==='absolute'){
   const outline=country.append(shape).attr('class','country-outline');if(shape==='circle')outline.attr('cx',group.x).attr('cy',group.y).attr('r',group.referenceR);else outline.attr('x',group.x-group.referenceR).attr('y',group.y-group.referenceR).attr('width',2*group.referenceR).attr('height',2*group.referenceR);
  }
  country.selectAll('text.country-empty').data(group.available?[]:[group]).join('text').attr('class','country-empty').attr('x',group.x).attr('y',group.y).text(group.count?'No sized observations':'No matching companies');
  country.selectAll('g.country-content').data([group]).join('g').attr('class','country-content');const content=country.select('g.country-content');
  if(state.layout==='circles'){
   content.selectAll('g.compare-tile').remove();
   const slices=content.selectAll('g.compare-slice').data(companyPieSlices(groupSmallSlices(group.members,group.key,COMPARISON_OTHER_SHARE),group.r).filter(d=>d.data.cap>0),d=>d.data.entity.id).join(enter=>{const g=enter.append('g').attr('class','compare-slice').attr('role','button').attr('tabindex',0);g.append('path');g.append('text').attr('class','compare-name');g.append('text').attr('class','compare-value');g.append('title');return g;});
   motion(slices).attr('transform',`translate(${group.x},${group.y})`);
   const arc=d3.arc().innerRadius(0).outerRadius(d=>d.radius);
   slices.select('path').attr('fill',d=>d.data.isOther?'url(#comparison-other)':colorOf(colorValue(d.data.entity,observation(d.data.entity))));
   if(duration)slices.select('path').transition('comparison').duration(duration).ease(d3.easeLinear).attrTween('d',function(d){const from=this._comparisonArc||{startAngle:d.startAngle,endAngle:d.startAngle,radius:d.radius},interpolate=d3.interpolate(from,{startAngle:d.startAngle,endAngle:d.endAngle,radius:d.radius});return t=>{this._comparisonArc=interpolate(t);return arc(this._comparisonArc);};});else slices.select('path').attr('d',function(d){this._comparisonArc={startAngle:d.startAngle,endAngle:d.endAngle,radius:d.radius};return arc(d);});
   slices.each(function(d){
    const box=circleLabelBox(d.startAngle,d.endAngle,d.radius),e=d.data.entity,text=d.data.isOther?'Other':state.labels==='ticker'?e.comparisonSourceId:companyTileName(e),fit=fitCompanyLabel(text,box.side,box.side,measureCompanyText,state.labels==='nameDense'),top=box.y-(fit.lines.length*fit.lineHeight+(fit.value&&!d.data.isOther?18:0))/2;
    const g=d3.select(this),label=g.select('.compare-name').text('').attr('font-size',fit.font).attr('x',box.x);
    label.selectAll('tspan').data(fit.lines).join('tspan').attr('x',box.x).attr('y',(_,i)=>top+fit.font+i*fit.lineHeight).text(s=>s);
    g.select('.compare-value').attr('x',box.x).attr('y',top+fit.lines.length*fit.lineHeight+13).text(fit.value&&!d.data.isOther?metricText(e,observation(e)):'');
   });
   slices.attr('aria-label',d=>d.data.isOther?`Other in ${group.country}, ${d.data.children.length} companies, ${currency(d.data.cap)}`:`${group.country}: ${d.data.entity.name}, ${currency(d.data.cap)}, forward P/E ${multiple(observation(d.data.entity)?.fpe)}`).classed('is-selected',d=>d.data.entity.id===state.selected).classed('is-dimmed',d=>d.data.isOther?!d.data.children.some(m=>matches(m.entity)):!matches(d.data.entity));
   slices.select('title').text(d=>d.data.isOther?`Other · ${group.country} · ${d.data.children.length} companies · ${currency(d.data.cap)}`:`${d.data.entity.name} · ${group.country}\n${currency(d.data.cap)} · ${multiple(observation(d.data.entity)?.fpe)}`);
   slices.on('click',(_,d)=>d.data.isOther?openComparisonOther(group):select(d.data.entity.id)).on('keydown',(ev,d)=>{if(['Enter',' '].includes(ev.key)){ev.preventDefault();d.data.isOther?openComparisonOther(group):select(d.data.entity.id);}}).on('pointermove',(ev,d)=>d.data.isOther?showTip(`<strong>Other · ${esc(group.country)}</strong>${d.data.children.length} companies · ${currency(d.data.cap)}<br>Click to inspect members.`,ev.clientX,ev.clientY):showEntityTip(d.data.entity,ev)).on('pointerleave',hideTip);
  }else{
   content.selectAll('g.compare-slice').remove();
   if(!comparisonLayoutCache.trees.has(group.key)){
    const sectorGroups=d3.groups(group.members.map(m=>m.entity),e=>e.sector).sort((a,b)=>sectorRank(a[0])-sectorRank(b[0]));
    const root=d3.hierarchy({children:sectorGroups.map(([name,members])=>({name,children:members.sort((a,b)=>a.comparisonSourceId.localeCompare(b.comparisonSourceId)).map(entity=>({entity}))}))});
    const layout=d3.treemap().tile(d3.treemapResquarify).size([1,1]).padding(0).round(false);root.sum(d=>d.entity?historyOf(d.entity).at(-1)?.marketCap||1:0);layout(root);comparisonLayoutCache.trees.set(group.key,{root,layout});
   }
   const {root,layout}=comparisonLayoutCache.trees.get(group.key);root.sum(d=>d.entity?observation(d.entity)?.marketCap||0:0);layout(root);
   const tiles=content.selectAll('g.compare-tile').data(root.leaves().filter(d=>d.data.entity&&d.value>0),d=>d.data.entity.id).join(enter=>{const g=enter.append('g').attr('class','compare-tile').attr('role','button').attr('tabindex',0);g.append('rect');g.append('text').attr('class','compare-name');g.append('text').attr('class','compare-value');g.append('title');return g;});
   const side=2*group.r;motion(tiles).attr('transform',d=>`translate(${group.x-group.r+d.x0*side},${group.y-group.r+d.y0*side})`);
   motion(tiles.select('rect')).attr('width',d=>(d.x1-d.x0)*side).attr('height',d=>(d.y1-d.y0)*side).attr('fill',d=>colorOf(colorValue(d.data.entity,observation(d.data.entity))));
   tiles.each(function(d){
    const e=d.data.entity,tw=(d.x1-d.x0)*side,th=(d.y1-d.y0)*side,text=state.labels==='ticker'?e.comparisonSourceId:companyTileName(e),fit=fitCompanyLabel(text,tw,th,measureCompanyText,state.labels==='nameDense'),top=(th-fit.lines.length*fit.lineHeight-(fit.value?18:0))/2,g=d3.select(this),label=g.select('.compare-name').text('').attr('x',tw/2).attr('font-size',fit.font);
    label.selectAll('tspan').data(fit.lines).join('tspan').attr('x',tw/2).attr('y',(_,i)=>top+fit.font+i*fit.lineHeight).text(s=>s);
    const value=fit.value?metricText(e,observation(e)):'';g.select('.compare-value').attr('x',tw/2).attr('y',top+fit.lines.length*fit.lineHeight+13).text(value.length*6<tw-8?value:'');
   });
   tiles.attr('aria-label',d=>`${group.country}: ${d.data.entity.name}, ${currency(d.value)}, forward P/E ${multiple(observation(d.data.entity)?.fpe)}`).classed('is-selected',d=>d.data.entity.id===state.selected).classed('is-dimmed',d=>!matches(d.data.entity));tiles.select('title').text(d=>`${d.data.entity.name} · ${group.country}\n${currency(d.value)} · ${multiple(observation(d.data.entity)?.fpe)}`);
   tiles.on('click',(_,d)=>select(d.data.entity.id)).on('keydown',(ev,d)=>{if(['Enter',' '].includes(ev.key)){ev.preventDefault();select(d.data.entity.id);}}).on('pointermove',(ev,d)=>showEntityTip(d.data.entity,ev)).on('pointerleave',hideTip);
  }
 });
 const noCPI=state.dollars==='real'&&groups.every(g=>!g.available)&&groups.some(g=>g.sourceCount>0);
 const nominal=svg.selectAll('g.comparison-nominal').data(noCPI?[null]:[]).join(enter=>{const g=enter.append('g').attr('class','comparison-nominal').attr('role','button').attr('tabindex',0);g.append('rect');g.append('text');return g;}).attr('transform',`translate(${w/2-150},${h/2+38})`).attr('aria-label','View '+frameLabel(state.year)+' in nominal USD').on('click',()=>{stop();state.dollars='nominal';render();}).on('keydown',ev=>{if(['Enter',' '].includes(ev.key)){ev.preventDefault();stop();state.dollars='nominal';render();}});
 nominal.select('rect').attr('width',300).attr('height',34).attr('rx',4);nominal.select('text').attr('x',150).attr('y',22).text('View '+frameLabel(state.year)+' in nominal USD');
 comparisonLayoutCache.frame=state.year;
 $('map-title').textContent='Countries side by side'+(state.industry?' · '+state.industry:state.sector!=='All sectors'?' · '+state.sector:'');$('map-count').textContent='4 separate baskets · '+capBasis();$('map-area-label').textContent='ONE SHARED USD SCALE';
 $('scale-note').textContent=`${state.scale==='absolute'?'Fixed scale across dates; dashed outlines mark each basket’s largest observed cap.':'One shared scale at this date; the largest basket fits the chart.'} Area compares observed basket caps in ${capBasis()}, using exact cap-date ECB FX. Index baskets differ in size and coverage; these are not whole-country market totals.${state.layout==='circles'?' Other groups companies below 0.2% of each basket.':''}${width<900?' Scroll sideways or use full screen for all four.':''}`;
 if(state.layout==='circles')d3.select('#legend').append('span').attr('class','legend-stop other-stop').text('Other');
}

function renderMap(){
 if(state.dataset==='compare'){const holder=$('treemap');$('zoom-out').hidden=state.sector==='All sectors'&&!state.industry;renderComparisonMap(holder,holder.clientWidth,holder.clientHeight,universe());return;}
 $('treemap').classList.remove('comparing');
 const holder=$('treemap'),w=holder.clientWidth,h=holder.clientHeight,all=universe();
 const visible=all.filter(e=>observation(e)?.marketCap>0),total=d3.sum(visible,e=>observation(e).marketCap);
 const peak=referenceMarket(),absolute=state.scale==='absolute',scale=marketScaleGeometry(total,peak.total,state.scale);
 $('scale-note').textContent=absolute?`Map footprint: ${(scale.ratio*100).toFixed(1)}% of peak · Reference ${currency(peak.total)} (${frameLabel(peak.frame)}, full ${state.dataset==='companies'?'S&P 500':['largecaps','dax','cac','ftse'].includes(state.dataset)?marketInfo().name:industryMode()?'industry dataset':'imported dataset'}). Empty space shows the difference from that total.`:'Relative scale · The visible market fills the map in every snapshot.';
 $('scale-note').textContent+=' Value basis: '+capBasis()+'.';
 $('map-area-label').textContent=absolute?'FIXED MARKET-CAP SCALE':'AREA = MARKET CAP';
 $('map-title').textContent=state.industry||(state.sector!=='All sectors'?state.sector:state.dataset==='companies'?'S&P 500 · current members':state.dataset==='largecaps'?'US-listed large caps · 1,000 current issuers':state.dataset==='industries'?'US industries · annual archive':state.dataset==='spIndustries'?'S&P 500 industries · current members':state.dataset==='longrun'?'US industries · historical membership':'Imported snapshots');
 if(europeanDataset())$('map-title').textContent=marketInfo().name+' · '+(state.industry||(state.sector!=='All sectors'?state.sector:'current members'))+' · '+marketInfo().currency;
 $('zoom-out').hidden=state.sector==='All sectors'&&!state.industry;
 $('zoom-out').setAttribute('aria-label',state.industry?'Back to sector':'Back to all sectors');
 $('map-count').textContent=`${visible.length}/${all.length} ${industryMode()?'industries':'companies'} · ${visible.length?currency(total):'market cap unavailable'}${state.dollars==='real'?' · '+shortMonth(inflationSeries().baseMonth)+' '+marketInfo().symbol:''}`;
 if(!w)return;
 if(!visible.length){const hasSource=all.some(e=>rawObservation(e)?.marketCap>0);$('scale-note').textContent='Missing data is not a zero market cap. Value basis retained: '+capBasis()+'.';holder.innerHTML=hasSource&&state.dollars==='real'?`<div class="empty-state"><div><strong>${esc(frameLabel(state.year))} market data is available</strong><p>Inflation-adjusted caps are unavailable because this snapshot has no matching CPI. Your selected date and value basis are unchanged.</p><button id="show-nominal" type="button">View ${esc(frameLabel(state.year))} in nominal ${marketInfo().currency}</button></div></div>`:'<div class="empty-state"><div><strong>No source market caps for this snapshot</strong><p>The requested date is retained. See the source availability ranges below; no other date or dataset is substituted.</p></div></div>';if($('show-nominal'))$('show-nominal').onclick=()=>{stop();state.dollars='nominal';render();};return;}
 const layoutMode=state.layout==='circles'?'circles':'treemap';
 if(holder.querySelector('svg')?.getAttribute('data-layout')!==layoutMode)holder.innerHTML='';
 if(layoutMode==='circles'){renderCircleMap(holder,w,h,all,total,peak);return;}
 const key=JSON.stringify([state.dataset,state.frequency,state.sector,state.industry,w,h,all.map(e=>e.id)]);
 const existing=mapLayoutCache?.key===key;
 if(!existing)mapLayoutCache={key,...createStableTreemap(all,w,h,companyMode(),e=>historyOf(e).at(-1)?.marketCap||1)};
 if(!existing||mapLayoutCache.labelMode!==state.scale+'|'+state.dollars){mapLayoutCache.prepareLabels(years().slice(-60),(e,frame)=>observation(e,frame)?.marketCap,total=>marketScaleGeometry(total,peak.total,state.scale).factor);mapLayoutCache.labelMode=state.scale+'|'+state.dollars;}
 const duration=existing&&(mapLayoutCache.frame!==state.year||mapLayoutCache.scale!==state.scale||mapLayoutCache.dollars!==state.dollars)?transitionMs():0;
 const root=mapLayoutCache.update(e=>observation(e)?.marketCap);mapLayoutCache.frame=state.year;
 mapLayoutCache.scale=state.scale;mapLayoutCache.dollars=state.dollars;

 holder.querySelector('.empty-state')?.remove();
 const motion=selection=>duration?selection.transition('layout').duration(duration).ease(player.running?d3.easeLinear:d3.easeCubicInOut):selection;
 const svg=d3.select(holder).selectAll('svg').data([null]).join('svg').attr('data-layout','treemap').attr('viewBox',`0 0 ${w} ${h}`).attr('role','group').attr('aria-label',absolute?'Market capitalization by sector on a fixed dollar scale':'Market capitalization by sector').attr('data-scale-factor',scale.factor).attr('data-current-total',total).attr('data-reference-total',peak.total);
 svg.selectAll('*').interrupt('layout');
 svg.selectAll('rect.scale-reference').data(absolute?[null]:[]).join('rect').attr('class','scale-reference').attr('x',0).attr('y',0).attr('width',w).attr('height',h).attr('fill','none').attr('stroke','#72887c').attr('stroke-dasharray','4 5').attr('stroke-opacity',.6).attr('pointer-events','none');
 const content=svg.selectAll('g.market-content').data([null]).join('g').attr('class','market-content');
 motion(content).attr('transform',`scale(${scale.factor})`);
 // Keep headings outside the scaled tile layer: their type stays a fixed size.
 const labelLayer=svg.selectAll('g.group-labels').data([null]).join('g').attr('class','group-labels');
 const headings=root.descendants().filter(d=>d.children&&d.depth>0);
 const clips=svg.selectAll('defs').data([null]).join('defs').selectAll('clipPath').data(headings,d=>d.depth+'|'+d.data.name).join('clipPath').attr('id',(_,i)=>'heading-clip-'+i).attr('clipPathUnits','userSpaceOnUse');
 clips.each(function(d,i){d.headingClip='heading-clip-'+i;});
 motion(clips.selectAll('rect').data(d=>[d]).join('rect')).attr('x',d=>d.x0*scale.factor+3).attr('y',d=>d.y0*scale.factor).attr('width',d=>Math.max(0,(d.x1-d.x0)*scale.factor-6)).attr('height',d=>Math.max(0,(d.labelPadding-1)*scale.factor));
 const sectorLabels=labelLayer.selectAll('text.sector-label').data((root.children||[]).filter(d=>d.value>0&&d.labelSpec?.text),d=>d.data.name).join('text').attr('class','sector-label').attr('role','button').attr('tabindex',0).attr('aria-label',d=>'Explore '+d.data.name).style('font-size','8.5px').style('letter-spacing','.55px').text(d=>d.labelSpec.text).on('click',(_,d)=>focusGroup(d.data.name)).on('keydown',(event,d)=>{if(event.key==='Enter')focusGroup(d.data.name);});
 sectorLabels.attr('clip-path',d=>`url(#${d.headingClip})`);motion(sectorLabels).attr('x',d=>d.x0*scale.factor+5).attr('y',d=>d.y0*scale.factor+Math.min(14,d.labelPadding*scale.factor-2));
 const industryGroups=root.descendants().filter(d=>d.depth===2&&d.children&&d.value>0&&d.labelSpec?.text);
 const industryLabels=labelLayer.selectAll('text.industry-label').data(industryGroups,d=>d.data.sector+'|'+d.data.name).join('text').attr('class','industry-label').attr('role','button').attr('tabindex',0).attr('aria-label',d=>'Explore industry '+d.data.name).style('font-size','7px').text(d=>d.labelSpec.text).on('click',(_,d)=>focusGroup(d.data.sector,d.data.name)).on('keydown',(event,d)=>{if(event.key==='Enter')focusGroup(d.data.sector,d.data.name);});
 industryLabels.attr('clip-path',d=>`url(#${d.headingClip})`);motion(industryLabels).attr('x',d=>d.x0*scale.factor+4).attr('y',d=>d.y0*scale.factor+Math.min(10,d.labelPadding*scale.factor-1));
 const tiles=content.selectAll('g.tile').data(root.leaves().filter(d=>d.value>0),d=>d.data.entity.id).join(
 enter=>{const g=enter.append('g').attr('class','tile').attr('tabindex',0).attr('role','button').attr('transform',d=>`translate(${d.x0},${d.y0})`).style('opacity',duration?0:1);g.append('rect').attr('rx',2).attr('width',0).attr('height',0);g.append('text').attr('class','tile-name');g.append('text').attr('class','tile-value');g.append('title');return g;},
 update=>update,
 exit=>duration?exit.transition('layout').duration(duration).style('opacity',0).remove():exit.remove()
 );
 tiles.classed('is-selected',d=>d.data.entity.id===state.selected).classed('is-dimmed',d=>!matches(d.data.entity)).attr('aria-label',d=>`${d.data.entity.name}, ${(d.data.entity.symbols||[d.data.entity.id]).join(' / ')}, market cap ${currency(d.value)}, forward P/E ${multiple(observation(d.data.entity)?.fpe)}`);
 motion(tiles).attr('transform',d=>`translate(${d.x0},${d.y0})`).style('opacity',d=>matches(d.data.entity)?1:.15);
 motion(tiles.select('rect')).attr('width',d=>Math.max(0,d.x1-d.x0)).attr('height',d=>Math.max(0,d.y1-d.y0)).attr('fill',d=>colorOf(colorValue(d.data.entity,observation(d.data.entity))));
 const companyNames=companyMode()&&['name','nameDense','short'].includes(state.labels),denseNames=companyNames&&state.labels==='nameDense';
 tiles.classed('company-names',companyNames);
 const tileClips=tiles.selectAll('clipPath.tile-label-clip').data((d,i)=>[{node:d,id:'tile-label-clip-'+i}]).join('clipPath').attr('class','tile-label-clip').attr('id',d=>d.id);
 const labelInset=denseNames?.25:3;
 motion(tileClips.selectAll('rect').data(d=>[d.node]).join('rect')).attr('x',labelInset).attr('y',labelInset).attr('width',d=>Math.max(0,d.x1-d.x0-labelInset*2)).attr('height',d=>Math.max(0,d.y1-d.y0-labelInset*2));
 tiles.selectAll('.tile-name,.tile-value').attr('clip-path',(_,i,nodes)=>`url(#${nodes[i].parentNode.querySelector('.tile-label-clip').id})`);
 if(companyNames){
  tiles.each(function(d){
   const tw=d.x1-d.x0,th=d.y1-d.y0,factor=Math.max(.0001,scale.factor),fit=fitCompanyLabel(companyTileName(d.data.entity),tw*factor,th*factor,measureCompanyText,denseNames),g=d3.select(this);
   const blockHeight=fit.lines.length*fit.lineHeight+(fit.value?18:0),top=(th*factor-blockHeight)/2;
   const name=g.select('.tile-name').text('').attr('text-anchor','middle').attr('font-family','"DM Sans", sans-serif').attr('font-weight',600).attr('font-size',fit.font/factor).attr('x',tw/2).attr('y',0);
   name.selectAll('tspan').data(fit.lines).join('tspan').text(line=>line).attr('x',tw/2).attr('y',(_,i)=>(top+fit.font+i*fit.lineHeight)/factor);
   const metric=metricText(d.data.entity,observation(d.data.entity)),showValue=fit.lines.length&&fit.value&&metric.length*6<tw*factor-10;
   g.select('.tile-value').attr('text-anchor','middle').text(showValue?metric:'').attr('font-size',10/factor).attr('x',tw/2).attr('y',(top+fit.lines.length*fit.lineHeight+13)/factor);
  });
 }else{
  tiles.select('.tile-name').attr('font-family',null).attr('font-weight',null);
 const label=d=>companyMode()?d.data.entity.id:d.data.entity.name;
 const names=tiles.select('.tile-name').attr('text-anchor','middle').text(d=>{const tw=d.x1-d.x0,th=d.y1-d.y0;if(tw<29||th<26)return '';const text=label(d),max=Math.floor(tw/(companyMode()?7:5.5));return text.length>max?text.slice(0,Math.max(0,max-1))+'…':text;});
 motion(names).attr('x',d=>(d.x1-d.x0)/2).attr('y',d=>(d.y1-d.y0)/2-2).attr('font-size',d=>Math.max(9,Math.min(companyMode()?28:16,(d.x1-d.x0)/Math.max(4,label(d).length)*1.2,(d.y1-d.y0)/3)));
 const values=tiles.select('.tile-value').attr('text-anchor','middle').text(d=>d.x1-d.x0>43&&d.y1-d.y0>43?metricText(d.data.entity,observation(d.data.entity)):'');
 motion(values).attr('x',d=>(d.x1-d.x0)/2).attr('y',d=>(d.y1-d.y0)/2+15).attr('font-size',d=>Math.max(9,Math.min(14,(d.x1-d.x0)/8)));
 }
 tiles.select('title').text(d=>`${d.data.entity.name}\n${currency(d.value)}\nForward P/E: ${multiple(observation(d.data.entity)?.fpe)}`);
 tiles.on('click',(_,d)=>select(d.data.entity.id)).on('keydown',(event,d)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(d.data.entity.id);}}).on('pointermove',(event,d)=>showEntityTip(d.data.entity,event)).on('pointerleave',hideTip);
}
function renderDetail(){
 $('history-measure').value=state.historyMetric;
 $('history-title').textContent='History';
 const e=entities().find(e=>e.id===state.selected);document.querySelector('.detail').dataset.empty=String(!e);$('industry-members').hidden=state.dataset!=='spIndustries'||!e;
 if(!e){$('detail-name').textContent='Select a tile';for(const id of ['detail-pe','detail-cap','detail-growth','detail-range','detail-cheap'])$(id).textContent='—';for(const id of ['detail-ticker','detail-date','pe-context','detail-sector','line-range','detail-note','history-availability'])$(id).textContent='';$('source-link').hidden=true;$('history-chart').innerHTML='';return;}
 const p=observation(e),base=observation(e,state.baseline),hist=priorHistory(e),vals=hist.map(h=>h.fpe);
 $('detail-sector').textContent=e.sector.toUpperCase();$('detail-name').textContent=e.name;$('detail-ticker').textContent=companyMode()?(e.symbols||[e.id]).join(' / '):'';
 $('detail-date').textContent=p?(state.dataset==='longrun'?`Source month: ${frameLabel(state.year)} · ${p.firmCount.toLocaleString()} firms`:state.dataset==='industries'?`January update · cap ≈ ${dateLabel(p.capDate)}`:`${p.kind==='latest'?(p.dateBasis==='retrieval'?'Retrieved':'Latest source snapshot'):monthlyMode()?'Month-end source observation':'Fiscal year-end'} · ${dateLabel(p.date)}`):'No observation in this snapshot';
 if(state.dataset==='spIndustries'&&p)$('detail-date').textContent=`Monthly aggregate · ${p.memberCount}/${p.memberTotal} current companies with cap${p.date?' · '+dateLabel(p.date):p.sourceDateFrom?' · source dates '+dateLabel(p.sourceDateFrom)+'–'+dateLabel(p.sourceDateTo):''}`;
 $('detail-pe').textContent=multiple(p?.fpe);$('detail-cap').textContent=currency(p?.marketCap);
 const g=p&&base?change(p.marketCap,base.marketCap):null;$('detail-growth').textContent=pct(g);$('detail-growth').className=Number.isFinite(g)?g>=0?'up':'down':'';$('growth-label').textContent=`Cap vs ${frameLabel(state.baseline)}`;
 const own=p&&validPE(p.fpe)?percentile(vals,p.fpe):null;$('pe-context').textContent=Number.isFinite(own)?`Own-history percentile: ${Math.round(own)}% through ${frameLabel(state.year)}`:'Not enough history for a percentile';
 $('detail-range').textContent=vals.length?`${multiple(d3.min(vals))} / ${multiple(d3.max(vals))}`:'—';
 let cheap=0,n=0;
 for(const q of hist){const peers=entities().filter(x=>x.sector===e.sector&&(!e.comparisonMarket||x.comparisonMarket===e.comparisonMarket)).map(x=>observation(x,frameKey(q))?.fpe).filter(validPE);if(peers.length>=2){n++;if(q.fpe<d3.median(peers))cheap++;}}
 $('detail-cheap').textContent=n?`${cheap} / ${n} snapshots`:'—';
 $('line-range').textContent=hist.length?`${frameLabel(frameKey(hist[0]))} – ${frameLabel(state.year)}`:'';
 $('detail-note').textContent=state.dataset==='industries'?'Forward P/E is the source’s simple industry average. Sector grouping is app-defined.':!p?'This current constituent has no source market-cap observation in this snapshot. It is retained in the roster; no historical value is imputed.':(e.symbols?.length>1?`One company tile represents ${e.symbols.join(' / ')}. Company market cap is counted once. `:'')+'Historical forward P/E is source-reported. Forecast vintage is unverified.';
 if(p?.provider==='finhacker')$('detail-note').textContent='Rounded monthly market cap from FinHacker. No historical P/E is supplied for this observation. Current company membership and grouping are used; corporate restructurings may affect comparisons.';
 if(state.dataset==='longrun')$('detail-note').textContent=`Fama/French historical industry portfolio · ${p?p.firmCount.toLocaleString()+' firms. ':''}Cap = firm count × rounded average firm size (USD millions). Historical membership; SIC industries with app-defined sectors. No P/E data.`;
 if(state.dataset==='spIndustries'){$('detail-note').textContent=p?`P/E covers ${p.fpeMemberCount}/${p.memberCount} observed companies (${(p.fpeMarketCapCoverage*100).toFixed(1)}% of observed industry cap). It is the cap-weighted harmonic mean of positive reported ratios, not an all-member industry P/E. Missing estimates are excluded. Current membership and classifications are used throughout; coverage changes affect comparisons.`:'No component company market caps are available for this industry and month.';$('industry-members').textContent='Explore '+e.members.length+' underlying companies →';}
 if(state.dataset==='largecaps'){$('detail-note').textContent=(listingStatus(e,state.frequency,state.year)?`Not yet public at this snapshot. IPO: ${dateLabel(e.ipoDate)}. No pre-IPO valuation is supplied. `:!p?'No source cap for this month; no value is imputed. ':'')+(e.symbols?.length>1?`Share-class listings grouped: ${e.symbols.join(' / ')}. Full company cap is counted once. `:'')+(p?.sourceCurrency&&p.sourceCurrency!=='USD'?`Source cap in ${p.sourceCurrency}, converted to USD with same-day ${p.fxRateSource} rates (${p.fxDate}). `:'')+(e.capCurrencyVerification?'USD cap units verified against the provider’s dated USD market-cap page; conflicting API financial-currency metadata is retained in the source archive. ':'')+`Current top-1,000 roster throughout; survivorship bias. ${e.ipoDate?'Source-reported IPO: '+dateLabel(e.ipoDate)+'. ':''}Missing or nonpositive P/E remains unavailable; forecast vintage is unverified.`;if(listingStatus(e,state.frequency,state.year))$('detail-date').textContent='Not yet public · IPO '+dateLabel(e.ipoDate);}
 if(europeanDataset())$('detail-note').textContent=`Current ${marketInfo().name} membership throughout; survivorship bias. ${p?.sourceCurrency&&p.sourceCurrency!==marketInfo().currency?`Source cap in ${p.sourceCurrency}, converted to ${marketInfo().currency} using same-day ${p.fxRateSource||'ECB'} reference rates (${p.fxDate||'rate unavailable'}). `:`Caps in ${marketInfo().currency}. `}Full company caps, not free-float index weights. ${e.alternateSourceURL?'Data listing: '+e.valuationSourceSymbol+' (same issuer; local listing history unavailable). ':''}${!e.monthly.length?e.sourceAvailability+'. ':''}Forward-estimate vintage is unverified.`;
 if(state.dataset==='compare'){$('detail-sector').textContent=e.comparisonCountry.toUpperCase()+' · '+e.comparisonName+' · '+e.sector;$('detail-note').textContent=`${e.comparisonName} current basket; full company cap, not an entire country market. ${p?.indexCurrency?`Index cap ${p.indexMarketCap?.toLocaleString()} ${p.indexCurrency}, converted to USD using exact cap-date ECB rates (${p.comparisonFXDate||'unavailable'}). `:'Caps in USD. '}${p?.comparisonFXUnavailable?'No exact-date conversion rate: USD cap is unavailable; source month and P/E retained. ':''}${p?.provider==='finhacker'?'Rounded historical US cap; no P/E supplied. ':''}Current membership throughout; missing data stays missing. P/E percentiles and sector-peer counts use this basket’s own companies. USD purchasing-power adjustment uses US CPI for all baskets.`;}
 if(p?.dataNote)$('detail-note').textContent+=' '+p.dataNote;
 if(p?.cpiProxy||base?.cpiProxy)$('detail-note').textContent+=' Inflation adjustment uses Sep 2025 CPI for Oct 2025 observations because October US CPI is unavailable. Market-data dates and P/E are unchanged.';
 $('source-link').href=['companies','largecaps','compare'].includes(state.dataset)?(monthlyMode()?`https://stockanalysis.com/fundamental-chart/#p=${encodeURIComponent(e.id)}~peForward~d~l~s&r=5Y`:p?.sourceURL||`https://stockanalysis.com/stocks/${encodeURIComponent(e.id.toLowerCase())}/financials/ratios/`):state.dataset==='industries'?'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/dataarchived.html':'#';
 if(state.dataset==='compare')$('source-link').href=e.historicalSourceURL&&p?.provider==='finhacker'?e.historicalSourceURL:e.alternateSourceURL||e.sourceURL||`https://stockanalysis.com/fundamental-chart/#p=${encodeURIComponent(e.comparisonSourceId)}~peForward~d~l~s&r=5Y`;
 if(europeanDataset())$('source-link').href=e.alternateSourceURL||e.sourceURL;
 $('source-link').hidden=['imported','spIndustries'].includes(state.dataset);
 if(p?.provider==='finhacker')$('source-link').href=e.historicalSourceURL;
 if(state.dataset==='longrun')$('source-link').href=db.historical.longrun.source;
 $('history-measure').value=state.historyMetric;
 drawHistory(e);
}
function drawHistory(e){
 const holder=$('history-chart'),w=holder.clientWidth,h=holder.clientHeight,m={l:43,r:12,t:11,b:21},all=years().filter(y=>y<=state.year),cap=state.historyMetric==='marketCap',metric=cap?'marketCap':'fpe',hist=all.map(y=>observation(e,y)||{year:y,month:monthlyMode()?monthString(y):undefined}),valid=hist.filter(p=>validPE(p[metric]));
 const source=historyOf(e).filter(p=>validPE(p[metric])),sourceFrames=source.map(frameKey);$('history-availability').textContent=source.length?`${cap?'Source market cap':'Forward P/E'} available ${frameLabel(Math.min(...sourceFrames))} – ${frameLabel(Math.max(...sourceFrames))}; gaps may exist. Showing only observations through ${frameLabel(state.year)}${cap?' in '+capBasis():''}.`:`No ${cap?'market-cap':'forward P/E'} data for ${e.name} in this dataset. The chosen chart measure is retained.`;
 $('history-title').textContent='History';
 $('line-range').textContent=valid.length?`${frameLabel(frameKey(valid[0]))} – ${frameLabel(state.year)}`:'';
 holder.innerHTML='';if(!valid.length){holder.innerHTML='<p class="chart-empty">No '+(cap?'market-cap':'valuation')+' observations through this snapshot.</p>';return;}
 const svg=d3.select(holder).append('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('role','img').attr('aria-label',`${e.name} ${cap?'market cap':'forward P/E'} history through ${frameLabel(state.year)}${cap?' · '+capBasis():''}`);
 const xr=d3.extent(cap?all:all.filter(y=>y>=frameKey(valid[0])));if(xr[0]===xr[1]){xr[0]-=1;xr[1]+=1;}
 const x=d3.scaleLinear(xr,[m.l,w-m.r]),max=d3.max(valid,d=>d[metric])||1,y=d3.scaleLinear([0,max*1.18],[h-m.b,m.t]);
 for(const v of [0,max/2,max]){svg.append('line').attr('x1',m.l).attr('x2',w-m.r).attr('y1',y(v)).attr('y2',y(v)).attr('stroke','#e6ebdf');svg.append('text').attr('x',m.l-5).attr('y',y(v)+3).attr('text-anchor','end').attr('fill','#9aa68c').attr('font-size',8).text(cap?currency(v):Math.round(v)+'×');}
 const area=d3.area().defined(d=>validPE(d[metric])).x(d=>x(frameKey(d))).y0(h-m.b).y1(d=>y(d[metric]));
 svg.append('path').datum(hist).attr('d',area).attr('fill','#638254').attr('fill-opacity',.09);
 svg.append('path').datum(hist).attr('d',d3.line().defined(d=>validPE(d[metric])).x(d=>x(frameKey(d))).y(d=>y(d[metric]))).attr('fill','none').attr('stroke','#658355').attr('stroke-width',1.6);
 svg.selectAll('circle').data(valid).join('circle').attr('cx',d=>x(frameKey(d))).attr('cy',d=>y(d[metric])).attr('r',d=>frameKey(d)===state.year?3:valid.length>80?0:2).attr('fill',d=>frameKey(d)===state.year?'#2b6344':'#9daf83').append('title').text(d=>`${frameLabel(frameKey(d))}: ${cap?currency(d[metric]):multiple(d[metric])}${cap&&d.cpiProxy?' · Sep 2025 CPI used for Oct 2025':''}`);
 [xr[0],xr[1]].forEach(v=>svg.append('text').attr('x',x(v)).attr('y',h-3).attr('text-anchor',v===xr[0]?'start':'end').attr('fill','#9aa68c').attr('font-size',8).text(frameLabel(v)));
}
function render(){
 if(!db)return;
 if(viewNotice&&noticeSignature!==JSON.stringify(state))viewNotice='';
 if(!['nominal','real'].includes(state.dollars))state.dollars='nominal';
 renderDollarBasis();
 const capOnly=entities().some(e=>observation(e)?.marketCap>0)&&!entities().some(e=>validPE(observation(e)?.fpe));
 if(!['treemap','circles'].includes(state.layout))state.layout='treemap';
 $('map-layout').querySelector('option[value=circles]').textContent=state.dataset==='compare'?'Country circles':'Sector circles';$('map-scale').querySelector('option[value=relative]').textContent=state.dataset==='compare'?'Relative · shared scale':'Relative · fill space';
 $('map-layout').value=state.layout;$('treemap').setAttribute('aria-label',state.dataset==='compare'?'Country index baskets on one shared USD scale':state.layout==='circles'?'Market capitalization by separate sector circles':'Market capitalization treemap');
 if(!['ticker','name','nameDense','short'].includes(state.labels))state.labels='ticker';
 $('tile-labels').value=state.labels;$('tile-labels').disabled=!companyMode();
 if(!palettes[state.palette])state.palette='atlas';
 colors=palettes[state.palette].colors;missingColor=palettes[state.palette].missing;
 $('palette').value=state.palette;document.querySelector('.workspace').dataset.palette=state.palette;
 const ys=years();if(!player.running)paintTimeline(ys.indexOf(state.year));$('snapshot-label').textContent=frameLabel(state.year);$('snapshot-context').textContent=player.running?'Playing · 5 snapshots / second':state.dataset==='companies'?(monthlyMode()?'':state.year===db.meta.latestFrameYear?'Retrieved Oct 29, 2026':'Company fiscal dates vary'):state.dataset==='industries'?'Annual January update':state.dataset==='spIndustries'?'Monthly company aggregates':monthlyMode()?'Imported monthly observations':'Imported annual observations';
 if(!player.running&&state.dataset==='compare')$('snapshot-context').textContent='Four country baskets · common USD';
 else if(!player.running&&state.dataset==='longrun')$('snapshot-context').textContent='Historical membership';
 else if(!player.running&&state.dataset==='largecaps')$('snapshot-context').textContent='1,000 current US-listed issuers';
 else if(!player.running&&europeanDataset())$('snapshot-context').textContent=marketInfo().name+' · '+marketInfo().currency;
 else if(!player.running&&capOnly)$('snapshot-context').textContent='';
 $('month-picker').value=state.year;$('map-scale').value=state.scale;
 $('baseline').value=state.baseline;$('color').value=state.color;$('sector').value=state.sector;$('search').value=state.query;$('clear-search').hidden=!state.query;
 const displayNames={layout:state.layout==='circles'?(state.dataset==='compare'?'Country circles':'Sector circles'):'Treemap',color:$('color').selectedOptions[0]?.textContent||'',size:state.scale==='absolute'?'Fixed cap scale':'Relative size',dollars:state.dollars==='real'?'Inflation-adjusted '+shortMonth(inflationSeries().baseMonth)+' '+marketInfo().symbol:'Nominal '+marketInfo().currency,palette:(state.palette==='finviz'?'Finviz':'Atlas')+' palette',labels:companyMode()?(state.labels==='short'?'Short names':state.labels==='nameDense'?'Company names · small tiles':state.labels==='name'?'Company names':'Tickers'):'Industry names'};$('display-summary').textContent=Object.values(displayNames).join(' · ');
 $('back').disabled=ys.indexOf(state.year)===0;$('next').disabled=ys.indexOf(state.year)===ys.length-1;
 $('year-ticks').querySelectorAll('button').forEach(b=>b.classList.toggle('active',+b.dataset.year===state.year));
 $('dataset-note').textContent=state.dataset==='companies'?'Complete current S&P 500 roster · Share classes consolidated into one company tile. Current membership is used throughout, not historical index membership. '+(monthlyMode()?'Real month-end market caps and forward P/E; missing values stay blank. Industry archives remain annual.':'Fiscal dates differ.')+' Forecast vintage is unverified.':state.dataset==='industries'?'NYU Stern / Aswath Damodaran · Annual January snapshots. Cap is approximately prior year-end; forward P/E is a simple industry average. Constituents change over time.':'Imported dated snapshots · Session only. Source quality, metric definitions, and date alignment are determined by your file.';
 if(state.dataset==='companies'&&monthlyMode())$('dataset-note').textContent='Current S&P 500 members throughout: survivorship bias, not a historical index reconstruction. FinHacker supplies rounded monthly caps before October 2021; earlier coverage varies and corporate histories may include predecessor businesses. Stock Analysis supplies recent caps and forward P/E (Oct 2021–Oct 2026); September and October 2026 were refreshed November 2, 2026. No P/E is invented for older months. Empty space can reflect missing coverage as well as market size.';
 if(state.dataset==='longrun')$('dataset-note').textContent='Fama/French Data Library · 49 SIC industry portfolios, July 1926–September 2026. Historical NYSE, AMEX and NASDAQ membership; this is a different universe from the S&P 500 view. Approximate market cap = firm count × rounded mean firm size (USD millions). Source month labels; exact valuation day is unspecified. No P/E data. Sectors are app-defined.';
 if(state.dataset==='spIndustries')$('dataset-note').textContent='S&P 500 monthly industry aggregates · 126 current GICS sub-industries, grouped from the same saved company observations as the company map. Caps sum available company caps. Forward P/E = covered market cap ÷ sum of (company cap ÷ company forward P/E), using only positive reported ratios. Company counts and the covered cap share are disclosed per industry. Current membership introduces survivorship bias; older coverage is partial and provider forecast vintage is unverified. No annual archive data is carried forward or interpolated.';
 if(state.dataset==='largecaps')$('dataset-note').textContent='US-listed large caps · 1,000 current issuers, ranked by dated October 2026 company capitalization; retrieved November 2, 2026, including foreign US listings / ADRs. Independent of index membership; full company caps, not float weights. Share classes are grouped by SEC issuer identity. The current roster is used in all months, not historical top-1,000 membership. Added-company monthly cap and forward P/E coverage begins November 2021 or later; older coverage mainly reuses the existing current S&P 500 histories. IPO months begin only with public observations. Missing data is not filled; changing coverage can change map size. New listings are included on manual roster/data refresh, not live. Retired members’ collected observations are retained in the data archive.';
 if(state.dataset==='compare')$('dataset-note').textContent='Country comparison · Current S&P 500, DAX, CAC 40 and FTSE 100 baskets. These differ in constituent count and coverage; they are not complete country stock markets. Full company caps in a common USD scale, converted with ECB reference rates matching each cap’s exact date; no prior-date FX is carried forward. The four baskets stay separate: shared issuers such as Airbus can appear independently in both DAX and CAC. Their caps are never presented as a unique combined total. Local CPI is replaced by one common US CPI adjustment in this explicit comparison view. Current membership throughout, partial early coverage, unverified forward-estimate vintages. See each panel’s dated cap/P/E counts.';
 if(europeanDataset())$('dataset-note').textContent=`${marketInfo().name} · ${entities().length} current members, retrieved October 29, 2026. Separate market: no companies or scale reference are pooled with other indices. Real monthly Stock Analysis observations within the free five-year window, through October 2026. September and October 2026 data refreshed November 2, 2026. Current membership and current provider industry classifications are used throughout; this is not a historical index reconstruction. Caps in ${marketInfo().currency}, converted from provider reporting currency at exact-date ECB rates where needed. Full company caps, not float-adjusted index weights. Missing cap, P/E or FX is not filled. Historical forecast vintage is unverified; monthly revenue and net income are unavailable.`;
 renderCoverage();renderAvailability();renderSearch();
 renderLegend();renderMap();renderDetail();if(!player.running)persist();
}
function download(text,name,type='text/csv'){const u=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function csvCell(v){return '"'+String(v??'').replace(/"/g,'""')+'"';}
function parseCSV(text){
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<=text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else if(c===undefined)throw Error('Unclosed quoted field.');else cell+=c;}else if(c==='"'){if(cell)throw Error('Unexpected quote in CSV field.');quoted=true;}else if(c===','||c==='\n'||c===undefined){row.push(cell.trim());cell='';if(c!==','){if(row.some(Boolean))rows.push(row);row=[];}}else if(c!=='\r')cell+=c;}
 if(rows.length<2)throw Error('Add at least one data row.');const head=rows.shift();if(new Set(head).size!==head.length)throw Error('Duplicate CSV headers.');return rows.map((r,i)=>{if(r.length!==head.length)throw Error(`Row ${i+2} has ${r.length} fields; expected ${head.length}.`);return Object.fromEntries(head.map((k,j)=>[k,r[j]]));});
}
function importCSV(text){
 const rows=parseCSV(text);if(rows.some(r=>r.currency&&r.currency!=='USD'))throw Error('CSV imports currently require USD. This export retains its EUR/GBP currency; convert values explicitly before importing.');const required=['id','name','sector','industry','year','date','marketCap','fpe'];for(const k of required)if(!(k in rows[0]))throw Error(`Missing column: ${k}`);
 if(rows.length>50000)throw Error('Limit imports to 50,000 rows.');const grouped=new Map(),seen=new Set();
 rows.forEach((r,i)=>{const y=Number(r.year),cap=Number(r.marketCap),date=r.date,monthly=r.frequency==='monthly',month=date.slice(0,7),key=r.id+'|'+(monthly?month:y);if(!r.id||!r.name||!r.sector||!r.industry||!Number.isInteger(y)||y<1900||y>2100||!Number.isFinite(cap)||cap<=0||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error(`Invalid identifier, year, date, or market cap on row ${i+2}.`);if(r.frequency&&!['annual','monthly'].includes(r.frequency))throw Error('Frequency must be annual or monthly.');if(monthly&&y!==Number(date.slice(0,4)))throw Error('Monthly year must match its date.');if(seen.has(key))throw Error(`Duplicate observation for ${r.id}, ${y}.`);seen.add(key);
 const parse=(key)=>{if(r[key]===''||r[key]===undefined)return null;const v=Number(r[key]);if(!Number.isFinite(v))throw Error(`Invalid ${key} on row ${i+2}.`);return v;};
 let e=grouped.get(r.id);if(!e){e={id:r.id,name:r.name,sector:r.sector,industry:r.industry,history:[],monthly:[]};grouped.set(r.id,e);}else if(e.name!==r.name||e.sector!==r.sector||e.industry!==r.industry)throw Error(`Inconsistent identity or grouping for ${r.id}. Use one group per identifier.`);
 (monthly?e.monthly:e.history).push({...(monthly?{month}:{}),year:y,date,capDate:date,marketCap:cap,fpe:parse('fpe'),revenue:parse('revenue'),netIncome:parse('netIncome')});});
 return [...grouped.values()].map(e=>({...e,history:e.history.sort((a,b)=>a.year-b.year),monthly:e.monthly.sort((a,b)=>a.month.localeCompare(b.month))}));
}
function chooseDataset(dataset,label){
 stop();const previousFrequency=state.frequency,previousSnapshot=frameLabel(state.year);Object.assign(state,selectionForDataset(state,dataset));
 state.selected=null;viewNotice=`${label} selected. ${previousSnapshot} retained${previousFrequency!==state.frequency?' as '+(state.frequency==='monthly'?'January of the same year':'the same annual year label'):''}; display settings unchanged.`;
 if(state.dataset==='compare')viewNotice+=' Four separate baskets, one shared USD cap-to-area scale. These are index baskets, not entire country markets; exact-date FX and coverage apply.';
 if(state.dataset==='largecaps')viewNotice+=' Current top-1,000 roster; added-company history starts November 2021 or later. Earlier coverage is partial.';
 if(europeanDataset())viewNotice+=' Currency: '+marketInfo().currency+'. Monthly source window only; earlier dates stay unavailable.';
 setupDataset();render();
}
$('dataset-picker').onchange=event=>chooseDataset(event.target.value,event.target.selectedOptions[0].textContent);
$('monthly-industries-shortcut').onclick=()=>chooseDataset('spIndustries','Monthly S&P 500 industries');
$('industry-members').onclick=()=>{const group=entities().find(e=>e.id===state.selected);if(!group||state.dataset!=='spIndustries')return;stop();state.dataset='companies';state.sector=group.sector;state.industry=group.industry;state.selected=null;state.query='';viewNotice='Showing underlying current S&P 500 companies for '+group.name+'. Snapshot and display settings retained.';setupDataset();render();};
$('display-toggle').onclick=()=>{const collapsed=$('display-settings').classList.toggle('display-collapsed');$('display-toggle').setAttribute('aria-expanded',String(!collapsed));$('display-toggle').setAttribute('aria-label',collapsed?'Show display settings':'Hide display settings');};
$('map-scale').onchange=event=>{stop();state.scale=event.target.value;render();};
$('dollar-basis').onchange=event=>{stop();state.dollars=event.target.value;render();};
$('map-layout').onchange=event=>{const layout=event.target.value;stop();state.layout=layout;hideTip();mapLayoutCache=null;circleLayoutCache=null;render();};
$('tile-labels').onchange=event=>{state.labels=event.target.value;render();};
$('palette').onchange=event=>{state.palette=event.target.value;render();};
$('frequency').onchange=event=>{if(event.target.value===state.frequency)return;stop();const wasMonthly=monthlyMode(),frequency=event.target.value,toFrame=v=>!Number.isFinite(v)?v:wasMonthly?v/12|0:v*12;for(const key of ['year','baseline'])state[key]=toFrame(state[key]);state.frequency=frequency;viewNotice='Frequency changed by your selection. The same year is retained; annual-to-monthly uses January. Unsupported dates remain unavailable rather than switching to other data.';setupDataset();render();};
$('month-picker').onchange=event=>{const selectedFrame=+event.target.value;stop();state.year=selectedFrame;render();};
$('sector').onchange=event=>{state.sector=event.target.value;state.industry=null;if(!universe().some(e=>e.id===state.selected))state.selected=null;render();};
$('search').oninput=event=>{state.query=event.target.value;render();};$('clear-search').onclick=()=>{state.query='';render();$('search').focus();};
$('search').onkeydown=event=>{const items=[...$('search-results').querySelectorAll('[data-match]')];if(!items.length)return;if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();searchIndex=Math.max(0,Math.min(items.length-1,searchIndex+(event.key==='ArrowDown'?1:-1)));items.forEach((b,i)=>b.setAttribute('aria-selected',String(i===searchIndex)));}else if(event.key==='Enter'){event.preventDefault();items[Math.max(0,searchIndex)].click();}else if(event.key==='Escape'){state.query='';render();}};
$('zoom-out').onclick=()=>{if(state.industry)state.industry=null;else state.sector='All sectors';render();};
$('data-status').addEventListener('toggle',()=>{if($('data-status').open)stop();});
$('coverage-open').onclick=()=>{stop();$('roster-search').value='';$('coverage-dialog').showModal();renderRoster();};$('roster-search').oninput=renderRoster;
$('color').onchange=event=>{state.color=event.target.value;render();};$('baseline').onchange=event=>{state.baseline=+event.target.value;render();};
$('history-measure').onchange=event=>{state.historyMetric=event.target.value;render();};
$('timeline').oninput=event=>{const index=Math.round(+event.target.value);stop();state.year=years()[index];hideTip();render();};
for(const [id,delta] of [['back',-1],['next',1]])$(id).onclick=()=>{stop();const ys=years();state.year=ys[Math.max(0,Math.min(ys.length-1,ys.indexOf(state.year)+delta))];render();};
const player=createTimelinePlayer({getFrames:years,getFrame:()=>state.year,showFrame:(y,{instant=false}={})=>{state.year=y;if(instant){mapLayoutCache=null;circleLayoutCache=null;}hideTip();render();},onProgress:paintTimeline,onChange:running=>{$('play').innerHTML=running?'Ⅱ <span>Pause</span>':'▶ <span>Play</span>';$('play').setAttribute('aria-label',running?'Pause timeline':'Play timeline');$('play').setAttribute('aria-pressed',String(running));document.querySelector('.workspace').classList.toggle('is-playing',running);if(!running)render();}});
 $('play').onclick=()=>player.running?player.stop():player.start();
 $('unselect').onclick=()=>{state.selected=null;render();};
// Native fullscreen where supported, with the same viewport-filling layout as fallback.
const chartWorkspace=document.querySelector('.workspace');
let expandedChart=false,nativeChartFullscreen=false;
function setExpandedChart(expanded){
 expandedChart=expanded;hideTip();
 chartWorkspace.classList.toggle('is-fullscreen',expanded);
 document.body.classList.toggle('fullscreen-active',expanded);
 const button=$('fullscreen-toggle'),label=expanded?'Exit full screen':'Full screen';
 button.setAttribute('aria-label',expanded?'Exit chart full screen':'Expand chart to full screen');
 button.setAttribute('aria-pressed',String(expanded));button.title=expanded?'Exit full screen (Esc)':'Full screen';button.querySelector('span').textContent=label;
 requestAnimationFrame(()=>{mapLayoutCache=null;render();});
}
$('fullscreen-toggle').onclick=async()=>{
 if(expandedChart){
  if(document.fullscreenElement===chartWorkspace){try{await document.exitFullscreen();}catch{}}
  nativeChartFullscreen=false;setExpandedChart(false);$('fullscreen-toggle').focus();return;
 }
 setExpandedChart(true);
 if(chartWorkspace.requestFullscreen&&document.fullscreenEnabled){
  try{await chartWorkspace.requestFullscreen();nativeChartFullscreen=document.fullscreenElement===chartWorkspace;}catch{/* The viewport layout remains available. */}
 }
};
document.addEventListener('fullscreenchange',()=>{
 if(document.fullscreenElement===chartWorkspace)nativeChartFullscreen=true;
 else if(nativeChartFullscreen){nativeChartFullscreen=false;setExpandedChart(false);$('fullscreen-toggle').focus();}
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&expandedChart&&!document.querySelector('dialog[open]')){event.preventDefault();if(document.fullscreenElement===chartWorkspace)document.exitFullscreen().catch(()=>{});nativeChartFullscreen=false;setExpandedChart(false);$('fullscreen-toggle').focus();}
});
const openMethod=()=>{stop();$('method-dialog').showModal();};$('method').onclick=openMethod;document.querySelectorAll('.open-method').forEach(b=>b.onclick=openMethod);
document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());document.querySelectorAll('dialog').forEach(d=>d.onclick=event=>{if(event.target===d){const r=d.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)d.close();}});
$('export').onclick=()=>{
 const keys=['dataset','comparisonCountry','comparisonName','comparisonDataset','comparisonSourceId','indexCurrency','indexMarketCap','indexFXRate','indexFXSource','comparisonFXRate','comparisonFXDate','comparisonFXSource','currency','sourceCurrency','rawSeriesCurrency','capCurrencyEvidenceURL','sourceMarketCap','fxRate','fxDate','fxRateSource','valuationSourceSymbol','id','name','symbols','sector','industry','frequency','month','year','date','capDate','fpeDate','marketCap','displayMarketCap','dollarBasis','dollarBaseMonth','cpiMonth','cpiObservationMonth','cpiProxy','memberCount','memberTotal','fpeMemberCount','fpeCoveredMarketCap','fpeMarketCapCoverage','fpe','revenue','netIncome'];
 const rows=universe().filter(e=>matches(e)).flatMap(e=>historyOf(e).filter(h=>frameKey(h)<=state.year).map(h=>{const shown=displayedObservation(h);return {...e,...h,dataset:state.dataset,indexCurrency:h.indexCurrency||e.comparisonCurrency||'',indexMarketCap:h.indexMarketCap??(e.comparisonMarket?h.marketCap:undefined),currency:marketInfo().currency,displayMarketCap:shown.marketCap,dollarBasis:state.dollars,dollarBaseMonth:state.dollars==='real'?inflationSeries().baseMonth:'',cpiMonth:shown.cpiMonth||'',cpiObservationMonth:shown.cpiObservationMonth||'',cpiProxy:shown.cpiProxy||false,frequency:monthlyMode()?'monthly':'annual',symbols:(e.symbols||[e.id]).join('|')};}));
 download([keys.join(','),...rows.map(r=>keys.map(k=>csvCell(r[k])).join(','))].join('\n'),`market-time-lapse-${state.dataset}-${state.dollars}-through-${monthlyMode()?monthString(state.year):state.year}.csv`);toast(`Exported ${rows.length} rows · raw and display caps`);
};
$('import-open').onclick=()=>{$('import-status').textContent='';$('import-dialog').showModal();};$('template').onclick=()=>download('id,name,sector,industry,year,date,marketCap,fpe,revenue,netIncome\nEXAMPLE,Example company,Technology,Software,2022,2022-12-31,1000000000,15,100000000,10000000\nEXAMPLE,Example company,Technology,Software,2023,2023-12-31,1200000000,16,120000000,12000000\n','market-time-lapse-template.csv');
$('import-file').onchange=async event=>{const f=event.target.files[0];if(!f)return;try{if(f.size>10e6)throw Error('Choose a CSV smaller than 10 MB.');const data=importCSV(await f.text());db.imported=data;stop();state.frequency=data.some(e=>e.monthly.length)?'monthly':'annual';state.dataset='imported';state.sector='All sectors';state.industry=null;state.query='';state.selected=data[0]?.id;setupDataset();render();$('import-dialog').close();toast(`Imported ${data.length} names into this session`);}catch(err){$('import-status').textContent=err.message;}finally{event.target.value='';}};
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,120);});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
async function init(){try{const load=async name=>{const res=await fetch(name+'?v=shortnames-2026-11-v1');if(!res.ok)throw Error('Dataset could not be loaded.');return res.json();};const [current,archive,inflation,europe,largecaps]=await Promise.all([load('data.json'),load('data-history.json'),load('data-inflation.json'),load('data-europe.json'),load('data-largecaps.json')]);db=mergeHistoricalData(current,archive);const expanded=mergeHistoricalData({companies:largecaps.entities.filter(e=>largecaps.activeIds.includes(e.id))},archive,false);db.largecaps=expanded.companies;db.largecapMeta=largecaps.meta;db.inflation=inflation;db.europe=europe;Object.assign(db,europe.markets);if(!window.d3)throw Error('Chart library could not be loaded.');try{const saved=JSON.parse(localStorage.getItem('market-atlas-v3')||'null');if(saved&&['companies','largecaps','compare','industries','longrun','spIndustries','dax','cac','ftse'].includes(saved.dataset))Object.assign(state,Object.fromEntries(Object.keys(state).filter(key=>key in saved).map(key=>[key,saved[key]]))); }catch{}if(!['fpe','marketCap'].includes(state.historyMetric)){state.historyMetric='fpe';viewNotice='Automatic history-chart switching has been removed. Forward P/E is selected; use the chart selector to choose market cap explicitly.';}if(['longrun','spIndustries','largecaps','compare','dax','cac','ftse'].includes(state.dataset)&&state.frequency!=='monthly'||state.dataset==='industries'&&state.frequency!=='annual')Object.assign(state,selectionForDataset(state,state.dataset));setupDataset();render();document.querySelectorAll('[data-await-data]').forEach(e=>{e.removeAttribute('inert');e.setAttribute('aria-busy','false');});document.querySelectorAll('#dataset-picker').forEach(b=>b.disabled=false);}catch(err){$('treemap').innerHTML=`<div class="empty-state"><div><strong>Unable to load the map</strong><p>${esc(err.message)}</p><p>Reload the page to retry.</p></div></div>`;$('coverage').textContent='Data unavailable';document.querySelector('.workspace').setAttribute('aria-busy','false');document.querySelector('.workspace').removeAttribute('inert');document.querySelector('.toolbar').setAttribute('inert','');document.querySelector('.timeline').setAttribute('inert','');console.error(err);}}
// Expose pure calculation helpers for reproducible checks, without mutation hooks.
window.MarketAtlasMath={comparisonUSD,buildComparisonData,comparisonReferenceCaps,comparisonGeometry,listingStatus,percentile,change,cagr,parseCSV,importCSV,annualObservation,monthKey,monthString,createTimelinePlayer,createStableTreemap,PLAYBACK,peakMarketCap,marketScaleGeometry,mergeHistoricalData,inflationPoint,adjustMarketCap,dollarObservation,timelineFrames,selectionForDataset,coverageWindow,aggregateCompanyIndustries,fitCompanyLabel,companyDisplayName,companyShortName,groupSectorCaps,packSectorCircles,sectorShelfLayout,groupSmallSlices,sizeSectorCircles,companyPieSlices,circleLabelBox};
document.fonts?.ready.then(()=>{companyTextWidths.clear();if(db&&['name','nameDense','short'].includes(state.labels))renderMap();});
init();
})();
