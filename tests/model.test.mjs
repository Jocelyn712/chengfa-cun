import test from 'node:test';
import assert from 'node:assert/strict';
import { ACROSS_SIZES, BRIDGE, PLACES, SIZES, STALE_DAYS, UPGRADE_COST } from '../js/data.js';
import {
  allFacts, daysSince, decodeBackup, earn, eggReady, encodeBackup, factKey, freshState,
  isMastered, isNewFact, isUnlocked, isWeedy, knownBefore, outcomeOf, placePlanks, product,
  recommend, record, repeatedSum, revive, rewardFor, segmentDone, stockOf, today, totalWood,
  upgrade, upgradeCost, villagerCount, visit, weedyPlaces,
} from '../js/model.js';
import {
  bridgeScene, closedGroup, freeScene, openGroup, villageHeroPath, villageHeroStop, villageScene,
} from '../js/art.js';

const fixed = () => 0.5;

// 大部分的測試都假設橋已經修好，對岸的 6～9 才進得去。
function crossed() {
  const state = freshState();
  state.bridge.segments.forEach(segment => { segment.flagged = true; });
  return state;
}

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
  const state = crossed();
  record(state, 7, 4, 'supported');
  const soon = recommend(state, fixed);
  assert.ok(!soon.some(f => f.size === 7 && f.count === 4), '剛做完不會馬上再出');
  record(state, 2, 3, 'independent');
  record(state, 3, 3, 'independent');
  record(state, 4, 3, 'independent');
  assert.deepEqual(recommend(state, fixed)[0], { size: 7, count: 4 }, '隔三個動作後優先出');

  const nextDay = revive(JSON.parse(JSON.stringify(crossed())));
  record(nextDay, 8, 6, 'skipped');
  const reopened = revive(JSON.parse(JSON.stringify(nextDay)));
  assert.deepEqual(recommend(reopened, fixed)[0], { size: 8, count: 6 }, '下次打開優先混入');
});

test('修完第二段橋後，稍後會在蛋盒遇到 6×3', () => {
  const state = crossed();
  record(state, 6, 2, 'explored');
  record(state, 6, 3, 'supported');
  state.eggDue = { step: state.step, session: state.session };
  assert.equal(eggReady(state), false);
  assert.ok(!recommend(state, fixed).some(f => f.size === 6 && f.count === 3));
  record(state, 6, 4, 'explored');
  record(state, 3, 5, 'independent');
  assert.equal(eggReady(state), true);
  assert.deepEqual(recommend(state, fixed)[0], { size: 6, count: 3 });

  const tomorrow = crossed();
  tomorrow.eggDue = { step: 0, session: 1 };
  tomorrow.session = 2;
  assert.equal(eggReady(tomorrow), true, '隔天打開也會出現');
});

test('每次推薦最多兩題，6～9 照順序帶新題，再用 2～5 複習', () => {
  const state = crossed();
  const first = recommend(state, fixed);
  assert.equal(first.length, 2);
  assert.deepEqual(first[0], { size: 6, count: 2 });
  assert.ok(first[1].size <= 5 && first[1].count > 1);
  record(state, 6, 2, 'explored');
  assert.deepEqual(recommend(state, fixed)[0], { size: 6, count: 3 });
  const picks = new Set(Array.from({ length: 30 }, () => {
    const pick = recommend(crossed())[1];
    return factKey(pick.size, pick.count);
  }));
  assert.ok(picks.size > 1, '2～5 的複習題不會每次都一樣');
});

test('橋修好才去得了對岸，在那之前小任務只出 2～5', () => {
  const before = freshState();
  for (const size of ACROSS_SIZES) assert.equal(isUnlocked(before, size), false);
  for (const size of [2, 3, 4, 5]) assert.equal(isUnlocked(before, size), true);
  for (let i = 0; i < 20; i++) {
    const picks = recommend(freshState());
    assert.equal(picks.length, 2, '橋還沒修好也要有兩題可以做');
    assert.ok(picks.every(pick => pick.size <= 5), '對岸的題目不會出現');
  }
  const after = crossed();
  for (const size of ACROSS_SIZES) assert.equal(isUnlocked(after, size), true);
  assert.deepEqual(recommend(after, fixed)[0], { size: 6, count: 2 });
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
  earn(state, 6, UPGRADE_COST.reduce((a, b) => a + b));
  for (let i = 0; i < UPGRADE_COST.length; i++) assert.equal(upgrade(state, 6), true);
  assert.equal(stockOf(state, 6), 0);
  assert.equal(upgradeCost(state, 6), null);
  assert.equal(upgrade(state, 6), false, '最高級不能再升');
  assert.equal(villagerCount(state), 1);
});

