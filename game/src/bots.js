// Bots: one job each in a small state machine — advance along a route, hold
// a position, engage what they can see, plant the bomb, or defuse it.
// A bot sees an enemy only with a clear line of sight (raycast against the
// world), aims with a reaction delay, and fires in bursts with spread that
// grows with distance, so fights are readable, not instant.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { moveBox } from './collision.js';
import { WEAPONS } from './weapons.js';

const RADIUS = 0.34;
const HEIGHT = 1.72;
const SPEED = 3.6;
const GRAVITY = 20;

const NAMES = ['Rook', 'Vale', 'Iris', 'Juno', 'Pike', 'Sable', 'Moss', 'Wren'];

export function createBots(scene, colliders, shootables, routes, holds) {
  const bots = [];
  const raycaster = new THREE.Raycaster();
  raycaster.far = 60;
  const tmpDir = new THREE.Vector3();
  const tmpFrom = new THREE.Vector3();
  const tmpVel = new THREE.Vector3();

  function makeBot(index, team, spawn, weaponId) {
    const group = new THREE.Group();
    const teamColor = team === 'ember' ? PALETTE.ember : PALETTE.teal;
    const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(teamColor), roughness: 0.6, metalness: 0.05 });
    const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.85 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.78, 0.3), bodyMat);
    torso.position.y = 1.0;
    torso.userData.part = 'torso';
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 12), new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.45 }));
    head.position.y = 1.53;
    head.userData.part = 'head';
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.28), darkMat);
    legs.position.y = 0.28;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.6), darkMat);
    gun.position.set(0.2, 1.15, -0.35);
    group.add(torso, head, legs, gun);
    group.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    group.position.set(spawn.x, 0, spawn.z);
    scene.add(group);
    const bot = {
      index, team, group, torso, head,
      name: NAMES[index % NAMES.length],
      position: group.position,
      velocity: new THREE.Vector3(),
      yaw: spawn.yaw || 0,
      health: 100,
      alive: true,
      weaponId,
      route: null,
      routeIndex: 0,
      holdAt: null,
      holdUntil: 0,
      state: 'advance',
      target: null,
      aimAt: new THREE.Vector3(),
      reactAt: -1,
      nextShot: 0,
      burstLeft: 0,
      burstUntil: 0,
      stuckAt: 0,
      lastX: spawn.x,
      lastZ: spawn.z,
      lastMove: 0,
      plantProgress: 0,
      defuseProgress: 0,
      hasBomb: false,
      speed: SPEED,
    };
    torso.userData.bot = bot;
    head.userData.bot = bot;
    shootables.push(torso, head);
    bots.push(bot);
    return bot;
  }

  function canSee(bot, targetPos) {
    tmpFrom.set(bot.position.x, 1.5, bot.position.z);
    tmpDir.set(targetPos.x - tmpFrom.x, 1.45 - tmpFrom.y, targetPos.z - tmpFrom.z);
    const dist = tmpDir.length();
    if (dist > 42) return false;
    tmpDir.normalize();
    raycaster.set(tmpFrom, tmpDir);
    raycaster.far = dist;
    const hit = raycaster.intersectObjects(shootables, false)[0];
    // A hit on a bot mesh at about the target distance is a clear shot;
    // a world mesh in front of it blocks the view.
    if (!hit) return true;
    if (hit.object.userData.bot) return true;
    return hit.distance > dist - 0.6;
  }

  function damage(bot, amount, part) {
    if (!bot.alive) return false;
    bot.health -= amount;
    if (bot.health <= 0) {
      bot.health = 0;
      bot.alive = false;
      bot.group.rotation.x = -1.45;
      bot.group.position.y = -0.08;
      return true;
    }
    return false;
  }

  function reset(bot, spawn) {
    bot.health = 100;
    bot.alive = true;
    bot.group.rotation.set(0, 0, 0);
    bot.group.position.set(spawn.x, 0, spawn.z);
    bot.yaw = spawn.yaw || 0;
    bot.route = null;
    bot.routeIndex = 0;
    bot.holdAt = null;
    bot.state = 'advance';
    bot.target = null;
    bot.reactAt = -1;
    bot.nextShot = 0;
    bot.burstLeft = 0;
    bot.plantProgress = 0;
    bot.defuseProgress = 0;
    bot.hasBomb = false;
    bot.velocity.set(0, 0, 0);
  }

  // Step one bot. `ctx` carries the player, the other bots, the round state
  // and callbacks (onBotShot, onBotKilled, onPlant, onDefuse). Returns events
  // the caller turns into tracers, sounds and HUD entries.
  function stepBot(bot, dt, now, ctx) {
    if (!bot.alive) return;
    // Find the nearest living enemy we can see.
    let enemy = null;
    let enemyPos = null;
    let enemyDist = 1e9;
    const foes = [];
    if (bot.team === 'ember') {
      if (ctx.playerAlive) foes.push({ pos: ctx.playerPos, isPlayer: true, dist: 0 });
      for (const other of bots) if (other.team === 'vanguard' && other.alive) foes.push({ pos: other.position, bot: other, dist: 0 });
    } else {
      if (ctx.playerAlive) foes.push({ pos: ctx.playerPos, isPlayer: true, dist: 0 });
      for (const other of bots) if (other.team === 'ember' && other.alive) foes.push({ pos: other.position, bot: other, dist: 0 });
    }
    for (const foe of foes) {
      const d = Math.hypot(foe.pos.x - bot.position.x, foe.pos.z - bot.position.z);
      foe.dist = d;
      if (d < enemyDist && canSee(bot, foe.pos)) {
        enemyDist = d;
        enemy = foe;
        enemyPos = foe.pos;
      }
    }
    bot.target = enemy;

    // Reaction delay: a bot that has just spotted an enemy faces it but
    // does not fire until its reaction time has passed.
    if (enemy && bot.reactAt < 0) bot.reactAt = now + 0.45 + Math.random() * 0.4;
    if (!enemy) bot.reactAt = -1;

    if (enemy && now >= bot.reactAt) {
      bot.state = 'engage';
      bot.aimAt.set(enemyPos.x, 1.3, enemyPos.z);
      // Face the enemy, fire in bursts.
      const dx = enemyPos.x - bot.position.x;
      const dz = enemyPos.z - bot.position.z;
      bot.yaw = Math.atan2(-dx, -dz);
      if (now >= bot.nextShot && bot.burstLeft <= 0) {
        bot.burstLeft = 3 + Math.floor(Math.random() * 3);
        bot.burstUntil = now + 0.9;
      }
      if (bot.burstLeft > 0 && now < bot.burstUntil) {
        if (now >= bot.nextShot) {
          bot.nextShot = now + WEAPONS[bot.weaponId].gap * 1.6;
          bot.burstLeft -= 1;
          ctx.onBotShot(bot, enemy, enemyDist);
        }
      } else if (bot.burstLeft <= 0) {
        bot.nextShot = now + 1.0 + Math.random() * 0.8;
      }
      // Strafe a little while engaging, so a bot is not a static target.
      tmpVel.set(Math.sin(now * 1.3 + bot.index) * 1.2, 0, Math.cos(now * 1.1 + bot.index) * 0.6);
      bot.velocity.x = tmpVel.x;
      bot.velocity.z = tmpVel.z;
    } else {
      if (enemy) {
        // Still reacting: face the enemy and hold still.
        const dx = enemyPos.x - bot.position.x;
        const dz = enemyPos.z - bot.position.z;
        bot.yaw = Math.atan2(-dx, -dz);
        bot.velocity.x = 0;
        bot.velocity.z = 0;
        bot.state = 'engage';
      } else {
        bot.state = ctx.bombPlanted && bot.team === 'vanguard' ? 'rotate' : 'advance';
      }
      // Follow the assigned route, or hold.
      let dest = null;
      if (bot.holdAt && now < bot.holdUntil) {
        dest = bot.holdAt;
      } else if (bot.route && bot.routeIndex < bot.route.length) {
        dest = bot.route[bot.routeIndex];
      } else if (ctx.bombPlanted && bot.team === 'vanguard') {
        dest = ctx.bombSite;
      } else if (bot.team === 'vanguard' && bot.holdAt) {
        dest = bot.holdAt;
      }
      if (dest) {
        const dx = dest[0] - bot.position.x;
        const dz = dest[1] - bot.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.9) {
          if (bot.route && bot.routeIndex < bot.route.length) bot.routeIndex += 1;
          else if (bot.holdAt) bot.holdUntil = now + 4 + Math.random() * 4;
        } else {
          bot.yaw = Math.atan2(-dx, -dz);
          const sp = bot.speed * (ctx.bombPlanted ? 1.15 : 1);
          bot.velocity.x = (dx / dist) * sp;
          bot.velocity.z = (dz / dist) * sp;
        }
      } else {
        bot.velocity.x = 0;
        bot.velocity.z = 0;
      }
      // Stuck detection: sidestep for a moment instead of pushing a wall.
      const moved = Math.hypot(bot.position.x - bot.lastX, bot.position.z - bot.lastZ);
      if (moved < 0.02 && (bot.velocity.x || bot.velocity.z)) {
        if (now - bot.stuckAt > 1.2) {
          bot.stuckAt = now;
          const s = bot.index % 2 ? 1 : -1;
          bot.velocity.x += Math.cos(bot.yaw) * s * 2;
          bot.velocity.z += -Math.sin(bot.yaw) * s * 2;
        }
      } else {
        bot.lastX = bot.position.x;
        bot.lastZ = bot.position.z;
      }
    }

    bot.velocity.y -= GRAVITY * dt;
    bot.onGround = moveBox(colliders, bot.position, bot.velocity, dt, RADIUS, HEIGHT);
    bot.group.rotation.y = bot.yaw;
    if (bot.state !== 'engage') bot.group.rotation.y = bot.yaw;
  }

  return {
    bots,
    makeBot,
    damage,
    reset,
    step(dt, now, ctx) {
      for (const bot of bots) stepBot(bot, dt, now, ctx);
    },
    hitMeshes() {
      const out = [];
      for (const bot of bots) { out.push(bot.torso, bot.head); }
      return out;
    },
    aliveCount(team) { return bots.filter((b) => b.team === team && b.alive).length; },
  };
}
