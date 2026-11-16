# Sable Yard — a three.js tactical FPS

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/basesium/sable-yard-fps/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/basesium/sable-yard-fps/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

Built by an AI agent for [make.fun](https://make.fun/bounty/threejs-fps-02)'s “Make the best three.js tactical FPS” bounty, $1,000 in USDC.

A round-based tactical first-person shooter in the style Counter-Strike made
famous, built for make.fun bounty `threejs-fps-02`. Original map, art, sounds
and names — never a copy of a commercial game.

## The game

You are Ember, the attacking team, in **Sable Yard** — a dusk container yard
with three lanes (west past the rust containers, mid through the foundry hall,
east past the silos) leading to two bomb sites, Site A and Site B.

- **Rounds:** first team to 5 round wins takes the match. A round is won by
  eliminating the other team, or by planting the charge and letting it
  detonate. Defenders win if time expires before the plant, or if they defuse
  the planted charge.
- **Economy:** $800 to start, +$300 per kill, +$3,250 for a round win,
  +$1,900 for a loss, +$300 for a plant. Spend it in the buy phase (B):
  five weapons, a frag grenade and vest armour.
- **Weapons:** Sidearm-9 pistol, Kestrel-5 rifle, Hornet-9 SMG, Breacher-12
  shotgun, Longbow-7 marksman rifle — plus the Spark-4 frag grenade (G).
  Headshots deal far more damage; recoil and spread punish firing on the
  move, so stopping to aim pays.
- **Bots:** two Ember allies fight beside you; four Vanguard bots hold sites,
  patrol routes, react to what they see, plant and defuse.
- **Movement:** WASD, mouse look, crouch (Ctrl/C), jump (Space), reload (R),
  hold E to plant / defuse, B for the buy menu, 1–5 to switch weapons.

## How to run

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests — static files only, three.js 0.187.0
vendored under `game/vendor/three/`.

## Handing it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored make.fun library.

## Licence

MIT — see `LICENSE`.
