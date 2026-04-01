# ROADMAP — TikTok Algorithm Studio

> App web pour creer des videos TikTok/Reels virales avec des algorithmes et simulations visuelles.
> Live : https://tiktok-algo-studio.vercel.app
> Repo : https://github.com/lhemwii/tiktok-algorithm-studio

---

## Stack technique

| Composant | Techno |
|-----------|--------|
| Build | Vite |
| Rendering | Canvas 2D (1080x1920, 60fps) |
| Audio | Web Audio API (masterGain + DelayNode sync) |
| Export video | MediaRecorder natif MP4 (Chrome 125+) |
| Hosting | Vercel (auto-deploy depuis GitHub) |

---

## Fait

### Infrastructure
- [x] Vite + ES modules, deploy Vercel
- [x] Export MP4 (H.264+AAC, compatible TikTok)
- [x] Audio/video sync (DelayNode 50ms + captureStream(0) + requestFrame)
- [x] Safe zones TikTok (200px top, 100px sides)
- [x] Dark/Light mode, raccourcis clavier, URL hash routing
- [x] Boutons Start / Stop / Restart

### Algorithmes de tri (8)
- [x] Anxiety Sort, Stalin Sort, Thanos Sort, Bogo Sort, Sleep Sort
- [x] Miracle Sort, Intelligent Design Sort, Quantum Bogo Sort

### Simulations (3)
- [x] Territory War (4 strategies snake-style)
- [x] Murmuration Boids (200 oiseaux + predateur)
- [x] Phantom Traffic Jam (onde de choc)

---

## Catalogue complet — 100 concepts viraux

### Cat. 1: ESCAPE GAMES (Ball/Object tries to escape)
| # | Concept | Status |
|---|---------|--------|
| 1 | Ball Escape — Circle with hole | A FAIRE |
| 2 | Ball Escape — Maze | Planifie |
| 3 | Ball Escape — Shrinking Room | Planifie |
| 4 | Ball Escape — Spinning Circle | Planifie |
| 5 | Ball Escape — Multiple Doors | Planifie |
| 6 | Ball Escape — Gravity Switch | Planifie |
| 7 | Ball Escape — Obstacle Course (Plinko) | Planifie |
| 8 | Ball Escape — Pac-Man Style | Planifie |
| 9 | Water Escape | Planifie |
| 10 | Balloon Escape | Planifie |

### Cat. 2: TERRITORY WARS
| # | Concept | Status |
|---|---------|--------|
| 11 | Territory War — Countries of Europe | Planifie |
| 12 | Territory War — Football Clubs | Planifie |
| 13 | Territory War — Fast Food Chains | Planifie |
| 14 | Territory War — Programming Languages | Planifie |
| 15 | Territory War — Social Media | Planifie |
| 16 | Territory War — US States | Planifie |
| 17 | Territory War — Dog Breeds | Planifie |
| 18 | Territory War — Music Genres | Planifie |
| 19 | Territory War — World Religions | Planifie |
| 20 | Territory War — Zodiac Signs | Planifie |

### Cat. 3: RACE / SORTING
| # | Concept | Status |
|---|---------|--------|
| 21 | Bar Chart Race — GDP | Planifie |
| 22 | Bar Chart Race — Baby Names | Planifie |
| 23 | Bar Chart Race — YouTube Subs | Planifie |
| 24 | Bar Chart Race — Languages | Planifie |
| 25 | Bar Chart Race — City Populations | Planifie |
| 26 | Marble Race — Downhill | Planifie |
| 27 | Marble Race — Elimination | Planifie |
| 28 | Sorting Race — Algos Head to Head | Planifie |
| 29 | Drag Race — Pixel Cars | Planifie |
| 30 | Swimming Race | Planifie |

### Cat. 4: SURVIVAL / ELIMINATION
| # | Concept | Status |
|---|---------|--------|
| 31 | Battle Royale — 100 Dots | A FAIRE |
| 32 | Battle Royale — Country Flags | Planifie |
| 33 | Hunger Games — Letters | Planifie |
| 34 | Virus vs Immune System | Planifie |
| 35 | Predator vs Prey Ecosystem | Planifie |
| 36 | King of the Hill | Planifie |
| 37 | Sumo Ring | Planifie |
| 38 | Gladiator Arena | Planifie |
| 39 | Tower Defense | Planifie |
| 40 | Infection Tag | Planifie |

