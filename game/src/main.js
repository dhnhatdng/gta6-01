// SOLARA BAY — boot and the one game loop. Builds the world, owns the game
// state (menu / playing / paused / over), wires every system together and
// stages the deterministic screenshot scenes (?shot=cover|street|mission|chase).
import * as THREE from 'three';
import { makeRng, clamp } from './rng.js';
import { createInput } from './input.js';
import { createCity, STREETS } from './city.js';
import { createPlayer, movePlayerOnFoot, updateCamera, tryPunch, tryShoot } from './player.js';
import { makeCar, spawnParkedCars, driveCar, findNearestCar, setCarLights } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { createPolice, addWanted, setWanted, updatePolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';

window.addEventListener('error', (e) => {
  const el = document.getElementById('err');
  if (el) el.textContent += `${e.message}\n`;
});

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;
const rng = makeRng(seed);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87c5e8);
scene.fog = new THREE.Fog(0x9fd0e8, 130, 560);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
camera.position.set(20, 12, 30);

scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 1.0));
const sun = new THREE.DirectionalLight(0xfff2d0, 2.0);
sun.position.set(-140, 220, -90);
scene.add(sun);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- world state ----------
const saved = loadSave();
const world = {
  scene, rng, time: 0,
  cash: saved ? saved.cash : 200,
  health: 100,
  missionsDone: saved ? saved.missionsDone : [],
  bestWanted: saved ? saved.bestWanted : 0,
  totalEarned: saved ? saved.totalEarned : 0,
  cars: [],
  trafficCars: [],
  peds: [],
  player: null,
  playerCar: null,
  police: null,
  missions: null,
  city: null,
  audio: createAudio(),
  hud: createHud(),
  state: 'menu', // menu | playing | paused | over
  bustTimer: 0,
  muted: false,
  shotMode: !!shot,
};

world.saveProgress = () => writeSave(world);
world.addCash = (n) => { world.cash += n; world.totalEarned += n; world.saveProgress(); };
world.showBanner = (t, s, sticky) => world.hud.showBanner(t, s, sticky);
world.showMessage = (t) => world.hud.showMessage(t);
world.policeSetWanted = (n) => setWanted(world.police, n);
world.policeWanted = () => world.police.wanted;
world.addWanted = (n, reason) => {
  addWanted(world.police, n, reason);
  if (world.police.wanted > world.bestWanted) {
    world.bestWanted = world.police.wanted;
    world.saveProgress();
  }
  if (reason) world.showMessage(`${reason} — wanted level ${world.police.wanted}`);
};
world.damagePlayer = (amount) => {
  if (world.state !== 'playing') return;
  world.health -= amount;
  if (world.health <= 0) {
    world.health = 0;
    gameOver('down');
  }
};
world.onCrash = (speed) => {
  if (speed > 14) {
    world.damagePlayer(speed * 0.12);
    world.audio.crash();
  }
};
world.onPedHit = () => {
  world.addWanted(1, 'Pedestrian hit');
  world.audio.crash();
};

// muzzle flash light for the pistol
const flash = new THREE.PointLight(0xffe9a0, 0, 18, 1.5);
scene.add(flash);
world.muzzleFlash = (cam) => {
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  flash.position.copy(cam.position).addScaledVector(dir, 2.5);
  flash.intensity = 80;
};

// Small debug handle for live playtests (read-only inspection from the console).
window.__solara = world;

// ---------- build the city ----------
world.city = createCity(scene, rng);
world.player = createPlayer(scene, -30, -18);
world.playerCar = null;

// parked cars + traffic + pedestrians
const parked = spawnParkedCars(scene, rng, 16);
world.cars.push(...parked);
world.trafficCars = spawnTraffic(scene, rng, 14);
world.cars.push(...world.trafficCars);
world.peds = spawnPedestrians(scene, rng, 34);
world.police = createPolice(scene, rng);
world.missions = createMissions(scene, world);

const input = createInput(canvas);
const minimap = createMinimap(document.getElementById('minimap'));

// ---------- enter / exit car ----------
function enterExitCar() {
  if (world.playerCar) {
    const car = world.playerCar;
    car.isPlayer = false;
    setCarLights(car, false);
    world.playerCar = null;
    // step out to the side of the car
    const side = car.heading + Math.PI / 2;
    world.player.x = car.x + Math.cos(side) * 2.4;
    world.player.z = car.z + Math.sin(side) * 2.4;
    world.player.mesh.position.set(world.player.x, 0, world.player.z);
    world.player.camYaw = car.heading + Math.PI;
    return;
  }
  const car = findNearestCar(world.cars, world.player.x, world.player.z, 4.6);
  if (!car) return;
  if (car.ai) {
    // steal from traffic: the car stops being AI-driven
    world.trafficCars.splice(world.trafficCars.indexOf(car), 1);
    car.ai = null;
  }
  car.parked = false;
  car.isPlayer = true;
  car.speed = 0;
  setCarLights(car, true);
  world.playerCar = car;
  world.addWanted(1, 'Car stolen');
  world.audio.pickup();
}

