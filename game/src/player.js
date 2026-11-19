// Alex Carter on foot: third-person movement, mouse-drag orbit camera,
// running, punching and pistol combat. The camera also follows the car.
import * as THREE from 'three';
import { clamp, angleLerp } from './rng.js';
import { collideCircle, insideCity } from './city.js';

export function createPlayerMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x2e6fd8, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.34), shirt);
  body.position.y = 1.28;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
  head.position.y = 1.92;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0xffd23e, roughness: 0.7 }));
  cap.position.y = 2.1;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.26), pants);
  legL.position.set(0, 0.4, 0.16);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.26), pants);
  legR.position.set(0, 0.4, -0.16);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), shirt);
  armL.position.set(0, 1.3, 0.42);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), shirt);
  armR.position.set(0, 1.3, -0.42);
  group.add(armR);
  group.userData = { legL, legR, armL, armR, body, head };
  return group;
}

export function createPlayer(scene, x, z) {
  const mesh = createPlayerMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh, x, z,
    heading: 0,
    walkPhase: 0,
    moving: false,
    weapon: 'fists',   // 'fists' | 'pistol'
    punchTimer: 0,
    shootTimer: 0,
    camYaw: Math.PI * 0.75,
    camYawOffset: 0,
    camPitch: 0.32,
    camDist: 9,
  };
}

// Move on foot relative to the camera yaw. Returns whether the player moved.
export function movePlayerOnFoot(player, input, dt, world) {
  const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const speed = run ? 9.5 : 5.2;
  let fx = 0, fz = 0;
  if (input.isDown('KeyW') || input.isDown('ArrowUp')) { fx += 1; }
  if (input.isDown('KeyS') || input.isDown('ArrowDown')) { fx -= 1; }
  if (input.isDown('KeyA') || input.isDown('ArrowLeft')) { fz -= 1; }
  if (input.isDown('KeyD') || input.isDown('ArrowRight')) { fz += 1; }
  const len = Math.hypot(fx, fz);
  player.moving = len > 0;
  if (len > 0) {
    fx /= len; fz /= len;
    const yaw = player.camYaw;
    // camera looks toward -forward; forward on the ground:
    const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    const mx = fwdX * fx + rightX * fz;
    const mz = fwdZ * fx + rightZ * fz;
    const nx = player.x + mx * speed * dt;
    const nz = player.z + mz * speed * dt;
    const hit = collideCircle(world.city.colliders, nx, nz, 0.55);
    player.x = hit.x; player.z = hit.z;
    if (insideCity(player.x, player.z)) {
      player.x = clamp(player.x, -296, 262);
      player.z = clamp(player.z, -296, 296);
    }
    player.heading = angleLerp(player.heading, Math.atan2(mx, mz), Math.min(1, dt * 12));
    player.walkPhase += dt * (run ? 13 : 9);
  }
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  // walk-cycle swing
  const swing = player.moving ? Math.sin(player.walkPhase) * 0.55 : 0;
  const u = player.mesh.userData;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8;
  u.armR.rotation.x = swing * 0.8;
  return player.moving;
}

// Third-person orbit camera. In shot mode the yaw/pitch are frozen.
export function updateCamera(player, car, camera, input, dt, frozen) {
  if (!frozen) {
    const drag = input.takeDrag();
    player.camYaw -= drag.dx * 0.005;
    player.camPitch = clamp(player.camPitch + drag.dy * 0.004, 0.08, 1.1);
  }
  let focusX, focusZ, focusY, yaw, dist;
  if (car) {
    // chase cam: directly behind the car is yaw = -heading - PI/2, since the
    // camera sits at focus + (sin yaw, cos yaw) * dist; camYawOffset swings
    // it around the car (PI = dead ahead, for a pursuit coming at the lens).
    const targetYaw = -car.heading - Math.PI / 2 + (player.camYawOffset || 0);
    player.camYaw = angleLerp(player.camYaw, targetYaw, frozen ? 1 : Math.min(1, dt * 2.2));
    yaw = player.camYaw;
    focusX = car.x; focusZ = car.z; focusY = 1.6;
    dist = 12;
  } else {
    yaw = player.camYaw;
    focusX = player.x; focusZ = player.z; focusY = 1.7;
    dist = player.camDist;
  }
  const pitch = player.camPitch;
  const cx = focusX + Math.sin(yaw) * Math.cos(pitch) * dist;
  const cz = focusZ + Math.cos(yaw) * Math.cos(pitch) * dist;
  const cy = focusY + Math.sin(pitch) * dist;
  camera.position.set(cx, cy, cz);
  camera.lookAt(focusX, focusY, focusZ);
}

// Punch: hits the nearest pedestrian / police within 2.2 m in front.
export function tryPunch(player, world) {
  if (player.punchTimer > 0) return false;
  player.punchTimer = 0.45;
  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  let hitAny = false;
  for (const ped of world.peds) {
    if (ped.down) continue;
    const dx = ped.x - player.x, dz = ped.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.4 && (dx * fx + dz * fz) / (d || 1) > 0.2) {
      ped.flee(player.x, player.z, true);
      ped.health -= 40;
      if (ped.health <= 0) ped.down = true;
      world.addWanted(1, 'Assault on a pedestrian');
      world.audio.punch();
      hitAny = true;
    }
  }
  if (!hitAny) world.audio.punch();
  return hitAny;
}

// Pistol: raycast from the camera through the click point; hits peds, cars, police.
export function tryShoot(player, world, camera, click) {
  if (player.shootTimer > 0 || player.weapon !== 'pistol') return;
  player.shootTimer = 0.35;
  world.audio.gunshot();
  world.muzzleFlash(camera);
  const ndc = new THREE.Vector2((click.x / window.innerWidth) * 2 - 1, -(click.y / window.innerHeight) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  const targets = [];
  for (const ped of world.peds) if (!ped.down) targets.push(ped.mesh);
  for (const car of world.cars) targets.push(car.group);
  const hits = ray.intersectObjects(targets, true);
  if (hits.length > 0) {
    let obj = hits[0].object;
    while (obj && !obj.userData.hitRef) obj = obj.parent;
    if (obj && obj.userData.hitRef) {
      const ref = obj.userData.hitRef;
      if (ref.kind === 'ped') {
        ref.ped.flee(player.x, player.z, true);
        ref.ped.health -= 55;
        if (ref.ped.health <= 0) ref.ped.down = true;
        world.addWanted(1, 'Shooting in public');
      } else if (ref.kind === 'car') {
        ref.car.speed *= 0.6;
        world.addWanted(1, 'Shooting at a vehicle');
      }
    }
  }
}
