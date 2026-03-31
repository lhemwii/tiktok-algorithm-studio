# ROADMAP — TikTok Algorithm Studio

> App web pour creer des videos TikTok/Reels virales avec des algorithmes et simulations visuelles.
> Live : https://tiktok-algo-studio.vercel.app

---

## Stack technique

| Composant | Techno |
|-----------|--------|
| Build | Vite |
| Rendering | Canvas 2D (1080x1920, 60fps) |
| Audio | Web Audio API (oscillateurs + noise) |
| Export video | MediaRecorder natif MP4 (Chrome 125+) |
| Hosting | Vercel (auto-deploy depuis GitHub) |
| Repo | https://github.com/lhemwii/tiktok-algorithm-studio |

---

## Fait

### Infrastructure
- [x] Migration vers Vite (ES modules, build < 200ms)
- [x] Deploy Vercel avec auto-deploy GitHub
- [x] Export MP4 fonctionnel (H.264 + AAC, compatible TikTok)
- [x] Sync audio/video dans les exports
- [x] Safe zones TikTok (200px top, 100px sides)
- [x] Dark mode / Light mode
- [x] Raccourcis clavier (Space = play, R = record)
- [x] URL hash routing (#anxiety, #territory, etc.)
- [x] Favicon SVG
- [x] Meta tags Open Graph + Twitter Card

### Algorithmes de tri (5/5)
- [x] **Anxiety Sort** — Trie puis re-verifie en panique
- [x] **Stalin Sort** — Elimine tout element pas dans l'ordre
- [x] **Thanos Sort** — Snap : 50% disparaissent
- [x] **Bogo Sort** — Melange aleatoire jusqu'a ce que ce soit trie
- [x] **Sleep Sort** — Chaque element attend sa valeur en ms

### Simulations (1)
- [x] **Territory War France** — 13 regions s'affrontent en automate cellulaire

---

## A faire

### Simulations virales (priorite haute)

| Simulation | Description | Potentiel viral |
|------------|-------------|-----------------|
| Murmuration (Boids) | Nuee d'etourneaux avec 3 regles simples → beaute emergente | Tres haut — visuellement hypnotique |
| Embouteillages | Un seul frein → onde de choc sur le periph | Haut — les Parisiens vont commenter |
| Mouvement de foule | Simulation panique vs flux normal dans un stade | Haut — post-actualites |
| Fibonacci tournesol | Spirale qui se construit graine par graine | Moyen — satisfaisant |
| Propagation epidemie | SIR model sur carte de France, slider R0 | Moyen — post-covid |
| Segregation Schelling | Tolerance 30% → ville segregee | Moyen — debat societe |
| Territory War Monde | Version mondiale avec pays | Tres haut — engagement international |

### Algorithmes de tri supplementaires

| Algo | Description |
|------|-------------|
| Miracle Sort | Ne fait rien, espere que la RAM corrompe les bits dans le bon ordre |
| Intelligent Design Sort | Le tableau est deja dans l'ordre voulu par l'univers |
| Quantum Bogo Sort | Detruit tous les univers ou le tableau n'est pas trie |

### Ameliorations app

| Feature | Description |
|---------|-------------|
| Bouton copier description/hashtags | Un clic → clipboard pour coller dans TikTok |
| Slider vitesse | Ralentir/accelerer les animations |
| Choix du nombre d'elements | Slider pour 5-50 barres |
| Preview miniature | Thumbnail dans la sidebar |
| Mode plein ecran | Pour les simulations |
| PWA | Installable sur mobile |
| i18n FR/EN | Toggle langue pour audience internationale |

### Contenu TikTok FR (idees de videos)

**Tier 1 — Bangers garantis**
- Tri des presidents francais par duree de mandat
- Tri des villes par loyer au m2
- Territory War regions de France (deja fait)
- Bar chart race : prix du m2 Paris vs province

**Tier 2 — Science + emerveillement**
- Comment les embouteillages se creent a partir de rien
- Pourquoi les etourneaux font des murmurations
- Le probleme a 3 corps est impossible

**Tier 3 — Philo/societe**
- Le dilemme du prisonnier
- La segregation de Schelling

---

## Architecture du code

```
src/
  main.js          — Tout le code (render, algos, recording, nav)
  style.css        — Styles de l'app (layout, sidebar, theme)
public/
  favicon.svg
index.html         — Point d'entree Vite
```

### Structure d'un algorithme (sort)

```js
{
  type: 'sort',
  title: 'Nom',
  badge: 'O(n)',
  desc: 'Description affichee sur le canvas',
  tiktokDesc: 'Description pour TikTok',
  tiktokTags: '#hashtags',
  codeLines: ['ligne 1', 'ligne 2'],
  run: async function(runId) { /* animation */ }
}
```

### Structure d'une simulation

```js
{
  type: 'simulation',
  title: 'Nom',
  badge: 'Info',
  desc: 'Description',
  tiktokDesc: '...',
  tiktokTags: '...',
  init: function() { /* setup state */ },
  draw: function(ctx) { /* custom rendering chaque frame */ },
  run: async function(runId) { /* logique de simulation */ }
}
```

---

## Inspirations

- **swap.js** (swapjs.dev) — 18M vues en 6 jours avec des sorting algorithms visuels
- **SimulateItNow** (simulateitnow.com) — 130+ simulations interactives (physique, maths, CS)
