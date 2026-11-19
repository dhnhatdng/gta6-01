// Minimap for Solara Bay: a top-down 2D canvas — streets, beach and sea,
// the player arrow, police dots, traffic dots and the mission marker.
import { STREETS, BEACH_X, WATER_X, WORLD_HALF } from './city.js';

export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  const toMap = (v) => ((v + WORLD_HALF) / (WORLD_HALF * 2)) * S;

  function draw(world) {
    ctx.clearRect(0, 0, S, S);
    // land
    ctx.fillStyle = '#20262e';
    ctx.fillRect(0, 0, S, S);
    // sea
    ctx.fillStyle = '#1e7fb8';
    ctx.fillRect(toMap(WATER_X), 0, S - toMap(WATER_X), S);
    // beach
    ctx.fillStyle = '#e8d5a4';
    ctx.fillRect(toMap(BEACH_X), 0, toMap(WATER_X) - toMap(BEACH_X), S);
    // roads
    ctx.strokeStyle = '#5a636e';
    ctx.lineWidth = 5;
    for (const s of STREETS) {
      ctx.beginPath(); ctx.moveTo(toMap(s), 0); ctx.lineTo(toMap(s), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, toMap(s)); ctx.lineTo(S, toMap(s)); ctx.stroke();
    }
    ctx.strokeStyle = '#8a939e';
    ctx.lineWidth = 1;
    for (const s of STREETS) {
      ctx.beginPath(); ctx.moveTo(toMap(s), 0); ctx.lineTo(toMap(s), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, toMap(s)); ctx.lineTo(S, toMap(s)); ctx.stroke();
    }
    // mission marker
    const step = world.missions.currentStep();
    if (step && step.marker) {
      const mx = toMap(step.marker.x), mz = toMap(step.marker.z);
      const pulse = 6 + Math.sin(world.time * 5) * 2;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(mx, mz, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, mz, pulse + 3, 0, Math.PI * 2); ctx.stroke();
    }
    // traffic dots
    ctx.fillStyle = '#9fb8cc';
    for (const car of world.trafficCars) {
      ctx.fillRect(toMap(car.x) - 1.5, toMap(car.z) - 1.5, 3, 3);
    }
    // police dots
    ctx.fillStyle = '#ff4d4d';
    for (const car of world.police.cruisers) {
      ctx.beginPath(); ctx.arc(toMap(car.x), toMap(car.z), 4, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow: compute the ground direction, then rotate the up-pointing arrow onto it
    const px = world.playerCar ? world.playerCar.x : world.player.x;
    const pz = world.playerCar ? world.playerCar.z : world.player.z;
    const heading = world.playerCar ? world.playerCar.heading : world.player.heading;
    const dirX = world.playerCar ? Math.cos(heading) : Math.sin(heading);
    const dirZ = world.playerCar ? Math.sin(heading) : Math.cos(heading);
    const mx = toMap(px), mz = toMap(pz);
    ctx.save();
    ctx.translate(mx, mz);
    ctx.rotate(Math.atan2(dirX, -dirZ));
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // north label
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', 6, 14);
  }

  return { draw };
}
