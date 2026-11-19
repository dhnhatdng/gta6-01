// Missions and story for Solara Bay: three jobs for Alex Carter, each with an
// objective line, a glowing world marker, cash rewards and a completion banner.
// Progress is saved; finished missions stay finished.
import * as THREE from 'three';

export const MISSION_DEFS = [
  {
    id: 'first-wheels',
    name: 'FIRST WHEELS',
    intro: 'Alex needs wheels. Steal a car and get it to the docks.',
    reward: 500,
    steps: [
      { text: 'Steal a car — press E near any parked car', marker: null, needsCar: true },
      { text: 'Drive to the docks marker on the east beach', marker: { x: 240, z: 120 }, radius: 8 },
    ],
  },
  {
    id: 'the-pickup',
    name: 'THE PICKUP',
    intro: 'A contact named Mara is waiting downtown. Pick her up — the cops will notice.',
    reward: 1200,
    steps: [
      { text: 'Pick up Mara at the downtown marker', marker: { x: -30, z: -30 }, radius: 6, pickup: true },
      { text: 'Drive Mara to the safehouse — stay ahead of the police', marker: { x: -180, z: 180 }, radius: 8, wantedOnStart: 2 },
    ],
  },
  {
    id: 'heat-run',
    name: 'HEAT RUN',
    intro: 'Three stars and the whole Bay PD on your tail. Lose them and reach the hideout.',
    reward: 2500,
    steps: [
      { text: 'Escape the police — reach the hideout marker', marker: { x: 150, z: -180 }, radius: 8, wantedOnStart: 3 },
    ],
  },
];

export function createMissions(scene, world) {
  // glowing marker: ground ring + light beam + spinning diamond
  const markerGroup = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(4.2, 4.2, 0.35, 24),
    new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0xffb52e, emissiveIntensity: 1.4, transparent: true, opacity: 0.85 }),
  );
  ring.position.y = 0.2;
  markerGroup.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 34, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 17;
  markerGroup.add(beam);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0xffb52e, emissiveIntensity: 2 }),
  );
  diamond.position.y = 6;
  markerGroup.add(diamond);
  markerGroup.visible = false;
  scene.add(markerGroup);

  const missions = {
    defs: MISSION_DEFS,
    index: -1,        // index into defs, -1 = none active
    step: 0,
    active: false,
    contact: null,    // the pickup pedestrian for mission 2
    pulse: 0,

    currentDef() { return this.index >= 0 ? this.defs[this.index] : null; },
    currentStep() {
      const def = this.currentDef();
      return def ? def.steps[this.step] : null;
    },
    objectiveText() {
      if (!this.active) {
        const next = this.defs.find((d) => !world.missionsDone.includes(d.id));
        if (!next) return 'All jobs done. Free roam — Solara Bay is yours.';
        return `Next job: ${next.name} — starting now.`;
      }
      const step = this.currentStep();
      return step ? step.text : '';
    },
    missionName() {
      const def = this.currentDef();
      return def ? def.name : 'FREE ROAM';
    },

    startMission(i) {
      this.index = i;
      this.step = 0;
      this.active = true;
      const def = this.defs[i];
      world.showBanner(def.name, def.intro);
      world.showMessage(`${def.name}: ${def.intro}`);
      world.audio.pickup();
      this.applyStep();
    },

    applyStep() {
      const step = this.currentStep();
      if (!step) { this.completeMission(); return; }
      if (step.wantedOnStart) world.policeSetWanted(step.wantedOnStart);
      if (step.marker) {
        markerGroup.position.set(step.marker.x, 0, step.marker.z);
        markerGroup.visible = true;
      } else {
        markerGroup.visible = false;
      }
      if (step.pickup) this.spawnContact(step.marker);
    },

    spawnContact(marker) {
      // Mara waits at the marker: a distinct pedestrian with a red jacket.
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.8, 0.32), new THREE.MeshStandardMaterial({ color: 0xd83a2e, roughness: 0.8 }));
      body.position.y = 1.22;
      group.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 }));
      head.position.y = 1.82;
      group.add(head);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.26), new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.9 }));
      leg.position.y = 0.38;
      group.add(leg);
      group.position.set(marker.x, 0, marker.z);
      scene.add(group);
      this.contact = group;
    },

    completeMission() {
      const def = this.currentDef();
      if (!def) return;
      world.addCash(def.reward);
      world.missionsDone.push(def.id);
      world.saveProgress();
      world.showBanner('JOB COMPLETE', `+ $${def.reward} — ${def.name}`);
      world.audio.missionComplete();
      this.active = false;
      this.index = -1;
      this.step = 0;
      markerGroup.visible = false;
      if (this.contact) { scene.remove(this.contact); this.contact = null; }
    },

    update(dt) {
      this.pulse += dt;
      if (markerGroup.visible) {
        const s = 1 + Math.sin(this.pulse * 4) * 0.08;
        ring.scale.set(s, 1, s);
        diamond.rotation.y += dt * 2;
        diamond.position.y = 6 + Math.sin(this.pulse * 2) * 0.5;
      }
      if (this.contact) this.contact.rotation.y += dt * 1.5;
      // In screenshot staging the scene is frozen: animate the marker, never progress.
      if (world.shotMode) return;
      // auto-start the next job when the player is free
      if (!this.active) {
        const nextIdx = this.defs.findIndex((d) => !world.missionsDone.includes(d.id));
        if (nextIdx >= 0) this.startMission(nextIdx);
        return;
      }
      const step = this.currentStep();
      if (!step) return;
      const px = world.playerCar ? world.playerCar.x : world.player.x;
      const pz = world.playerCar ? world.playerCar.z : world.player.z;
      if (step.needsCar) {
        if (world.playerCar) {
          this.step += 1;
          world.showMessage('Got wheels. Now drive to the docks.');
          this.applyStep();
        }
        return;
      }
      if (step.marker) {
        const d = Math.hypot(px - step.marker.x, pz - step.marker.z);
        if (step.pickup && this.contact) {
          if (d < step.radius) {
            scene.remove(this.contact);
            this.contact = null;
            world.showMessage('Mara is in the car. Go — the cops are coming.');
            world.audio.pickup();
            this.step += 1;
            this.applyStep();
          }
          return;
        }
        if (d < step.radius) {
          // heat-run also completes by losing the cops entirely
          this.step += 1;
          this.applyStep();
        }
      }
      // heat run: losing all wanted stars also counts as an escape
      const def = this.currentDef();
      if (def && def.id === 'heat-run' && world.policeWanted() === 0 && this.step === 0) {
        this.completeMission();
      }
    },
  };
  return missions;
}
