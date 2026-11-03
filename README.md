# সবজির ট্রাক (Sobjir Truck)

A browser-based 3D arcade truck-driving satire about how a vegetable's farm-gate price becomes its
Karwan Bazar price. Buy vegetables at village farms, drive toward Dhaka, pay legal tolls, and get
stopped by illegal extortion barriers (চাঁদা) along the way: pay up, or ram through at 90+ km/h and
outrun the chasers. At the end, a trip report breaks down where every taka went.

Built with Vite + TypeScript + Three.js. All models are procedural low-poly geometry, all sound is
synthesised with the Web Audio API except the truck engine, which plays a recording
(`public/sounds/truck-engine.m4a`, 24 s cut from the original, see `ENGINE_SOUND` in `tuning.ts`): engine start when a run begins,
idle, a running loop whose pitch climbs through each gear, and a gear change at each shift speed. If
the file is missing, the synthesised engine hum is used. Run-ending crashes (head-on, falling into the valley) play
`public/sounds/final-crash.m4a`.

> Satire of a system. All characters and organisations are fictional and generic. No real party
> names, symbols, colours or people are used. Prices are placeholders.

## Run

```bash
npm install
npm run dev        # http://localhost:5173 (also reachable from your phone on the LAN)
npm run build      # type-checks, then writes a static site to dist/
npm run preview    # serve dist/ locally
```

Requires Node 18+.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Accelerate | W / ↑ | গ্যাস pedal (right) |
| Brake / reverse | S / ↓ | ব্রেক pedal (right) |
| Steer | A / D or ← / → | ◀ ▶ (left) |
| Handbrake | Space | — |
| Horn | H | 📯 |
| Camera (chase / cockpit) | C | 🎥 |
| Mute | M | 🔊 |
| Pause | P / Esc | ⏸ |
| Debug overlay (fps, draw calls) | F3 | add `?debug` to the URL |

Phones are played in **portrait**: steering buttons bottom-left, pedals bottom-right, speedometer in
between. Holding a phone sideways shows a "rotate to portrait" hint, and the camera switches to a taller
FOV for portrait screens (`CAMERA.portrait` in `tuning.ts`).

Press the horn and the vehicle in front of you swaps lanes to let you through: from the right lane it
moves left, from the left lane it moves right (only if the other lane is free).
- Cars, CNGs and rickshaws move on one tap.
- Buses and trucks need 3 taps within 6 seconds, or a long press of 1.2 seconds
  (`TRAFFIC.heavyHonks`, `heavyHonkWindow`, `longHornSeconds`).
- An oncoming bus overtaking in your lane ducks back on any horn.

There is no driving assist: the truck keeps its heading, so you steer through every bend yourself.
The highway is curvy between events (`ROAD.bend*` in `tuning.ts`, minimum radius `bendMinRadius`)
and straight only around tolls, barriers, crossings, bridges and the city.

## Trucks

Pick one of three vehicles on the title menu (`src/config/trucks.ts`). They're the most common goods vehicles on
Bangladeshi highways, where Tata and Ashok Leyland chassis dominate. Each card shows a rendered photo of the truck, and
the choice is remembered in `localStorage`.

| | খোলা ট্রাক | কাভার্ড ভ্যান | পিকআপ |
| --- | --- | --- | --- |
| Real-world type | Tata SE 1613 / Ashok Leyland 1616 with a locally built wooden body | 12-tonne cab-over (Tata LPT 1212 class) with a steel box | One-tonne single cab (Mahindra Bolero / Tata Yodha class) |
| Model | Yellow cab with a short nose, wooden crown (মুকুট) over the cab, full truck art, tassels | White cab, black grille, corrugated blue box, painted lettering, rear doors with locking bars | Vertical-slat grille, white body with a stripe, low steel bed, tube rack |
| Capacity | 5,000 kg | 4,000 kg | 1,800 kg |
| Top speed | 120 km/h | 115 km/h | 120 km/h, quicker off the line and more nimble |
| Chanda / tolls | full / full | full / 85% | 50% / 40% |
| Special | — | Locked: jam thieves can't steal | Shorter and narrower |

