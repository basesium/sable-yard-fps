// Sable Yard — a round-based tactical FPS on three.js.
// Boot and the one loop: a fixed 60 Hz simulation feeding a render at the
// display's rate. ?shot=start|buy|play|end with &seed=N sets up a
// deterministic frame for a capture, renders it twice, then freezes it and
// sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeaponSet, WEAPONS, GRENADE_PRICE, ARMOUR_PRICE } from './weapons.js';
import { createBots } from './bots.js';
import { createHud } from './hud.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createRounds, PLANT_TIME, DEFUSE_TIME, START_MONEY } from './rounds.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 22, 58);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 140);
scene.add(camera);

const world = createWorld(scene);
const effects = createEffects(scene);
const audio = createAudio();
const rounds = createRounds();
const hud = createHud();
const player = createPlayer(world.colliders, world.spawns.ember[0]);
const weapons = createWeaponSet(camera);
const input = createInput(renderer.domElement, onLockChange);
const bots = createBots(scene, world.colliders, world.shootables, world.routes, world.holds);
const raycaster = new THREE.Raycaster();
raycaster.far = 80;
const direction = new THREE.Vector3();
const muzzle = new THREE.Vector3();
const hitPoint = new THREE.Vector3();
const tmpVec = new THREE.Vector3();
const tmpVec2 = new THREE.Vector3();

const body = player.state;
const markerHoldMs = shot ? 4000 : 90;
let elapsed = 0;
let frozen = false;
let started = false;
let accumulator = 0;
let lastTime = performance.now();
let roundOverAt = 0;
let plantProgress = 0;
let defuseProgress = 0;
let bombDropped = null;
let grenades = [];

const bombMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.42, 0.2, 0.3),
  new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ember), emissive: new THREE.Color(PALETTE.ember), emissiveIntensity: 0.8 }),
);
bombMesh.visible = false;
scene.add(bombMesh);
const bombLight = new THREE.PointLight(new THREE.Color(PALETTE.ember), 0, 8);
scene.add(bombLight);

// Teams: the player plus two Ember allies against four Vanguard bots.
const allyBots = [
  bots.makeBot(0, 'ember', world.spawns.ember[1], 'rifle'),
  bots.makeBot(1, 'ember', world.spawns.ember[2], 'smg'),
];
const enemyBots = [
  bots.makeBot(2, 'vanguard', world.spawns.vanguard[0], 'rifle'),
  bots.makeBot(3, 'vanguard', world.spawns.vanguard[1], 'sniper'),
  bots.makeBot(4, 'vanguard', world.spawns.vanguard[2], 'rifle'),
  bots.makeBot(5, 'vanguard', world.spawns.vanguard[3], 'smg'),
];

function siteAt(x, z) {
  for (const key of Object.keys(world.sites)) {
    const s = world.sites[key];
    if (Math.hypot(x - s.x, z - s.z) < s.r) return key;
  }
  return null;
}

function assignBots() {
  const round = rounds.state.round;
  const routes = round % 2 === 1
    ? [world.routes.westA, world.routes.midB]
    : [world.routes.eastB, world.routes.midA];
  allyBots.forEach((bot, i) => {
    bot.route = routes[i % routes.length];
    bot.routeIndex = 0;
    bot.holdAt = null;
    bot.holdUntil = 0;
  });
  const holds = [
    world.holds.A[0], world.holds.B[0], world.holds.mid[0], world.holds.A[1],
  ];
  enemyBots.forEach((bot, i) => {
    bot.route = null;
    bot.routeIndex = 0;
    bot.holdAt = holds[i % holds.length];
    bot.holdUntil = elapsed + 6 + i * 2;
  });
}

