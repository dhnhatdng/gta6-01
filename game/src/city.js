// Solara Bay city builder: a sun-soaked coastal grid city made from procedural
// geometry and canvas textures — streets, buildings with lit windows, palms,
// streetlights, a beach and the sea. All deterministic from the seeded RNG.
import * as THREE from 'three';
import { clamp } from './rng.js';

export const PITCH = 60;          // block + road
export const BLOCK = 46;          // block size
export const ROAD = 14;           // road width
export const GRID = 7;            // 7 x 7 blocks
export const CITY_HALF = 210;     // outer road centre
export const BEACH_X = 228;       // sand starts here
export const WATER_X = 268;       // sea starts here
export const WORLD_HALF = 300;    // ground plane half-size

// Road centre lines, used by traffic, police and the minimap.
export const STREETS = [-210, -150, -90, -30, 30, 90, 150, 210];

function windowTexture(baseColor, litRatio, rng) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 128, 256);
  // subtle vertical shading
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  for (let y = 14; y < 244; y += 22) {
    for (let x = 10; x < 118; x += 20) {
      const lit = rng.next() < litRatio;
      g.fillStyle = lit ? '#ffe9a8' : '#1d2f45';
      g.fillRect(x, y, 13, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function groundTexture(rng) {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  const worldToPx = (v) => ((v + WORLD_HALF) / (WORLD_HALF * 2)) * S;
  // base: pale sidewalk concrete
  g.fillStyle = '#b9b3a4';
  g.fillRect(0, 0, S, S);
  // blocks: varied warm tones
  const tones = ['#c9b391', '#c2a98e', '#bfae9c', '#d0bfa5', '#b7a58f'];
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const cx = (i - 3) * PITCH, cz = (j - 3) * PITCH;
      g.fillStyle = tones[Math.floor(rng.next() * tones.length)];
      g.fillRect(worldToPx(cx - BLOCK / 2), worldToPx(cz - BLOCK / 2), worldToPx(BLOCK) - worldToPx(0), worldToPx(BLOCK) - worldToPx(0));
      // inner courtyard
      g.fillStyle = 'rgba(90,140,90,0.35)';
      const inset = 12;
      g.fillRect(worldToPx(cx - BLOCK / 2 + inset), worldToPx(cz - BLOCK / 2 + inset), worldToPx(BLOCK - inset * 2) - worldToPx(0), worldToPx(BLOCK - inset * 2) - worldToPx(0));
    }
  }
  // roads: dark asphalt
  g.fillStyle = '#454a52';
  for (const s of STREETS) {
    g.fillRect(worldToPx(s - ROAD / 2), 0, worldToPx(ROAD) - worldToPx(0), S);
    g.fillRect(0, worldToPx(s - ROAD / 2), S, worldToPx(ROAD) - worldToPx(0));
  }
  // centre dashes
  g.fillStyle = '#e8d44d';
  for (const s of STREETS) {
    for (let v = -WORLD_HALF; v < WORLD_HALF; v += 12) {
      g.fillRect(worldToPx(s) - 1, worldToPx(v), 2, 5);
      g.fillRect(worldToPx(v), worldToPx(s) - 1, 5, 2);
    }
  }
  // crosswalks at intersections
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (const sx of STREETS) {
    for (const sz of STREETS) {
      for (let k = -2; k <= 2; k++) {
        g.fillRect(worldToPx(sx + k * 2.4) - 1, worldToPx(sz - ROAD / 2), 2, 5);
        g.fillRect(worldToPx(sx + k * 2.4) - 1, worldToPx(sz + ROAD / 2) - 5, 2, 5);
        g.fillRect(worldToPx(sx - ROAD / 2), worldToPx(sz + k * 2.4) - 1, 5, 2);
        g.fillRect(worldToPx(sx + ROAD / 2) - 5, worldToPx(sz + k * 2.4) - 1, 5, 2);
      }
    }
  }
  // beach sand east of the city
  const sand = g.createLinearGradient(worldToPx(BEACH_X), 0, worldToPx(WATER_X), 0);
  sand.addColorStop(0, '#e8d5a4');
  sand.addColorStop(1, '#f2e2b8');
  g.fillStyle = sand;
  g.fillRect(worldToPx(BEACH_X), 0, worldToPx(WATER_X) - worldToPx(BEACH_X), S);
  // boardwalk strip
  g.fillStyle = '#a9805a';
  g.fillRect(worldToPx(BEACH_X - 4), 0, worldToPx(4) - worldToPx(0), S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // ---- ground ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2),
    new THREE.MeshStandardMaterial({ map: groundTexture(rng), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // ---- sea ----
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(180, WORLD_HALF * 2),
    new THREE.MeshStandardMaterial({ color: 0x1e7fb8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.94 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(WATER_X + 90, 0.15, 0);
  group.add(water);
  // foam line at the shoreline
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(3, WORLD_HALF * 2),
    new THREE.MeshStandardMaterial({ color: 0xeaf7ff, roughness: 0.6 }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(WATER_X + 1, 0.2, 0);
  group.add(foam);

  // ---- buildings ----
  const palette = ['#e8dcc8', '#d9c1a3', '#c7d6de', '#e5b8a0', '#b9c4a8', '#d8d3c8', '#e0c9d4'];
  const facadeTex = palette.map((col) => windowTexture(col, 0.28, rng));
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.9 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const cx = (i - 3) * PITCH, cz = (j - 3) * PITCH;
      const distCenter = Math.hypot(cx, cz) / 260;
      const count = rng.chance(0.55) ? 1 : rng.chance(0.7) ? 2 : 4;
      for (let b = 0; b < count; b++) {
        const w = count === 1 ? 34 : count === 2 ? 16 : 15;
        const d = count === 1 ? 34 : count === 2 ? 30 : 15;
        const ox = count === 1 ? 0 : (b % 2 === 0 ? -9 : 9);
        const oz = count === 1 ? 0 : (b < 2 ? -9 : 9);
        const h = clamp((1 - distCenter) * rng.range(14, 46) + rng.range(4, 12), 7, 52);
        const mat = new THREE.MeshStandardMaterial({ map: facadeTex[Math.floor(rng.next() * facadeTex.length)], roughness: 0.85 });
        const mesh = new THREE.Mesh(boxGeo, mat);
        mesh.scale.set(w, h, d);
        mesh.position.set(cx + ox, h / 2, cz + oz);
        group.add(mesh);
        colliders.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2 });
        if (rng.chance(0.4)) {
          const roof = new THREE.Mesh(boxGeo, roofMat);
          roof.scale.set(w * 0.3, 2.2, d * 0.3);
          roof.position.set(cx + ox + rng.range(-4, 4), h + 1.1, cz + oz + rng.range(-4, 4));
          group.add(roof);
        }
      }
    }
  }

  // ---- palm trees: beach row + scattered sidewalk palms ----
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6b46, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f9e4f, roughness: 0.8 });
  function palm(x, z, s) {
    const p = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.42 * s, 7 * s, 6), trunkMat);
    trunk.position.y = 3.5 * s;
    trunk.rotation.z = rng.range(-0.08, 0.08);
    p.add(trunk);
    for (let k = 0; k < 6; k++) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.12 * s, 3.4 * s), leafMat);
      const a = (k / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.4 * s, 7 * s, Math.sin(a) * 1.4 * s);
      leaf.rotation.y = -a;
      leaf.rotation.x = 0.5;
      p.add(leaf);
    }
    p.position.set(x, 0, z);
    group.add(p);
  }
  for (let z = -260; z <= 260; z += 22) {
    palm(BEACH_X + 8 + rng.range(-2, 2), z + rng.range(-4, 4), rng.range(0.9, 1.3));
  }
  for (let i = 0; i < 40; i++) {
    const sx = STREETS[Math.floor(rng.next() * STREETS.length)];
    const sz = rng.range(-200, 200);
    palm(sx + (rng.chance(0.5) ? 9 : -9), sz, rng.range(0.8, 1.1));
  }

  // ---- streetlights along every road ----
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c343c, roughness: 0.6, metalness: 0.5 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffdf6e, emissiveIntensity: 0.9 });
  for (const s of STREETS) {
    for (let v = -195; v <= 195; v += 60) {
      for (const [x, z] of [[s + 8, v], [s - 8, v + 30]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.4, 6), poleMat);
        pole.position.set(x, 3.2, z);
        group.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), lampMat);
        lamp.position.set(x, 6.5, z);
        group.add(lamp);
      }
    }
  }

  // ---- sun, clouds, sky ----
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(14, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }),
  );
  sun.position.set(-260, 190, -320);
  scene.add(sun);
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(6, 11), 8, 6), cloudMat);
      puff.position.set(k * 8 - 8, rng.range(-1, 1), rng.range(-2, 2));
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-280, 280), rng.range(70, 110), rng.range(-280, 280));
    scene.add(cloud);
  }

  return { colliders, group, water };
}

// Circle-vs-building collision. Returns the pushed-out position.
export function collideCircle(colliders, x, z, radius) {
  for (const b of colliders) {
    const cx = clamp(x, b.minX, b.maxX);
    const cz = clamp(z, b.minZ, b.maxZ);
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        z = cz + (dz / d) * radius;
      } else {
        // centre inside the box: push out along the smallest penetration axis
        const pl = x - b.minX, pr = b.maxX - x, pt = z - b.minZ, pb = b.maxZ - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.minX - radius;
        else if (m === pr) x = b.maxX + radius;
        else if (m === pt) z = b.minZ - radius;
        else z = b.maxZ + radius;
      }
    }
  }
  return { x, z };
}

export function insideCity(x, z) {
  return x > -WORLD_HALF + 4 && x < WATER_X - 2 && z > -WORLD_HALF + 4 && z < WORLD_HALF - 4;
}
