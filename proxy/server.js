// Express proxy – /api/search -> LBC search API (non-officielle)
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

function buildSearchBody({ zipcodes, price_max, rooms_min, rooms_max }){
  // Filtres de base: location immobilière / maisons
  const filters = {
    category: { id: "10" },            // Immobilier (Location)
    real_estate_type: { id: "1" }      // 1 = Maison, (2 = Appartement) -> tu peux adapter
  };
  // Prix
  if (price_max && Number(price_max) > 0) filters.price = { min: 0, max: Number(price_max) };
  // Pièces
  if (rooms_min || rooms_max){
    filters.rooms = {};
    if (rooms_min) filters.rooms.min = Number(rooms_min);
    if (rooms_max) filters.rooms.max = Number(rooms_max);
  }
  // Localisation
  const locations = [];
  if (zipcodes){
    const parts = String(zipcodes).split(',').map(s=>s.trim()).filter(Boolean);
    for (const p of parts){
      if (/^\d{5}$/.test(p)) locations.push({ zipcode: p });
      else locations.push({ city: p });
    }
  }
  if (locations.length) filters.location = { locations };

  return {
    limit: 40,
    limit_alu: 3,
    filters
  };
}

function normalizeHit(hit){
  const id = hit.list_id || hit.ad_id || hit.id;
  const title = hit.subject || hit.title || '';
  const priceNum = hit.price || (hit.prices && hit.prices.value);
  const price = (priceNum != null) ? `${priceNum} €` : '';
  const attrs = hit.attributes || hit.params || [];
  const getAttr = (keys) => {
    if (!Array.isArray(attrs)) return '';
    for (const k of keys){
      const f = attrs.find(a => (a.key||a.name) === k);
      if (f) return f.value || f.val || '';
    }
    return '';
  };
  const surface = getAttr(['square','surface','living_space']);
  const rooms = getAttr(['rooms','room','nb_rooms']);
  const bedrooms = getAttr(['bedrooms','bedroom','nb_bedrooms']);

  const loc = hit.location || {};
  const city = loc.city || loc.city_label || loc.label || '';
  const zipcode = loc.zipcode || loc.zip_code || '';
  const lat = (loc.lat ?? loc.latitude ?? null);
  const lng = (loc.lng ?? loc.longitude ?? null);

  // Images
  const images = [];
  if (Array.isArray(hit.images)){
    for (const it of hit.images){
      if (typeof it === 'string') images.push(it);
      else if (it && it.url) images.push(it.url);
      else if (it && it.small_url) images.push(it.small_url);
    }
  } else if (hit.thumb_url) {
    images.push(hit.thumb_url);
  }

  return {
    id: String(id),
    title,
    price,
    surface,
    pieces: rooms || '',
    chambres: bedrooms || '',
    location: [city, zipcode].filter(Boolean).join(' '),
    coords: (lat != null && lng != null) ? [lat, lng] : null,
    images,
    url: id ? `https://www.leboncoin.fr/ad/locations/${id}` : ''
  };
}

app.post('/api/search', async (req, res) => {
  try{
    const body = buildSearchBody(req.body || {});
    const resp = await fetch('https://api.leboncoin.fr/finder/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'leboncoin/10.0 (iPhone; iOS 16.4; Scale/3.00)',
        'Origin': 'https://www.leboncoin.fr',
        'Referer': 'https://www.leboncoin.fr/'
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const t = await resp.text();
      return res.status(resp.status).json({ error: 'LBC search failed', detail: t.slice(0,500) });
    }
    const json = await resp.json();
    const hits = json.ads || json.data || json.results || [];
    const results = hits.map(normalizeHit);
    res.json({ results });
  }catch(e){
    res.status(500).json({ error: String(e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LBC proxy running on http://localhost:${PORT}`));
