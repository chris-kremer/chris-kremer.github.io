/* Market Atlas. All calculations use dated observations; missing years stay missing. */
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
const companyMode=()=>state.dataset==='companies'||europeanDataset();
const marketInfo=()=>europeanDataset()?db.europe.meta[state.dataset]:{name:'S&P 500',currency:'USD',symbol:'$'};
const inflationSeries=()=>europeanDataset()?db.europe.meta[state.dataset].inflation:db.inflation;
const sectorRank=name=>sectors.includes(name)?sectors.indexOf(name):sectors.length;
const state = {dataset:'companies',frequency:'monthly',dollars:'nominal',scale:'absolute',palette:'atlas',labels:'ticker',year:24320,baseline:24261,sector:'All sectors',industry:null,query:'',color:'fpe',selected:'MSFT',tab:'map',matrix:'absolute',start:null,horizon:3,outcome:'marketCap',historyMetric:'fpe'};
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
const entities = () => {if(state.dataset==='spIndustries'&&!db.spIndustries)db.spIndustries=aggregateCompanyIndustries(db.companies);return db[state.dataset] || [];};
const universe = () => entities().filter(e=>(state.sector==='All sectors'||e.sector===state.sector)&&(!state.industry||e.industry===state.industry));
const matches = (e,q=state.query) => !q || [e.id,e.name,e.sector,e.industry,...(e.symbols||[])].join(' ').toLowerCase().includes(q.trim().toLowerCase());
function timelineFrames(items,frequency,requested){
 const monthly=frequency==='monthly',values=items.flatMap(e=>(monthly?e.monthly||[]:e.history||[]).map(p=>monthly?monthKey(p.month):p.year));
 if(Number.isInteger(requested))values.push(requested);
 if(!values.length)return [];
 let lo=Infinity,hi=-Infinity;for(const v of values){lo=Math.min(lo,v);hi=Math.max(hi,v);}
 return Array.from({length:hi-lo+1},(_,i)=>lo+i);
}
const years = () => {const key=state.dataset+'|'+state.frequency;if(!framesCache.has(key))framesCache.set(key,timelineFrames(entities(),state.frequency,state.year));return framesCache.get(key);};
function selectionForDataset(current,dataset){
 const frequency=dataset==='industries'?'annual':['longrun','spIndustries','dax','cac','ftse'].includes(dataset)?'monthly':current.frequency;
 const convert=v=>!Number.isFinite(v)?v:current.frequency===frequency?v:frequency==='monthly'?v*12:Math.floor(v/12);
 return {...current,dataset,frequency,year:convert(current.year),baseline:convert(current.baseline),start:convert(current.start)};
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
 if(europeanDataset()&&state.tab==='map'){
  const missing=items.filter(e=>!rawObservation(e)?.marketCap);
  if(missing.length){$('availability-current').textContent=`${missing.length}/${items.length} members have no available ${marketInfo().currency} market cap at ${frameLabel(state.year)}${missing.length<=6?': '+missing.map(e=>e.name).join(', '):''}. They remain in the constituent roster; missing caps have no tile. No other month is substituted.`;$('availability-current').hidden=false;}
 }
 if(state.tab==='lab'){const startPE=items.filter(e=>validPE((monthlyMode()?observation(e,state.start):annualObservation(e,state.start))?.fpe)).length;$('availability-current').textContent=!startPE?'No starting forward P/E at '+frameLabel(state.start)+'. The selected lab settings are retained.':monthlyMode()&&state.outcome!=='marketCap'?'The chosen outcome has no monthly data. Select a different outcome or frequency to compare it.':'';$('availability-current').hidden=!$('availability-current').textContent;$('availability-box').dataset.incomplete=String(!startPE);}
 $('view-notice').textContent=viewNotice;$('view-notice').hidden=!viewNotice;
}

