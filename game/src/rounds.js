// Round and match state, in one place: buy phase, round timer, bomb plant
// and defuse, economy, and the win conditions. No rendering here — main.js
// reads this state and pushes it to the HUD.
export const ROUND_TIME = 100;
export const BUY_TIME = 18;
export const BOMB_TIME = 35;
export const PLANT_TIME = 3.5;
export const DEFUSE_TIME = 5;
export const WIN_ROUNDS = 5;
export const START_MONEY = 800;
export const WIN_MONEY = 3250;
export const LOSS_MONEY = 1900;
export const KILL_MONEY = 300;
export const PLANT_MONEY = 300;

export function createRounds() {
  const state = {
    phase: 'buy', // buy | live | over
    round: 1,
    wins: { ember: 0, vanguard: 0 },
    timer: BUY_TIME,
    money: START_MONEY,
    kills: 0,
    deaths: 0,
    bombPlanted: false,
    bombSite: null,
    bombTimer: 0,
    bombPos: null,
    carrier: 'player',
    matchOver: false,
    matchWinner: null,
    roundWinner: null,
    roundReason: '',
    message: '',
  };

  return {
    state,
    startRound(round) {
      state.round = round;
      state.phase = 'buy';
      state.timer = BUY_TIME;
      state.bombPlanted = false;
      state.bombSite = null;
      state.bombTimer = 0;
      state.bombPos = null;
      state.carrier = 'player';
      state.roundWinner = null;
      state.roundReason = '';
      state.message = 'Buy phase — press B to open the buy menu.';
    },
    startLive() {
      state.phase = 'live';
      state.timer = ROUND_TIME;
      state.message = 'Round live — plant the charge at Site A or Site B.';
    },
    plant(site, pos) {
      state.bombPlanted = true;
      state.bombSite = site;
      state.bombTimer = BOMB_TIME;
      state.bombPos = { x: pos.x, z: pos.z };
      state.money += PLANT_MONEY;
      state.message = 'Charge planted — defend it until it blows.';
    },
    endRound(winner, reason) {
      if (state.phase === 'over') return;
      state.phase = 'over';
      state.roundWinner = winner;
      state.roundReason = reason;
      state.wins[winner] += 1;
      state.money += winner === 'ember' ? WIN_MONEY : LOSS_MONEY;
      state.message = winner === 'ember' ? `Round ${state.round} won — ${reason}` : `Round ${state.round} lost — ${reason}`;
      if (state.wins[winner] >= WIN_ROUNDS) {
        state.matchOver = true;
        state.matchWinner = winner;
      }
    },
    addKill() {
      state.kills += 1;
      state.money += KILL_MONEY;
    },
    addDeath() { state.deaths += 1; },
    tick(dt) {
      if (state.phase === 'buy') {
        state.timer -= dt;
        if (state.timer <= 0) this.startLive();
      } else if (state.phase === 'live') {
        state.timer -= dt;
        if (state.bombPlanted) {
          state.bombTimer -= dt;
          if (state.bombTimer <= 0) {
            state.bombTimer = 0;
            this.endRound('ember', 'the charge detonated');
          }
        } else if (state.timer <= 0) {
          state.timer = 0;
          this.endRound('vanguard', 'time expired before the plant');
        }
      }
    },
  };
}
