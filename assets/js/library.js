(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const colors = ['#a4573c', '#c3a260', '#52667b', '#636b49', '#824f45', '#557878', '#8a794c'];
  let books = [], matches = [], active = 0, filter = 'all', view = 'shelf', limit = 48;
  const escaped = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const color = b => colors[Array.from(b.id).reduce((n,c) => n+c.charCodeAt(0),0) % colors.length];
  function cover(b) {
    const el = document.createElement('div');
    el.className = 'cover'; el.setAttribute('aria-hidden', 'true'); el.style.setProperty('--book-color', color(b));
    el.innerHTML = `<div class="type-cover"><strong>${escaped(b.title)}</strong><small>${escaped(b.author)}</small></div>`;
    const src = b.cover || (b.isbn ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(b.isbn)}-L.jpg?default=false` : '');
    if (src) { const img = new Image(); img.alt = ''; img.src = src; img.draggable = false; img.onload = () => {if(img.naturalWidth > 5) el.append(img);}; }
    return el;
  }
  function select(i, focusBook = false) {
    active = Math.max(0, Math.min(i, matches.length - 1));
    renderShelf();
    if (focusBook) $('#book-track button[aria-pressed="true"]')?.focus({preventScroll:true});
  }
  function renderShelf() {
    const track = $('#book-track');
    const keep = new Set();
    const compact = window.innerWidth < 600;
    for (let i = Math.max(0,active-6); i <= Math.min(matches.length-1,active+6); i++) {
      const b = matches[i], d = i-active, side = Math.sign(d), abs = Math.abs(d);
      keep.add(b.id);
      let button = Array.from(track.children).find(el => el.dataset.id === b.id);
      if (!button) {
        button = document.createElement('button'); button.type = 'button'; button.className = 'book'; button.dataset.id = b.id;
        button.append(cover(b)); track.append(button);
      }
      button.onclick = () => select(i);
      button.setAttribute('aria-label', `${b.title}, by ${b.author}`);
      button.setAttribute('aria-pressed', String(d === 0)); button.tabIndex = d === 0 ? 0 : -1;
      const x = d === 0 ? 0 : side * ((compact ? 163 : 242) + (abs-1) * (compact ? 62 : 85));
      const y = d === 0 ? -3 : 4 - Math.min(abs,5)*6;
      button.style.transform = `translate3d(${x}px,${y}px,${d===0?100:-abs*32}px) rotateY(${d===0?-7:-side*43}deg) rotateZ(${d===0?-2:side*1.3}deg)`;
      button.style.zIndex = String(20-abs); button.style.opacity = abs > 5 ? '.35' : '1';
    }
    Array.from(track.children).forEach(el => {if(!keep.has(el.dataset.id)) el.remove();});
    const b = matches[active]; if(!b) return;
    $('#book-info').innerHTML = `<span class="status">${b.featured ? 'A FEATURED BOOK · ' : ''}${escaped(b.status)}</span><h2 title="${escaped(b.title)}">${escaped(b.title.split(':')[0])}</h2><p>${escaped(b.author)}${b.year ? `<span>·</span>${escaped(b.year)}` : ''}</p><a class="notes-link" href="${escaped(b.url)}">${b.notes ? 'Read my notes' : 'Book details'} <span aria-hidden="true">↗</span></a>`;
    $('#position').textContent = `${String(active+1).padStart(2,'0')} / ${matches.length} BOOKS`;
    $('#previous').disabled = active === 0; $('#next').disabled = active === matches.length-1;
  }
  function renderGrid() {
    $('#book-grid').replaceChildren();
    matches.slice(0,limit).forEach((b,i) => {
      const button = document.createElement('button'); button.className='grid-book';button.type='button';
      button.append(cover(b));
      button.insertAdjacentHTML('beforeend', `<h3>${escaped(b.title)}</h3><p>${escaped(b.author)}</p>`);
      button.onclick = () => {active=i; changeView('shelf'); $('.toolbar').scrollIntoView({block:'start',behavior:'smooth'}); $('#stage').focus({preventScroll:true});};
      $('#book-grid').append(button);
    });
    $('#grid-count').textContent = `${matches.length} BOOKS`;
    $('#load-more').hidden = limit >= matches.length;
  }
  function render() {
    $('#empty').hidden = matches.length > 0;
    $('#shelf-view').hidden = !matches.length || view !== 'shelf';
    $('#grid-view').hidden = !matches.length || view !== 'grid';
    if(matches.length) view === 'shelf' ? renderShelf() : renderGrid();
  }
  function applyFilters() {
    const q = $('input[type=search]').value.trim().toLowerCase();
    matches = books.filter(b => (filter === 'all' || (filter === 'featured' ? b.featured : b.group === filter)) && `${b.title} ${b.author} ${b.genre}`.toLowerCase().includes(q));
    active=filter === 'all' && !q ? Math.min(5,matches.length-1) : 0; limit=48;
    $('#shelf-label').textContent = q ? 'SEARCH RESULTS' : ({all:'THE WHOLE SHELF',featured:'A FEW FAVORITES',reading:'ON THE BEDSIDE TABLE',read:'ALREADY EXPLORED',unread:'STILL TO DISCOVER'})[filter];
    render();
  }
  function changeView(next) {view=next;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));render();}
  document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));applyFilters();});
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>changeView(button.dataset.view));
  $('input[type=search]').addEventListener('input',applyFilters);
  $('#previous').onclick=()=>select(active-1);$('#next').onclick=()=>select(active+1);
  $('#random').onclick=()=>select(matches.length>1 ? (active+1+Math.floor(Math.random()*(matches.length-1)))%matches.length : 0);
  $('#load-more').onclick=()=>{limit+=48;renderGrid();};
  $('#reset').onclick=()=>{$('input[type=search]').value='';$('[data-filter=all]').click();};
  $('#shelf-view').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();select(e.key==='Home'?0:e.key==='End'?matches.length-1:active+(e.key==='ArrowRight'?1:-1),true);}});
  let startX=null, dragged=false;
  $('#stage').addEventListener('pointerdown',e=>{startX=e.clientX;dragged=false;});
  $('#stage').addEventListener('pointermove',e=>{if(startX!==null&&Math.abs(e.clientX-startX)>45){dragged=true;select(active+(e.clientX<startX?1:-1));startX=e.clientX;}});
  window.addEventListener('pointerup',()=>{startX=null;});
  $('#stage').addEventListener('pointercancel',()=>{startX=null;});
  $('#stage').addEventListener('click',e=>{if(dragged){e.preventDefault();e.stopPropagation();dragged=false;}},true);
  let lastWheel=0;
  $('#stage').addEventListener('wheel',e=>{if(Math.abs(e.deltaX)>Math.abs(e.deltaY)&&Math.abs(e.deltaX)>8){e.preventDefault();if(Date.now()-lastWheel>220){select(active+Math.sign(e.deltaX));lastWheel=Date.now();}}},{passive:false});
  window.addEventListener('resize',()=>{if(view==='shelf'&&matches.length)renderShelf();});
  fetch(document.body.dataset.booksUrl).then(r=>{if(!r.ok)throw Error('Unable to load books');return r.json();}).then(data=>{const opening = ["infinite-jest", "project-hail-mary", "beyond-freedom-and-dignity", "the-importance-of-being-earnest", "1984", "the-beginning-of-infinity-explanations-that-transform-the-wo", "abundance", "why-nations-fail-the-origins-of-power-prosperity-and-poverty", "sapiens-a-brief-history-of-humankind", "piranesi"]; const rank = b => opening.includes(b.id) ? opening.indexOf(b.id) : b.notes ? 100 : 200; books=data.sort((a,b)=>rank(a)-rank(b)||a.title.localeCompare(b.title));$('#total-count').textContent=books.length;applyFilters();}).catch(()=>{$('#empty').hidden=false;$('#empty h2').textContent='The library couldn’t load.';$('#empty p').textContent='Please refresh the page or use the full media archive.';$('#shelf-view').hidden=true;});
})();