function setupRound(roundNum) {
  rounds.startRound(roundNum);
  player.respawn(world.spawns.ember[0]);
  player.state.armour = 0;
  weapons.state.owned = { pistol: true, rifle: true };
  weapons.equip('rifle');
  weapons.refill();
  weapons.state.grenades = 0;
  plantProgress = 0;
  defuseProgress = 0;
  bombDropped = null;
  bombMesh.visible = false;
  bombLight.intensity = 0;
  for (const g of grenades) scene.remove(g.mesh);
  grenades = [];
  allyBots.forEach((bot, i) => bots.reset(bot, world.spawns.ember[i + 1]));
  enemyBots.forEach((bot, i) => bots.reset(bot, world.spawns.vanguard[i]));
  assignBots();
  roundOverAt = 0;
  hud.showBuy(false, rounds.state.money, weapons.state.owned);
  syncHud();
}

function restartMatch() {
  rounds.state.wins.ember = 0;
  rounds.state.wins.vanguard = 0;
  rounds.state.kills = 0;
  rounds.state.deaths = 0;
  rounds.state.money = START_MONEY;
  rounds.state.matchOver = false;
  rounds.state.matchWinner = null;
  setupRound(1);
}

function nextRound() {
  if (rounds.state.matchOver) restartMatch();
  else setupRound(rounds.state.round + 1);
}

function syncHud() {
  const r = rounds.state;
  hud.setAmmo(weapons.state.mag, weapons.state.reserve);
  hud.setHealth(body.health, body.armour);
  hud.setMoney(r.money);
  hud.setTimer(r.phase === 'over' ? 0 : (r.bombPlanted ? r.bombTimer : r.timer));
  hud.setScore(r.wins.ember, r.wins.vanguard, r.round, r.kills, r.deaths);
  hud.setWeapon(weapons.def().name, weapons.state.grenades);
  hud.setMessage(r.message);
  hud.setBomb(r.bombPlanted ? `CHARGE PLANTED — ${Math.ceil(r.bombTimer)}s` : r.carrier === 'player' ? 'You carry the charge' : r.carrier === 'dropped' ? 'Charge dropped — walk over it to pick it up' : 'Charge with a teammate');
  hud.setSpread(weapons.spread(player.groundSpeed()));
}

hud.onPlay(() => {
  if (shot) return;
  audio.unlock();
  if (rounds.state.matchOver) { restartMatch(); input.requestLock(); return; }
  if (rounds.state.phase === 'over') { nextRound(); input.requestLock(); return; }
  if (!body.alive) { hud.hideOverlay(); return; }
  input.requestLock();
});

hud.onBuy((id) => buyWeapon(id));

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    hud.hideOverlay();
    hud.showBuy(false, rounds.state.money, weapons.state.owned);
  } else if (rounds.state.phase !== 'over' && !rounds.state.matchOver && body.alive) {
    hud.showOverlay(started ? 'paused' : 'start');
  }
}

function syncCamera() {
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
}

function aimAt(point) {
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}

function damageBot(bot, amount, part, shooter) {
  const killed = bots.damage(bot, amount, part);
  if (killed) {
    rounds.addKill();
    hud.killfeed(`${shooter} eliminated ${bot.name}`);
    hud.hitMarker(true, markerHoldMs);
    audio.kill();
    if (bot.hasBomb) {
      bombDropped = { x: bot.position.x, z: bot.position.z };
      bot.hasBomb = false;
      rounds.state.carrier = 'dropped';
    }
  } else {
    hud.hitMarker(false, markerHoldMs);
    audio.hit();
  }
  return killed;
}

