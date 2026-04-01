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

---

## Catalogue 101-200 — Tension, Suspense & "I Can't Stop Watching"

### Cat. 11: PICK YOUR WINNER — Betting Tension
| # | Concept | Status |
|---|---------|--------|
| 101 | Last Country Standing — World Map Elimination | Planifie |
| 102 | Color War — 4 Paint Drops | Planifie |
| 103 | Alphabet Elimination | Planifie |
| 104 | Zodiac Battle Royale | Planifie |
| 105 | Birth Month Hunger Games | FAIT |
| 106 | Blood Type Battle | Planifie |
| 107 | Left Hand vs Right Hand | Planifie |
| 108 | Morning Person vs Night Owl | Planifie |
| 109 | iPhone vs Android Pong | Planifie |
| 110 | Cat vs Dog Territory War | Planifie |

### Cat. 12: WILL IT SURVIVE? — Countdown to Disaster
| # | Concept | Status |
|---|---------|--------|
| 111 | Balloon and the Needles | FAIT |
| 112 | Tightrope Ball | Planifie |
| 113 | Rising Water | Planifie |
| 114 | Asteroid Field | Planifie |
| 115 | Shrinking Platform | Planifie |
| 116 | Lava Floor Rising | Planifie |
| 117 | Crumbling Bridge | Planifie |
| 118 | 1000 Degrees Knife vs Objects | Planifie |
| 119 | Closing Walls | Planifie |
| 120 | Lightning Survival | Planifie |

### Cat. 13: SO CLOSE! — Near-Miss Tension
| # | Concept | Status |
|---|---------|--------|
| 121 | Hole-in-One Machine | FAIT |
| 122 | Perfect Bounce (5 walls + cup) | Planifie |
| 123 | Thread the Needle (10 gaps) | Planifie |
| 124 | Maze — Almost There | Planifie |
| 125 | Parallel Parking Bot | Planifie |
| 126 | Stacking Game | Planifie |
| 127 | Pendulum Timer | Planifie |
| 128 | Coin Spinning on Edge | Planifie |
| 129 | Jenga Tower Physics | Planifie |
| 130 | Gap Jump | Planifie |

### Cat. 14: THE GREAT REVERSAL — Comeback Tension
| # | Concept | Status |
|---|---------|--------|
| 131 | Tortoise and the Hare | Planifie |
| 132 | Empire Rise and Fall | Planifie |
| 133 | Battery Race | Planifie |
| 134 | Comeback King Score Race | Planifie |
| 135 | Inflation vs Savings | Planifie |
| 136 | Forest vs Fire | FAIT |
| 137 | Population vs Resources | Planifie |
| 138 | Student vs Deadline | Planifie |
| 139 | Dam vs Rising Water | Planifie |
| 140 | Immune System vs Infection Race | Planifie |

### Cat. 15: IMPOSSIBLE ODDS
| # | Concept | Status |
|---|---------|--------|
| 141 | Random Walk Home | Planifie |
| 142 | Monkey Typing Shakespeare | Planifie |
| 143 | Shuffle to Sorted | Planifie |
| 144 | Lightning Same Spot | Planifie |
| 145 | Needle in a Haystack | Planifie |
| 146 | Random Maze Solver | Planifie |
| 147 | Lottery Simulation | Planifie |
| 148 | Pi by Throwing Darts | Planifie |
| 149 | Evolution Simulation | Planifie |
| 150 | Infinite Monkey Painter | Planifie |

### Cat. 16: WHO GETS ELIMINATED NEXT?
| # | Concept | Status |
|---|---------|--------|
| 151 | Country Elimination by Disaster | Planifie |
| 152 | Musical Chairs Dots | Planifie |
| 153 | Floor is Lava Platforms | Planifie |
| 154 | Weakest Link Stats | Planifie |
| 155 | Hunger Games 24 Dots | Planifie |
| 156 | Spelling Bee Elimination | Planifie |
| 157 | Planet Elimination | Planifie |
| 158 | Social Media App Elimination | Planifie |
| 159 | Food Chain Elimination | Planifie |
| 160 | Celebrity Popularity Contest | Planifie |