`selectTruck()` copies the chosen truck's `physics` over `TRUCK` in `tuning.ts`, so collisions, mud and the
hill-road sign speeds follow it. The worker scores every run against the biggest capacity and the fastest top
speed (`MAX_CAPACITY_KG`, `MAX_TRUCK_KMH`), so the leaderboard rules are the same for all three.

## Tuning prices and gameplay

All numbers live in `src/config/`:

- **`vegetables.ts`**: per vegetable: `farmPricePerKg`, `karwanBazarPricePerKg` (both **placeholders**),
  `crateKg` (only affects how many crates are drawn), and colour.
- **`economy.ts`**:
  - `startingCash`, `buyStepKg` (each truck's capacity is in `trucks.ts`)
  - `chandaPerBarrier[]`: escalating chanda for barrier #1, #2, …
  - `penaltyMultiplierSlowHit` (1.5×) and `caughtMultiplier` (2×). The base amount is booked as CHANDA,
    the extra as PENALTY.
  - `fees.roadTax`, `fees.jamunaToll`, `fees.padmaToll`
  - `speedFine` (base + per km/h over the limit, speed cameras in slow zones)
  - `cargoDamagePct.*`, `ramSpeedKmh` (90), `tollMaxSpeedKmh` (20), `chaseRequiredSeconds` (10)
  - `chaseMeterMode`: `'reset'` (default: dropping below 90 resets the meter) or `'pause'`
- **`route.ts`**: start points (যশোর, রাজশাহী, ফরিদপুর, রাঙামাটি, বগুড়া, সিলেট, নেত্রকোনা, পটুয়াখালী,
  কুমিল্লা, রংপুর, পাবনা, খুলনা, নড়াইল, মুন্সীগঞ্জ, বান্দরবান). Each has an ordered list of legal toll stops on its real highway and a number of random
  chanda barriers:
  - যশোর: লালন শাহ সেতু → নাটোর সড়ক টোল → যমুনা সেতু, 10 barriers
  - রাজশাহী: নাটোর সড়ক টোল → যমুনা সেতু, 6 barriers
  - ফরিদপুর: পদ্মা সেতু → এক্সপ্রেসওয়ে টোল, 6 barriers
  - রাঙামাটি: 1.25 km hill road → মেঘনা-গোমতী সেতু → মেঘনা সেতু, 6 barriers (N106 via Hathazari and the
    Bayezid–Fouzdarhat link road, so no Karnaphuli crossing)
  - বগুড়া: যমুনা সেতু (N5 via Hatikumrul and Elenga), 8 barriers
  - সিলেট: শেরপুর সেতু (Kushiyara) → সৈয়দ নজরুল ইসলাম সেতু (Bhairab, Meghna), 6 barriers
  - নেত্রকোনা: শম্ভুগঞ্জ সেতু (Old Brahmaputra) → N3 via Bhaluka and Gazipur, 6 barriers
  - পটুয়াখালী: পায়রা সেতু (Lebukhali) → পদ্মা সেতু → এক্সপ্রেসওয়ে টোল, 6 barriers
  - কুমিল্লা: মেঘনা-গোমতী সেতু (Daudkandi) → মেঘনা সেতু (Meghnaghat), 6 barriers
  - রংপুর: যমুনা সেতু (N5 via Palashbari, Gobindaganj, Bogura and Hatikumrul), 10 barriers
  - পাবনা: যমুনা সেতু (via Kashinathpur, Baghabari and Hatikumrul), 7 barriers; onion farms
  - খুলনা: মোল্লাহাট সেতু → পদ্মা সেতু → এক্সপ্রেসওয়ে টোল (via Gopalganj and Bhanga), 7 barriers
  - নড়াইল: মধুমতি সেতু (Kalna) → পদ্মা সেতু → এক্সপ্রেসওয়ে টোল (via Bhatiapara and Bhanga), 6 barriers
  - মুন্সীগঞ্জ: মুক্তারপুর সেতু (Dhaleshwari) → Panchabati → Postogola, 3 barriers; potato farms, the shortest run
  - বান্দরবান: 1.1 km hill road → Keranihat → শাহ আমানত সেতু → মেঘনা-গোমতী সেতু → মেঘনা সেতু, 8 barriers

  A start point can have its own four farms (`farms`: names, crops and farmers' lines); the others use the
  default four.

  `generateRoute()` re-rolls the barrier positions, places and amounts every run
  (`ECONOMY.randomChanda`). The last barrier is always at the city entrance. Spacing rules are in
  `LAYOUT`.
- **`tuning.ts` → `WORLD.speedScale`** (default 1.6): how much faster vehicles move through the world than the
  speedometer shows. Raise it for a quicker trip; every km/h rule stays the same.
- **`tuning.ts`**: `WEATHER` (how long each weather lasts and how long it takes to blend), truck physics, road size/curves, chase AI speeds, traffic density, camera, render
  quality (pixel-ratio caps, fog).

## Roadside life

- **Vehicle writing:** traffic carries truck-art style slogans. Buses and trucks show slogans on the back
  and made-up company names on the sides, CNGs and rickshaws have painted back plates, and cars carry
  bumper stickers. All the lines are in `world/VehicleArt.ts`.
- **Billboards:** 19 illustrated parody billboards on both sides of the road (`BILLBOARDS` in
  `world/Scenery.ts`). Every brand is made up.
- **Exhaust smoke** (`EXHAUST` in `tuning.ts`, `world/Exhaust.ts`): every motor vehicle puffs black
  smoke from its tailpipe. Buses and trucks puff the most, and pedal rickshaws don't smoke at all. Your
  truck's smoke comes out of a stack behind the cab. It puffs a thick cloud when the engine starts and
  when you floor it from low speed. All the puffs share one pooled point cloud.
- **Village life** (`world/VillageSights.ts`, `VILLAGE` in `tuning.ts`): every route has a গরুর হাট, a ওয়াজ মাহফিল,
  two football fields and two cricket fields beside the road, in quiet rural stretches. Each run places them
  somewhere new, on either side of the road.
  - **গরুর হাট:** rows of deshi cattle tied to bamboo rails (some in Eid garlands), Black Bengal goats, tarp
    shades, a bull under his own shade, straw piles, the হাসিল ঘর desk with a loudspeaker, and buyers walking
    the rows. Cows are led along the road shoulder. You hear them moo as you pass.
  - **ওয়াজ মাহফিল:** a patchwork shamiana with cloth walls on the far side, a stage with its banner and the
    speakers, rows of listeners on mats, food stalls and a decorated gate. Horn loudspeakers on bamboo poles
    line the road for 200 m each way, and a synthesised sermon carries over them with an echo. At night the
    string lights come on.
  - **Football:** bamboo goals on a worn field, with two teams of boys in Argentina sky-blue stripes and Brazil
    yellow chasing the ball. Spectators sit along the road, and cows graze at the corner.
  - **Cricket:** a pitch with stumps and creases. The bowler runs in, the batter plays a shot or misses to the
    keeper, a fielder chases it down, and the batters run.
  - The players go home after dark.
- **Pedestrians:** they open umbrellas when it rains and carry flashlights after dark.
- **Slow zones** (`SLOW_ZONES` in `tuning.ts`): every bazaar (40 km/h), 2–3 random schools (30 km/h) and
  the Karwan Bazar approach (30 km/h). Each has signs, and schools also get a school building, kids
  playing behind a wall and a zebra crossing. Speeding there shows a HUD limit badge and a funny warning.
  Each zone also has a **speed camera** (with a "স্পিড ক্যামেরা" sign at the entrance): pass it more
  than 5 km/h over the limit and it flashes and fines you automatically, cash first, then cargo, with no
  dialog. The fine is ৳500 + ৳50 per km/h over (`speedFine` in `economy.ts`). It's a legal traffic fine
  (`FINE` in the ledger), so the result report counts it with tolls and road tax, not with chanda.

## Aircraft

Planes and helicopters cross the sky ahead of you on every route (`world/Aircraft.ts`, models in
`world/AircraftModels.ts`, timing and heights in `AIRCRAFT` in `tuning.ts`). The types are the ones flying in
Bangladesh, with fictional airline liveries:
- **Airliners:** a wide-body twin (Boeing 787 class) and a narrow-body (737-800 class) cruise high and small
  with contrails. Within 5 km of Karwan Bazar they come in low with their gear down, on approach to Shahjalal.
- **Turboprop:** the domestic hopper (ATR 72 / Dash 8-400 class), with a high wing, a T-tail and spinning
  six-blade propellers.
- **Air Force fighters:** F-7BGI (nose intake, double-delta wing; often a vic of three) and MiG-29 (twin
  engines, twin fins; often a pair). They make a fast low pass, in grey with green-and-red roundels and an
  afterburner glow.
- **Helicopters:** the Mi-17/Mi-171 (olive, five blades, fixed wheels) and a civil white Bell 212 (two
  blades, skids). They sometimes follow the road.

Each flight fades in and out at the ends of its pass and has synthesised sound with Doppler: jet roar,
airliner rumble, turboprop drone and rotor slap. Navigation lights and flashing beacons show at dusk and
night. `game.aircraft.spawn('mi17')` in the dev console sends one over now.

## Bridges

- **Jamuna and Lalon Shah:** concrete box-girder bridges on twin piers, with a name arch over the road.
  - **Jamuna** carries its railway along the left (north) edge of the deck, as the real bridge does. The
    track also runs beside the road for 2 km before and after the bridge, then curves away. One train
    always comes by on the approach, and 65% of the time a second one crosses the bridge while you do.
    Trains sound their horn and the wheels clatter as they pass.
  - **Lalon Shah** has the old **Hardinge Bridge** (1915) on its left. It's a railway bridge of steel
    Pettit through trusses, with curved top chords on stone well piers, and a double track on high banks
    at each end.
- **Padma:** modelled on the real double-deck design. The road runs on top of a deep grey steel Warren
  truss, the two-track railway deck is enclosed inside the truss, and it stands on massive piers.
  The deck is 22 m up, with a roadside name monument. The approaches are open viaducts on piers. At each
  end, the railway's own viaduct comes in from the left and slips under the road into the truss, and
  trains run on it too.

The railway lines and trains are in `world/Railway.ts` (`TRAINS` and `HARDINGE` in `tuning.ts`). Route
generation keeps the railway's stretch (`bridge.rail` in `route.ts`) clear of other events.

- **Shah Amanat (Karnaphuli):** on the বান্দরবান route. Modelled on
  the real extradosed bridge. A prestressed concrete box
  girder over 115 + 3 × 200 + 115 m spans (scaled), deeper at the four short pylons. The pylons stand in
  the median, each with a single plane of stay cables fanning down to the middle of the deck, and the
  median keeps your traffic in the left lanes. A short viaduct on round piers follows.
- **Payra (Lebukhali):** the same extradosed design: one 200 m main span between two median pylons,
  mid-river, with approach viaducts on round piers at both ends.
- **Meghna-Gumti and Meghna:** long prestressed concrete box girders built by balanced cantilever, with
  deep haunches over every wall pier, each with its newer steel twin bridge running alongside.
- **Syed Nazrul Islam (Bhairab):** a concrete box girder on wall piers. On its left are the 2017 railway
  bridge (concrete girders, trains run on it) and the old 1937 railway bridge (steel parallel-chord
  Warren through trusses on stone piers, `BHAIRAB_RAIL` in `tuning.ts`).
- **Madhumati (Kalna, 2022):** a steel network arch over the middle of the river (150 m of its 690 m, scaled).
  Two arch ribs stand just outside the railings, tied at deck level, with crossing inclined hangers and wind
  bracing high above the traffic. Concrete approach spans on twin round piers.
- **Sherpur, Shambhuganj, Mollahat and Muktarpur:** plain concrete girder bridges on twin piers (`girder`).

Deck heights and ramp lengths are in `ROAD.bridgeStyles`.

## Hill road (Rangamati)

The রাঙামাটি route starts with 1.25 km of hill road before the highway (`HILL` in `tuning.ts`). It's two
lanes, with tight bends (down to about 32 m radius), and climbs and dips 8–32 m above the valley floor.
- On every bend the inside is a hillside cutting you scrape against; the outside drops into the jungle
  valley. Take a bend too fast and the truck can't turn tightly enough, runs off the outside edge, rolls
  down into the valley, and the run ends (outcome `fall`).
- Before every sharp bend a sign gives the speed it can be taken at (worked out from the truck's steering
  limits). The HUD warns you if you come at one too fast.
- Traffic on the hill road keeps to 40 km/h, with no overtaking. There are no barriers or tolls on it.

## Railway crossings

Each route has 1–2 level crossings (`RAIL` in `tuning.ts`). When you come within about 450 m, a train
is usually on its way (80% chance): the gates drop, red lights flash, the bell rings and the gateman
waves his flag. A long train with 9 coaches passes with a horn and wheel clatter, then the gates lift.
- A closed gate stops the truck. Hitting it faster than 20 km/h costs a little cargo.
- Traffic queues at the gate.
- Gates never close in the middle of a chase.

## Village shortcuts

Every route has 2 village shortcuts (`SHORTCUT` in `tuning.ts`), each going round one chanda barrier
(never the one at the city entrance). It always forks off to the left and always rejoins from the left;
a green sign and a HUD hint announce it. Steer onto it and you skip that barrier.
- It's a curvy 2-lane village road through paddy fields and roadside trees, about 80 m from the highway,
  and it rejoins the highway 1.1–1.3 km past the barrier.
- A **left** one stays on the left all the way. A **right** one passes under the highway soon after the
  fork (the highway climbs over it on a flyover), runs along the right side past the barrier, then passes
  under a second highway flyover to rejoin from the left. It's a coin flip (`rightChance`). The village
  road itself is always on the ground.
- Speed limit 70 km/h (`maxKmh`), signposted along the road; the truck won't go faster there. That also
  means you can't shake off a chase on a shortcut (escaping needs 90+).
- No buses or trucks: only slow rickshaws, CNGs and motorbikes, so it isn't automatically faster.
- Run off the road into the paddy and you get stuck in the mud, as you would beside the highway.
- `Shortcut.ts` holds the road maths (an offset from the highway's centreline); `ShortcutRoads.ts`
  builds the village road, the flyover's piers and the signs. The flyover deck is part of the highway
  (`Track` elevation, drawn by `RoadStreamer`).

## Weather and time of day

`world/Weather.ts` drifts randomly between দিন, সন্ধ্যা, রাত, মেঘলা, বৃষ্টি and ঝড়. Each state holds for
60–120 s, then blends over 25 s into a believable neighbour (for example day → evening → night, or
cloudy → rain → storm). Presets control the sky, fog, light, clouds, stars, rain amount, lightning and
headlights. Rain also makes the road wetter: braking is about 20% weaker and steering about 10% weaker.

## How the money is counted

Every payment goes through `Ledger` (`src/game/Ledger.ts`) with a category: `PURCHASE`, `ROAD_TAX`,
`TOLL`, `CHANDA`, `PENALTY`, `CARGO_LOSS`.

- When cash runs out, the rest is taken as cargo. That entry is **non-cash**: its value is the purchase
  price of the kg removed, and it was already paid for under PURCHASE.
- Cargo damage (ramming, crashes, getting caught) is a non-cash `CARGO_LOSS` entry.
- The result screen (`src/game/Results.ts`) splits **total cash spent** exactly into: vegetables that
  arrived, legal tolls/tax, chanda, penalty chanda, and lost cargo.
- Landed cost per kg = total cash ÷ delivered kg. Per vegetable, the non-purchase costs are allocated
  in proportion to purchase value.
- "Without chanda" per-kg cost = (total cash − chanda/penalty paid in cash) ÷ (delivered kg + kg taken
  as chanda).

## Icons

The game uses no emoji. Every icon is a flat SVG in `src/ui/icons.ts`, so it looks the same on every
phone. In any game text, write an icon as a token such as `"{truck} ঢাকার পথে"`.
- The DOM helpers (`el`, `button`, `setText`) turn tokens into inline SVG.
- Canvas textures (signs, billboards, vehicle slogans, the share image) draw them with `fillRich()`.
  Icons are preloaded as images at boot for this.
- To add an icon, add an SVG to `ICONS`.

## Project layout

```
src/
  main.ts                 renderer, resize, font loading, main loop
  config/                 vegetables, economy, route, tuning (all gameplay numbers)
  game/                   Game (orchestrator), GameState, Ledger, Cargo, Results, Input
  world/                  Track (road maths), RoadStreamer, Scenery, Environment, Traffic,
                          Farm, Barrier, TollPlaza, Bridge, City (market), People, Props, VehicleModels
  vehicle/                Truck (model), TruckController (physics), CameraRig, Chasers
  ui/                     HUD, ChaseMeter, BuyPanel, ResultReport,
                          ShareImage, TouchControls, Menu, DebugOverlay
  audio/Sound.ts          engine recording + synthesised sound effects
  utils/                  Bengali numbers (bnNumber.ts), geometry/texture helpers, rng, math
```

Models are built by factory functions (`world/VehicleModels.ts`, `world/People.ts`, `world/Props.ts`,
`vehicle/Truck.ts`). To use GLB models later, swap those factories for loaders that return meshes with
the same orientation (facing −Z, origin at ground centre).

## Performance notes

- Road is streamed in 40 m chunks: about 15 ahead and 3 behind are rebuilt as you drive.
- Roadside scenery uses one `InstancedMesh` per prop type, rebuilt deterministically per chunk.
- People, vehicles and set pieces are merged vertex-coloured meshes (one draw call each), and set
  pieces are hidden when far away.
- Phones get no MSAA and a 1.25 pixel-ratio cap. Typical scene: ~80 draw calls and ~25k triangles.

## SEO and link previews

- **Set your domain** in `.env` → `VITE_SITE_URL=https://your-domain` (no trailing slash). The build
  fills it into the canonical URL, Open Graph, Twitter and JSON-LD tags in `index.html`, and writes
  `robots.txt` and `sitemap.xml` (see the `seoFiles` plugin in `vite.config.ts`). On Cloudflare Pages
  you can instead set `VITE_SITE_URL` as a build environment variable.
- **`index.html` contains:**
  - Bengali title, description and keywords
  - canonical and hreflang links
  - Open Graph tags (`og:locale` `bn_BD`, 1200×630 image) and a Twitter `summary_large_image` card
  - schema.org `VideoGame` structured data
  - favicon, Apple touch icon and web app manifest (fullscreen, portrait)
  - crawlable text on the loading screen
- **Preview image and icons:** `public/og-image.png`, `icon-192/512.png`, `apple-touch-icon.png` and
  `favicon.svg`. To change the preview art, edit `scripts/social/og.html` / `icon.html` and run
  `npm run social-images`. This needs Google Chrome; set `CHROME=/path/to/chrome` if it's installed
  somewhere else. It currently runs on macOS only, because it uses `sips` to resize the small icons.
- **After deploying,** check the preview with Facebook's Sharing Debugger
  (developers.facebook.com/tools/debug), which also refreshes its cache.

## Leaderboard

Players enter a name before their first run. Each player's running totals are kept in their browser.
The board (top 100) is downloaded at most once an hour per device; a run is sent to the API worker
(`worker/index.ts`, only handles `/api/*`) only when it would get onto that board. The worker keeps just
those 100 rows in a Cloudflare D1 database (`migrations/`), drops whoever falls off, and returns the new
board with the answer. Rankings are therefore up to an hour old.
Points (`src/game/Score.ts`, shared by the game and the worker): no delivery or no profit = 0;
otherwise 1 point per ৳100 profit, × a speed factor of 0.5–2 (highway driven at 60 km/h average = ×1).
The server recomputes points itself and rejects impossible runs, but a determined cheater can still
forge requests: scores come from the browser.

**Deploy:** pushing to `main` deploys through Cloudflare Workers Builds (`npm run build`, then
`npx wrangler deploy`), site and API together. The D1 database `chanda-truck` already exists (its id is in
`wrangler.jsonc`). After adding a file to `migrations/`, apply it with `npx wrangler login` once and then
`npm run db:migrate`.

**Local dev with the API:** `npm run dev:api` (worker + local D1 on :8787, serves the last `npm run build`)
alongside `npm run dev`; Vite proxies `/api` to it. Without it the game still runs, just without a leaderboard.

## Deploy to Cloudflare Pages

The leaderboard needs the Worker deploy above; a plain Pages upload serves the game only.

**Dashboard (Git integration):** create a Pages project from your repo with

- Framework preset: *None* (or *Vite*)
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable (optional): `NODE_VERSION=20`

**CLI (direct upload):**

```bash
npm run build
npx wrangler pages deploy dist --project-name sobjir-truck
```

`public/_headers` sets long-lived caching for hashed assets. The build uses relative asset paths
(`base: './'`), so it also works from a sub-path.