function shootPlayer(spread) {
  if (!weapons.takeRound()) return false;
  const def = weapons.def();
  camera.getWorldDirection(direction);
  let hitAny = false;
  for (let p = 0; p < def.pellets; p += 1) {
    tmpVec.copy(direction);
    tmpVec.x += (random() * 2 - 1) * spread;
    tmpVec.y += (random() * 2 - 1) * spread;
    tmpVec.z += (random() * 2 - 1) * spread;
    tmpVec.normalize();
    scene.updateMatrixWorld(true);
    raycaster.set(camera.position, tmpVec);
    const hit = raycaster.intersectObjects(world.shootables, false)[0];
    muzzle.set(0.24, -0.18, -0.95).applyMatrix4(camera.matrixWorld);
    if (hit) {
      hitPoint.copy(hit.point);
      effects.tracer(muzzle, hitPoint);
      if (hit.object.userData.bot) {
        const bot = hit.object.userData.bot;
        const part = hit.object.userData.part;
        const dist = hit.distance;
        const falloff = 1 - def.falloff * Math.min(1, dist / 40);
        const amount = Math.round(def.damage * (part === 'head' ? def.headMult : 1) * falloff);
        damageBot(bot, amount, part, 'You');
        hitAny = true;
      } else {
        effects.sparksAt(hitPoint, 4);
      }
    } else {
      tmpVec2.copy(camera.position).addScaledVector(tmpVec, 60);
      effects.tracer(muzzle, tmpVec2);
    }
  }
  weapons.pullTrigger();
  player.recoil(0.009 + random() * 0.004, (random() * 2 - 1) * 0.004);
  audio.shot(def.kind);
  hud.setAmmo(weapons.state.mag, weapons.state.reserve);
  return hitAny;
}

function throwGrenade() {
  if (weapons.state.grenades <= 0 || !body.alive) return;
  weapons.state.grenades -= 1;
  camera.getWorldDirection(direction);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.steel), roughness: 0.4, metalness: 0.6 }),
  );
  mesh.position.copy(camera.position);
  scene.add(mesh);
  grenades.push({
    mesh,
    pos: mesh.position,
    vel: direction.clone().multiplyScalar(16).add(new THREE.Vector3(0, 4, 0)),
    fuse: 1.6,
  });
  syncHud();
}

function explodeGrenade(g) {
  effects.explosion(g.pos);
  audio.grenade();
  scene.remove(g.mesh);
  const targets = [];
  if (body.alive) targets.push({ pos: body.position, isPlayer: true });
  for (const bot of bots.bots) if (bot.alive) targets.push({ pos: bot.position, bot });
  for (const t of targets) {
    const d = Math.hypot(t.pos.x - g.pos.x, t.pos.z - g.pos.z);
    if (d > 7) continue;
    const amount = Math.round(95 - (d / 7) * 70);
    if (t.isPlayer) {
      player.damage(amount);
      hud.damageFlash();
      audio.hurt();
      if (!body.alive) {
        rounds.addDeath();
        hud.killfeed('You were caught by a grenade');
        if (rounds.state.carrier === 'player') {
          bombDropped = { x: body.position.x, z: body.position.z };
          rounds.state.carrier = 'dropped';
        }
      }
    } else {
      const killed = bots.damage(t.bot, amount, 'torso');
      if (killed) {
        rounds.addKill();
        hud.killfeed(`Grenade eliminated ${t.bot.name}`);
        audio.kill();
      }
    }
  }
}

function onBotShot(bot, enemy, dist) {
  // Hitscan with a distance-based hit chance; a tracer shows every shot.
  const def = WEAPONS[bot.weaponId];
  tmpVec.set(bot.position.x + 0.2, 1.35, bot.position.z);
  const hitProb = Math.max(0.1, 0.42 - dist * 0.01 - (enemy.isPlayer && player.groundSpeed() > 3 ? 0.15 : 0));
  const hit = random() < hitProb;
  if (hit) {
    tmpVec2.set(enemy.pos.x, 1.3, enemy.pos.z);
    effects.tracer(tmpVec, tmpVec2);
    // Bots hit a little softer than a player shot, so a firefight lasts
    // long enough to react, reposition and return fire.
    const amount = Math.round(def.damage * (1 - def.falloff * Math.min(1, dist / 40)) * (enemy.isPlayer ? 0.7 : 1));
    if (enemy.isPlayer) {
      player.damage(amount);
      hud.damageFlash();
      audio.hurt();
      if (!body.alive) {
        rounds.addDeath();
        hud.killfeed(`${bot.name} eliminated you`);
        if (document.pointerLockElement) document.exitPointerLock();
        hud.showOverlay('dead');
        if (rounds.state.carrier === 'player') {
          bombDropped = { x: body.position.x, z: body.position.z };
          rounds.state.carrier = 'dropped';
        }
      }
    } else if (enemy.bot) {
      const killed = bots.damage(enemy.bot, amount, 'torso');
      if (killed) hud.killfeed(`${bot.name} eliminated ${enemy.bot.name}`);
    }
  } else {
    tmpVec2.set(
      enemy.pos.x + (random() * 2 - 1) * 1.2,
      1.3 + (random() * 2 - 1) * 0.6,
      enemy.pos.z + (random() * 2 - 1) * 1.2,
    );
    effects.tracer(tmpVec, tmpVec2);
  }
  audio.distantShot();
}

