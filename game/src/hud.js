// The DOM HUD: crosshair, hit marker, health, ammo, money, timer, team
// score, kill feed, buy menu and the overlay panels. It never touches the
// simulation; main.js pushes numbers in and reads callbacks out.
import { WEAPONS, GRENADE_PRICE, ARMOUR_PRICE } from './weapons.js';

const COPY = {
  start: {
    title: 'Sable Yard',
    copy: 'Ember attacks. Plant the charge at Site A or Site B, or eliminate the Vanguard team. Click to play.',
    action: 'Click to play',
  },
  paused: {
    title: 'Sable Yard',
    copy: 'Paused. Click to resume.',
    action: 'Click to resume',
  },
  round: {
    title: 'Round over',
    copy: '',
    action: 'Next round',
  },
  match: {
    title: 'Match over',
    copy: '',
    action: 'Play again',
  },
  dead: {
    title: 'You are down',
    copy: 'Your team is still fighting. Wait for the round to end.',
    action: 'Spectate',
  },
};

export function createHud() {
  const el = (id) => document.getElementById(id);
  const overlay = el('overlay');
  const title = el('overlay-title');
  const copy = el('overlay-copy');
  const play = el('play');
  const ammo = el('ammo');
  const ammoMag = el('ammo-mag');
  const ammoReserve = el('ammo-reserve');
  const scoreValue = el('score-value');
  const healthValue = el('health-value');
  const armourValue = el('armour-value');
  const moneyValue = el('money-value');
  const timerValue = el('timer-value');
  const roundValue = el('round-value');
  const weaponName = el('weapon-name');
  const grenadesValue = el('grenades-value');
  const killfeed = el('killfeed');
  const message = el('message');
  const buyMenu = el('buy-menu');
  const buyList = el('buy-list');
  const bombStatus = el('bomb-status');
  const damageFlash = el('damage-flash');
  const plantBar = el('plant-bar');
  const plantFill = el('plant-fill');
  const plantLabel = el('plant-label');
  const crosshair = el('crosshair');
  const hitmarker = el('hitmarker');
  const killsValue = el('score-kills');
  const deathsValue = el('score-deaths');
  let hitTimer = 0;
  let last = {};
  let buyHandler = null;

  function setText(node, key, value) {
    if (last[key] === value) return;
    last[key] = value;
    node.textContent = value;
  }

  function renderBuy(money, owned) {
    if (!buyList) return;
    buyList.innerHTML = '';
    const items = [
      ...Object.values(WEAPONS).map((w) => ({ id: w.id, label: `${w.name} — $${w.price}`, price: w.price, owned: !!owned[w.id] })),
      { id: 'grenade', label: `Spark-4 frag grenade — $${GRENADE_PRICE}`, price: GRENADE_PRICE, owned: false },
      { id: 'armour', label: `Vest armour — $${ARMOUR_PRICE}`, price: ARMOUR_PRICE, owned: false },
    ];
    for (const item of items) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'buy-row';
      row.textContent = `${item.label}${item.owned ? ' (owned)' : ''}${money < item.price && !item.owned ? ' — not enough' : ''}`;
      row.addEventListener('click', () => { if (buyHandler) buyHandler(item.id); });
      buyList.appendChild(row);
    }
  }

  return {
    setAmmo(mag, reserve) {
      setText(ammoMag, 'mag', String(mag));
      setText(ammoReserve, 'reserve', `/ ${reserve}`);
      ammo.classList.toggle('empty', mag === 0);
    },
    setHealth(health, armour) {
      setText(healthValue, 'health', String(health));
      setText(armourValue, 'armour', armour > 0 ? `+${armour}` : '');
    },
    setMoney(money) { setText(moneyValue, 'money', `$${money}`); },
    setTimer(seconds) {
      const s = Math.max(0, Math.ceil(seconds));
      setText(timerValue, 'timer', `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    },
    setScore(ember, vanguard, round, kills = null, deaths = null) {
      setText(scoreValue, 'score', `${ember} — ${vanguard}`);
      setText(roundValue, 'round', `Round ${round}`);
      if (kills != null && killsValue) setText(killsValue, 'kills', String(kills));
      if (deaths != null && deathsValue) setText(deathsValue, 'deaths', String(deaths));
    },
    setWeapon(name, grenades) {
      setText(weaponName, 'weapon', name);
      setText(grenadesValue, 'grenades', `Grenades: ${grenades}`);
    },
    setMessage(text) { setText(message, 'message', text); },
    setBomb(text) { setText(bombStatus, 'bomb', text); },
    setSpread(spread) {
      if (!crosshair) return;
      const px = Math.round(4 + spread * 900);
      crosshair.style.setProperty('--gap', `${px}px`);
    },
    setPlant(progress, label) {
      if (progress == null) { plantBar.hidden = true; return; }
      plantBar.hidden = false;
      plantFill.style.width = `${Math.round(progress * 100)}%`;
      plantLabel.textContent = label;
    },
    killfeed(text) {
      const line = document.createElement('div');
      line.textContent = text;
      killfeed.prepend(line);
      while (killfeed.children.length > 4) killfeed.removeChild(killfeed.lastChild);
      setTimeout(() => { if (line.parentNode) line.parentNode.removeChild(line); }, 6000);
    },
    damageFlash() {
      damageFlash.classList.add('on');
      setTimeout(() => damageFlash.classList.remove('on'), 140);
    },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.style.transform = killed ? 'translate(-50%, -50%) rotate(45deg) scale(1.25)' : '';
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => {
        hitmarker.classList.remove('on');
        hitmarker.style.transform = '';
      }, holdMs);
    },
    showOverlay(mode, data = {}) {
      const text = COPY[mode];
      title.textContent = data.title || text.title;
      copy.textContent = data.copy || text.copy;
      play.textContent = data.action || text.action;
      overlay.hidden = false;
      play.focus();
    },
    hideOverlay() { overlay.hidden = true; },
    onPlay(handler) { play.addEventListener('click', handler); },
    showBuy(open, money, owned) {
      buyMenu.hidden = !open;
      if (open) renderBuy(money, owned);
    },
    onBuy(handler) { buyHandler = handler; },
    isBuyOpen() { return !buyMenu.hidden; },
  };
}