const annualYears = () => [...new Set(entities().flatMap(e=>e.history.filter(h=>h.kind!=='latest').map(h=>h.year)))].sort((a,b)=>a-b);
const annualObservation = (e,y) => displayedObservation(e.history.find(h=>h.year===Number(y)&&h.kind!=='latest'));
const analysisYears = () => {if(!monthlyMode())return annualYears();const key=state.dataset+'|valuation';if(!framesCache.has(key))framesCache.set(key,years().filter(y=>entities().some(e=>validPE(observation(e,y)?.fpe))));return framesCache.get(key);};
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
 return Number.isFinite(index)&&index>0?{month,index,observationMonth:month,proxy:false}:null;
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
 $('dollar-note').textContent=state.dollars==='real'?`Market caps in ${capBasis()} · ${series.name||'US CPI-U (BLS / FRED)'}. Exact observation-month CPI only; source range ${cpiRange}${!europeanDataset()?', except Oct 2025':''}. No prior-month or nominal fallback. P/E, revenue and earnings are unchanged.`:`Market caps in nominal ${marketInfo().currency}. Inflation adjustment uses ${series.name||'US CPI-U (BLS / FRED)'}; no currency conversion is performed by this toggle.`;
 const points=universe().map(e=>observation(e,state.tab==='lab'?state.start:state.year)).filter(p=>p?.nominalMarketCap>0),missing=points.filter(p=>!p.marketCap);
 $('dollar-warning').hidden=!missing.length;$('dollar-warning').textContent='';if(missing.length){const months=[...new Set(missing.map(p=>p.cpiObservationMonth?shortMonth(p.cpiObservationMonth):'unknown month'))];$('dollar-warning').textContent=`Adjusted cap unavailable for ${missing.length} observations (${months.join(', ')}): no matching CPI. Inflation adjustment remains selected; source caps are not substituted.`;}
 $('detail-cap-label').textContent=state.dollars==='real'?'Market cap · '+shortMonth(inflationSeries().baseMonth)+' '+marketInfo().symbol:'Market cap';
}
function mergeHistoricalData(data,archive){
 for(const e of data.companies){
  const source=archive.companies[e.id],recent=new Set(e.monthly.map(h=>h.month));
  e.historicalSourceURL=source?.url;
  const old=(source?.rows||[]).filter(([date])=>!recent.has(date.slice(0,7))).map(([date,marketCap])=>({month:date.slice(0,7),year:+date.slice(0,4),date,capDate:date,marketCap,fpe:null,pe:null,revenue:null,netIncome:null,kind:'historical',provider:'finhacker'}));
  e.monthly=[...old,...e.monthly].sort((a,b)=>a.month.localeCompare(b.month));
 }
 data.longrun=archive.longrun.industries.map(e=>({...e,history:[],monthly:e.rows.map(([month,marketCap,firmCount,averageFirmSizeMillions])=>({month,year:+month.slice(0,4),date:null,capDate:null,marketCap,firmCount,averageFirmSizeMillions,fpe:null,pe:null,revenue:null,netIncome:null,kind:'research',provider:'fama-french'}))}));
 data.historical=archive;
 return data;
}
function persist(){try{localStorage.setItem('market-atlas-v3',JSON.stringify({...state,query:''}));}catch{}}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;setTimeout(()=>$('toast').hidden=true,3200);}
function stop(){player.stop();}
function select(id){state.selected=id;render();}
function focusGroup(sector,industry=null){state.sector=sector;state.industry=industry;state.query='';if(!universe().some(e=>e.id===state.selected))state.selected=null;render();}
function setupDataset(){
 framesCache.clear();peakCache.clear();availabilityCache.clear();mapLayoutCache=null;
 const ys=years(); if(!ys.length)throw new Error('Dataset contains no dated snapshots.');
 if(!Number.isInteger(state.year))state.year=ys.at(-1);
 if(!Number.isInteger(state.baseline))state.baseline=ys[0];
 const ays=analysisYears(),starts=ays.filter(y=>y+(monthlyMode()?12:1)<=ays.at(-1));if(!Number.isInteger(state.start))state.start=starts[0]??ays[0]??ys[0];
 const opts=['All sectors',...new Set(entities().map(e=>e.sector))];
 if(!opts.includes(state.sector)){viewNotice+=' Sector filter '+state.sector+' is absent from this dataset and has been cleared.';state.sector='All sectors';}
 if(state.industry&&!entities().some(e=>e.industry===state.industry&&(state.sector==='All sectors'||e.sector===state.sector))){viewNotice+=' The sub-industry filter is absent from this dataset and has been cleared.';state.industry=null;}
 $('sector').innerHTML=opts.map(s=>`<option>${esc(s)}</option>`).join('');$('sector').value=state.sector;
 $('baseline').innerHTML=[...new Set([...ys,state.baseline])].sort((a,b)=>a-b).map(y=>`<option value="${y}">${frameLabel(y)}</option>`).join('');
 $('lab-start').innerHTML=[...new Set([...starts,state.start])].sort((a,b)=>a-b).map(y=>`<option value="${y}">${frameLabel(y)}</option>`).join('');
 $('timeline').max=ys.length-1;
 const yearStep=Math.max(1,Math.ceil((ys.at(-1)-ys[0])/12/8/5)*5);
 const ticks=monthlyMode()?ys.filter((y,i)=>i===0||i===ys.length-1||y%12===0&&Math.floor(y/12)%yearStep===0&&i>12&&i<ys.length-13):ys.length>10?ys.filter((y,i)=>i===0||i===ys.length-1||y%Math.max(5,Math.ceil((ys.at(-1)-ys[0])/8/5)*5)===0):ys;
 $('year-ticks').innerHTML=ticks.map(y=>`<button type="button" data-year="${y}">${frameLabel(y)}</button>`).join('');
 $('month-picker').hidden=false;$('month-picker').setAttribute('aria-label',monthlyMode()?'Choose snapshot month':'Choose snapshot year');$('month-picker').innerHTML=ys.map(y=>`<option value="${y}">${frameLabel(y)}</option>`).join('');
 $('frequency').value=state.frequency;$('frequency-wrap').hidden=false;$('frequency').disabled=industryMode()||europeanDataset();
 $('timeline').setAttribute('aria-label',monthlyMode()?'Snapshot month':'Snapshot year');
 $('year-ticks').querySelectorAll('button').forEach(b=>b.onclick=()=>{stop();state.year=+b.dataset.year;render();});
 const capWindow=sourceWindows().cap;$('coverage').textContent=`${entities().length} ${industryMode()?'industries':'current companies'} · source cap ${capWindow?frameLabel(capWindow.first)+'–'+frameLabel(capWindow.last):'unavailable'} · ${state.frequency}`;
 $('dataset-picker').value=state.dataset;$('imported-option').hidden=!db.imported;
 if(!universe().some(e=>e.id===state.selected))state.selected=null;
 noticeSignature=JSON.stringify(state);
}
function renderCoverage(){
 const all=universe(),frame=state.tab==='lab'?state.start:state.year,caps=all.filter(e=>rawObservation(e,frame)?.marketCap>0),pes=all.filter(e=>validPE(rawObservation(e,frame)?.fpe)),adjusted=all.filter(e=>observation(e,frame)?.marketCap>0);
 $('coverage-summary').textContent=`${state.tab==='lab'?'Start '+frameLabel(state.start)+' · ':''}Market cap ${caps.length}/${all.length} · Forward P/E ${pes.length}/${all.length}${state.dollars==='real'?' · CPI-adjusted '+adjusted.length+'/'+all.length:''}`;
 if(state.dataset==='spIndustries'){const observed=caps.reduce((n,e)=>n+rawObservation(e,frame).memberCount,0),peMembers=caps.reduce((n,e)=>n+rawObservation(e,frame).fpeMemberCount,0),total=all.reduce((n,e)=>n+e.members.length,0);$('coverage-summary').textContent+=` · Company caps ${observed}/${total} · P/E ${peMembers}/${observed}`;}
 $('coverage-open').textContent=state.dataset==='companies'?`Browse all ${db.meta.constituentCount} constituent tickers ↗`:'Browse all '+entities().length+(companyMode()?' companies ↗':' industries ↗');
 $('coverage-description').textContent=state.dataset==='companies'?`All ${db.meta.constituentCount} current constituent symbols, grouped into ${db.meta.issuerCount} companies to avoid counting the same company market cap twice. Membership verified October 29, 2026. This list includes members with missing historical data.`:`All ${entities().length} names in this dataset. Coverage is for ${frameLabel(state.year)}.`;
 if(europeanDataset())$('coverage-description').textContent=`All ${entities().length} current ${marketInfo().name} companies. Roster retrieved October 29, 2026. Current membership is used throughout; this is not a historical index reconstruction. Caps are in ${marketInfo().currency}, with full company capitalization rather than free-float index weights. Missing observations remain in the roster.`;
 if(state.dataset==='spIndustries')$('coverage-description').textContent='Current S&P 500 companies grouped into '+entities().length+' GICS sub-industries. Market cap is the sum of observed company caps. Forward P/E is calculated only from firms with positive reported ratios; the covered company count and cap share are shown for every industry. This is not the broader annual NYU industry universe.';
 if($('coverage-dialog').open)renderRoster();
}
function renderRoster(){
 const q=$('roster-search').value.trim(),all=entities().filter(e=>matches(e,q)).sort((a,b)=>a.name.localeCompare(b.name));
 const caps=entities().filter(e=>rawObservation(e)?.marketCap>0),pes=entities().filter(e=>validPE(rawObservation(e)?.fpe));
 $('coverage-totals').textContent=`${frameLabel(state.year)} · source caps ${caps.length}/${entities().length} · displayed caps ${entities().filter(e=>observation(e)?.marketCap>0).length}/${entities().length} (${capBasis()}) · ${pes.length}/${entities().length} forward P/E ratios · matches: ${all.length}`;
 $('roster-table').innerHTML=`<table><thead><tr><th>${industryMode()?'INDUSTRY':'COMPANY / TICKERS'}</th><th>SECTOR</th><th>MARKET CAP · ${esc(capBasis())}</th><th>FWD P/E</th></tr></thead><tbody>${all.map(e=>{const p=observation(e);return `<tr><td><button data-roster="${esc(e.id)}">${esc(e.name)}<small>${esc(state.dataset==='spIndustries'?e.members.length+' current companies':(e.symbols||[e.id]).join(' / '))}</small></button></td><td>${esc(e.sector)}</td><td>${currency(p?.marketCap)}</td><td>${multiple(p?.fpe)}${state.dataset==='spIndustries'&&p?`<small class="ratio-coverage">${p.fpeMemberCount}/${p.memberCount} firms · ${(p.fpeMarketCapCoverage*100).toFixed(0)}% cap</small>`:''}</td></tr>`;}).join('')}</tbody></table>`;
 $('roster-table').querySelectorAll('[data-roster]').forEach(b=>b.onclick=()=>{state.selected=b.dataset.roster;state.query='';state.sector='All sectors';state.industry=null;state.tab='map';$('coverage-dialog').close();render();});
}
function renderSearch(){
 const holder=$('search-results'),show=state.tab==='map'&&state.query.trim().length>0;
 holder.hidden=!show;$('search').setAttribute('aria-expanded',String(show));if(!show){holder.innerHTML='';searchIndex=-1;return;}
 const fieldBox=document.querySelector('.search').getBoundingClientRect(),workspaceBox=document.querySelector('.workspace').getBoundingClientRect(),resultsWidth=Math.min(430,workspaceBox.width-24);
 holder.style.top=(fieldBox.bottom-workspaceBox.top+8)+'px';holder.style.left=Math.max(12,Math.min(fieldBox.left-workspaceBox.left,workspaceBox.width-resultsWidth-12))+'px';holder.style.width=resultsWidth+'px';
 const found=entities().filter(e=>matches(e));const exact=state.query.trim().toUpperCase();found.sort((a,b)=>Number((b.symbols||[b.id]).includes(exact))-Number((a.symbols||[a.id]).includes(exact))||a.name.localeCompare(b.name));
 holder.innerHTML=`<div class="search-count">${found.length} matches${found.length>8?' · showing the first 8, type more to narrow':''}</div>${found.slice(0,8).map(e=>`<button type="button" role="option" aria-selected="false" data-match="${esc(e.id)}"><span><strong>${esc(state.dataset==='spIndustries'?e.name:(e.symbols||[e.id]).join(' / '))}</strong> ${esc(state.dataset==='spIndustries'?e.members.length+' current companies':e.name)}</span><small>${currency(observation(e)?.marketCap)} · ${multiple(observation(e)?.fpe)}</small></button>`).join('')}`;
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
// Fit names in screen pixels so fixed-dollar scaling never creates microscopic type.
function companyDisplayName(name){return String(name).replace(/,?\s+(?:(?:Inc(?:orporated)?|Corp(?:oration)?|Ltd|Limited)\.?|PLC)$/i,'').trim();}
function fitCompanyLabel(text,width,height,measure){
 const empty={lines:[],font:11,lineHeight:13,value:false};
 if(width<38||height<20)return empty;
 const available=width-10,value=width>=58&&height>=56,reserve=value?18:0,maxHeight=height-8-reserve;
 const wrap=(font,maxLines)=>{
  const words=text.split(/\s+/),lines=[];let line='';
  for(const word of words){const next=line?line+' '+word:word;if(measure(next,font)<=available){line=next;continue;}if(line)lines.push(line);line=word;if(lines.length>=maxLines||measure(word,font)>available)return null;}
  if(line)lines.push(line);return lines.length<=maxLines?lines:null;
 };
 for(let font=26;font>=11;font--){const lineHeight=font*1.15,maxLines=Math.min(3,Math.floor(maxHeight/lineHeight));if(maxLines<1)continue;const lines=wrap(font,maxLines);if(lines)return {lines,font,lineHeight,value};}
 const font=11,lineHeight=13,maxLines=Math.min(3,Math.floor(maxHeight/lineHeight));if(maxLines<1)return empty;
 const clip=word=>{if(measure(word,font)<=available)return word;let n=word.length;while(n>0&&measure(word.slice(0,n).trimEnd()+'…',font)>available)n--;return word.slice(0,n).trimEnd()+'…';};
 const lines=[];let line='',overflow=false;
 for(const word of text.split(/\s+/)){
  const next=line?line+' '+word:word;
  if(measure(next,font)<=available){line=next;continue;}
  if(line){lines.push(line);line='';}
  if(lines.length>=maxLines){overflow=true;break;}
  if(measure(word,font)>available)lines.push(clip(word));else line=word;
  if(lines.length>=maxLines){overflow=true;break;}
 }
 if(line&&lines.length<maxLines)lines.push(line);
 if(overflow&&lines.length){const last=lines.at(-1).replace(/…$/,'');lines[lines.length-1]=clip(last+'…');}
 return {lines,font,lineHeight,value};
}
let companyTextContext;
const companyTextWidths=new Map();
function measureCompanyText(text,size){
 const key=size+'|'+text;if(companyTextWidths.has(key))return companyTextWidths.get(key);
 companyTextContext??=document.createElement('canvas').getContext('2d');companyTextContext.font=`600 ${size}px "DM Sans", sans-serif`;
 const width=companyTextContext.measureText(text).width;if(companyTextWidths.size>12000)companyTextWidths.clear();companyTextWidths.set(key,width);return width;
}
function renderMap(){
 const holder=$('treemap'),w=holder.clientWidth,h=holder.clientHeight,all=universe();
 const visible=all.filter(e=>observation(e)?.marketCap>0),total=d3.sum(visible,e=>observation(e).marketCap);
 const peak=referenceMarket(),absolute=state.scale==='absolute',scale=marketScaleGeometry(total,peak.total,state.scale);
 $('scale-note').textContent=absolute?`Map footprint: ${(scale.ratio*100).toFixed(1)}% of peak · Reference ${currency(peak.total)} (${frameLabel(peak.frame)}, full ${state.dataset==='companies'?'S&P 500':europeanDataset()?marketInfo().name:industryMode()?'industry dataset':'imported dataset'}). Empty space shows the difference from that total.`:'Relative scale · The visible market fills the map in every snapshot.';
 $('scale-note').textContent+=' Value basis: '+capBasis()+'.';
 $('map-area-label').textContent=absolute?'FIXED MARKET-CAP SCALE':'AREA = MARKET CAP';
 $('map-title').textContent=state.industry||(state.sector!=='All sectors'?state.sector:state.dataset==='companies'?'S&P 500 · current members':state.dataset==='industries'?'US industries · annual archive':state.dataset==='spIndustries'?'S&P 500 industries · current members':state.dataset==='longrun'?'US industries · historical membership':'Imported snapshots');
 if(europeanDataset())$('map-title').textContent=marketInfo().name+' · '+(state.industry||(state.sector!=='All sectors'?state.sector:'current members'))+' · '+marketInfo().currency;
 $('zoom-out').hidden=state.sector==='All sectors'&&!state.industry;
 $('zoom-out').setAttribute('aria-label',state.industry?'Back to sector':'Back to all sectors');
 $('map-count').textContent=`${visible.length}/${all.length} ${industryMode()?'industries':'companies'} · ${visible.length?currency(total):'market cap unavailable'}${state.dollars==='real'?' · '+shortMonth(inflationSeries().baseMonth)+' '+marketInfo().symbol:''}`;
 if(!w)return;
 const key=JSON.stringify([state.dataset,state.frequency,state.sector,state.industry,w,h,all.map(e=>e.id)]);
 const existing=mapLayoutCache?.key===key;
 if(!existing)mapLayoutCache={key,...createStableTreemap(all,w,h,companyMode(),e=>historyOf(e).at(-1)?.marketCap||1)};
 if(!existing||mapLayoutCache.labelMode!==state.scale+'|'+state.dollars){mapLayoutCache.prepareLabels(years().slice(-60),(e,frame)=>observation(e,frame)?.marketCap,total=>marketScaleGeometry(total,peak.total,state.scale).factor);mapLayoutCache.labelMode=state.scale+'|'+state.dollars;}
 const duration=existing&&(mapLayoutCache.frame!==state.year||mapLayoutCache.scale!==state.scale||mapLayoutCache.dollars!==state.dollars)?transitionMs():0;
 const root=mapLayoutCache.update(e=>observation(e)?.marketCap);mapLayoutCache.frame=state.year;
 mapLayoutCache.scale=state.scale;mapLayoutCache.dollars=state.dollars;
 if(!visible.length){const hasSource=all.some(e=>rawObservation(e)?.marketCap>0);$('scale-note').textContent='Missing data is not a zero market cap. Value basis retained: '+capBasis()+'.';holder.innerHTML=hasSource&&state.dollars==='real'?'<div class="empty-state"><div><strong>Inflation-adjusted market cap unavailable</strong><p>Source market caps exist, but this snapshot has no matching CPI. Inflation adjustment remains selected; no nominal or prior-month values are substituted.</p></div></div>':'<div class="empty-state"><div><strong>No source market caps for this snapshot</strong><p>The requested date is retained. See the source availability ranges below; no other date or dataset is substituted.</p></div></div>';return;}
 holder.querySelector('.empty-state')?.remove();
 const motion=selection=>duration?selection.transition('layout').duration(duration).ease(player.running?d3.easeLinear:d3.easeCubicInOut):selection;
 const svg=d3.select(holder).selectAll('svg').data([null]).join('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('role','group').attr('aria-label',absolute?'Market capitalization by sector on a fixed dollar scale':'Market capitalization by sector').attr('data-scale-factor',scale.factor).attr('data-current-total',total).attr('data-reference-total',peak.total);
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
 const companyNames=companyMode()&&state.labels==='name';
 tiles.classed('company-names',companyNames);
 const tileClips=tiles.selectAll('clipPath.tile-label-clip').data((d,i)=>[{node:d,id:'tile-label-clip-'+i}]).join('clipPath').attr('class','tile-label-clip').attr('id',d=>d.id);
 motion(tileClips.selectAll('rect').data(d=>[d.node]).join('rect')).attr('x',3).attr('y',3).attr('width',d=>Math.max(0,d.x1-d.x0-6)).attr('height',d=>Math.max(0,d.y1-d.y0-6));
 tiles.selectAll('.tile-name,.tile-value').attr('clip-path',(_,i,nodes)=>`url(#${nodes[i].parentNode.querySelector('.tile-label-clip').id})`);
 if(companyNames){
  tiles.each(function(d){
   const tw=d.x1-d.x0,th=d.y1-d.y0,factor=Math.max(.0001,scale.factor),fit=fitCompanyLabel(companyDisplayName(d.data.entity.name),tw*factor,th*factor,measureCompanyText),g=d3.select(this);
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
 tiles.on('click',(_,d)=>select(d.data.entity.id)).on('keydown',(event,d)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(d.data.entity.id);}}).on('pointermove',(event,d)=>{const e=d.data.entity,p=observation(e),base=observation(e,state.baseline);if(!p)return;showTip(`<strong>${esc(e.name)}${companyMode()?' · '+esc(e.id):''}</strong><span>${esc(e.industry)} · ${esc(frameLabel(state.year))}</span><br>Market cap (${esc(capBasis())}) <b>${currency(p.marketCap)}</b><br>Forward P/E <b>${multiple(p.fpe)}</b>${state.dataset==='spIndustries'?`<br>P/E coverage <b>${p.fpeMemberCount}/${p.memberCount} firms · ${(p.fpeMarketCapCoverage*100).toFixed(1)}% cap</b>`:''}<br>Cap change vs ${esc(frameLabel(state.baseline))} <b>${pct(base?change(p.marketCap,base.marketCap):null)}</b><br><span>${esc(dateLabel(p.date))}</span>`,event.clientX,event.clientY);}).on('pointerleave',hideTip);
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
 for(const q of hist){const peers=entities().filter(x=>x.sector===e.sector).map(x=>observation(x,frameKey(q))?.fpe).filter(validPE);if(peers.length>=2){n++;if(q.fpe<d3.median(peers))cheap++;}}
 $('detail-cheap').textContent=n?`${cheap} / ${n} snapshots`:'—';
 $('line-range').textContent=hist.length?`${frameLabel(frameKey(hist[0]))} – ${frameLabel(state.year)}`:'';
 $('detail-note').textContent=state.dataset==='industries'?'Forward P/E is the source’s simple industry average. Sector grouping is app-defined.':!p?'This current constituent has no source market-cap observation in this snapshot. It is retained in the roster; no historical value is imputed.':(e.symbols?.length>1?`One company tile represents ${e.symbols.join(' / ')}. Company market cap is counted once. `:'')+'Historical forward P/E is source-reported. Forecast vintage is unverified.';
 if(p?.provider==='finhacker')$('detail-note').textContent='Rounded monthly market cap from FinHacker. No historical P/E is supplied for this observation. Current company membership and grouping are used; corporate restructurings may affect comparisons.';
 if(state.dataset==='longrun')$('detail-note').textContent=`Fama/French historical industry portfolio · ${p?p.firmCount.toLocaleString()+' firms. ':''}Cap = firm count × rounded average firm size (USD millions). Historical membership; SIC industries with app-defined sectors. No P/E data.`;
 if(state.dataset==='spIndustries'){$('detail-note').textContent=p?`P/E covers ${p.fpeMemberCount}/${p.memberCount} observed companies (${(p.fpeMarketCapCoverage*100).toFixed(1)}% of observed industry cap). It is the cap-weighted harmonic mean of positive reported ratios, not an all-member industry P/E. Missing estimates are excluded. Current membership and classifications are used throughout; coverage changes affect comparisons.`:'No component company market caps are available for this industry and month.';$('industry-members').textContent='Explore '+e.members.length+' underlying companies →';}
 if(europeanDataset())$('detail-note').textContent=`Current ${marketInfo().name} membership throughout; survivorship bias. ${p?.sourceCurrency&&p.sourceCurrency!==marketInfo().currency?`Source cap in ${p.sourceCurrency}, converted to ${marketInfo().currency} using same-day ${p.fxRateSource||'ECB'} reference rates (${p.fxDate||'rate unavailable'}). `:`Caps in ${marketInfo().currency}. `}Full company caps, not free-float index weights. ${e.alternateSourceURL?'Data listing: '+e.valuationSourceSymbol+' (same issuer; local listing history unavailable). ':''}${!e.monthly.length?e.sourceAvailability+'. ':''}Forward-estimate vintage is unverified.`;
 if(p?.dataNote)$('detail-note').textContent+=' '+p.dataNote;
 $('source-link').href=state.dataset==='companies'?(monthlyMode()?`https://stockanalysis.com/fundamental-chart/#p=${encodeURIComponent(e.id)}~peForward~d~l~s&r=5Y`:p?.sourceURL||`https://stockanalysis.com/stocks/${encodeURIComponent(e.id.toLowerCase())}/financials/ratios/`):state.dataset==='industries'?'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/dataarchived.html':'#';
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
 svg.selectAll('circle').data(valid).join('circle').attr('cx',d=>x(frameKey(d))).attr('cy',d=>y(d[metric])).attr('r',d=>frameKey(d)===state.year?3:valid.length>80?0:2).attr('fill',d=>frameKey(d)===state.year?'#2b6344':'#9daf83').append('title').text(d=>`${frameLabel(frameKey(d))}: ${cap?currency(d[metric]):multiple(d[metric])}`);
 [xr[0],xr[1]].forEach(v=>svg.append('text').attr('x',x(v)).attr('y',h-3).attr('text-anchor',v===xr[0]?'start':'end').attr('fill','#9aa68c').attr('font-size',8).text(frameLabel(v)));
}
function renderMatrix(){
 const items=universe().filter(e=>matches(e));
 const median=e=>d3.median(priorHistory(e),p=>p.fpe)??Infinity;
 const chosen=items.filter(e=>priorHistory(e).length).sort((a,b)=>median(a)-median(b)).slice(0,18);
 if(!chosen.length){$('matrix').innerHTML='<p>No valuation observations through this snapshot. The older series supplies market caps only; it cannot establish whether a company or industry was cheap.</p>';$('matrix-foot').textContent='Market-cap history is available in the map and selected-name chart. Forward P/E coverage begins in October 2021 for companies; the long-run industry archive has no P/E.';return;}
 const ys=years().filter(y=>y<=state.year).slice(-60);
 const allPeByYear=Object.fromEntries(ys.map(y=>[y,universe().map(e=>observation(e,y)?.fpe).filter(validPE)]));
 $('matrix-foot').textContent='Showing the last 60 timeline snapshots through the selected date and up to 18 names ordered by median forward P/E. Missing valuation columns remain blank; dates are not skipped.';
 let html=`<table><thead><tr><th>${industryMode()?'INDUSTRY':'COMPANY'}</th>${ys.map(y=>`<th>${frameLabel(y)}</th>`).join('')}<th>MEDIAN FPE</th></tr></thead><tbody>`;
 for(const e of chosen){html+=`<tr class="${e.id===state.selected?'selected-row':''}"><td><button data-entity="${esc(e.id)}" title="${esc(e.name)}">${esc(companyMode()?e.id:e.name)}${companyMode()?`<small>${esc(e.name)}</small>`:''}</button></td>`;
 for(const y of ys){const p=observation(e,y),available=y<=state.year&&validPE(p?.fpe);const rank=available?percentile(allPeByYear[y],p.fpe):null;const value=available?(state.matrix==='peers'?Number.isFinite(rank)?Math.round(rank)+'%':'—':multiple(p.fpe)):'—';const color=available?(state.matrix==='peers'?(rank===null?missingColor:d3.scaleQuantize([0,100],colors)(rank)):peColor(p.fpe)):'#eef1e9';html+=`<td><button class="matrix-cell" style="background:${color};color:${available?'#fff':'#a6af9b'}" data-entity="${esc(e.id)}" data-cell-year="${y}" title="${esc(e.name)} · ${frameLabel(y)}: ${available?multiple(p.fpe):y>state.year?'after selected snapshot':'unavailable'}">${value}</button></td>`;}
 html+=`<td>${multiple(median(e))}</td></tr>`;
 }html+='</tbody></table>';$('matrix').innerHTML=html;
 $('matrix').querySelectorAll('[data-entity]').forEach(b=>b.onclick=()=>{state.selected=b.dataset.entity;if(b.dataset.cellYear){stop();state.year=+b.dataset.cellYear;}render();});
}
function correlation(points){if(points.length<3)return null;const xm=d3.mean(points,p=>p.x),ym=d3.mean(points,p=>p.y),top=d3.sum(points,p=>(p.x-xm)*(p.y-ym)),den=Math.sqrt(d3.sum(points,p=>(p.x-xm)**2)*d3.sum(points,p=>(p.y-ym)**2));return den?top/den:null;}
function renderLab(){
 const holder=$('scatter');if(holder.clientWidth===0)return;
 if(!analysisYears().length){$('lab-summary').textContent='Market-cap-only archive';$('lab-foot').textContent='This dataset has no P/E observations. Use S&P 500 monthly data from October 2021 onward or the annual industry archive for valuation comparisons.';holder.innerHTML='<div class="empty-state"><div><strong>No valuation data in this archive</strong><p>Explore historical size in the market map. A market cap alone cannot measure cheapness.</p></div></div>';$('cohorts').innerHTML='';return;}
 const start=+state.start,n=+state.horizon,end=start+n*(monthlyMode()?12:1),metric=state.outcome;
 if(monthlyMode()&&metric!=='marketCap'){$('lab-summary').textContent='Selected outcome unavailable at monthly frequency';$('lab-foot').textContent='Revenue and net-income data are available only in annual observations. Your selected outcome and frequency are retained; choose a different outcome or frequency explicitly.';holder.innerHTML='<div class="empty-state"><div><strong>No monthly data for this outcome</strong><p>No market-cap outcome has been substituted.</p></div></div>';$('cohorts').innerHTML='';return;}
 const points=universe().flatMap(e=>{const a=monthlyMode()?observation(e,start):annualObservation(e,start),b=monthlyMode()?observation(e,end):annualObservation(e,end);const y=a&&b?cagr(b[metric],a[metric],n):null;return validPE(a?.fpe)&&Number.isFinite(y)?[{entity:e,x:a.fpe,y,cap:a.marketCap}]:[];});
 const r=correlation(points);$('lab-summary').textContent=`${state.industry?state.industry+' · ':''}${points.length} matched names · ${frameLabel(start)} → ${frameLabel(end)}${Number.isFinite(r)?' · Pearson r = '+r.toFixed(2):''}`;
 $('lab-foot').textContent=`Starting ${frameLabel(start)} forward P/E vs subsequent ${n}-year ${metric==='marketCap'?'market-cap':metric==='revenue'?'revenue':'net-income'} CAGR. ${universe().length-points.length} names excluded for missing or nonpositive endpoints. ${companyMode()?(monthlyMode()?'Matched calendar months; source dates are month-end trading observations. Forward-estimate vintage is unverified. ':'Fiscal-year-end dates differ. Forward-estimate vintage is unverified. '):''}This describes an association; it does not measure investment returns or establish causation.`;
 $('lab-foot').textContent+=' Market-cap amounts and growth use '+capBasis()+'. Revenue and net-income outcomes remain nominal.';if(state.dataset==='spIndustries')$('lab-foot').textContent+=' Industry endpoint totals use the companies observed at each date, so changes in component coverage affect growth. Starting P/E covers positive-ratio companies only.';
 holder.innerHTML='';$('cohorts').innerHTML='';
 if(points.length<2){holder.innerHTML='<div class="empty-state"><div><strong>Not enough matched observations</strong><p>Choose an earlier starting snapshot, a shorter horizon, or another outcome.</p></div></div>';return;}
 const w=holder.clientWidth,h=holder.clientHeight,m={l:66,r:24,t:20,b:55};
 const svg=d3.select(holder).append('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('role','img').attr('aria-label','Starting forward P/E versus subsequent annualized growth');
 let [xmin,xmax]=d3.extent(points,p=>p.x),[ymin,ymax]=d3.extent(points,p=>p.y);const xp=Math.max((xmax-xmin)*.08,1),yp=Math.max((ymax-ymin)*.13,2);
 const x=d3.scaleLinear([Math.max(0,xmin-xp),xmax+xp],[m.l,w-m.r]),y=d3.scaleLinear([Math.min(0,ymin-yp),Math.max(0,ymax+yp)],[h-m.b,m.t]);
 svg.append('g').attr('transform',`translate(0,${h-m.b})`).call(d3.axisBottom(x).ticks(w<500?4:8).tickSizeOuter(0)).call(g=>g.selectAll('.domain').attr('stroke','#d4decc')).call(g=>g.selectAll('.tick line').attr('stroke','#d4decc'));
 svg.append('g').attr('transform',`translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d=>d+'%').tickSize(-(w-m.l-m.r))).call(g=>g.select('.domain').remove()).call(g=>g.selectAll('.tick line').attr('stroke','#eaf0e3'));
 if(ymin<0)svg.append('line').attr('x1',m.l).attr('x2',w-m.r).attr('y1',y(0)).attr('y2',y(0)).attr('stroke','#bfceb4').attr('stroke-dasharray','3,4');
 svg.append('text').attr('x',(w+m.l-m.r)/2).attr('y',h-10).attr('text-anchor','middle').text('Starting forward P/E (×)');
 svg.append('text').attr('transform',`translate(15,${(h+m.t-m.b)/2}) rotate(-90)`).attr('text-anchor','middle').text(`${metric==='marketCap'?'Market cap':metric==='revenue'?'Revenue':'Net income'} CAGR (% / year)`);
 const size=d3.scaleSqrt(d3.extent(points,p=>p.cap),[4,12]);
 svg.selectAll('circle.point').data(points).join('circle').attr('class','point').attr('cx',p=>x(p.x)).attr('cy',p=>y(p.y)).attr('r',p=>size(p.cap)).attr('fill',p=>peColor(p.x)).attr('fill-opacity',.8).attr('stroke','#fff').attr('stroke-width',1).attr('tabindex',0).attr('role','button').attr('aria-label',p=>`${p.entity.name}: ${multiple(p.x)}, growth ${pct(p.y)}`).on('pointermove',(event,p)=>showTip(`<strong>${esc(p.entity.name)}</strong><span>${frameLabel(start)} → ${frameLabel(end)}</span><br>Starting FPE: ${multiple(p.x)}<br>Subsequent CAGR: ${pct(p.y)}<br>Starting cap: ${currency(p.cap)}`,event.clientX,event.clientY)).on('pointerleave',hideTip).on('click',(_,p)=>{state.selected=p.entity.id;state.year=start;state.tab='map';render();}).on('keydown',(event,p)=>{if(event.key==='Enter'){state.selected=p.entity.id;state.year=start;state.tab='map';render();}});
 points.sort((a,b)=>a.x-b.x);const groups=[points.slice(0,Math.ceil(points.length/3)),points.slice(Math.ceil(points.length/3),Math.ceil(2*points.length/3)),points.slice(Math.ceil(2*points.length/3))];
 $('cohorts').innerHTML=groups.map((g,i)=>`<div class="cohort" style="border-color:${colors[i*3]}"><span>${['LOWEST','MIDDLE','HIGHEST'][i]} STARTING P/E THIRD</span><strong>${pct(d3.median(g,p=>p.y))}</strong><small>median CAGR · n=${g.length}</small></div>`).join('');
}
function render(){
 if(!db)return;
 if(viewNotice&&noticeSignature!==JSON.stringify(state))viewNotice='';
 if(!['nominal','real'].includes(state.dollars))state.dollars='nominal';
 renderDollarBasis();
 const capOnly=entities().some(e=>observation(e)?.marketCap>0)&&!entities().some(e=>validPE(observation(e)?.fpe));
 if(!['ticker','name'].includes(state.labels))state.labels='ticker';
 $('tile-labels').value=state.labels;$('tile-labels').disabled=!companyMode();
 if(!palettes[state.palette])state.palette='atlas';
 colors=palettes[state.palette].colors;missingColor=palettes[state.palette].missing;
 $('palette').value=state.palette;document.querySelector('.workspace').dataset.palette=state.palette;
 const ys=years();if(!player.running)paintTimeline(ys.indexOf(state.year));$('snapshot-label').textContent=frameLabel(state.year);$('snapshot-context').textContent=player.running?'Playing · 5 snapshots / second':state.dataset==='companies'?(monthlyMode()?'':state.year===db.meta.latestFrameYear?'Retrieved Oct 29, 2026':'Company fiscal dates vary'):state.dataset==='industries'?'Annual January update':state.dataset==='spIndustries'?'Monthly company aggregates':monthlyMode()?'Imported monthly observations':'Imported annual observations';
 if(!player.running&&state.dataset==='longrun')$('snapshot-context').textContent='Historical membership';
 else if(!player.running&&europeanDataset())$('snapshot-context').textContent=marketInfo().name+' · '+marketInfo().currency;
 else if(!player.running&&capOnly)$('snapshot-context').textContent='';
 $('outcome').querySelectorAll('option').forEach(o=>{o.disabled=false;const label=o.value==='marketCap'?'Market-cap growth':o.value==='revenue'?'Revenue growth':'Net-income growth';o.textContent=label+(monthlyMode()&&o.value!=='marketCap'?' (no monthly data)':'');});
 $('month-picker').value=state.year;$('map-scale').value=state.scale;
 $('horizon').querySelectorAll('option').forEach(o=>o.disabled=false);
 $('baseline').value=state.baseline;$('lab-start').value=state.start;$('color').value=state.color;$('sector').value=state.sector;$('search').value=state.query;$('matrix-mode').value=state.matrix;$('horizon').value=state.horizon;$('outcome').value=state.outcome;$('clear-search').hidden=!state.query;
 const displayNames={color:$('color').selectedOptions[0]?.textContent||'',size:state.scale==='absolute'?'Fixed cap scale':'Relative size',dollars:state.dollars==='real'?'Inflation-adjusted '+shortMonth(inflationSeries().baseMonth)+' '+marketInfo().symbol:'Nominal '+marketInfo().currency,palette:(state.palette==='finviz'?'Finviz':'Atlas')+' palette',labels:companyMode()?(state.labels==='name'?'Company names':'Tickers'):'Industry names'};$('display-summary').textContent=(state.tab==='lab'?[displayNames.dollars,displayNames.palette]:Object.values(displayNames)).join(' · ');
 $('back').disabled=ys.indexOf(state.year)===0;$('next').disabled=ys.indexOf(state.year)===ys.length-1;
 $('year-ticks').querySelectorAll('button').forEach(b=>b.classList.toggle('active',+b.dataset.year===state.year));
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));$('map-view').hidden=state.tab!=='map';$('lab-view').hidden=state.tab!=='lab';document.querySelector('.detail').hidden=state.tab!=='map';document.querySelector('.history-section').hidden=state.tab!=='map';
 document.querySelector('.timeline').hidden=state.tab==='lab';document.querySelector('.search').hidden=state.tab==='lab';document.querySelector('.color-control').hidden=state.tab==='lab';document.querySelector('.scale-control').hidden=state.tab==='lab';document.querySelector('.label-control').hidden=state.tab==='lab';document.querySelector('.coverage-strip').hidden=false;document.querySelector('.workspace').dataset.view=state.tab;
 $('dataset-note').textContent=state.dataset==='companies'?'Complete current S&P 500 roster · Share classes consolidated into one company tile. Current membership is used throughout, not historical index membership. '+(monthlyMode()?'Real month-end market caps and forward P/E; missing values stay blank. Industry archives remain annual.':'Fiscal dates differ.')+' Forecast vintage is unverified.':state.dataset==='industries'?'NYU Stern / Aswath Damodaran · Annual January snapshots. Cap is approximately prior year-end; forward P/E is a simple industry average. Constituents change over time.':'Imported dated snapshots · Session only. Source quality, metric definitions, and date alignment are determined by your file.';
 if(state.dataset==='companies'&&monthlyMode())$('dataset-note').textContent='Current S&P 500 members throughout: survivorship bias, not a historical index reconstruction. FinHacker supplies rounded monthly caps before October 2021; earlier coverage varies and corporate histories may include predecessor businesses. Stock Analysis supplies recent caps and forward P/E (Oct 2021–Sep 2026). No P/E is invented for older months. Empty space can reflect missing coverage as well as market size.';
 if(state.dataset==='longrun')$('dataset-note').textContent='Fama/French Data Library · 49 SIC industry portfolios, July 1926–September 2026. Historical NYSE, AMEX and NASDAQ membership; this is a different universe from the S&P 500 view. Approximate market cap = firm count × rounded mean firm size (USD millions). Source month labels; exact valuation day is unspecified. No P/E data. Sectors are app-defined.';
 if(state.dataset==='spIndustries')$('dataset-note').textContent='S&P 500 monthly industry aggregates · 126 current GICS sub-industries, grouped from the same saved company observations as the company map. Caps sum available company caps. Forward P/E = covered market cap ÷ sum of (company cap ÷ company forward P/E), using only positive reported ratios. Company counts and the covered cap share are disclosed per industry. Current membership introduces survivorship bias; older coverage is partial and provider forecast vintage is unverified. No annual archive data is carried forward or interpolated.';
 if(europeanDataset())$('dataset-note').textContent=`${marketInfo().name} · ${entities().length} current members, retrieved October 29, 2026. Separate market: no companies or scale reference are pooled with other indices. Real monthly Stock Analysis observations within the free five-year window, through September 2026. Current membership and current provider industry classifications are used throughout; this is not a historical index reconstruction. Caps in ${marketInfo().currency}, converted from provider reporting currency at exact-date ECB rates where needed. Full company caps, not float-adjusted index weights. Missing cap, P/E or FX is not filled. Historical forecast vintage is unverified; monthly revenue and net income are unavailable.`;
 renderCoverage();renderAvailability();renderSearch();
 if(state.tab==='map'){renderLegend();renderMap();renderDetail();if(!player.running)renderMatrix();}else renderLab();if(!player.running)persist();
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
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{stop();state.tab=b.dataset.tab;hideTip();render();});
function chooseDataset(dataset,label){
 stop();const previousFrequency=state.frequency,previousSnapshot=frameLabel(state.year);Object.assign(state,selectionForDataset(state,dataset));
 state.selected=null;viewNotice=`${label} selected. ${previousSnapshot} retained${previousFrequency!==state.frequency?' as '+(state.frequency==='monthly'?'January of the same year':'the same annual year label'):''}; display settings unchanged.`;
 if(europeanDataset())viewNotice+=' Currency: '+marketInfo().currency+'. Monthly source window only; earlier dates stay unavailable.';
 setupDataset();render();
}
$('dataset-picker').onchange=event=>chooseDataset(event.target.value,event.target.selectedOptions[0].textContent);
$('monthly-industries-shortcut').onclick=()=>chooseDataset('spIndustries','Monthly S&P 500 industries');
$('industry-members').onclick=()=>{const group=entities().find(e=>e.id===state.selected);if(!group||state.dataset!=='spIndustries')return;stop();state.dataset='companies';state.sector=group.sector;state.industry=group.industry;state.selected=null;state.query='';viewNotice='Showing underlying current S&P 500 companies for '+group.name+'. Snapshot and display settings retained.';setupDataset();render();};
$('display-toggle').onclick=()=>{const collapsed=$('display-settings').classList.toggle('display-collapsed');$('display-toggle').setAttribute('aria-expanded',String(!collapsed));$('display-toggle').setAttribute('aria-label',collapsed?'Show display settings':'Hide display settings');};
$('map-scale').onchange=event=>{stop();state.scale=event.target.value;render();};
$('dollar-basis').onchange=event=>{stop();state.dollars=event.target.value;render();};
$('tile-labels').onchange=event=>{state.labels=event.target.value;render();};
$('palette').onchange=event=>{state.palette=event.target.value;render();};
$('frequency').onchange=event=>{if(event.target.value===state.frequency)return;stop();const wasMonthly=monthlyMode(),frequency=event.target.value,toFrame=v=>!Number.isFinite(v)?v:wasMonthly?v/12|0:v*12;for(const key of ['year','baseline','start'])state[key]=toFrame(state[key]);state.frequency=frequency;viewNotice='Frequency changed by your selection. The same year is retained; annual-to-monthly uses January. Unsupported dates or outcomes remain unavailable rather than switching to other data.';setupDataset();render();};
$('month-picker').onchange=event=>{stop();state.year=+event.target.value;render();};
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
const player=createTimelinePlayer({getFrames:years,getFrame:()=>state.year,showFrame:(y,{instant=false}={})=>{state.year=y;if(instant)mapLayoutCache=null;hideTip();render();},onProgress:paintTimeline,onChange:running=>{$('play').innerHTML=running?'Ⅱ <span>Pause</span>':'▶ <span>Play</span>';$('play').setAttribute('aria-label',running?'Pause timeline':'Play timeline');$('play').setAttribute('aria-pressed',String(running));document.querySelector('.workspace').classList.toggle('is-playing',running);$('matrix').setAttribute('aria-busy',String(running));$('matrix-foot').textContent=running?'Pause playback to update and inspect the full history table.':'Showing up to 18 names, ordered by median forward P/E through the selected snapshot. Peer ranks use the visible universe, including names outside this table.';if(!running)render();}});
 $('play').onclick=()=>player.running?player.stop():player.start();
 $('unselect').onclick=()=>{state.selected=null;render();};$('matrix-mode').onchange=event=>{state.matrix=event.target.value;render();};
for(const [id,k] of [['lab-start','start'],['horizon','horizon'],['outcome','outcome']])$(id).onchange=event=>{state[k]=id==='outcome'?event.target.value:+event.target.value;render();};
const openMethod=()=>{stop();$('method-dialog').showModal();};$('method').onclick=openMethod;document.querySelectorAll('.open-method').forEach(b=>b.onclick=openMethod);
document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());document.querySelectorAll('dialog').forEach(d=>d.onclick=event=>{if(event.target===d){const r=d.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)d.close();}});
$('export').onclick=()=>{
 const keys=['dataset','currency','sourceCurrency','sourceMarketCap','fxRate','fxDate','fxRateSource','valuationSourceSymbol','id','name','symbols','sector','industry','frequency','month','year','date','capDate','fpeDate','marketCap','displayMarketCap','dollarBasis','dollarBaseMonth','cpiMonth','cpiProxy','memberCount','memberTotal','fpeMemberCount','fpeCoveredMarketCap','fpeMarketCapCoverage','fpe','revenue','netIncome'];
 const rows=universe().filter(e=>matches(e)).flatMap(e=>historyOf(e).filter(h=>frameKey(h)<=state.year).map(h=>{const shown=displayedObservation(h);return {...e,...h,dataset:state.dataset,currency:marketInfo().currency,displayMarketCap:shown.marketCap,dollarBasis:state.dollars,dollarBaseMonth:state.dollars==='real'?inflationSeries().baseMonth:'',cpiMonth:shown.cpiMonth||'',cpiProxy:shown.cpiProxy||false,frequency:monthlyMode()?'monthly':'annual',symbols:(e.symbols||[e.id]).join('|')};}));
 download([keys.join(','),...rows.map(r=>keys.map(k=>csvCell(r[k])).join(','))].join('\n'),`market-atlas-${state.dataset}-${state.dollars}-through-${monthlyMode()?monthString(state.year):state.year}.csv`);toast(`Exported ${rows.length} rows · raw and display caps`);
};
$('import-open').onclick=()=>{$('import-status').textContent='';$('import-dialog').showModal();};$('template').onclick=()=>download('id,name,sector,industry,year,date,marketCap,fpe,revenue,netIncome\nEXAMPLE,Example company,Technology,Software,2022,2022-12-31,1000000000,15,100000000,10000000\nEXAMPLE,Example company,Technology,Software,2023,2023-12-31,1200000000,16,120000000,12000000\n','market-atlas-template.csv');
$('import-file').onchange=async event=>{const f=event.target.files[0];if(!f)return;try{if(f.size>10e6)throw Error('Choose a CSV smaller than 10 MB.');const data=importCSV(await f.text());db.imported=data;stop();state.frequency=data.some(e=>e.monthly.length)?'monthly':'annual';state.dataset='imported';state.sector='All sectors';state.industry=null;state.query='';state.selected=data[0]?.id;setupDataset();render();$('import-dialog').close();toast(`Imported ${data.length} names into this session`);}catch(err){$('import-status').textContent=err.message;}finally{event.target.value='';}};
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,120);});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
async function init(){try{const load=async name=>{const res=await fetch(name+'?v=europe-v1');if(!res.ok)throw Error('Dataset could not be loaded.');return res.json();};const [current,archive,inflation,europe]=await Promise.all([load('data.json'),load('data-history.json'),load('data-inflation.json'),load('data-europe.json')]);db=mergeHistoricalData(current,archive);db.inflation=inflation;db.europe=europe;Object.assign(db,europe.markets);if(!window.d3)throw Error('Chart library could not be loaded.');try{const saved=JSON.parse(localStorage.getItem('market-atlas-v3')||'null');if(saved&&['companies','industries','longrun','spIndustries','dax','cac','ftse'].includes(saved.dataset))Object.assign(state,saved); }catch{}if(!['fpe','marketCap'].includes(state.historyMetric)){state.historyMetric='fpe';viewNotice='Automatic history-chart switching has been removed. Forward P/E is selected; use the chart selector to choose market cap explicitly.';}if(['longrun','spIndustries','dax','cac','ftse'].includes(state.dataset)&&state.frequency!=='monthly'||state.dataset==='industries'&&state.frequency!=='annual')Object.assign(state,selectionForDataset(state,state.dataset));setupDataset();render();document.querySelectorAll('[data-await-data]').forEach(e=>{e.removeAttribute('inert');e.setAttribute('aria-busy','false');});document.querySelectorAll('#dataset-picker,[data-tab]').forEach(b=>b.disabled=false);}catch(err){$('treemap').innerHTML=`<div class="empty-state"><div><strong>Unable to load the map</strong><p>${esc(err.message)}</p><p>Reload the page to retry.</p></div></div>`;$('coverage').textContent='Data unavailable';document.querySelector('.workspace').setAttribute('aria-busy','false');document.querySelector('.workspace').removeAttribute('inert');document.querySelector('.toolbar').setAttribute('inert','');document.querySelector('.timeline').setAttribute('inert','');console.error(err);}}
// Expose pure calculation helpers for reproducible checks, without mutation hooks.
window.MarketAtlasMath={percentile,change,cagr,parseCSV,importCSV,annualObservation,monthKey,monthString,createTimelinePlayer,createStableTreemap,PLAYBACK,peakMarketCap,marketScaleGeometry,mergeHistoricalData,inflationPoint,adjustMarketCap,dollarObservation,timelineFrames,selectionForDataset,coverageWindow,aggregateCompanyIndustries,fitCompanyLabel,companyDisplayName};
document.fonts?.ready.then(()=>{companyTextWidths.clear();if(db&&state.labels==='name')renderMap();});
init();
})();
