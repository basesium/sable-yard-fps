// Pooled visual effects: tracers, impact sparks and the bomb blast. Pools
// are allocated once at boot and reused, so the hot loop makes no new objects.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createEffects(scene) {
  const tracerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9 });
  const tracers = [];
  for (let i = 0; i < 10; i += 1) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1), tracerMat.clone());
    mesh.visible = false;
    scene.add(mesh);
    tracers.push({ mesh, life: 0 });
  }
  let tracerIndex = 0;

  const sparkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 1 });
  const sparks = [];
  for (let i = 0; i < 24; i += 1) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), sparkMat.clone());
    mesh.visible = false;
    scene.add(mesh);
    sparks.push({ mesh, life: 0, vel: new THREE.Vector3() });
  }
  let sparkIndex = 0;

  const blast = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.ember), transparent: true, opacity: 0.8 }),
  );
  blast.visible = false;
  scene.add(blast);
  const blastLight = new THREE.PointLight(new THREE.Color(PALETTE.ember), 0, 30);
  scene.add(blastLight);
  let blastLife = 0;
  let blastPos = new THREE.Vector3();

  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const mid = new THREE.Vector3();

  return {
    tracer(from, to) {
      const t = tracers[tracerIndex];
      tracerIndex = (tracerIndex + 1) % tracers.length;
      dir.subVectors(to, from);
      const len = dir.length() || 0.01;
      mid.addVectors(from, to).multiplyScalar(0.5);
      t.mesh.position.copy(mid);
      t.mesh.scale.set(1, 1, len);
      t.mesh.lookAt(to);
      t.mesh.visible = true;
      t.mesh.material.opacity = 0.9;
      t.life = 0.07;
    },
    sparksAt(point, count = 6) {
      for (let i = 0; i < count; i += 1) {
        const s = sparks[sparkIndex];
        sparkIndex = (sparkIndex + 1) % sparks.length;
        s.mesh.position.copy(point);
        s.mesh.visible = true;
        s.mesh.material.opacity = 1;
        s.vel.set((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4);
        s.life = 0.35;
      }
    },
    explosion(point) {
      blastPos.copy(point);
      blast.position.copy(point);
      blast.visible = true;
      blastLife = 0.8;
    },
    step(dt) {
      for (const t of tracers) {
        if (t.life <= 0) continue;
        t.life -= dt;
        t.mesh.material.opacity = Math.max(0, t.life / 0.07) * 0.9;
        if (t.life <= 0) t.mesh.visible = false;
      }
      for (const s of sparks) {
        if (s.life <= 0) continue;
        s.life -= dt;
        s.mesh.position.x += s.vel.x * dt;
        s.mesh.position.y += s.vel.y * dt;
        s.mesh.position.z += s.vel.z * dt;
        s.vel.y -= 9 * dt;
        s.mesh.material.opacity = Math.max(0, s.life / 0.35);
        if (s.life <= 0) s.mesh.visible = false;
      }
      if (blastLife > 0) {
        blastLife -= dt;
        const k = 1 - blastLife / 0.8;
        blast.scale.setScalar(1 + k * 9);
        blast.material.opacity = Math.max(0, 0.8 * (1 - k));
        blastLight.position.copy(blastPos);
        blastLight.position.y += 1;
        blastLight.intensity = Math.max(0, 120 * (1 - k));
        if (blastLife <= 0) { blast.visible = false; blastLight.intensity = 0; }
      }
    },
  };
}
