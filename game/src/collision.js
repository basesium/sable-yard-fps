// One AABB collision helper, shared by the player and the bots: a box (radius,
// height) is moved one axis at a time against the world's colliders, so a wall
// never swallows a body and standing on the floor is never read as a wall hit.
import * as THREE from 'three';

const probe = new THREE.Box3();

export function overlapsAt(colliders, x, y, z, radius, height, lift) {
  probe.min.set(x - radius, y + lift, z - radius);
  probe.max.set(x + radius, y + height - lift, z + radius);
  for (let i = 0; i < colliders.length; i += 1) {
    if (probe.intersectsBox(colliders[i])) return colliders[i];
  }
  return null;
}

// Move `pos` by `vel * dt`, resolving X then Z then Y. Returns true when on ground.
export function moveBox(colliders, pos, vel, dt, radius, height) {
  const nextX = pos.x + vel.x * dt;
  if (!overlapsAt(colliders, nextX, pos.y, pos.z, radius, height, 0.04)) pos.x = nextX;
  else vel.x = 0;
  const nextZ = pos.z + vel.z * dt;
  if (!overlapsAt(colliders, pos.x, pos.y, nextZ, radius, height, 0.04)) pos.z = nextZ;
  else vel.z = 0;
  pos.y += vel.y * dt;
  let onGround = false;
  const hit = overlapsAt(colliders, pos.x, pos.y, pos.z, radius, height, 0);
  if (hit && vel.y <= 0) {
    pos.y = hit.max.y;
    vel.y = 0;
    onGround = true;
  } else if (hit) {
    pos.y = hit.min.y - height;
    vel.y = 0;
  }
  if (pos.y < 0) {
    pos.y = 0;
    vel.y = 0;
    onGround = true;
  }
  return onGround;
}