### Cat. 5: PHYSICS
| # | Concept | Status |
|---|---------|--------|
| 41 | Domino Chain Reaction | Planifie |
| 42 | Newton's Cradle 100 balls | Planifie |
| 43 | Pendulum Wave | Planifie |
| 44 | Double Pendulum Chaos | Planifie |
| 45 | Cloth Simulation Tear | Planifie |
| 46 | Fluid Simulation | Planifie |
| 47 | Sand Simulation | Planifie |
| 48 | Bridge Builder Stress Test | Planifie |
| 49 | Wrecking Ball vs Building | Planifie |
| 50 | Gravity Well / 3-Body | Planifie |

### Cat. 6: NATURE / EMERGENCE
| # | Concept | Status |
|---|---------|--------|
| 51 | Ant Colony Optimization | Planifie |
| 52 | Starling Murmuration 1000 | FAIT (200 boids) |
| 53 | Schelling Segregation | Planifie |
| 54 | Conway's Game of Life | A FAIRE |
| 55 | Forest Fire Simulation | Planifie |
| 56 | Coral Reef Growth | Planifie |
| 57 | Snowflake Formation | Planifie |
| 58 | Erosion Simulation | Planifie |
| 59 | Flocking Fish + Shark | Planifie |
| 60 | Tree Growth L-System | Planifie |

### Cat. 7: SOCIETY / ECONOMY
| # | Concept | Status |
|---|---------|--------|
| 61 | Wealth Distribution | Planifie |
| 62 | Epidemic SIR Model | Planifie |
| 63 | Traffic Jam from Nothing | FAIT |
| 64 | Housing Market | Planifie |
| 65 | Democracy / Gerrymandering | Planifie |
| 66 | Supply and Demand | Planifie |
| 67 | Social Network Growth | Planifie |
| 68 | Urban Sprawl Timelapse | Planifie |
| 69 | Stock Market Random Walk | Planifie |
| 70 | Immigration Flow | Planifie |

### Cat. 8: CODE COMEDY
| # | Concept | Status |
|---|---------|--------|
| 71 | Anxiety Sort | FAIT |
| 72 | Passive-Aggressive Terminal | Planifie |
| 73 | Procrastination Sort | Planifie |
| 74 | Gaslighting Database | Planifie |
| 75 | Micromanager Function | Planifie |
| 76 | People-Pleaser API | Planifie |
| 77 | Imposter Syndrome Algorithm | Planifie |
| 78 | Toxic Positivity Compiler | Planifie |
| 79 | Boomer Sort | Planifie |
| 80 | Gen Z Sort | Planifie |

### Cat. 9: SPORTS
| # | Concept | Status |
|---|---------|--------|
| 81 | Penalty Shootout | Planifie |
| 82 | 100m Sprint Countries | Planifie |
| 83 | Boxing Match | Planifie |
| 84 | Football Match Dots | Planifie |
| 85 | F1 Race Top View | Planifie |
| 86 | Basketball Free Throw | Planifie |
| 87 | Tug of War | Planifie |
| 88 | Arm Wrestling | Planifie |
| 89 | Rock Paper Scissors Tournament | Planifie |
| 90 | Olympic Decathlon | Planifie |

### Cat. 10: PUZZLE / SATISFYING
| # | Concept | Status |
|---|---------|--------|
| 91 | Perfect Loop Gears | Planifie |
| 92 | Line Rider Auto | Planifie |
| 93 | Sandpile Model | Planifie |
| 94 | Spirograph Generator | Planifie |
| 95 | Maze Generator + Solver | Planifie |
| 96 | Pixel Art Timelapse | Planifie |
| 97 | Circle Packing | Planifie |
| 98 | Voronoi Diagram | Planifie |
| 99 | Reaction-Diffusion Turing Patterns | Planifie |
| 100 | Impossible Maze Ball 3D | Planifie |

---

## Formule video TikTok

1. **HOOK (0-3s)** — Action deja en cours. Jamais de titre au debut.
2. **SETUP (3-10s)** — Texte overlay rapide : les regles.
3. **TENSION (10s-50s)** — La simulation tourne. Near-misses.
4. **CLIMAX (50s-1:10)** — Le gagnant emerge.
5. **CAPTION** — Opinion, question, provocation. Jamais d'explication.

## Monetisation

1. 1-2 videos/jour → audience
2. 10K followers → Creator Fund
3. 50K → Brand deals
4. 100K → Lancer son propre outil (SaaS)
