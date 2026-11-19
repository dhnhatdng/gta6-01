// City traffic: AI cars that cruise the street grid, stop at intersections,
// turn, and keep a simple following distance. They are real drivable cars,
// so the player can steal one from the flow.
import { STREETS } from './city.js';
import { makeCar } from './vehicles.js';
import { clamp } from './rng.js';

const CAR_COLORS = [0xd83a2e, 0x2e6fd8, 0xf2c230, 0x27a35c, 0xe8e8e8, 0x22262c, 0xff7f2a, 0x8e44ad, 0x19b5b0, 0xc0c8d0];

export function spawnTraffic(scene, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const horizontal = rng.chance(0.5);
    const street = STREETS[Math.floor(rng.next() * STREETS.length)];
    const lane = rng.chance(0.5) ? 3.2 : -3.2;
    const v = rng.range(-200, 200);
    const dir = rng.chance(0.5) ? 1 : -1;
    const x = horizontal ? v : street + lane;
    const z = horizontal ? street + lane : v;
    const heading = horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const color = CAR_COLORS[Math.floor(rng.next() * CAR_COLORS.length)];
    const car = makeCar(scene, x, z, heading, color, false);
    car.parked = false;
    car.speed = rng.range(6, 11);
    car.ai = {
      horizontal, street, lane, dir,
      targetSpeed: rng.range(7, 12),
      wait: 0,
      nextTurnAt: rng.range(60, 200),
    };
    cars.push(car);
  }
  return cars;
}

function nearestAhead(car, cars, range) {
  let best = null, bestD = range;
  const fx = Math.cos(car.heading), fz = Math.sin(car.heading);
  for (const other of cars) {
    if (other === car) continue;
    const dx = other.x - car.x, dz = other.z - car.z;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * -fz + dz * fx);
    if (along > 0 && along < bestD && side < 3) { bestD = along; best = other; }
  }
  return best;
}

export function updateTraffic(cars, playerCar, dt, world) {
  for (const car of cars) {
    const ai = car.ai;
    if (!ai) continue;
    // stop if something is right ahead (car or the player's car)
    const ahead = nearestAhead(car, world.cars, 12);
    let target = ai.targetSpeed;
    if (ahead) target = 0;
    if (ai.wait > 0) {
      ai.wait -= dt;
      target = 0;
    }
    car.speed += clamp(target - car.speed, -14 * dt, 8 * dt);
    // turn at a random intersection
    const travelled = Math.abs(car.speed) * dt;
    ai.nextTurnAt -= travelled;
    const nearStreet = STREETS.some((s) => {
      const d = ai.horizontal ? Math.abs(car.z - s) : Math.abs(car.x - s);
      return d < 6;
    });
    if (ai.nextTurnAt <= 0 && nearStreet && Math.abs(car.speed) > 1) {
      ai.nextTurnAt = world.rng.range(80, 220);
      const turnLeft = world.rng.chance(0.5);
      const oldHeading = car.heading;
      const newHeading = oldHeading + (turnLeft ? Math.PI / 2 : -Math.PI / 2);
      // snap onto the nearest cross street lane
      const snap = (v) => STREETS.reduce((a, s) => (Math.abs(s - v) < Math.abs(a - v) ? s : a), STREETS[0]);
      if (ai.horizontal) {
        const nz = snap(car.z) + (turnLeft ? 3.2 : -3.2) * (Math.cos(oldHeading) > 0 ? 1 : -1);
        car.z = nz;
        car.heading = newHeading;
        ai.horizontal = false;
        ai.street = snap(car.z);
        ai.dir = Math.sin(newHeading) > 0 ? 1 : -1;
      } else {
        const nx = snap(car.x) + (turnLeft ? -3.2 : 3.2) * (Math.sin(oldHeading) > 0 ? 1 : -1);
        car.x = nx;
        car.heading = newHeading;
        ai.horizontal = true;
        ai.street = snap(car.x);
        ai.dir = Math.cos(newHeading) > 0 ? 1 : -1;
      }
    }
    // move along heading
    car.x += Math.cos(car.heading) * car.speed * dt;
    car.z += Math.sin(car.heading) * car.speed * dt;
    // wrap around the city edge instead of driving into the sea
    if (car.x > 205) { car.x = -205; }
    if (car.x < -205) { car.x = 205; }
    if (car.z > 205) { car.z = -205; }
    if (car.z < -205) { car.z = 205; }
    // keep to the lane (gentle pull back)
    if (ai.horizontal) car.z += (ai.street + ai.lane - car.z) * Math.min(1, dt * 1.5);
    else car.x += (ai.street + ai.lane - car.x) * Math.min(1, dt * 1.5);
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = -car.heading;
    for (const w of car.wheels) w.rotation.z += car.speed * dt * 2.2;
  }
}