### Cat. 17: THE DOMINO EFFECT — Chain Reaction
| # | Concept | Status |
|---|---------|--------|
| 161 | One Domino Topples a City | Planifie |
| 162 | One Lie Snowball | Planifie |
| 163 | Butterfly Effect Weather | Planifie |
| 164 | One Person Starts Clapping | Planifie |
| 165 | Bank Run Simulation | Planifie |
| 166 | Traffic Shockwave Highway | FAIT (Phantom Traffic) |
| 167 | Viral Tweet Simulation | Planifie |
| 168 | Nuclear Chain Reaction | Planifie |
| 169 | One Crack in a Dam | Planifie |
| 170 | Invasive Species | Planifie |

### Cat. 18: HOW LONG UNTIL...? — Timer Tension
| # | Concept | Status |
|---|---------|--------|
| 171 | Ice Cube Melting | Planifie |
| 172 | Candle Burning Down | Planifie |
| 173 | Balance Inverted Pendulum | Planifie |
| 174 | Erosion River Canyon | Planifie |
| 175 | Rust Timelapse | Planifie |
| 176 | Sun Burning Out | Planifie |
| 177 | Hourglass Random Sand | Planifie |
| 178 | AI Driving How Far | Planifie |
| 179 | Growing Bacteria Petri Dish | Planifie |
| 180 | Memory Filling Up | Planifie |

### Cat. 19: MAKE THE CHOICE — Decision Tension
| # | Concept | Status |
|---|---------|--------|
| 181 | Monty Hall 3 Doors | Planifie |
| 182 | Trolley Problem Visualized | Planifie |
| 183 | Risk vs Safety Investment | Planifie |
| 184 | Flight vs Invisibility | Planifie |
| 185 | Escape Room 2 Strategies | Planifie |
| 186 | Fight or Flight | Planifie |
| 187 | Save One Ethical Dilemma | Planifie |
| 188 | Short-Term vs Long-Term | Planifie |
| 189 | Cooperation vs Betrayal | Planifie |
| 190 | Fast Lane vs Slow Lane | Planifie |

### Cat. 20: EMOTIONAL INVESTMENT — Stories
| # | Concept | Status |
|---|---------|--------|
| 191 | The Last Tree | Planifie |
| 192 | The Lonely Dot | FAIT |
| 193 | Baby Turtle to Ocean | Planifie |
| 194 | The Underdog Race | Planifie |
| 195 | Plant Growing Through Concrete | Planifie |
| 196 | Lost Penguin Finding Home | Planifie |
| 197 | Paper Boat in a Storm | Planifie |
| 198 | The Climbing Dot | Planifie |
| 199 | Two Magnets Finding Each Other | Planifie |
| 200 | The Signal | Planifie |

### Watch Time Psychology Cheat Sheet

| Mecanique | Pourquoi ca marche | Boost watch time |
|-----------|-------------------|-----------------|
| Betting/Picking | Investissement identitaire | +40% completion |
| Countdown | Doom inevitable = urgence | +35% completion |
| Near-misses | Boucle dopamine (slot machine) | +50% completion |
| Reversal | Les perdants restent pour le comeback | +45% completion |
| Impossible odds | Curiosite pour l'improbable | +30% completion |
| Emotional attachment | Anthropomorphiser des points | +60% completion |
| Slow escalation | Effet "encore un peu" | +40% completion |

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

---

## Analyse des videos d'inspiration (dossier /inspiration)

### 1. Arena War — Territory War circulaire (swapjs)
**Source** : `Capture d'écran 2026-04-01 151842.png` + `mimic_analysis.png`

**Description** : 4 IA s'affrontent sur une grille CIRCULAIRE (pas carree). Chaque IA a un nom, une couleur, une strategie, et un pourcentage en temps reel.

**Layout pixel-perfect (9:16, 1080x1920)** :
- **Fond** : blanc/creme clair `#F5F0EB`
- **Titre** : "Arena War" en noir, police serif bold ~60px, centre, y=120
- **Sous-titre** : "4 algorithms fight for space" en gris clair, ~28px, y=160
- **Grille circulaire** : centre x=540 y=700, rayon ~350px
  - Forme : cercle rempli de cellules carrees (~8x8px)
  - Seules les cellules DANS le cercle sont actives (les coins sont vides)
  - Cellules vides : gris tres clair `#E8E4E0`
  - Cellules occupees : couleur de l'IA
