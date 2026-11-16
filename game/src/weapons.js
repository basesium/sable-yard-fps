// Weapons: five original guns plus a frag grenade. Each definition owns its
// damage, headshot multiplier, fire gap, magazine, spread and price; the
// view model is built from boxes per weapon, and main.js owns the ray.
// Spread grows with movement speed, so stopping to aim pays.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  pistol: { id: 'pistol', name: 'Sidearm-9', kind: 'pistol', price: 0, damage: 26, headMult: 4, mag: 12, reserve: 48, gap: 0.18, reload: 1.4, spreadStill: 0.004, spreadMove: 0.02, pellets: 1, auto: false, falloff: 0.35 },
  rifle: { id: 'rifle', name: 'Kestrel-5', kind: 'rifle', price: 2100, damage: 34, headMult: 4, mag: 30, reserve: 90, gap: 0.105, reload: 1.9, spreadStill: 0.0022, spreadMove: 0.028, pellets: 1, auto: true, falloff: 0.15 },
  smg: { id: 'smg', name: 'Hornet-9', kind: 'smg', price: 1400, damage: 22, headMult: 4, mag: 32, reserve: 96, gap: 0.07, reload: 1.6, spreadStill: 0.006, spreadMove: 0.032, pellets: 1, auto: true, falloff: 0.5 },
  shotgun: { id: 'shotgun', name: 'Breacher-12', kind: 'shotgun', price: 900, damage: 13, headMult: 2, mag: 6, reserve: 24, gap: 0.85, reload: 2.4, spreadStill: 0.03, spreadMove: 0.04, pellets: 8, auto: false, falloff: 0.7 },
  sniper: { id: 'sniper', name: 'Longbow-7', kind: 'sniper', price: 3200, damage: 82, headMult: 4, mag: 5, reserve: 15, gap: 1.15, reload: 2.6, spreadStill: 0.0006, spreadMove: 0.06, pellets: 1, auto: false, falloff: 0.05 },
};

export const GRENADE_PRICE = 300;
export const ARMOUR_PRICE = 650;

function buildModel(def) {
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const body = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });
  const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.5, metalness: 0.2 });
  const model = new THREE.Group();
  const add = (w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || body);
    m.position.set(x, y, z);
    model.add(m);
    return m;
  };
  if (def.kind === 'pistol') {
    add(0.07, 0.09, 0.24, 0, 0.02, -0.1);
    add(0.06, 0.12, 0.07, 0, -0.06, 0.02, grip);
  } else if (def.kind === 'shotgun') {
    add(0.09, 0.1, 0.5, 0, 0, -0.2);
    add(0.06, 0.06, 0.42, 0, -0.04, -0.22, grip);
    add(0.07, 0.09, 0.2, 0, -0.02, 0.26, grip);
  } else if (def.kind === 'sniper') {
    add(0.08, 0.1, 0.55, 0, 0, -0.22);
    add(0.05, 0.05, 0.5, 0, 0.03, -0.3, grip);
    add(0.06, 0.08, 0.12, 0, 0.09, -0.05, accent);
    add(0.07, 0.08, 0.2, 0, -0.02, 0.3, grip);
  } else if (def.kind === 'smg') {
    add(0.08, 0.09, 0.34, 0, 0, -0.14);
    add(0.05, 0.14, 0.06, 0, -0.08, -0.05, grip);
    add(0.05, 0.05, 0.22, 0, 0.02, -0.34, accent);
  } else {
    add(0.09, 0.1, 0.42, 0, 0, -0.14);
    add(0.045, 0.045, 0.4, 0, 0.025, -0.52, grip);
    add(0.075, 0.08, 0.22, 0, -0.02, 0.18, grip);
    add(0.09, 0.03, 0.1, 0, 0.06, -0.1, accent);
  }
  model.position.set(0.24, -0.2, -0.42);
  return model;
}

export function createWeaponSet(camera) {
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, -0.95);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  const models = {};
  for (const key of Object.keys(WEAPONS)) {
    models[key] = buildModel(WEAPONS[key]);
    models[key].visible = false;
    camera.add(models[key]);
  }
  const state = {
    current: 'rifle',
    mag: WEAPONS.rifle.mag,
    reserve: WEAPONS.rifle.reserve,
    cooldown: 0,
    reloadLeft: 0,
    flash: 0,
    kick: 0,
    grenades: 0,
    owned: { pistol: true, rifle: true },
  };
  models.rifle.visible = true;

  function def() { return WEAPONS[state.current]; }

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    const model = models[state.current];
    model.position.z = -0.42 + state.kick;
    model.rotation.x = state.kick * 2.2;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (def().reload - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const need = def().mag - state.mag;
        const take = Math.min(need, state.reserve);
        state.mag += take;
        state.reserve -= take;
      }
    }
  }

  return {
    state,
    def,
    step,
    ready() { return state.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0; },
    pullTrigger() {
      state.cooldown = def().gap;
      state.flash = 0.06;
      state.kick = def().kind === 'sniper' ? 0.11 : def().kind === 'shotgun' ? 0.09 : 0.055;
    },
    takeRound() {
      if (state.mag <= 0) return false;
      state.mag -= 1;
      return true;
    },
    reload() {
      if (state.reloadLeft > 0 || state.mag === def().mag || state.reserve === 0) return false;
      state.reloadLeft = def().reload;
      return true;
    },
    spread(speed) {
      const d = def();
      return d.spreadStill + Math.min(1, speed / 5.2) * d.spreadMove;
    },
    equip(id) {
      if (!state.owned[id]) return false;
      models[state.current].visible = false;
      state.current = id;
      state.mag = WEAPONS[id].mag;
      state.reserve = WEAPONS[id].reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      models[id].visible = true;
      return true;
    },
    buy(id) {
      if (state.owned[id]) return this.equip(id) ? 'equipped' : 'failed';
      state.owned[id] = true;
      return this.equip(id) ? 'bought' : 'failed';
    },
    refill() {
      state.mag = def().mag;
      state.reserve = def().reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
    },
  };
}