function step(dt) {
  elapsed += dt;
  const r = rounds.state;
  const wasBuy = r.phase === 'buy';
  rounds.tick(dt);
  if (wasBuy && r.phase === 'live') {
    hud.showBuy(false, r.money, weapons.state.owned);
    audio.beep();
  }

  // Buy keys, edge-triggered, through the same buyWeapon() as the menu.
  if (r.phase === 'buy' && body.alive) {
    if (input.takePressed('KeyB')) hud.showBuy(!hud.isBuyOpen(), r.money, weapons.state.owned);
    if (hud.isBuyOpen()) {
      const map = { Digit1: 'pistol', Digit2: 'rifle', Digit3: 'smg', Digit4: 'shotgun', Digit5: 'sniper', Digit6: 'grenade', Digit7: 'armour' };
      for (const [code, id] of Object.entries(map)) {
        if (input.takePressed(code)) buyWeapon(id);
      }
    }
  }
  if (input.takePressed('KeyG')) throwGrenade();

  player.step(dt, input.state.keys);
  weapons.step(dt);
  effects.step(dt);

  // Bomb carrier pickup: walk over a dropped charge.
  if (bombDropped && body.alive && Math.hypot(body.position.x - bombDropped.x, body.position.z - bombDropped.z) < 1.4) {
    bombDropped = null;
    r.carrier = 'player';
    hud.killfeed('You picked up the charge');
  }
  for (const bot of allyBots) {
    if (bombDropped && bot.alive && Math.hypot(bot.position.x - bombDropped.x, bot.position.z - bombDropped.z) < 1.4) {
      bombDropped = null;
      bot.hasBomb = true;
      r.carrier = bot.name;
      hud.killfeed(`${bot.name} picked up the charge`);
    }
  }

  // Plant / defuse, held with E.
  const site = siteAt(body.position.x, body.position.z);
  const holdingE = input.state.keys.has('KeyE');
  if (r.phase === 'live' && !r.bombPlanted && body.alive && r.carrier === 'player' && holdingE && site) {
    plantProgress += dt / PLANT_TIME;
    hud.setPlant(plantProgress, `Planting at Site ${site}…`);
    if (plantProgress >= 1) {
      plantProgress = 0;
      hud.setPlant(null);
      rounds.plant(site, body.position);
      bombMesh.position.set(body.position.x, 0.12, body.position.z - 0.5);
      bombMesh.visible = true;
      audio.plant();
      hud.killfeed('Charge planted');
    }
  } else if (plantProgress > 0) {
    plantProgress = 0;
    hud.setPlant(null);
  }

  // Bot carrier plants at a site; a defender bot defuses a planted charge.
  for (const bot of allyBots) {
    if (!bot.alive || !bot.hasBomb || r.bombPlanted) continue;
    const s = siteAt(bot.position.x, bot.position.z);
    if (s && !bot.target) {
      bot.plantProgress += dt / PLANT_TIME;
      if (bot.plantProgress >= 1) {
        bot.plantProgress = 0;
        bot.hasBomb = false;
        rounds.plant(s, bot.position);
        bombMesh.position.set(bot.position.x, 0.12, bot.position.z - 0.5);
        bombMesh.visible = true;
        audio.plant();
        hud.killfeed(`${bot.name} planted the charge at Site ${s}`);
      }
    } else bot.plantProgress = 0;
  }
  if (r.bombPlanted) {
    bombLight.intensity = 20 + Math.sin(elapsed * 6) * 12;
    bombLight.position.set(r.bombPos.x, 1.2, r.bombPos.z);
    for (const bot of enemyBots) {
      if (!bot.alive) continue;
      const d = Math.hypot(bot.position.x - r.bombPos.x, bot.position.z - r.bombPos.z);
      if (d < 1.6 && !bot.target) {
        bot.defuseProgress += dt / DEFUSE_TIME;
        hud.setPlant(bot.defuseProgress, `${bot.name} is defusing…`);
        if (bot.defuseProgress >= 1) {
          bot.defuseProgress = 0;
          hud.setPlant(null);
          bombMesh.visible = false;
          bombLight.intensity = 0;
          r.bombPlanted = false;
          rounds.endRound('vanguard', 'the charge was defused');
        }
      } else bot.defuseProgress = 0;
    }
  }

  // Grenades.
  for (let i = grenades.length - 1; i >= 0; i -= 1) {
    const g = grenades[i];
    g.fuse -= dt;
    g.vel.y -= 20 * dt;
    g.pos.x += g.vel.x * dt;
    g.pos.y += g.vel.y * dt;
    g.pos.z += g.vel.z * dt;
    if (g.pos.y < 0.1) { g.pos.y = 0.1; g.vel.y = Math.abs(g.vel.y) * 0.4; g.vel.x *= 0.7; g.vel.z *= 0.7; }
    if (g.pos.x < -21.5 || g.pos.x > 21.5) g.vel.x *= -0.5;
    if (g.pos.z < -17.5 || g.pos.z > 17.5) g.vel.z *= -0.5;
    if (g.fuse <= 0) {
      explodeGrenade(g);
      grenades.splice(i, 1);
    }
  }

  // Bots fight only once the round is live; the buy phase is safe.
  if (r.phase === 'live') bots.step(dt, elapsed, {
    playerAlive: body.alive,
    playerPos: body.position,
    bombPlanted: r.bombPlanted,
    bombSite: r.bombPos ? [r.bombPos.x, r.bombPos.z] : null,
    onBotShot,
  });

  // Round end by elimination.
  if (r.phase === 'live') {
    if (bots.aliveCount('vanguard') === 0) rounds.endRound('ember', 'the Vanguard team was eliminated');
    else if (!body.alive && bots.aliveCount('ember') === 0) rounds.endRound('vanguard', 'the Ember team was eliminated');
  }
  if (r.phase === 'over' && roundOverAt === 0) {
    roundOverAt = elapsed;
    bombLight.intensity = 0;
    if (r.bombPlanted && r.roundWinner === 'ember' && r.roundReason.includes('detonat')) {
      effects.explosion(new THREE.Vector3(r.bombPos.x, 0.5, r.bombPos.z));
      audio.grenade();
      bombMesh.visible = false;
      r.bombPlanted = false;
    }
    if (r.matchOver) audio.roundWin();
    else if (r.roundWinner === 'ember') audio.roundWin();
    else audio.roundLose();
  }
  if (r.phase === 'over' && elapsed - roundOverAt > 1.4 && !shot) {
    if (r.matchOver) hud.showOverlay('match', { title: r.matchWinner === 'ember' ? 'Ember wins the match' : 'Vanguard wins the match', copy: `Final score Ember ${r.wins.ember} — ${r.wins.vanguard} Vanguard. You had ${r.kills} kills.`, action: 'Play again' });
    else hud.showOverlay('round', { title: r.roundWinner === 'ember' ? `Round ${r.round} won` : `Round ${r.round} lost`, copy: `${r.roundReason}. Ember ${r.wins.ember} — ${r.wins.vanguard} Vanguard. Next round starts with a buy phase.`, action: 'Next round' });
    roundOverAt = elapsed - 1000; // show once
  }

  syncHud();
}

