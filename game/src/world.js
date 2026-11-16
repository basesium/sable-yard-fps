// Sable Yard: an original dusk container yard, 44 x 36 m. Three lanes run
// north from the Ember spawn in the south to the two bomb sites in the north:
// the west lane past the rust containers, the mid lane through the foundry
// hall, and the east lane past the silos. Every box is a collider for players
// and bots and a surface a bullet stops on. Plain geometry only.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const SITES = {
  A: { name: 'Site A', x: -15, z: -12, r: 3.4 },
  B: { name: 'Site B', x: 15, z: -12, r: 3.4 },
};

export const SPAWNS = {
  ember: [
    { x: -4, z: 14, yaw: 0 }, { x: 0, z: 15, yaw: 0 }, { x: 4, z: 14, yaw: 0 },
  ],
  vanguard: [
    { x: -8, z: -14, yaw: Math.PI }, { x: 0, z: -15, yaw: Math.PI },
    { x: 8, z: -14, yaw: Math.PI }, { x: -16, z: -14, yaw: Math.PI },
    { x: 16, z: -14, yaw: Math.PI },
  ],
};

// Waypoint routes through clear corridors: west, mid and east to each site.
export const ROUTES = {
  westA: [[-4, 14], [-14, 10], [-14, 2], [-14, -6], [-15, -12]],
  midA: [[0, 14], [0, 6], [2.5, 0], [0, -6], [-7, -8], [-15, -12]],
  midB: [[0, 14], [0, 6], [-2.5, 0], [0, -6], [7, -8], [15, -12]],
  eastB: [[4, 14], [14, 10], [14, 2], [14, -6], [15, -12]],
  westB: [[-4, 14], [-14, 10], [-7, -8], [7, -8], [15, -12]],
  eastA: [[4, 14], [14, 10], [7, -8], [-7, -8], [-15, -12]],
};

