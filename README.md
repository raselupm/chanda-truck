# সবজির ট্রাক (Sobjir Truck)

A browser-based 3D arcade truck-driving satire about how a vegetable's farm-gate price becomes its
Karwan Bazar price. Buy vegetables at village farms, drive toward Dhaka, pay legal tolls, and get
stopped by illegal extortion barriers (চাঁদা) along the way: pay up, or ram through at 90+ km/h and
outrun the chasers. At the end, a trip report breaks down where every taka went.

Built with Vite + TypeScript + Three.js. All models are procedural low-poly geometry, all sound is
synthesised with the Web Audio API, and there are no external downloads at runtime.

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
| Pay in a dialog | Enter | button |
| Debug overlay (fps, draw calls) | F3 | add `?debug` to the URL |

Phones are played in **portrait**: steering buttons bottom-left, pedals bottom-right, speedometer in
between. Holding a phone sideways shows a "rotate to portrait" hint, and the camera switches to a taller
FOV for portrait screens (`CAMERA.portrait` in `tuning.ts`).

Press the horn and the vehicle in front of you gives way: from the inner lane it moves to the outer
lane, and from the outer lane to the shoulder. An oncoming bus overtaking in your lane also ducks back.

There is no driving assist: the truck keeps its heading, so you steer through every bend yourself.
The highway is curvy between events (`ROAD.bend*` in `tuning.ts`, minimum radius `bendMinRadius`)
and straight only around tolls, barriers, crossings, bridges and the city.

## Tuning prices and gameplay

All numbers live in `src/config/`:

- **`vegetables.ts`**: per vegetable: `farmPricePerKg`, `karwanBazarPricePerKg` (both **placeholders**),
  `crateKg` (only affects how many crates are drawn), and colour.
- **`economy.ts`**:
  - `startingCash`, `truckCapacityKg`, `buyStepKg`
  - `chandaPerBarrier[]`: escalating chanda for barrier #1, #2, …
  - `penaltyMultiplierSlowHit` (1.5×) and `caughtMultiplier` (2×). The base amount is booked as CHANDA,
    the extra as PENALTY.
  - `fees.roadTax`, `fees.jamunaToll`, `fees.padmaToll`
  - `cargoDamagePct.*`, `ramSpeedKmh` (90), `tollMaxSpeedKmh` (20), `chaseRequiredSeconds` (20)
  - `chaseMeterMode`: `'reset'` (default: dropping below 90 resets the meter) or `'pause'`
- **`route.ts`**: start points (যশোর, রাজশাহী, ফরিদপুর). Each has an ordered list of legal toll
  stops and a number of random chanda barriers:
  - যশোর: লালন শাহ সেতু → নাটোর সড়ক টোল → যমুনা সেতু, 10 barriers
  - রাজশাহী: নাটোর সড়ক টোল → যমুনা সেতু, 6 barriers
  - ফরিদপুর: পদ্মা সেতু → এক্সপ্রেসওয়ে টোল, 6 barriers

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
- **Slow zones** (`SLOW_ZONES` in `tuning.ts`): every bazaar (40 km/h), 2–3 random schools (30 km/h) and
  the Karwan Bazar approach (30 km/h). Each has signs, and schools also get a school building, kids
  playing behind a wall and a zebra crossing. Speeding there shows a HUD limit badge and a funny warning,
  but no penalty.

## Railway crossings

Each route has 1–2 level crossings (`RAIL` in `tuning.ts`). When you come within about 450 m, a train
is usually on its way (80% chance): the gates drop, red lights flash, the bell rings and the gateman
waves his flag. A long train with 9 coaches passes with a horn and wheel clatter, then the gates lift.
- A closed gate stops the truck. Hitting it faster than 20 km/h costs a little cargo.
- Traffic queues at the gate.
- Gates never close in the middle of a chase.

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

## Project layout

```
src/
  main.ts                 renderer, resize, font loading, main loop
  config/                 vegetables, economy, route, tuning (all gameplay numbers)
  game/                   Game (orchestrator), GameState, Ledger, Cargo, Results, Input
  world/                  Track (road maths), RoadStreamer, Scenery, Environment, Traffic,
                          Farm, Barrier, TollPlaza, Bridge, City (market), People, Props, VehicleModels
  vehicle/                Truck (model), TruckController (physics), CameraRig, Chasers
  ui/                     HUD, ChaseMeter, BuyPanel, Chanda/Toll dialogs, ResultReport,
                          ShareImage, TouchControls, Menu, DebugOverlay
  audio/Sound.ts          synthesised sound effects
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

## Deploy to Cloudflare Pages

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
