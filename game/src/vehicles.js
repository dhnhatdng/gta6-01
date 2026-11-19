// Cars for Solara Bay: procedural car meshes (body, cabin, wheels, working
// headlights and taillights), arcade driving physics, parking, and enter/exit.
import * as THREE from 'three';
import { clamp, angleLerp } from './rng.js';
import { collideCircle, STREETS, CITY_HALF } from './city.js';

const CAR_COLORS = [0xd83a2e, 0x2e6fd8, 0xf2c230, 0x27a35c, 0xe8e8e8, 0x22262c, 0xff7f2a, 0x8e44ad, 0x19b5b0, 0xc0c8d0];

export function createCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.15, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.85, 2.0), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.7, 1.8), glass);
  cabin.position.set(-0.25, 1.35, 0);
  group.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.7), paint);
  roof.position.set(-0.25, 1.74, 0);
  group.add(roof);
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[1.45, 0.95], [1.45, -0.95], [-1.45, 0.95], [-1.45, -0.95]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    group.add(w);
    wheels.push(w);
  }
  // headlights (front = +X)
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff8d0, emissive: 0xffe9a0, emissiveIntensity: 1.6 });
  for (const wz of [0.62, -0.62]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.42), headMat);
    h.position.set(2.22, 0.72, wz);
    group.add(h);
  }
  // taillights
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xff2222, emissiveIntensity: 1.2 });
  for (const wz of [0.62, -0.62]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.42), tailMat);
    t.position.set(-2.22, 0.72, wz);
    group.add(t);
  }
  if (isPolice) {
    const barMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 1.1), barMat);
    bar.position.set(-0.25, 1.86, 0);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.5), new THREE.MeshStandardMaterial({ color: 0xcc0000, emissive: 0xff0000, emissiveIntensity: 2 }));
    red.position.set(-0.25, 1.98, 0.28);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.5), new THREE.MeshStandardMaterial({ color: 0x0000cc, emissive: 0x2222ff, emissiveIntensity: 2 }));
    blue.position.set(-0.25, 1.98, -0.28);
    group.add(blue);
    group.userData.lightBar = { red, blue };
  }
  // headlight beam, switched on for the player's car
  const beam = new THREE.SpotLight(0xfff2c0, 0, 26, 0.45, 0.55, 1.2);
  beam.position.set(2.2, 0.9, 0);
  const beamTarget = new THREE.Object3D();
  beamTarget.position.set(14, 0, 0);
  group.add(beamTarget);
  beam.target = beamTarget;
  group.add(beam);
  group.userData.beam = beam;
  return { group, wheels, beam };
}

export function makeCar(scene, x, z, heading, color, isPolice) {
  const { group, wheels, beam } = createCarMesh(color, isPolice);
  group.position.set(x, 0, z);
  group.rotation.y = -heading;
  scene.add(group);
  const car = {
    group, wheels, beam,
    x, z, heading,
    speed: 0,
    steer: 0,
    isPolice: !!isPolice,
    isPlayer: false,
    driver: null,       // pedestrian driving it, or null when parked
    parked: true,
    ai: null,           // traffic AI state
    flashPhase: Math.random() * 10,
  };
  group.userData.hitRef = { kind: 'car', car };
  return car;
}

// Parked cars along the kerbs, plus a few in the open.
export function spawnParkedCars(scene, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const along = rng.chance(0.5);
    const street = STREETS[Math.floor(rng.next() * STREETS.length)];
    const v = rng.range(-190, 190);
    const side = rng.chance(0.5) ? 1 : -1;
    const x = along ? street + side * 5.2 : v;
    const z = along ? v : street + side * 5.2;
    const heading = along ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    const color = CAR_COLORS[Math.floor(rng.next() * CAR_COLORS.length)];
    cars.push(makeCar(scene, x, z, heading, color, false));
  }
  return cars;
}

export function findNearestCar(cars, x, z, maxDist) {
  let best = null, bestD = maxDist;
  for (const car of cars) {
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

// Arcade driving: accelerate, brake/reverse, steer by speed, handbrake drift.
export function driveCar(car, input, dt, world) {
  const maxSpeed = car.isPolice ? 40 : 38;
  const accel = 16;
  const brake = 30;
  let throttle = 0;
  if (input.isDown('KeyW') || input.isDown('ArrowUp')) throttle = 1;
  if (input.isDown('KeyS') || input.isDown('ArrowDown')) throttle = car.speed > 0.5 ? -1 : -0.55;
  if (throttle > 0) car.speed += accel * dt;
  else if (throttle < 0) car.speed += brake * throttle * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  if (input.isDown('Space')) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  car.speed = clamp(car.speed, -9, maxSpeed);

  const steerInput = (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0) - (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0);
  const steerTarget = steerInput * 0.55 * clamp(Math.abs(car.speed) / 8, 0, 1);
  car.steer = angleLerp(car.steer, steerTarget, Math.min(1, dt * 8));
  const handbrake = input.isDown('Space') ? 0.55 : 1;
  const turnRate = car.steer * clamp(Math.abs(car.speed) * 0.12, 0, 2.2);
  car.heading += turnRate * dt * (car.speed >= 0 ? 1 : -1) * handbrake;

  const nx = car.x + Math.cos(car.heading) * car.speed * dt;
  const nz = car.z + Math.sin(car.heading) * car.speed * dt;
  const hit = collideCircle(world.city.colliders, nx, nz, 2.3);
  const blocked = Math.hypot(hit.x - nx, hit.z - nz) > 0.01;
  car.x = hit.x; car.z = hit.z;
  if (blocked && Math.abs(car.speed) > 6) {
    world.onCrash(Math.abs(car.speed));
    car.speed *= 0.35;
  } else if (blocked) {
    car.speed *= 0.5;
  }
  // keep inside the playable area (sea blocks the east)
  if (car.x > 262) { car.x = 262; car.speed *= 0.4; }
  if (car.x < -296) { car.x = -296; car.speed *= 0.4; }
  if (car.z > 296) { car.z = 296; car.speed *= 0.4; }
  if (car.z < -296) { car.z = -296; car.speed *= 0.4; }

  // push away from other cars
  for (const other of world.cars) {
    if (other === car) continue;
    const dx = car.x - other.x, dz = car.z - other.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.01 && d < 4.4) {
      const push = (4.4 - d) / 2;
      car.x += (dx / d) * push;
      car.z += (dz / d) * push;
      if (Math.abs(car.speed) > 8 && !other.isPlayer) world.onCrash(Math.abs(car.speed) * 0.5);
      car.speed *= 0.92;
    }
  }

  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = -car.heading;
  for (const w of car.wheels) w.rotation.y = car.steer * 0.9;
  for (const w of car.wheels) w.rotation.z += car.speed * dt * 2.2;
}

export function setCarLights(car, on) {
  car.beam.intensity = on ? 60 : 0;
}