test('木材分地點存：在鞋店賺的木材不能拿去蓋棋盤廣場', () => {
  const state = freshState();
  earn(state, 2, 30);
  assert.equal(stockOf(state, 2), 30);
  assert.equal(stockOf(state, 9), 0);
  assert.equal(totalWood(state), 30);
  assert.equal(upgrade(state, 9), false, '別的地點的木材用不到這裡');
  assert.equal(upgrade(state, 2), true);
  assert.equal(state.levels[9], 0);
  assert.equal(state.levels[2], 1);
});

test('已經自己答對過的算式再做一次只給 1 塊，還沒熟的永遠給滿額', () => {
  assert.equal(rewardFor('independent'), 3);
  assert.equal(rewardFor('supported'), 2);
  assert.equal(rewardFor('explored'), 2);
  assert.equal(rewardFor('independent', true), 1, '複習熟題只給 1 塊');
  assert.equal(rewardFor('supported', true), 1);
  assert.equal(rewardFor('skipped'), 0);
  assert.equal(rewardFor('skipped', true), 0, '跳過不給木材');

  const state = freshState();
  assert.equal(isMastered(state.records[factKey(2, 3)]), false);
  record(state, 2, 3, 'supported');
  assert.equal(isMastered(state.records[factKey(2, 3)]), false, '用線索完成還不算熟');
  record(state, 2, 3, 'independent');
  assert.equal(isMastered(state.records[factKey(2, 3)]), true);
});

test('全部蓋完要答對 56 題，而且八個乘法表都要練到', () => {
  const state = crossed();
  let answers = 0;
  for (const size of SIZES) {
    let count = 1;
    while (state.levels[size] < UPGRADE_COST.length) {
      const repeat = isMastered(state.records[factKey(size, count)]);
      record(state, size, count, 'independent');
      earn(state, size, rewardFor('independent', repeat));
      answers++;
      while (upgrade(state, size));
      count = count % 9 + 1;
      assert.ok(answers < 200, '不能無限刷下去');
    }
  }
  assert.equal(villagerCount(state), SIZES.length);
  assert.equal(answers, 56);
  // 每個地點都要在自己那裡練到 7 題，不能靠別的乘法表的木材蓋完。
  for (const size of SIZES) {
    const done = allFacts().filter(fact => fact.size === size &&
      state.records[factKey(fact.size, fact.count)]).length;
    assert.equal(done, 7);
  }
});

