// The Solara Bay Police Department: wanted stars 0-5, police cruisers that
// spawn at the city edge, chase and ram the player, and lose interest when the
// player stays out of sight. Ramming a cruiser or hitting a cop raises heat.
import * as THREE from 'three';
import { makeCar } from './vehicles.js';
import { clamp, angleLerp } from './rng.js';
import { STREETS } from './city.js';

export function createPolice(scene, rng) {
  return {
    scene, rng,
    cruisers: [],
    wanted: 0,
    heat: 0,            // 0..100 within the current star level
    hiddenTimer: 0,     // time since any cruiser saw the player
    flashTimer: 0,
  };
}

function wantedTargetCount(wanted) {
  return [0, 1, 2, 3, 4, 6][wanted] || 0;
}

export function addWanted(police, stars, reason) {
  if (stars <= 0) return;
  police.wanted = clamp(police.wanted + stars, 0, 5);
  police.heat = Math.min(100, police.heat + stars * 25);
  police.hiddenTimer = 0;
}

export function setWanted(police, stars) {
  police.wanted = clamp(stars, 0, 5);
  police.heat = stars > 0 ? 60 : 0;
  police.hiddenTimer = 0;
}

function spawnCruiser(police, world, nearX, nearZ) {
  const rng = police.rng;
  // spawn on a street near the player, at the edge of view
  const street = STREETS[Math.floor(rng.next() * STREETS.length)];
  const angle = rng.range(0, Math.PI * 2);
  const x = clamp(nearX + Math.cos(angle) * 70, -200, 200);
  const z = clamp(nearZ + Math.sin(angle) * 70, -200, 200);
  const heading = Math.atan2(nearZ - z, nearX - x);
  const car = makeCar(police.scene, x, z, heading, 0x1a1d22, true);
  car.parked = false;
  car.isPlayer = false;
  car.speed = 12;
  police.cruisers.push(car);
  world.cars.push(car);
  return car;
}

export function updatePolice(police, world, dt) {
  const player = world.player;
  const playerCar = world.playerCar;
  const px = playerCar ? playerCar.x : player.x;
  const pz = playerCar ? playerCar.z : player.z;
  const playerSpeed = playerCar ? Math.abs(playerCar.speed) : (player.moving ? 5 : 0);

  // ---- spawn / despawn to match the wanted level ----
  const target = wantedTargetCount(police.wanted);
  if (police.cruisers.length < target && police.wanted > 0) {
    if (world.rng.next() < dt * 1.2) spawnCruiser(police, world, px, pz);
  }
  // ---- decay: out of sight for a while cools the heat ----
  let anyNear = false;
  for (const c of police.cruisers) {
    if (Math.hypot(c.x - px, c.z - pz) < 55) { anyNear = true; break; }
  }
  if (police.wanted > 0 && !anyNear && playerSpeed < 4) {
    police.hiddenTimer += dt;
    if (police.hiddenTimer > 6) {
      police.heat -= dt * 9;
      if (police.heat <= 0) {
        police.wanted = Math.max(0, police.wanted - 1);
        police.heat = police.wanted > 0 ? 70 : 0;
        police.hiddenTimer = 0;
        world.showMessage(police.wanted === 0 ? 'You lost them. Heat is off.' : `Heat dropping — ${police.wanted} star${police.wanted > 1 ? 's' : ''} left.`);
      }
    }
  } else {
    police.hiddenTimer = 0;
  }

  // ---- chase behaviour ----
  police.flashTimer += dt;
  for (let i = police.cruisers.length - 1; i >= 0; i--) {
    const car = police.cruisers[i];
    const dx = px - car.x, dz = pz - car.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dz, dx);
    // steer toward the player, with a little wobble so they do not stack
    const wobble = Math.sin(police.flashTimer * 1.3 + i * 2.1) * 0.25;
    car.heading = angleLerp(car.heading, wantHeading + wobble, Math.min(1, dt * 1.6));
    const maxSpeed = 30 + police.wanted * 2.2;
    car.speed += clamp(maxSpeed - car.speed, -20 * dt, 12 * dt);
    car.x += Math.cos(car.heading) * car.speed * dt;
    car.z += Math.sin(car.heading) * car.speed * dt;
    // ram: hitting the player's car hurts and slows it (damage scaled by time, not frames)
    if (dist < 4.6) {
      if (playerCar) {
        playerCar.speed *= 0.82;
        playerCar.x += (dx / dist) * -1.2;
        playerCar.z += (dz / dist) * -1.2;
        world.damagePlayer(10 * dt);
        world.audio.crash();
      } else if (dist < 2.4) {
        world.damagePlayer(20 * dt);
      }
      // bounce the cruiser off a little so it does not stick
      car.x -= (dx / dist) * 1.5;
      car.z -= (dz / dist) * 1.5;
      car.speed *= 0.7;
    }
    // light bar flash
    const bar = car.group.userData.lightBar;
    if (bar) {
      const on = Math.floor(police.flashTimer * 4 + i) % 2 === 0;
      bar.red.material.emissiveIntensity = on ? 3 : 0.2;
      bar.blue.material.emissiveIntensity = on ? 0.2 : 3;
    }
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = -car.heading;
    for (const w of car.wheels) w.rotation.z += car.speed * dt * 2.2;
    // despawn far cruisers once the heat is off
    if (police.wanted === 0 && dist > 120) {
      police.scene.remove(car.group);
      world.cars.splice(world.cars.indexOf(car), 1);
      police.cruisers.splice(i, 1);
    }
  }
  // siren follows the wanted level
  world.audio.setSiren(police.wanted > 0 && police.cruisers.length > 0);
}