export const HOLDS = {
  A: [[-12, -10], [-17, -8], [-10, -13]],
  B: [[12, -10], [17, -8], [10, -13]],
  mid: [[0, -8], [-2.5, -4], [2.5, -4]],
};

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' || name === 'ink' ? 0.55 : 0.92,
      metalness: name === 'steel' ? 0.45 : 0.03,
    });
  }
  const colliders = [];
  const shootables = [];

  function box(w, h, d, x, y, z, material, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collide) {
      colliders.push(new THREE.Box3().setFromObject(mesh));
      shootables.push(mesh);
    }
    return mesh;
  }

  function cylinder(r, h, x, z, material) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), materials[material]);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const c = new THREE.Box3(new THREE.Vector3(x - r, 0, z - r), new THREE.Vector3(x + r, h, z + r));
    colliders.push(c);
    shootables.push(mesh);
    return mesh;
  }

  function sitePaint(site, material) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(site.r * 2, site.r * 2),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE[material]), roughness: 0.9, transparent: true, opacity: 0.28 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(site.x, 0.02, site.z);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Floor and outer walls, 5 m high, open to the dusk sky.
  box(44.4, 0.4, 36.4, 0, -0.2, 0, 'yard');
  box(0.4, 5, 36.4, -22.2, 2.5, 0, 'surface');
  box(0.4, 5, 36.4, 22.2, 2.5, 0, 'surface');
  box(44.4, 5, 0.4, 0, 2.5, -18.2, 'surface');
  box(44.4, 5, 0.4, 0, 2.5, 18.2, 'surface');

  // Mid hall: a cross wall with two door gaps, and a central pillar.
  box(8, 4.2, 0.8, -14, 2.1, 0, 'steel');
  box(8, 4.2, 0.8, 14, 2.1, 0, 'steel');
  box(2, 4.2, 2, 0, 2.1, 0, 'rust');
  box(3, 1.1, 1.2, -8, 0.55, -4, 'hairline');
  box(3, 1.1, 1.2, 8, 0.55, -4, 'hairline');

  // West lane: rust containers and crates, with a clear corridor at x = -14.
  box(6, 2.6, 2.4, -18, 1.3, 6, 'rust');
  box(2.4, 2.6, 6, -19.5, 1.3, -2, 'steel');
  box(1.6, 1.1, 1.6, -11, 0.55, 6, 'hairline');
  box(1.6, 0.7, 1.6, -17, 0.35, -8, 'hairline');
  box(3.6, 1.1, 1.2, -12, 0.55, -2, 'hairline');
  box(1.2, 2.4, 1.2, -18, 1.2, -12, 'sand');

  // East lane: silos and crates, clear corridor at x = 14.
  cylinder(1.8, 4.4, 19, 4, 'steel');
  cylinder(1.8, 4.4, 19, -4, 'steel');
  box(6, 2.6, 2.4, 18, 1.3, -10, 'rust');
  box(1.6, 1.1, 1.6, 11, 0.55, 6, 'hairline');
  box(1.6, 0.7, 1.6, 17, 0.35, -8, 'hairline');
  box(3.6, 1.1, 1.2, 12, 0.55, -2, 'hairline');
  box(1.2, 2.4, 1.2, 18, 1.2, -12, 'sand');

  // North connector and site cover.
  box(4, 1.1, 1.2, -6, 0.55, -10, 'hairline');
  box(4, 1.1, 1.2, 6, 0.55, -10, 'hairline');
  box(1.6, 1.1, 1.6, -15, 0.55, -15, 'hairline');
  box(1.6, 1.1, 1.6, 15, 0.55, -15, 'hairline');
  box(2.4, 2.2, 1.2, -19, 1.1, -14, 'rust');
  box(2.4, 2.2, 1.2, 19, 1.1, -14, 'rust');
  box(1.2, 3.2, 1.2, 0, 1.6, -14, 'steel');

  // South spawn cover, low crates both teams can crouch behind.
  box(2.4, 0.9, 1.2, -2.4, 0.45, 10, 'hairline');
  box(2.4, 0.9, 1.2, 2.4, 0.45, 10, 'hairline');
  box(2.4, 0.9, 1.2, -2.4, 0.45, -10, 'hairline');
  box(2.4, 0.9, 1.2, 2.4, 0.45, -10, 'hairline');

  sitePaint(SITES.A, 'ember');
  sitePaint(SITES.B, 'teal');

  // Site beacons: tall amber / teal posts so a site reads at a glance.
  const beaconA = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.ember) }));
  beaconA.position.set(-15, 1.7, -15.5);
  group.add(beaconA);
  const beaconB = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.teal) }));
  beaconB.position.set(15, 1.7, -15.5);
  group.add(beaconB);

  // Dusk lighting: low warm sun, cool sky fill, amber lamps over each site.
  const sky = new THREE.HemisphereLight(new THREE.Color('#8a9aa4'), new THREE.Color(PALETTE.canvas), 1.35);
  scene.add(sky);
  const key = new THREE.DirectionalLight(new THREE.Color('#ffb26a'), 2.6);
  key.position.set(18, 16, 12);
  key.target.position.set(0, 0, -4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -26;
  key.shadow.camera.right = 26;
  key.shadow.camera.top = 24;
  key.shadow.camera.bottom = -24;
  key.shadow.camera.far = 60;
  key.shadow.bias = -0.0006;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(new THREE.Color(PALETTE.muted), 0.85);
  fill.position.set(-14, 10, 14);
  scene.add(fill);
  const lampA = new THREE.PointLight(new THREE.Color(PALETTE.ember), 24, 14);
  lampA.position.set(-15, 4.2, -12);
  scene.add(lampA);
  const lampB = new THREE.PointLight(new THREE.Color(PALETTE.teal), 24, 14);
  lampB.position.set(15, 4.2, -12);
  scene.add(lampB);

  return { colliders, shootables, group, sites: SITES, spawns: SPAWNS, routes: ROUTES, holds: HOLDS };
}