function buyWeapon(id) {
  // Shared with the buy menu handler: same economy rules, one place.
  if (rounds.state.phase !== 'buy' || !body.alive) return;
  const r = rounds.state;
  if (id === 'grenade') {
    if (r.money < GRENADE_PRICE) return;
    r.money -= GRENADE_PRICE;
    weapons.state.grenades += 1;
  } else if (id === 'armour') {
    if (r.money < ARMOUR_PRICE || body.armour >= 50) return;
    r.money -= ARMOUR_PRICE;
    body.armour = 50;
  } else {
    const def = WEAPONS[id];
    if (!def) return;
    if (!weapons.state.owned[id]) {
      if (r.money < def.price) return;
      r.money -= def.price;
    }
    weapons.buy(id);
  }
  audio.buy();
  hud.showBuy(true, r.money, weapons.state.owned);
  syncHud();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    player.look(look.x, look.y);
    if (input.state.firing && body.alive && rounds.state.phase !== 'over') {
      if (weapons.ready()) shootPlayer(shot ? 0 : weapons.spread(player.groundSpeed()));
      else if (weapons.state.mag === 0 && weapons.state.reserve > 0) weapons.reload();
    }
    if (input.takePressed('KeyR')) weapons.reload();
    if (!hud.isBuyOpen()) {
      if (input.takePressed('Digit1')) weapons.equip('pistol');
      if (input.takePressed('Digit2')) weapons.equip('rifle');
      if (input.takePressed('Digit3')) weapons.equip('smg');
      if (input.takePressed('Digit4')) weapons.equip('shotgun');
      if (input.takePressed('Digit5')) weapons.equip('sniper');
    }
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
  }
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
}

