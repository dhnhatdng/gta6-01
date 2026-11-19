// Pedestrians for Solara Bay: people strolling the sidewalks with varied
// clothes, who run away screaming (visually) when scared by a speeding car,
// a punch or a gunshot, and scatter when a car barrels onto the pavement.
import * as THREE from 'three';
import { clamp } from './rng.js';
import { collideCircle, STREETS } from './city.js';

const SHIRTS = [0xe86a5a, 0x5a8fe8, 0x7bc47f, 0xe8c85a, 0xb678d8, 0xeeeeee, 0xff9f43, 0x2ec4b6];
const PANTS = [0x2a2f38, 0x5a4632, 0x3a4a6b, 0x6b3a3a];

export function createPedMesh(rng) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: [0xd9a066, 0x8a5a32, 0xe8b88a][Math.floor(rng.next() * 3)], roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: SHIRTS[Math.floor(rng.next() * SHIRTS.length)], roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: PANTS[Math.floor(rng.next() * PANTS.length)], roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.8, 0.32), shirt);
  body.position.y = 1.22;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.82;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.24), pants);
  legL.position.set(0, 0.38, 0.15);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.24), pants);
  legR.position.set(0, 0.38, -0.15);
  group.add(legR);
  group.userData = { legL, legR };
  return group;
}

export function spawnPedestrians(scene, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const mesh = createPedMesh(rng);
    scene.add(mesh);
    // stand on a sidewalk next to a random street
    const street = STREETS[Math.floor(rng.next() * STREETS.length)];
    const along = rng.range(-200, 200);
    const side = rng.chance(0.5) ? 1 : -1;
    const horizontal = rng.chance(0.5);
    const x = horizontal ? along : street + side * 9.5;
    const z = horizontal ? street + side * 9.5 : along;
    const ped = {
      mesh, x, z,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.1, 2.1),
      walkPhase: rng.range(0, 6),
      fleeing: false,
      fleeTimer: 0,
      health: 100,
      down: false,
      targetHeading: null,
      kind: 'ped',
    };
    mesh.userData.hitRef = { kind: 'ped', ped };
    mesh.position.set(x, 0, z);
    attachFlee(ped);
    peds.push(ped);
  }
  return peds;
}

export function updatePedestrians(peds, playerPos, playerCar, dt, world) {
  for (const ped of peds) {
    if (ped.down) {
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.25;
      continue;
    }
    // scared by a fast car nearby or by the player on foot running at them
    let scareX = null, scareZ = null;
    if (playerCar && Math.abs(playerCar.speed) > 6) {
      const d = Math.hypot(ped.x - playerCar.x, ped.z - playerCar.z);
      if (d < 9) { scareX = playerCar.x; scareZ = playerCar.z; }
    }
    if (!scareX && playerPos) {
      const d = Math.hypot(ped.x - playerPos.x, ped.z - playerPos.z);
      if (d < 1.6) { scareX = playerPos.x; scareZ = playerPos.z; }
    }
    if (scareX !== null) ped.flee(scareX, scareZ, false);
    if (ped.fleeing) {
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) ped.fleeing = false;
    }
    const speed = ped.fleeing ? 5.5 : ped.speed;
    // wander: pick a new heading now and then, stay on sidewalks
    if (!ped.fleeing && world.rng.next() < dt * 0.08) {
      ped.targetHeading = ped.heading + world.rng.range(-1.2, 1.2);
    }
    if (ped.targetHeading !== null) {
      let d = ped.targetHeading - ped.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      ped.heading += clamp(d, -dt * 2.5, dt * 2.5);
      if (Math.abs(d) < 0.05) ped.targetHeading = null;
    }
    const nx = ped.x + Math.sin(ped.heading) * speed * dt;
    const nz = ped.z + Math.cos(ped.heading) * speed * dt;
    const hit = collideCircle(world.city.colliders, nx, nz, 0.5);
    ped.x = clamp(hit.x, -290, 258);
    ped.z = clamp(hit.z, -290, 290);
    ped.walkPhase += dt * (ped.fleeing ? 14 : 8);
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    const swing = Math.sin(ped.walkPhase) * 0.5;
    ped.mesh.userData.legL.rotation.x = swing;
    ped.mesh.userData.legR.rotation.x = -swing;
    // hit by the player's car?
    if (playerCar && Math.abs(playerCar.speed) > 3) {
      const d = Math.hypot(ped.x - playerCar.x, ped.z - playerCar.z);
      if (d < 2.2) {
        ped.health = 0;
        ped.down = true;
        world.onPedHit();
      }
    }
  }
}

// Attach flee behaviour (defined here so pedestrians.js owns it).
export function attachFlee(ped) {
  ped.flee = function (fromX, fromZ, hard) {
    const dx = ped.x - fromX, dz = ped.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    ped.heading = Math.atan2(dx / d, dz / d);
    ped.fleeing = true;
    ped.fleeTimer = hard ? 5 : 3;
  };
}
