# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dhnhatdng/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dhnhatdng/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Build the most complete open-world crime game you can, in the spirit of GTA 6, playable in a desktop browser from static files with no network request, with keyboard and mouse.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. No build step, no network request — every asset is a local file.

## The game — SOLARA BAY

Sun, surf and stolen cars. **Alex Carter**, a driver-for-hire with empty pockets and a fast reputation, lands in Solara Bay — a sun-soaked modern coastal city where every street is an opportunity and every siren is a warning. Take jobs, steal what you need, outrun the Solara Bay Police, and build your name from nothing. All names, characters, art, story and sounds are original.

### Features

- **Open 3D city** (three.js): a 7×7 street grid with procedural buildings, sidewalks, palm trees, streetlights, a beach and the sea, sun, clouds and fog.
- **On foot and by car**: third-person orbit camera, run, and arcade driving with acceleration, braking, steering, handbrake, working headlights and taillights.
- **Traffic and pedestrians**: AI cars cruise the grid, stop and turn; pedestrians stroll the sidewalks and flee when scared or hurt.
- **Steal any car**: press E near a parked or driven car — the driver bails out and runs. Stealing raises your wanted level.
- **Wanted level 0–5 stars**: crimes raise the heat; police cruisers spawn, chase and ram you, with flashing light bars and two-tone sirens. Lay low and the heat decays.
- **Combat**: punch on foot, or draw a pistol (key 2) with raycast hits and a muzzle flash.
- **Missions and story**: three jobs with objective text, glowing world markers and cash rewards — *First Wheels*, *The Pickup*, *Heat Run* — plus free roam after the last job.
- **HUD**: cash, health bar, wanted stars, speed, a live 2D minimap (roads, player arrow, police dots, mission marker), objective line and controls hint.
- **Menus and save**: start screen with the story and controls, pause (Esc), game over / busted / restart, and progress saved to localStorage (cash, jobs done, best wanted level).
- **Procedural sound**: WebAudio only — engine hum that follows speed, police siren, pickup blips, crash thuds, gunshots. M mutes. No audio files.

### Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse drag | Look around (orbit camera) |
| Shift | Run |
| E | Enter / steal nearest car |
| Space | Handbrake |
| Click | Punch / shoot |
| 1 / 2 | Fists / pistol |
| M | Mute |
| Esc | Pause |

### Missions

1. **First Wheels** — steal a car and get it to the docks marker. Reward $500.
2. **The Pickup** — collect the contact Mara downtown and drive her to the safehouse while the police close in. Reward $1,200.
3. **Heat Run** — escape a 4-star police chase to the hideout. Reward $2,500.

### Tech

- Static files under `game/`, ES modules, no build step. three.js r170 vendored as a single `game/vendor/three.module.min.js`.
- Source split by job: `city.js`, `vehicles.js`, `traffic.js`, `pedestrians.js`, `police.js`, `missions.js`, `player.js`, `hud.js`, `minimap.js`, `audio.js`, `save.js`, `input.js`, `rng.js`, `main.js`.
- Deterministic screenshot staging: `?shot=cover|street|mission|chase&seed=1` stages each scene (see `shots.json`).
- `main.ts` copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the vendored make.fun library.

---

<sub>Entered on [make.fun](https://make.fun/?ref=fs4ajvvm&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