function runShot(name) {
  hud.hideOverlay();
  body.pitch = 0;
  body.yaw = 0;
  if (name === 'buy') {
    setupRound(1);
    rounds.state.money = 3200;
    hud.showBuy(true, 3200, weapons.state.owned);
    body.position.set(0, 0, 14);
    settle(20);
    aimAt(new THREE.Vector3(0, 1.5, -6));
  } else if (name === 'play') {
    setupRound(1);
    rounds.startLive();
    rounds.state.timer = 62;
    rounds.state.wins.ember = 1;
    rounds.state.kills = 3;
    rounds.state.money = 2400;
    body.position.set(0, 0, 6);
    settle(20);
    const foe = enemyBots[0];
    foe.position.set(3, 0, -4);
    foe.group.position.set(3, 0, -4);
    const foe2 = enemyBots[1];
    foe2.position.set(-4, 0, -8);
    foe2.group.position.set(-4, 0, -8);
    const down = enemyBots[2];
    bots.damage(down, 200, 'torso');
    down.position.set(-2, 0, -2);
    down.group.position.set(-2, 0, -2);
    aimAt(new THREE.Vector3(3, 1.3, -4));
    shootPlayer(0);
    settle(12);
    aimAt(new THREE.Vector3(-4, 1.3, -8));
    shootPlayer(0);
    settle(1);
  } else if (name === 'end') {
    setupRound(1);
    rounds.startLive();
    rounds.plant('A', new THREE.Vector3(-15, 0, -12));
    bombMesh.position.set(-15, 0.12, -12);
    bombMesh.visible = true;
    rounds.endRound('ember', 'the charge detonated');
    body.position.set(-10, 0, -6);
    settle(20);
    aimAt(new THREE.Vector3(-15, 1, -12));
    hud.showOverlay('round', { title: 'Round 1 won', copy: 'The charge detonated. Ember 1 — 0 Vanguard. Next round starts with a buy phase.', action: 'Next round' });
  } else {
    setupRound(1);
    body.position.set(0.6, 0, 14);
    settle(20);
    aimAt(new THREE.Vector3(0, 1.5, -6));
    hud.showOverlay('start', {});
  }
  syncHud();
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

setupRound(1);
syncCamera();
if (shot) runShot(shot);
else requestAnimationFrame(frame);
