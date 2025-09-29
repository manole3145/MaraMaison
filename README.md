# leboncoin-recap-v5

Frontend **GitHub Pages** + Proxy **Render** pour rechercher des annonces LeBonCoin (API non-officielle), afficher **carte Leaflet + liste** et prendre des décisions à deux.

## Frontend
- Mobile-first, Leaflet, liste avec like/non/peut-être, notes, export CSV.
- `frontend/config.js` définit `window.__CONFIG__.API_BASE` (URL de ton proxy).

## Proxy
- `POST /api/search` → appelle `https://api.leboncoin.fr/finder/search` avec filtres (codes postaux/villes, budget max, nb pièces min/max).

### Déploiement rapide
```bash
# Proxy (local)
cd proxy
npm install
npm start  # http://localhost:3000

# Front (local simple)
cd ../frontend
python3 -m http.server 8080
# puis http://localhost:8080
```

Déploie ensuite :
- Proxy → Render (Web Service Node.js)
- Front → GitHub Pages (dossier /frontend)
