// Frontend - recherche API LBC via proxy, carte Leaflet + liste
const API_BASE = (window.__CONFIG__ && window.__CONFIG__.API_BASE) || "";

const mapEl = document.getElementById('map');
let map, markersLayer, lastData = [];

function initMap(center=[43.6, 1.44], zoom=11){
  if(map) return;
  map = L.map('map').setView(center, zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}
function fitToMarkers(points){
  if(!points.length) return;
  const bounds = L.latLngBounds(points);
  map.fitBounds(bounds.pad(0.2));
}
function renderMap(data){
  markersLayer.clearLayers();
  const pts = [];
  data.forEach(item => {
    if(item.coords){
      const m = L.marker(item.coords);
      const img = (item.images && item.images[0]) ? `<br><img src="${item.images[0]}" width="140" style="border-radius:8px;"/>` : '';
      m.bindPopup(`<b>${item.title||''}</b><br>${item.price||''} • ${item.surface||''}<br>${item.location||''}${img}<br><a href="${item.url}" target="_blank" rel="noreferrer">Voir l'annonce</a>`);
      m.addTo(markersLayer);
      pts.push(item.coords);
      m.on('click', ()=>{
        const card = document.querySelector(\`.card[data-id="\${item.id}"]\`);
        if(card){ card.scrollIntoView({behavior:'smooth', block:'center'}); card.classList.add('glow'); setTimeout(()=>card.classList.remove('glow'), 1200); }
      });
    }
  });
  if(pts.length) fitToMarkers(pts);
}

const resultsEl = document.getElementById('results');
const q = document.getElementById('q');

function renderList(data){
  resultsEl.innerHTML = '';
  const filter = (q.value||'').toLowerCase();
  for(const item of data){
    const hay = (item.title+' '+item.price+' '+item.surface+' '+item.location).toLowerCase();
    if(filter && !hay.includes(filter)) continue;
    const card = renderCard(item);
    resultsEl.appendChild(card);
  }
}

function render(data){
  lastData = data;
  renderMap(data);
  renderList(data);
}

function loadSaved(){ try { return JSON.parse(localStorage.getItem('decisions')||'{}'); } catch(e){ return {}; } }
function saveSaved(s){ localStorage.setItem('decisions', JSON.stringify(s)); }

function renderCard(item){
  const saved = loadSaved();
  const decision = saved[item.url] || { state:'none', note:'' };
  const div = document.createElement('div'); div.className='card'; div.dataset.id=item.id;
  const img = document.createElement('img'); img.className='thumb';
  img.src = item.images?.[0] || ''; img.onerror=()=>img.style.display='none';
  const body = document.createElement('div'); body.className='card-body';
  body.innerHTML = `
    <div class="card-title">${item.title || 'Sans titre'}</div>
    <div class="card-meta">${item.price || ''} • ${item.surface || ''} • ${item.location || ''}</div>
    <div>
      <span class="tag">${item.pieces? item.pieces+' pièces':''}</span>
      <span class="tag">${item.chambres? item.chambres+' chambres':''}</span>
    </div>
    <div class="controls">
      <button class="smallbtn" data-action="like">❤️ Like</button>
      <button class="smallbtn" data-action="no">✖️ Non</button>
      <button class="smallbtn" data-action="maybe">🤔 Peut-être</button>
      <a class="smallbtn" href="${item.url}" target="_blank" rel="noreferrer">Ouvrir</a>
      ${item.coords? '<button class="smallbtn" data-action="map">📍 Carte</button>' : ''}
    </div>
    <textarea class="note" placeholder="Notes / commentaires">${decision.note||''}</textarea>
  `;
  div.appendChild(img); div.appendChild(body);

  body.querySelectorAll('.smallbtn[data-action]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const action = btn.dataset.action;
      if(action === 'map' && item.coords){ map.setView(item.coords, 15); }
      else {
        const s = loadSaved(); s[item.url] = s[item.url] || { state:'none', note:'' };
        s[item.url].state = action; saveSaved(s);
        body.style.border = action==='like'?'2px solid #bde4c6': action==='no'?'2px solid #ffd6d6':'2px solid #fff3bf';
      }
    });
  });
  const noteEl = body.querySelector('.note');
  noteEl.addEventListener('input', ()=>{
    const s = loadSaved(); s[item.url] = s[item.url] || { state:'none', note:'' };
    s[item.url].note = noteEl.value; saveSaved(s);
  });
  return div;
}

// Events
document.getElementById('export').addEventListener('click', ()=>{
  const saved = loadSaved();
  const rows = [['url','title','price','surface','pieces','chambres','location','lat','lng','state','note']];
  for(const it of lastData){
    const state = (saved[it.url] && saved[it.url].state) || '';
    const note = (saved[it.url] && saved[it.url].note) || '';
    const lat = it.coords ? it.coords[0] : '';
    const lng = it.coords ? it.coords[1] : '';
    rows.push([it.url,it.title||'',it.price||'',it.surface||'',it.pieces||'',it.chambres||'',it.location||'',lat,lng,state,note].map(v=>`"${(v||'').toString().replace(/"/g,'""')}"`).join(','));
  }
  const csv = rows.join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='annonces.csv'; document.body.appendChild(a); a.click(); a.remove();
});

document.getElementById('clear-decisions').addEventListener('click', ()=>{
  if(confirm('Effacer toutes les décisions ?')){ localStorage.removeItem('decisions'); alert('Ok.'); }
});

document.getElementById('reset').addEventListener('click', ()=>{
  document.getElementById('zipcodes').value='';
  document.getElementById('price_max').value='';
  document.getElementById('rooms_min').value='';
  document.getElementById('rooms_max').value='';
  document.getElementById('q').value='';
  resultsEl.innerHTML='';
  markersLayer?.clearLayers();
});

document.getElementById('search').addEventListener('click', async ()=>{
  const zipStr = document.getElementById('zipcodes').value.trim();
  const price_max = parseInt(document.getElementById('price_max').value || '0', 10) || 0;
  const rooms_min = parseInt(document.getElementById('rooms_min').value || '0', 10) || 0;
  const rooms_max = parseInt(document.getElementById('rooms_max').value || '0', 10) || 0;
  const payload = { zipcodes: zipStr, price_max, rooms_min, rooms_max };
  resultsEl.innerHTML = '<div class="card" style="padding:12px;">Recherche en cours…</div>';
  try{
    const r = await fetch(`${API_BASE}/api/search`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const json = await r.json();
    if(!json || !Array.isArray(json.results)) throw new Error('Réponse invalide');
    render(json.results);
  }catch(e){
    resultsEl.innerHTML = `<div class="card" style="padding:12px;">Erreur: ${e}</div>`;
  }
});

// init
initMap([43.6,1.44], 11);
