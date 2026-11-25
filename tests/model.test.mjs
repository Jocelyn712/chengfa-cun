import test from 'node:test';
import assert from 'node:assert/strict';
import { BRIDGE, PLACES, SIZES, UPGRADE_COST } from '../js/data.js';
import {
  allFacts, decodeBackup, eggReady, encodeBackup, factKey, freshState, isNewFact, knownBefore,
  outcomeOf, placePlanks, product, recommend, record, repeatedSum, revive, segmentDone, upgrade,
  villagerCount,
} from '../js/model.js';
import { bridgeScene, closedGroup, freeScene, openGroup, villageScene } from '../js/art.js';

const fixed = () => 0.5;

test('2～9 各乘 1～9，共 72 個算式，算式與總數一致', () => {
  const facts = allFacts();
  assert.equal(facts.length, 72);
  assert.equal(new Set(facts.map(f => factKey(f.size, f.count))).size, 72);
  for (const { size, count } of facts) {
    assert.equal(product(size, count), `${size}×${count}＝${size * count}`);
    const [terms, total] = repeatedSum(size, count).split('＝');
    assert.equal(terms.split('＋').length, count, '加法的項數等於組數');
    assert.ok(terms.split('＋').every(term => Number(term) === size), '每一項都是每組的數量');
    assert.equal(Number(total), size * count);
  }
});

test('每個地點都有題目、單位與圖，題目用「每組幾個 × 有幾組」', () => {
  for (const size of SIZES) {
    const place = PLACES[size];
    for (const key of ['name', 'kind', 'group', 'item', 'unit', 'each', 'deliver', 'done']) {
      assert.ok(place[key], `${size} 缺少 ${key}`);
    }
    for (let count = 1; count <= 9; count++) {
      assert.match(place.ask(count), new RegExp(`${count} `), `${size}×${count} 的題目要寫出組數`);
      assert.match(openGroup(size, place), /^<svg/);
      assert.match(openGroup(size, place, true), /^<svg/);
      assert.match(closedGroup(size, place), new RegExp(`>${size}<`), '箱子上寫每組的數量');
    }
  }
  assert.match(PLACES[5].ask(3), /幾元/, '五元硬幣問的是共幾元');
  assert.doesNotMatch(PLACES[5].ask(3), /幾枚/);
});

test('6～9 第一次是新題，2～5 不算新題', () => {
  const state = freshState();
  assert.equal(isNewFact(state, 6, 3), true);
  assert.equal(isNewFact(state, 9, 9), true);
  assert.equal(isNewFact(state, 2, 3), false);
  record(state, 6, 3, 'skipped');
  assert.equal(isNewFact(state, 6, 3), true, '跳過不算看過');
  record(state, 6, 3, 'explored');
  assert.equal(isNewFact(state, 6, 3), false);
});

test('修橋：領少的會留下空格可以補領，領多的放岸邊，不用重來', () => {
  const segment = freshState().bridge.segments[1];
  assert.equal(segment.rows * BRIDGE.width, 18);
  assert.deepEqual(placePlanks(segment, 12), { used: 12, extra: 0, missing: 6 });
  assert.equal(segmentDone(segment), false);
  assert.deepEqual(placePlanks(segment, 6), { used: 6, extra: 0, missing: 0 });
  assert.equal(segmentDone(segment), true);

  const other = freshState().bridge.segments[1];
  assert.deepEqual(placePlanks(other, 20), { used: 18, extra: 2, missing: 0 });
  assert.equal(segmentDone(other), true);
  assert.equal(other.extra, 2);
});

test('作答結果：用了線索或答錯過，就不算自己答對', () => {
  assert.equal(outcomeOf({ hint: 0, missed: false }), 'independent');
  assert.equal(outcomeOf({ hint: 1, missed: false }), 'supported');
  assert.equal(outcomeOf({ hint: 0, missed: true }), 'supported');
});