test('日期只算到「日」，隔天就是隔一天', () => {
  const noon = new Date(2026, 10, 25, 12, 0);
  assert.equal(today(noon), '2026-11-25');
  assert.equal(today(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(daysSince('2026-11-25', noon), 0);
  // 晚上 11 點玩，隔天早上 7 點算一天，不是「還沒滿 24 小時」。
  assert.equal(daysSince('2026-11-25', new Date(2026, 10, 26, 7, 0)), 1);
  assert.equal(daysSince('2026-11-22', noon), 3);
  assert.equal(daysSince('', noon), 0, '沒去過就沒有天數');
});

test('🌿 還在蓋的地點幾天沒回去就長草，蓋滿的不長草', () => {
  const day = (y, m, d) => new Date(y, m - 1, d, 10, 0);
  const state = crossed();
  assert.deepEqual(weedyPlaces(state, day(2026, 11, 25)), [], '沒去過的地點不長草');

  visit(state, 2, day(2026, 11, 20));
  visit(state, 3, day(2026, 11, 24));
  assert.equal(state.visited[2], '2026-11-20');
  assert.equal(isWeedy(state, 2, day(2026, 11, 22)), false, `還沒滿 ${STALE_DAYS} 天不長草`);
  assert.equal(isWeedy(state, 2, day(2026, 11, 23)), true, `第 ${STALE_DAYS} 天長草`);
  assert.equal(isWeedy(state, 3, day(2026, 11, 25)), false, '前天才去過，不長草');
  assert.deepEqual(weedyPlaces(state, day(2026, 11, 25)), [2]);

  // 蓋滿的地點不長草：木材對它已經沒用了，不該再叫孩子回去。
  state.levels[2] = UPGRADE_COST.length;
  assert.equal(isWeedy(state, 2, day(2026, 11, 25)), false, '蓋滿就不長草');
  state.levels[2] = UPGRADE_COST.length - 1;
  assert.equal(isWeedy(state, 2, day(2026, 11, 25)), true, '還差一級還是會長草');

  // 回去幫忙就除草。
  visit(state, 2, day(2026, 11, 25));
  assert.equal(isWeedy(state, 2, day(2026, 11, 25)), false, '今天去過就沒草了');
});

test('🌿 對岸還過不去的地點不長草', () => {
  const day = new Date(2026, 10, 25, 10, 0);
  const before = freshState();
  for (const size of ACROSS_SIZES) visit(before, size, new Date(2026, 10, 1, 10, 0));
  assert.deepEqual(weedyPlaces(before, day), [], '進不去的地方不會怪孩子沒去');
  const after = revive(JSON.parse(JSON.stringify(before)));
  after.bridge.segments.forEach(segment => { segment.flagged = true; });
  assert.deepEqual(weedyPlaces(after, day), ACROSS_SIZES, '過橋後就開始算天數');
});

test('備份碼可以還原，包含中文與進度', () => {
  const state = freshState();
  record(state, 7, 3, 'supported');
  earn(state, 7, 9);
  state.bridge.segments[0].flagged = true;
  const restored = decodeBackup(encodeBackup(state));
  assert.deepEqual(restored, JSON.parse(JSON.stringify(state)));
  assert.equal(decodeBackup('亂打的字'), null);
  assert.equal(decodeBackup('KAIMATH1:@@@'), null);
});

test('重新打開時保留進度並補上新欄位', () => {
  const saved = JSON.parse(JSON.stringify(freshState()));
  earn(saved, 4, 5);
  delete saved.free;
  const state = revive(saved);
  assert.equal(stockOf(state, 4), 5);
  assert.equal(state.session, 2);
  assert.deepEqual(state.free, { size: 6, rows: 1 });
  assert.equal(revive({ version: 99 }), null);
});

test('舊存檔（共用一堆木材）會平均分給八個地點', () => {
  const old = {
    version: 1, session: 3, step: 7, wood: 20,
    levels: { 2: 2, 3: 1, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
    bridge: freshState().bridge,
    records: { '2×3': { independent: 1, supported: 0, explored: 0, skipped: 0, last: 'independent', step: 1, session: 1 } },
  };
  const state = revive(old);
  assert.equal(state.version, 2);
  assert.equal(state.wood, undefined, '不再有共用的那一堆');
  for (const size of SIZES) assert.equal(stockOf(state, size), 2, '20 塊分給八個地點，每個 2 塊');
  assert.equal(state.levels[2], 2, '蓋好的進度留著');
  assert.equal(state.session, 4);
  assert.ok(state.records['2×3'], '學習紀錄留著');
  assert.ok(decodeBackup(encodeBackup(state)), '轉過來的存檔也能備份');
});

test('地圖都畫得出來', () => {
  const state = freshState();
  assert.match(villageScene(state, 6), /data-action="select-place" data-size="6"/);
  assert.match(bridgeScene(state.bridge, { segment: 0 }), /class="hero"/);
  for (const size of ACROSS_SIZES) {
    assert.match(villageScene(state, size), /修好橋才過得去/, '橋沒修好，對岸蓋著霧');
  }
  assert.doesNotMatch(villageScene(crossed(), 6), /修好橋才過得去/, '過橋後霧散開');
  const weedy = crossed();
  const before = villageScene(weedy, null);
  visit(weedy, 2, new Date(Date.now() - STALE_DAYS * 864e5));
  const after = villageScene(weedy, null);
  assert.ok(after.length > before.length, '長草的地點會多畫出草叢');
  assert.match(after, /長草了/, '長草的地點報讀得出來');

  for (let size = 2; size <= 9; size++) {
    for (let rows = 1; rows <= 9; rows++) {
      assert.match(freeScene(size, rows, -1), new RegExp(`一共 ${size * rows} 塊木板`));
    }
  }
});

test('村莊的小人會走到點的地點，對岸還過不去就只走到橋頭', () => {
  const state = freshState();
  const home = villageHeroStop(state, null);
  const stops = new Set();
  for (const size of [2, 3, 4, 5]) {
    const stop = villageHeroStop(state, size);
    assert.notDeepEqual(stop, home, `點了${PLACES[size].name}，小人要走過去`);
    stops.add(`${stop.x},${stop.y}`);
  }
  assert.equal(stops.size, 4, '每個地點站的位置都不一樣');
  const foot = villageHeroStop(state, 6);
  for (const size of ACROSS_SIZES) {
    assert.deepEqual(villageHeroStop(state, size), foot, '對岸的地點都只走到橋頭');
  }
  const after = crossed();
  assert.notDeepEqual(villageHeroStop(after, 6), foot, '過橋後就走得到雞舍');
});

test('要去對岸的小人會先走到橋頭，從橋上過河', () => {
  const state = crossed();
  const shop = villageHeroStop(state, 2);
  const coop = villageHeroStop(state, 6);
  assert.deepEqual(villageHeroPath(shop, villageHeroStop(state, 5)), [villageHeroStop(state, 5)],
    '同一岸直接走過去');
  const over = villageHeroPath(shop, coop);
  assert.equal(over.length, 3, '過河要先上橋再下橋');
  assert.deepEqual(over[2], coop);
  assert.ok(over[0].y > over[1].y, '先走到這岸的橋頭，再往對岸');
  const back = villageHeroPath(coop, shop);
  assert.ok(back[0].y < back[1].y, '回來的方向相反');
  assert.deepEqual(back[2], shop);
});