// ---------- screens ----------
const startScreen = document.getElementById('startScreen');
const pauseScreen = document.getElementById('pauseScreen');
const overScreen = document.getElementById('overScreen');

function startGame() {
  world.state = 'playing';
  startScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  overScreen.classList.add('hidden');
  world.hud.show();
  world.audio.unlock();
}

function pauseGame() {
  if (world.state !== 'playing') return;
  world.state = 'paused';
  pauseScreen.classList.remove('hidden');
}

function resumeGame() {
  if (world.state !== 'paused') return;
  world.state = 'playing';
  pauseScreen.classList.add('hidden');
}

function gameOver(kind) {
  if (world.state !== 'playing') return;
  world.state = 'over';
  document.getElementById('overText').textContent = kind === 'busted'
    ? 'The Bay PD boxed Alex in and made the arrest.'
    : 'Alex Carter is down. The Bay keeps the car, and the cash.';
  document.getElementById('overStats').textContent =
    `Cash $${world.cash.toLocaleString('en-US')} · Jobs done ${world.missionsDone.length}/3 · Best wanted ${world.bestWanted}★`;
  overScreen.classList.remove('hidden');
  world.audio.setSiren(false);
  world.audio.setEngine(0, false);
}

function resetDay() {
  world.health = 100;
  world.bustTimer = 0;
  world.police.wanted = 0;
  world.police.heat = 0;
  for (const c of [...world.police.cruisers]) {
    scene.remove(c.group);
    world.cars.splice(world.cars.indexOf(c), 1);
  }
  world.police.cruisers.length = 0;
  if (world.playerCar) {
    setCarLights(world.playerCar, false);
    world.playerCar.isPlayer = false;
    world.playerCar = null;
  }
  world.player.x = -30; world.player.z = -18;
  world.player.mesh.position.set(-30, 0, -18);
  world.player.camYaw = Math.PI * 0.75;
  for (const ped of world.peds) { ped.down = false; ped.health = 100; ped.mesh.rotation.x = 0; }
  startGame();
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('resumeBtn').addEventListener('click', resumeGame);
document.getElementById('restartBtn').addEventListener('click', resetDay);
document.getElementById('againBtn').addEventListener('click', resetDay);

// ---------- deterministic screenshot staging ----------
function placePlayerInCar(x, z, heading, speed, color) {
  const car = makeCar(scene, x, z, heading, color || 0xd83a2e, false);
  car.parked = false;
  car.isPlayer = true;
  car.speed = speed;
  setCarLights(car, true);
  world.cars.push(car);
  world.playerCar = car;
  world.player.x = x; world.player.z = z;
  return car;
}

function spawnPoliceBehind(x, z, heading, count) {
  for (let i = 0; i < count; i++) {
    const bx = x - Math.cos(heading) * (16 + i * 9) + (i % 2 === 0 ? 3.5 : -3.5);
    const bz = z - Math.sin(heading) * (16 + i * 9) + (i % 2 === 0 ? 2.5 : -2.5);
    const car = makeCar(scene, bx, bz, heading, 0x1a1d22, true);
    car.parked = false;
    car.speed = 22 + i;
    world.police.cruisers.push(car);
    world.cars.push(car);
  }
}

function stageShot(name) {
  startGame();
  world.player.camYaw = Math.PI * 0.75;
  if (name === 'cover') {
    // Alex driving east down Ocean Avenue, three stars, cruisers on his tail.
    const car = placePlayerInCar(-60, 30, 0, 22, 0xd83a2e);
    world.policeSetWanted(3);
    spawnPoliceBehind(car.x, car.z, 0, 3);
    world.missions.startMission(0);
    world.missions.step = 1;
    world.missions.applyStep();
    world.player.camYaw = Math.PI;
    world.player.camYawOffset = 2.6;
  } else if (name === 'street') {
    // On foot downtown, pedestrians and traffic all around.
    world.player.x = -39.5; world.player.z = -20;
    world.player.mesh.position.set(-39.5, 0, -20);
    world.player.camYaw = Math.PI * 0.9;
    world.player.camPitch = 0.3;
    // gather a few pedestrians onto this sidewalk so the street reads as alive
    const spots = [[-39.5, -32], [-38.5, -26], [-40.5, -14], [-39.5, -8], [-38.5, -2], [-40.5, 4]];
    world.peds.slice(0, spots.length).forEach((ped, i) => {
      ped.x = spots[i][0]; ped.z = spots[i][1];
      ped.heading = i % 2 === 0 ? 0 : Math.PI;
      ped.fleeing = false;
      ped.mesh.position.set(ped.x, 0, ped.z);
    });
    world.missions.startMission(0);
  } else if (name === 'mission') {
    // At the docks marker with the objective banner up: on the beach road,
    // heading north, the marker beam ahead-right over the sand.
    const car = placePlayerInCar(210, 150, -Math.PI / 2, 6, 0x2e6fd8);
    world.policeSetWanted(1);
    spawnPoliceBehind(car.x, car.z, -Math.PI / 2, 1);
    world.missions.startMission(0);
    world.missions.step = 1;
    world.missions.applyStep();
    world.hud.showBanner('FIRST WHEELS', 'Drive to the docks marker — $500', true);
    world.player.camYaw = Math.PI;
  } else if (name === 'chase') {
    // High-speed escape, four stars, cruisers closing in.
    const car = placePlayerInCar(-90, -30, 0, 30, 0xf2c230);
    world.missions.startMission(2);
    world.policeSetWanted(4);
    spawnPoliceBehind(car.x, car.z, 0, 4);
    world.player.camYaw = Math.PI;
    world.player.camYawOffset = 2.6;
  }
}

// ---------- main loop ----------
let last = performance.now();
let frames = 0;

function step(dt) {
  world.time += dt;
  const p = world.player;

  // weapon switching
  if (input.wasPressed('Digit1')) p.weapon = 'fists';
  if (input.wasPressed('Digit2')) p.weapon = 'pistol';
  if (input.wasPressed('KeyM')) {
    world.muted = world.audio.toggleMute();
    world.showMessage(world.muted ? 'Sound muted' : 'Sound on');
  }
  if (input.wasPressed('Escape')) {
    if (world.state === 'playing') pauseGame();
    else if (world.state === 'paused') resumeGame();
  }

  // click: punch or shoot
  const click = input.takeClick();
  if (click && world.state === 'playing') {
    if (world.playerCar) {
      // honk / nothing while driving
    } else if (p.weapon === 'pistol') {
      tryShoot(p, world, camera, click);
    } else {
      tryPunch(p, world);
    }
  }

  // enter / exit car
  if (input.wasPressed('KeyE')) enterExitCar();

  // movement: in chase/cover screenshots the car keeps its foot down
  const driveInput = (shot === 'cover' || shot === 'chase') && world.playerCar
    ? { isDown: (code) => code === 'KeyW' || code === 'ArrowUp' || input.isDown(code) }
    : input;
  if (world.playerCar) {
    driveCar(world.playerCar, driveInput, dt, world);
  } else {
    movePlayerOnFoot(p, input, dt, world);
  }

  // timers
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.shootTimer > 0) p.shootTimer -= dt;

  // systems
  updateTraffic(world.trafficCars, world.playerCar, dt, world);
  updatePedestrians(world.peds, { x: p.x, z: p.z }, world.playerCar, dt, world);
  updatePolice(world.police, world, dt);
  world.missions.update(dt);

  // busted: caught on foot by a cruiser at close range
  if (!world.playerCar && world.police.wanted > 0) {
    let near = false;
    for (const c of world.police.cruisers) {
      if (Math.hypot(c.x - p.x, c.z - p.z) < 3.2) { near = true; break; }
    }
    world.bustTimer = near ? world.bustTimer + dt : 0;
    if (world.bustTimer > 2.5) gameOver('busted');
  } else {
    world.bustTimer = 0;
  }

  // slow health regen when the heat is off
  if (world.police.wanted === 0 && world.health < 100) world.health = Math.min(100, world.health + 2.5 * dt);

  // audio follows the car
  const speedKmh = world.playerCar ? Math.abs(world.playerCar.speed) * 3.6 : 0;
  world.audio.setEngine(speedKmh, !!world.playerCar);
  world.audio.update(dt);

  // camera: in screenshot staging the angle snaps instantly for a stable frame
  updateCamera(p, world.playerCar, camera, input, dt, world.shotMode);

  // muzzle flash decay
  if (flash.intensity > 0) flash.intensity = Math.max(0, flash.intensity - dt * 500);

  // HUD + minimap
  world.hud.update({
    cash: world.cash,
    health: world.health,
    wanted: world.police.wanted,
    objective: world.missions.objectiveText(),
    missionName: world.missions.missionName(),
    driving: !!world.playerCar,
    speedKmh,
    aiming: !world.playerCar && p.weapon === 'pistol',
  });
  minimap.draw(world);
  input.endFrame();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (world.state === 'playing') step(dt);
  else if (world.state === 'menu') {
    // idle attract mode: slow orbit around downtown behind the start screen
    world.time += dt;
    updateCamera(world.player, null, camera, input, dt, true);
  }
  renderer.render(scene, camera);
  frames += 1;
  if (shot && frames >= 10) window.__shotReady = true;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && world.state === 'playing' && !shot) pauseGame();
});

if (shot) stageShot(shot);
requestAnimationFrame(frame);