test('卡住的題目隔幾個動作或下次再出，不會馬上重問', () => {
  const state = freshState();
  record(state, 7, 4, 'supported');
  const soon = recommend(state, fixed);
  assert.ok(!soon.some(f => f.size === 7 && f.count === 4), '剛做完不會馬上再出');
  record(state, 2, 3, 'independent');
  record(state, 3, 3, 'independent');
  record(state, 4, 3, 'independent');
  assert.deepEqual(recommend(state, fixed)[0], { size: 7, count: 4 }, '隔三個動作後優先出');

  const nextDay = revive(JSON.parse(JSON.stringify(freshState())));
  record(nextDay, 8, 6, 'skipped');
  const reopened = revive(JSON.parse(JSON.stringify(nextDay)));
  assert.deepEqual(recommend(reopened, fixed)[0], { size: 8, count: 6 }, '下次打開優先混入');
});

test('修完第二段橋後，稍後會在蛋盒遇到 6×3', () => {
  const state = freshState();
  record(state, 6, 2, 'explored');
  record(state, 6, 3, 'supported');
  state.eggDue = { step: state.step, session: state.session };
  assert.equal(eggReady(state), false);
  assert.ok(!recommend(state, fixed).some(f => f.size === 6 && f.count === 3));
  record(state, 6, 4, 'explored');
  record(state, 3, 5, 'independent');
  assert.equal(eggReady(state), true);
  assert.deepEqual(recommend(state, fixed)[0], { size: 6, count: 3 });

  const tomorrow = freshState();
  tomorrow.eggDue = { step: 0, session: 1 };
  tomorrow.session = 2;
  assert.equal(eggReady(tomorrow), true, '隔天打開也會出現');
});

test('每次推薦最多兩題，6～9 照順序帶新題，再用 2～5 複習', () => {
  const state = freshState();
  const first = recommend(state, fixed);
  assert.equal(first.length, 2);
  assert.deepEqual(first[0], { size: 6, count: 2 });
  assert.ok(first[1].size <= 5 && first[1].count > 1);
  record(state, 6, 2, 'explored');
  assert.deepEqual(recommend(state, fixed)[0], { size: 6, count: 3 });
  const picks = new Set(Array.from({ length: 30 }, () => {
    const pick = recommend(freshState())[1];
    return factKey(pick.size, pick.count);
  }));
  assert.ok(picks.size > 1, '2～5 的複習題不會每次都一樣');
});

test('「用學過的」線索只在少一組的算式做過時出現', () => {
  const state = freshState();
  assert.equal(knownBefore(state, 6, 3), null);
  record(state, 6, 2, 'explored');
  assert.deepEqual(knownBefore(state, 6, 3), { size: 6, count: 2 });
  assert.equal(knownBefore(state, 6, 1), null);
});

test('木材升級地點，第三級有村民搬進來', () => {
  const state = freshState();
  assert.equal(upgrade(state, 6), false, '木材不夠不能升級');
  state.wood = UPGRADE_COST.reduce((a, b) => a + b);
  for (let i = 0; i < UPGRADE_COST.length; i++) assert.equal(upgrade(state, 6), true);
  assert.equal(state.wood, 0);
  assert.equal(upgrade(state, 6), false, '最高級不能再升');
  assert.equal(villagerCount(state), 1);
});

test('備份碼可以還原，包含中文與進度', () => {
  const state = freshState();
  record(state, 7, 3, 'supported');
  state.wood = 9;
  state.bridge.segments[0].flagged = true;
  const restored = decodeBackup(encodeBackup(state));
  assert.deepEqual(restored, JSON.parse(JSON.stringify(state)));
  assert.equal(decodeBackup('亂打的字'), null);
  assert.equal(decodeBackup('KAIMATH1:@@@'), null);
});

test('重新打開時保留進度並補上新欄位', () => {
  const saved = JSON.parse(JSON.stringify(freshState()));
  saved.wood = 5;
  delete saved.free;
  const state = revive(saved);
  assert.equal(state.wood, 5);
  assert.equal(state.session, 2);
  assert.deepEqual(state.free, { size: 6, rows: 1 });
  assert.equal(revive({ version: 99 }), null);
});

test('地圖都畫得出來', () => {
  const state = freshState();
  assert.match(villageScene(state, 6), /data-action="select-place" data-size="6"/);
  assert.match(bridgeScene(state.bridge, { segment: 0 }), /class="hero"/);
  for (let size = 2; size <= 9; size++) {
    for (let rows = 1; rows <= 9; rows++) {
      assert.match(freeScene(size, rows, -1), new RegExp(`一共 ${size * rows} 塊木板`));
    }
  }
});