- **IAs et couleurs** :
  - Greedy : orange/saumon `#E8985A` — "Nearest empty cell"
  - Spiral : noir `#3D3D3D` — "Clockwise wall-hugger"
  - Hunter : bleu/mauve `#9B8EC8` — "Chase nearest enemy"
  - Random : rose/mauve clair `#C4A0C4` — "Random walk"
  - (Variante Mimic : une 5eme IA cyan `#7BC8C8` — "Copies enemy moves")
- **Tete de creature** : carre colore ~12x12px avec 2 yeux blancs (2x2px) et 2 pupilles noires (1x1px)
- **Scoreboard en bas** : 4 cartes empilees
  - Chaque carte : fond blanc, bords arrondis 12px, hauteur ~65px
  - A gauche : icone carre ~36x36 de la couleur avec yeux
  - Centre-gauche : nom en bold 26px + description en gris 18px
  - Droite : pourcentage en bold 30px
  - Les cartes sont triees par score descendant

**Ce qu'il faut implementer** :
- Grille circulaire (masque les cellules hors du cercle)
- Tetes avec yeux qui regardent dans la direction du mouvement
- Style "pixel art retro propre" — pas de glow, pas d'ombres lourdes
- 5eme IA optionnelle "Mimic" qui copie les mouvements du leader

---

### 2. Football Pong — Bosnie vs Italie
**Source** : `frame_analysis.png` + `frame_analysis_mid.png` + `frame_analysis_end.png`

**Description** : Deux balles-drapeaux rebondissent dans une arene circulaire. Quand une balle touche le mur, l'autre equipe marque. Style Pong mais avec physique 2D.

**Layout pixel-perfect** :
- **Fond** : vert football fonce `#2D5A27`
- **Arene** : cercle blanc/gris clair, centre ecran, rayon ~350px
  - Contour blanc epais ~6px
  - Interieur vert fonce (meme que le fond ou legerement different)
- **Scoreboard en haut** :
  - Barre horizontale centree, fond semi-transparent
  - Gauche : drapeau pays 1 (image ~40x28) + score en blanc bold 36px
  - Centre : timer "23:04" en petit fond jaune/vert arrondi
  - Droite : score en blanc bold 36px + drapeau pays 2
- **Balles** :
  - Chaque balle = cercle ~30px avec le drapeau du pays dessine dessus
  - OU emoji drapeau simplifie (couleurs du drapeau en bandes)
  - Les balles rebondissent avec physique realiste (vitesse, angle de reflexion)
  - Quand une balle touche le bord du cercle = point pour l'adversaire
- **Footer** :
  - En bas : logo tournoi + "qualifiers" + noms des deux pays
  - Fond semi-transparent

