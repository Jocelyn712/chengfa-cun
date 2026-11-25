import { BRIDGE, MAX_LEVEL, NEW_SIZES, REWARD, SIZES, UPGRADE_COST } from './data.js';

export const STORAGE_KEY = 'kaimath-village-v1';
const BACKUP_PREFIX = 'KAIMATH1:';

export const factKey = (size, count) => `${size}×${count}`;
export const product = (size, count) => `${size}×${count}＝${size * count}`;
export const repeatedSum = (size, count) =>
  `${Array(count).fill(size).join('＋')}＝${size * count}`;

export const allFacts = () =>
  SIZES.flatMap(size => Array.from({ length: 9 }, (_, i) => ({ size, count: i + 1 })));

export function freshState() {
  return {
    version: 1,
    session: 1,
    step: 0,
    wood: 0,
    levels: Object.fromEntries(SIZES.map(size => [size, 0])),
    bridge: {
      position: 0, // 0 起點、1 小島、2 對岸
      segments: BRIDGE.segments.map(rows => ({
        rows, planks: 0, extra: 0, flagged: false, hint: 0, missed: false, draft: '', note: '',
      })),
    },
    free: { size: 6, rows: 1 },
    missions: {},
    records: {},
    today: null,
    eggDue: null,
    active: null,
    backupAt: null,
  };
}

// 讀進舊存檔時補上缺的欄位，並把這次開啟算成新的一回。
export function revive(saved) {
  if (!saved || saved.version !== 1) return null;
  const base = freshState();
  const state = { ...base, ...saved };
  state.levels = { ...base.levels, ...saved.levels };
  state.session = (saved.session ?? 0) + 1;
  return state;
}

export function record(state, size, count, outcome) {
  const key = factKey(size, count);
  const entry = state.records[key] ??
    { independent: 0, supported: 0, explored: 0, skipped: 0 };
  entry[outcome]++;
  entry.last = outcome;
  entry.step = ++state.step;
  entry.session = state.session;
  state.records[key] = entry;
  return entry;
}

const tried = entry => entry && entry.independent + entry.supported + entry.explored > 0;

// 6～9 第一次遇到的算式，先讓孩子動手打開看，不用先答。
export function isNewFact(state, size, count) {
  return NEW_SIZES.includes(size) && !tried(state.records[factKey(size, count)]);
}

// 「用學過的」線索：少一組的算式已經做過，就能從那裡再加一組。
export function knownBefore(state, size, count) {
  if (count < 2) return null;
  return tried(state.records[factKey(size, count - 1)]) ? { size, count: count - 1 } : null;
}

export function isMastered(entry) {
  return entry?.last === 'independent';
}

function isDue(state, entry) {
  return entry && !isMastered(entry) &&
    (state.session > entry.session || state.step - entry.step >= 3);
}

export function eggReady(state) {
  const due = state.eggDue;
  return Boolean(due) && (state.session > due.session || state.step - due.step >= 2);
}

// 一次推薦兩題：先排該回來的（含修橋後的蛋盒），再補 6～9 的新題，最後用 2～5 複習。
export function recommend(state, random = Math.random) {
  const queue = [];
  const has = fact => queue.some(pick => pick.size === fact.size && pick.count === fact.count);
  const add = fact => { if (fact && queue.length < 2 && !has(fact)) queue.push(fact); };
  const facts = allFacts();
  const entryOf = fact => state.records[factKey(fact.size, fact.count)];

  if (eggReady(state)) add({ size: 6, count: 3 });

  const due = facts.filter(fact => isDue(state, entryOf(fact)))
    .sort((a, b) => entryOf(a).step - entryOf(b).step);
  add(due[0]);

  const learningOrder = NEW_SIZES.flatMap(size =>
    [2, 3, 4, 5, 6, 7, 8, 9, 1].map(count => ({ size, count })));
  add(learningOrder.find(fact => isNewFact(state, fact.size, fact.count)));

  if (queue.length < 2) {
    // 先打散再排序，分數一樣的（例如都還沒練過）就隨機挑，不會老是從 2×2 開始。
    const review = facts.filter(fact => fact.size <= 5 && fact.count > 1 && !has(fact))
      .map(fact => ({ fact, order: random() }))
      .sort((a, b) => reviewScore(entryOf(a.fact)) - reviewScore(entryOf(b.fact)) || a.order - b.order);
    add(review[0]?.fact);
  }
  add(due[1]);
  return queue;
}

// 越小越該複習：沒練過或沒熟的優先，再來是比較久沒碰的。
function reviewScore(entry) {
  if (!entry) return 0;
  return (isMastered(entry) ? 1000 : 0) + entry.step;
}

export function outcomeOf(mission) {
  return mission.hint > 0 || mission.missed ? 'supported' : 'independent';
}

export function earn(state, amount) {
  state.wood += amount;
  return amount;
}

export const rewardFor = outcome => REWARD[outcome] ?? 0;

export function upgradeCost(state, size) {
  const level = state.levels[size];
  return level >= MAX_LEVEL ? null : UPGRADE_COST[level];
}

export function upgrade(state, size) {
  const cost = upgradeCost(state, size);
  if (cost === null || state.wood < cost) return false;
  state.wood -= cost;
  state.levels[size]++;
  return true;
}

export function villagerCount(state) {
  return SIZES.filter(size => state.levels[size] >= MAX_LEVEL).length;
}

// 修橋：照排的順序鋪木板，領多的放回岸邊。
export function placePlanks(segment, amount) {
  const room = segment.rows * BRIDGE.width - segment.planks;
  const used = Math.min(room, amount);
  segment.planks += used;
  segment.extra += amount - used;
  return { used, extra: amount - used, missing: room - used };
}

export const segmentDone = segment => segment.planks >= segment.rows * BRIDGE.width;

export function encodeBackup(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return BACKUP_PREFIX + btoa(binary);
}

export function decodeBackup(code) {
  const text = code.trim();
  if (!text.startsWith(BACKUP_PREFIX)) return null;
  try {
    const binary = atob(text.slice(BACKUP_PREFIX.length));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const saved = JSON.parse(new TextDecoder().decode(bytes));
    return saved?.version === 1 ? saved : null;
  } catch {
    return null;
  }
}