**Ce qu'il faut implementer** :
- Arene circulaire sur fond vert
- Balles avec couleurs de drapeaux (pas besoin d'images, juste des bandes de couleurs)
- Collision avec le cercle = point pour l'adversaire
- Scoreboard anime en haut
- Match en temps reel, le score evolue
- Parametrable : n'importe quels pays/equipes

---

### 3. Escape Before You Die — Ball + Spikes + Hearts
**Source** : `escape_analysis.png`

**Description** : Une balle verte rebondit dans un cercle rempli de piques. Elle doit trouver la sortie avant de perdre toutes ses vies. Particules vertes trainent derriere elle.

**Layout pixel-perfect** :
- **Fond** : noir pur `#000000`
- **Titre** : "Escape Before You Die!" en blanc bold ~52px, centre, y=120
  - Avec emoji 💀 possible
- **Vies** : rangee de coeurs en haut
  - Coeurs rouges `#FF0000` = vies restantes
  - Coeurs gris `#555555` = vies perdues
  - ~10 coeurs total, taille ~28px chacun, espaces de 4px
- **Arene** : cercle, centre x=540 y=800, rayon ~320px
  - Contour : vert fonce `#1A3A1A` avec piques triangulaires
  - Piques : triangles pointant vers l'interieur, ~20px de long, espaces regulierement sur tout le contour (~40 piques)
  - Couleur piques : gris/vert sombre
  - Un GAP dans les piques = la sortie (visible, ~40px de large)
- **Balle** : cercle vert vif `#7FFF00`, rayon ~12px
  - Trainee de particules vertes derriere (petits cercles qui fade)
  - ~20-30 particules vertes semi-transparentes dispersees dans l'arene
- **Balle grise** : une 2eme balle grise (obstacle? ou balle morte?)
- **Footer** : texte petit en bas, username

**Ce qu'il faut implementer** :
- Cercle avec piques sur tout le contour (triangles)
- Un gap = sortie qui peut tourner lentement
- Balle avec trainee de particules
- Systeme de vies (coeurs)
- Toucher une pique = perdre une vie
- Sortir par le gap = victoire
- Particules ambiantes dans l'arene

---

### 4. Ball Multiply — Every bounce = new ball
**Source** : `multiply_analysis.png`

**Description** : Des balles rebondissent dans un cercle. A chaque rebond contre le mur, une nouvelle balle apparait. De 2 balles a 2500 en quelques secondes. Chaos exponentiel.

**Layout pixel-perfect** :
- **Fond** : noir pur `#000000`
- **Titre** : "Every bounce = new ball 🤯" en blanc bold ~44px, centre, y=180
- **Arene** : cercle, centre ecran, rayon ~350px
  - Contour : bleu/violet fin `#5555CC`, epaisseur ~2px
  - Interieur : noir
- **Balles** : petits cercles colores, rayon ~5-6px
  - Couleurs aleatoires vives : rouge `#FF0000`, bleu `#0066FF`, magenta `#FF00FF`, vert, jaune...
  - Initialement 2-3 balles
  - A chaque collision avec le mur du cercle → spawn une nouvelle balle a la position du rebond
  - Direction de la nouvelle balle = aleatoire
- **Croissance exponentielle** : le nombre de balles double rapidement
  - Afficher un compteur en overlay : "Balls: 2" → "Balls: 47" → "Balls: 2,500"
- **Le chaos final** : l'arene est completement remplie de balles qui rebondissent partout

**Ce qu'il faut implementer** :
- Cercle sur fond noir
- Physique de rebond sur cercle
- Spawn de nouvelle balle a chaque collision avec le mur
- Couleur aleatoire pour chaque nouvelle balle
- Compteur de balles en temps reel
- Performance : limiter a ~2000-3000 balles max, reduire le rayon des balles quand il y en a trop
- Son : petit "pop" a chaque spawn

---

### 5. Free For All — Emoji Battle Royale
**Source** : `crash_analysis.png`

**Description** : Des grosses balles emoji (avec visages) se battent dans une arene grille. Systeme de vies en haut (rangees de coeurs colores). Quand deux balles se touchent, une perd une vie.

**Layout pixel-perfect** :
- **Fond** : noir/bleu tres fonce `#0A0A1A`
- **Vies en haut** : 4 rangees de coeurs (une par joueur)
  - Rangee 1 : coeurs rouges (10 coeurs)
  - Rangee 2 : coeurs bleu-vert (10 coeurs)
  - Rangee 3 : coeurs verts (10 coeurs)
  - Rangee 4 : coeurs jaunes (10 coeurs)
  - Taille coeur ~20px, fond sombre derriere chaque rangee
- **Titre** : "Free For All" en blanc bold centre, entre les vies et l'arene
- **Arene** :
  - Grille de lignes fines bleu fonce `#1A1A3A` sur fond noir
  - Pas de bordure visible — les balles rebondissent sur les bords de l'ecran
- **Balles/Creatures** :
  - 4 grosses balles (~60-80px de diametre)
  - Chaque balle a un VISAGE (emoji-style) : yeux, bouche
  - Rouge : visage en colere 😡
  - Bleu/vert : visage cool 😎
  - Jaune : visage qui pleure 😢
  - Vert : visage degel 🤢
  - Les balles bougent avec physique, rebondissent sur les murs et entre elles
  - Quand deux balles se touchent = la plus petite perd une vie
- **Particules** : petites particules ambiantes (etoiles, debris) flottent dans l'arene
- **Watermark** : @username en bas

**Ce qu'il faut implementer** :
- 4 grosses balles avec visages dessines (yeux + bouche, pas d'images)
- Systeme de vies par couleur (rangees de coeurs en haut)
- Collision = une balle perd un coeur
- 0 coeurs = elimination (balle disparait avec explosion de particules)
- Grille en arriere-plan
- Particules ambiantes
- Dernier debout gagne
