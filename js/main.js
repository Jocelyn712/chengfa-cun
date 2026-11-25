import { BRIDGE, MAX_LEVEL, PLACES, SIZES, VILLAGERS } from './data.js';
import {
  STORAGE_KEY, allFacts, decodeBackup, earn, encodeBackup, factKey, freshState, isMastered,
  isNewFact, knownBefore, outcomeOf, placePlanks, product, recommend, record, repeatedSum,
  revive, rewardFor, segmentDone, upgrade, upgradeCost, villagerCount,
} from './model.js';
import {
  bridgeScene, closedGroup, freeScene, heroTransform, openGroup, propIcon, villageScene, woodIcon,
} from './art.js';

const app = document.querySelector('#app');
const woodCount = document.querySelector('#wood-count');
const villagerTotal = document.querySelector('#villager-count');
const range = n => Array.from({ length: n }, (_, i) => i);

let state = load();
// 家長頁有自己的網址（網址後面加 #parent），其他畫面都用原本的網址。
const PARENT_HASH = '#parent';
let route = { view: location.hash === PARENT_HASH ? 'parent' : 'village' };
let walking = false;
let freshPlanks = 0;
let freshRow = -1;

function load() {
  try {
    return revive(JSON.parse(localStorage.getItem(STORAGE_KEY))) ?? freshState();
  } catch {
    return freshState();
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 無痕模式等情況存不了，遊戲照樣能玩。
  }
}

function go(next, remember = false) {
  route = next;
  if (remember) state.active = next;
  render();
  syncHash();
  window.scrollTo({ top: 0 });
}

function syncHash() {
  const inParent = route.view === 'parent';
  if (inParent === (location.hash === PARENT_HASH)) return;
  history.replaceState(null, '', inParent ? PARENT_HASH : location.pathname + location.search);
}

window.addEventListener('hashchange', () => {
  const wantParent = location.hash === PARENT_HASH;
  if (wantParent !== (route.view === 'parent')) go({ view: wantParent ? 'parent' : 'village' });
});

const btn = (label, action, { attrs = '', cls = '' } = {}) =>
  `<button type="button" class="btn ${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const wood = n => `<span class="wood">${woodIcon()}<b>${n}</b></span>`;
const equation = (size, count) =>
  `<div class="equation"><span>${repeatedSum(size, count)}</span><strong>${product(size, count)}</strong></div>`;

function numberPad(draft, unit, submitLabel, submitAction) {
  return `<div class="pad">
    <div class="pad-line"><output class="pad-value">${draft || '?'}</output><span class="pad-unit">${unit}</span>
      ${btn(submitLabel, submitAction, { cls: 'primary', attrs: draft ? '' : 'disabled' })}</div>
    <div class="pad-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => btn(d, 'digit', { cls: 'key', attrs: `data-digit="${d}"` })).join('')}
      ${btn('刪除', 'erase', { cls: 'key soft-key', attrs: draft ? '' : 'disabled' })}
      ${btn(0, 'digit', { cls: 'key', attrs: 'data-digit="0"' })}
      <span></span></div>
  </div>`;
}

// ── 村莊
function canResume() {
  const active = state.active;
  if (!active) return null;
  if (active.view === 'mission') {
    const mission = state.missions[factKey(active.size, active.count)];
    return mission && mission.phase !== 'done' ? `${PLACES[active.size].name}的任務` : null;
  }
  if (active.view === 'bridge') return state.bridge.segments.some(s => !s.flagged) ? '修橋' : null;
  return null;
}

function villagersPanel() {
  return `<div class="villagers"><h3>搬進來的村民 ${villagerCount(state)} / ${SIZES.length}</h3>
    <div class="villager-row">${SIZES.map(size => {
      const here = state.levels[size] >= MAX_LEVEL;
      return `<span class="villager ${here ? 'here' : ''}" style="--c:${PLACES[size].color}" title="${here ? VILLAGERS[size] : '還沒搬來'}">
        <svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${propIcon(PLACES[size].kind)}</svg>
        <small>${here ? VILLAGERS[size].slice(-2) : size}</small></span>`;
    }).join('')}</div></div>`;
}

function welcomePanel() {
  const resume = canResume();
  const bridgeDone = state.bridge.segments.every(s => s.flagged);
  return `<div class="panel">
    <h1>乘法村</h1>
    <p>幫村民做事，就能拿到木材，把村莊蓋起來。點地圖上的地方看看！</p>
    <div class="stack">
      ${resume ? btn(`繼續：${resume}`, 'resume', { cls: 'primary big' }) : ''}
      ${bridgeDone ? '' : btn('去修橋', 'bridge', { cls: resume ? 'big' : 'primary big' })}
      ${btn('今日小任務', 'today', { cls: !resume && bridgeDone ? 'primary big' : 'big' })}
      ${bridgeDone ? btn('自由蓋橋', 'free', { cls: 'big' }) : ''}
    </div>
  </div>${villagersPanel()}`;
}

function placePanel(size) {
  const place = PLACES[size];
  const level = state.levels[size];
  const cost = upgradeCost(state, size);
  const stars = range(MAX_LEVEL).map(i => `<i class="${i < level ? 'on' : ''}"></i>`).join('');
  return `<div class="panel place" style="--c:${place.color}">
    <div class="place-head">
      <span class="place-icon"><svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${propIcon(place.kind)}</svg></span>
      <div><small>${size} 的乘法</small><h2>${place.name}</h2></div>
    </div>
    <p>${place.each}。</p>
    <div class="stars" aria-label="第 ${level} 級">${stars}</div>
    <div class="stack">
      ${btn('幫忙', 'pick', { cls: 'primary big', attrs: `data-size="${size}"` })}
      ${cost === null ? `<p class="happy">${VILLAGERS[size]}搬進來了！</p>` :
        `${btn(`升級 ${wood(cost)}`, 'upgrade', { cls: 'big', attrs: `data-size="${size}" ${state.wood < cost ? 'disabled' : ''}` })}
         ${state.wood < cost ? `<p class="soft">還差 ${cost - state.wood} 塊木材，幫村民做事就能拿到。</p>` :
           level === MAX_LEVEL - 1 ? `<p class="soft">再升一級，${VILLAGERS[size]}就會搬進來！</p>` : ''}`}
      ${btn('回村莊', 'village', { cls: 'quiet' })}
    </div>
  </div>`;
}

function villageView() {
  return `<div class="layout village">
    <section class="map">${villageScene(state, route.selected)}</section>
    <aside class="side">${route.selected ? placePanel(route.selected) : welcomePanel()}</aside>
  </div>`;
}

// ── 修橋
function activeSegment() {
  if (route.celebrate !== undefined) return route.celebrate;
  return state.bridge.segments.findIndex(s => !s.flagged);
}

function bridgeHintButton(segment) {
  const labels = ['看一排', '一排一排數', '用第一段的橋'];
  if (segment.hint >= labels.length) return '';
  return btn(labels[segment.hint], 'bridge-hint', { cls: 'hint' });
}

function bridgePanel(index) {
  if (index === -1) {
    return `<div class="panel"><h2>橋修好了！</h2><p>兩段橋都插上旗子了。想蓋不一樣的橋，可以去自由蓋橋。</p>
      <div class="stack">${btn('自由蓋橋', 'free', { cls: 'primary big' })}${btn('回村莊', 'village', { cls: 'big' })}</div></div>`;
  }
  const segment = state.bridge.segments[index];
  if (route.celebrate === index) {
    return index === 0 ?
      `<div class="panel"><h2>插好旗子了！</h2><p class="reward">拿到 ${wood(rewardFor('bridge'))} 木材</p>
        <p>前面還有一段更寬的河。</p>${btn('修下一段', 'bridge-next', { cls: 'primary big' })}</div>` :
      `<div class="panel"><h2>走到對岸了！</h2><p class="reward">拿到 ${wood(rewardFor('bridge'))} 木材</p>
        <p>對岸的村民聽說你很會算 6，說不定會來找你幫忙喔。</p>
        <div class="stack">${btn('今日小任務', 'today', { cls: 'primary big' })}${btn('回村莊蓋房子', 'village', { cls: 'big' })}${btn('自由蓋橋', 'free', { cls: 'big' })}</div></div>`;
  }
  if (segmentDone(segment)) {
    return `<div class="panel"><h2>木板鋪滿了！</h2>${equation(BRIDGE.width, segment.rows)}
      <p>每排都是 ${BRIDGE.width} 塊，一樣多。${segment.rows} 排就是 ${BRIDGE.width}×${segment.rows}，不用一塊一塊數。</p>
      ${segment.extra ? `<p class="soft">多的 ${segment.extra} 塊放在岸邊，下次再用。</p>` : ''}
      ${btn('走過橋插旗子', 'walk', { cls: 'primary big' })}</div>`;
  }
  if (index === 0) {
    const sums = range(segment.planks / BRIDGE.width).map(i =>
      `<li>第 ${i + 1} 排 <b>${i === 0 ? BRIDGE.width : `${range(i + 1).map(() => BRIDGE.width).join('＋')}＝${BRIDGE.width * (i + 1)}`}</b> 塊</li>`).join('');
    return `<div class="panel"><p class="tag">修橋・第一段</p><h2>一捆有 6 塊木板，剛好鋪一排</h2>
      <p>點一下，把一捆木板搬到橋上。</p>
      <div class="counter">已經用了 <b>${segment.planks}</b> 塊</div>
      ${sums ? `<ul class="sums">${sums}</ul>` : ''}
      ${btn('搬一捆木板', 'bundle', { cls: 'primary big' })}</div>`;
  }
  const hintText = [
    '',
    '<p class="hint-box">亮起來的這一排，有 6 格。</p>',
    '<p class="hint-box">點河上的空排，一排一排數數看。</p>',
    '<p class="hint-box">第一段 2 排是 6×2＝12。這段多一排，再加 6 塊是多少？</p>',
  ][segment.hint];
  return `<div class="panel"><p class="tag">修橋・第二段</p>
    <h2>${segment.planks ? `還缺幾塊？數數看閃閃的空格` : '這段要鋪 3 排，每排 6 格。要領幾塊木板？'}</h2>
    ${segment.planks ? `<div class="counter">已經鋪了 <b>${segment.planks}</b> 塊</div>` : ''}
    ${numberPad(segment.draft, '塊', '領木板', 'order')}
    ${segment.note ? `<p class="note">${segment.note}</p>` : ''}
    ${segment.planks ? '' : `<div class="hint-row">${bridgeHintButton(segment)}</div>${hintText}`}
  </div>`;
}

function bridgeView() {
  const index = activeSegment();
  const segment = state.bridge.segments[index];
  const asking = index === 1 && segment && !segmentDone(segment) && route.celebrate === undefined && !segment.planks;
  const scene = bridgeScene(state.bridge, {
    segment: index,
    fresh: freshPlanks,
    focusRow: asking && segment.hint >= 1,
    countRows: asking && segment.hint >= 2,
    hintRows: asking && segment.hint >= 2 ? segment.hintRows ?? 0 : 0,
    knownRow: asking && segment.hint >= 3,
  });
  return `<div class="layout bridge">
    <section class="map tall">${scene}</section>
    <aside class="side">${bridgePanel(index)}</aside>
  </div>`;
}

function freeView() {
  const { size, rows } = state.free;
  return `<div class="layout bridge free-layout">
    <section class="map tall free">${freeScene(size, rows, freshRow)}</section>
    <aside class="side"><div class="panel">
      <p class="tag">自由蓋橋</p><h2>每排幾格？</h2>
      <div class="choices">${range(8).map(i => btn(i + 2, 'free-size', { cls: 'choice', attrs: `data-size="${i + 2}" aria-pressed="${i + 2 === size}"` })).join('')}</div>
      <h2>一共幾排？</h2>
      <div class="stepper">${btn('少一排', 'free-rows', { attrs: `data-change="-1" ${rows <= 1 ? 'disabled' : ''}` })}
        <output>${rows} 排</output>${btn('多一排', 'free-rows', { cls: 'primary', attrs: `data-change="1" ${rows >= 9 ? 'disabled' : ''}` })}</div>
      <div class="counter">一共 <b>${size * rows}</b> 塊木板</div>
      ${equation(size, rows)}
      ${btn('回村莊', 'village', { cls: 'quiet' })}
    </div></aside>
  </div>`;
}

// ── 任務
function pickView() {
  const { size } = route;
  const place = PLACES[size];
  return `<div class="narrow"><div class="panel">
    <p class="tag">${size} 的乘法・${place.name}</p>
    <h2>${place.each}。要幫幾${place.group}？</h2>
    <div class="count-grid">${range(9).map(i => {
      const count = i + 1;
      const mastered = isMastered(state.records[factKey(size, count)]);
      return btn(`${count}<small>${place.group}</small>`, 'start', { cls: `count ${mastered ? 'mastered' : ''}`, attrs: `data-count="${count}"` });
    }).join('')}</div>
    <div class="stack">${btn('幫我挑', 'start-auto', { cls: 'big' })}${btn('回村莊', 'village', { cls: 'quiet' })}</div>
  </div></div>`;
}

const missionOf = r => state.missions[factKey(r.size, r.count)];

function groupsView(size, count, mission) {
  const place = PLACES[size];
  const known = mission.hint >= 3 ? knownBefore(state, size, count) : null;
  const counting = mission.mode === 'explore' || mission.hint >= 2 || mission.phase !== 'ask';
  const cards = range(count).map(i => {
    const open = mission.phase !== 'ask' || i < mission.opened;
    const tappable = !open && counting && mission.phase === 'ask';
    const label = open ? (counting ? `累計 <b>${(i + 1) * size}</b>` : `<b>${size}</b> ${place.unit}`) : `第 ${i + 1} ${place.group}`;
    const tag = tappable ? 'button' : 'div';
    return `<${tag} class="group ${open ? 'open' : ''} ${tappable ? 'tappable' : ''} ${known && i < count - 1 ? 'known' : ''}"
      ${tappable ? 'type="button" data-action="open-box"' : ''} aria-label="第 ${i + 1} ${place.group}">
      ${open ? openGroup(size, place, mission.phase === 'done') : closedGroup(size, place)}
      <span class="group-label">${label}</span></${tag}>`;
  }).join('');
  const banner = known ? `<p class="known-banner">前面 ${known.count} ${place.group}：你算過 ${product(size, known.count)}</p>` : '';
  return `${banner}<div class="groups">${cards}</div>`;
}

function hintButton(size, count, mission) {
  const place = PLACES[size];
  if (mission.hint === 0) return btn(`打開一${place.group}看看`, 'hint', { cls: 'hint' });
  if (mission.hint === 1 && count > 1) return btn(`一${place.group}一${place.group}打開`, 'hint', { cls: 'hint' });
  if (mission.hint === 2 && knownBefore(state, size, count)) return btn('用學過的', 'hint', { cls: 'hint' });
  return '';
}

function hintText(size, count, mission) {
  const place = PLACES[size];
  if (mission.hint === 2 && mission.opened < count) return `<p class="hint-box">點箱子，一${place.group}一${place.group}打開，數字會幫你加起來。</p>`;
  if (mission.hint === 3) return `<p class="hint-box">再加 1 ${place.group}，也就是再加 ${size}，是多少？</p>`;
  return '';
}

function workPanel(size, count, mission) {
  const place = PLACES[size];
  const total = size * count;
  const tag = `<p class="tag">${route.today ? '今日小任務・' : ''}${size} 的乘法・${place.name}</p>`;
  if (mission.phase === 'done') {
    const eggLink = size === 6 && count === 3 && state.bridge.segments[1].flagged ?
      '<p class="hint-box">每捆 6 塊、每盒 6 顆，3 組都等於 18！</p>' : '';
    const cost = upgradeCost(state, size);
    const next = route.today ?
      (state.today.index < state.today.queue.length ? btn('下一件小任務', 'today', { cls: 'primary big' }) : btn('完成今天的任務', 'today-done', { cls: 'primary big' })) :
      btn('再幫一次', 'pick', { cls: 'primary big', attrs: `data-size="${size}"` });
    return `<div class="panel">${tag}<h2>${place.done}</h2>
      ${equation(size, count)}${eggLink}
      <p class="reward">拿到 ${wood(mission.reward)} 木材</p>
      ${cost !== null && state.wood >= cost ? `<p class="soft">木材夠了，可以去升級${place.name}！</p>` : ''}
      <div class="stack">${next}${btn('回村莊', 'village-place', { cls: 'big', attrs: `data-size="${size}"` })}</div></div>`;
  }
  if (mission.phase === 'ready') {
    return `<div class="panel">${tag}<h2>${mission.outcome === 'independent' ? '答對了！' : '算出來了！'}一共 ${total} ${place.unit}</h2>
      ${equation(size, count)}
      <p>每${place.group}都是 ${size}，一樣多。${count} ${place.group}就是 ${size}×${count}。</p>
      ${btn(place.deliver, 'deliver', { cls: 'primary big' })}</div>`;
  }
  if (mission.mode === 'explore') {
    const opened = mission.opened;
    return `<div class="panel">${tag}<h2>第一次來${place.name}！</h2>
      <p>${place.each}。要準備 ${count} ${place.group}。</p>
      <p class="hint-box">${opened < count ? `點箱子，一${place.group}一${place.group}打開看看。` : '全部打開了！'}</p>
      ${opened === count ? `${equation(size, count)}<p>每${place.group}一樣多，可以用乘法算：${size}×${count}。</p>${btn(place.deliver, 'deliver', { cls: 'primary big' })}` : ''}
      ${btn('先跳過', 'skip', { cls: 'quiet' })}</div>`;
  }
  return `<div class="panel">${tag}<h2>${place.ask(count)}</h2>
    <p class="soft">${place.each}。</p>
    ${numberPad(mission.draft, place.unit, '確定', 'answer')}
    ${mission.feedback ? `<p class="note">${mission.feedback}</p>` : ''}
    <div class="hint-row">${hintButton(size, count, mission)}</div>
    ${hintText(size, count, mission)}
    ${btn('先跳過', 'skip', { cls: 'quiet' })}</div>`;
}

function missionView() {
  const { size, count } = route;
  const mission = missionOf(route);
  return `<div class="layout mission">
    <section class="stage"><h2 class="stage-title">${count} ${PLACES[size].group}，每${PLACES[size].group} ${size} ${PLACES[size].unit}</h2>
      ${groupsView(size, count, mission)}</section>
    <aside class="side">${workPanel(size, count, mission)}</aside>
  </div>`;
}

function todayDoneView() {
  const done = state.today?.done ?? 0;
  return `<div class="narrow"><div class="panel">
    <h2>${done ? `今天幫了 ${done} 個忙！` : '今天先休息也很好。'}</h2>
    <p>木材有 ${wood(state.wood)}，可以回村莊蓋房子。</p>
    <div class="stack">${btn('回村莊', 'village', { cls: 'primary big' })}${btn('再一題', 'today-more', { cls: 'big' })}</div>
  </div></div>`;
}

// ── 家長頁：孩子玩的畫面不出現這些紀錄。
const backupDate = () => state.backupAt ?
  `上次複製：${new Date(state.backupAt).toLocaleDateString('zh-TW')}` : '還沒複製過備份碼。';

// 判斷現在是怎麼打開的，給家長對應的存檔建議。
function whereAmI() {
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|Edg|FxiOS|Firefox|Android/.test(navigator.userAgent);
  if (standalone) return { ok: true, text: '目前是從主畫面圖示打開，這是最推薦的方式。' };
  if (ios) return { ok: false, text: '目前是在瀏覽器分頁裡玩。建議照下面的方法加入主畫面。' };
  if (safari) return { ok: false, text: '目前是用 Mac 的 Safari 玩。建議改用 Chrome 或 Edge，或至少每週打開一次。' };
  return { ok: true, text: '目前用的瀏覽器不會因為幾天沒開就清掉存檔，偶爾備份就好。' };
}

function parentView() {
  const where = whereAmI();
  const legend = [
    ['independent', '自己答對'], ['supported', '用線索或答錯後完成'], ['explored', '動手看過'], ['skipped', '跳過'], ['', '還沒練'],
  ];
  const cell = (size, count) => {
    const entry = state.records[factKey(size, count)];
    const detail = entry ? `自己答對 ${entry.independent}、線索 ${entry.supported}、看過 ${entry.explored}、跳過 ${entry.skipped}` : '還沒練';
    return `<td class="${entry?.last ?? ''}" title="${detail}">${size}×${count}</td>`;
  };
  const totals = { independent: 0, supported: 0, explored: 0, skipped: 0 };
  for (const fact of allFacts()) {
    const last = state.records[factKey(fact.size, fact.count)]?.last;
    if (last) totals[last]++;
  }
  return `<div class="parent">
    <div class="panel">
      <h1>家長頁</h1>
      <p>每格顯示這個算式「最近一次」的狀況。只有綠色才算熟了；黃色、藍色、灰色會在之後的小任務再出現。</p>
      <ul class="legend">${legend.map(([key, label]) => `<li><i class="${key}"></i>${label}${key ? ` ${totals[key]}` : ''}</li>`).join('')}</ul>
      <div class="table-wrap"><table class="facts"><tbody>${SIZES.map(size =>
        `<tr>${range(9).map(i => cell(size, i + 1)).join('')}</tr>`).join('')}</tbody></table></div>
    </div>
    <div class="panel">
      <h2>存檔規則</h2>
      <p class="where ${where.ok ? 'ok' : ''}">${where.text}</p>
      <ul class="rules">
        <li>進度只存在<b>這台裝置的這個瀏覽器</b>裡，不會上傳，也不會在不同裝置之間同步。</li>
        <li>換裝置、換瀏覽器，或是從 Safari 分頁改成主畫面圖示，進度都不會自動帶過去，要用下面的備份碼搬。</li>
        <li>Safari（iPad、iPhone、Mac 都一樣）：如果連續 7 天有在用 Safari，卻都沒有打開乘法村，Safari 可能會自動清掉存檔。</li>
        <li>清除瀏覽紀錄和網站資料，或用無痕模式玩，存檔也會不見。</li>
      </ul>
      <h2>建議這樣保存</h2>
      <ul class="rules">
        <li><b>iPad、iPhone：加入主畫面。</b>在 Safari 按分享按鈕（方框加向上箭頭）→「加入主畫面」→「新增」，以後都從主畫面的乘法村圖示打開。從主畫面打開會全螢幕顯示，存檔也有自己的天數計算，比在 Safari 分頁裡不容易被清掉。</li>
        <li><b>筆電：用 Chrome 或 Edge 玩。</b>這兩個瀏覽器不會因為幾天沒開就清掉存檔。如果用 Mac 的 Safari，至少每週打開玩一次。</li>
        <li><b>不管用哪種，都偶爾複製備份碼</b>，貼到備忘錄或傳給自己。存檔不見時，貼回下面的「還原進度」就能接著玩。</li>
      </ul>
      <h2>備份碼</h2>
      <p class="soft backup-date">${backupDate()}</p>
      <textarea id="backup-out" readonly rows="3">${encodeBackup(state)}</textarea>
      <div class="stack row">${btn('複製備份碼', 'copy-backup', { cls: 'primary' })}</div>
      <h2>還原進度</h2>
      <textarea id="backup-in" rows="3" placeholder="把備份碼貼在這裡"></textarea>
      <div class="stack row">${btn('還原', 'restore')}${btn('全部重來', 'reset', { cls: 'danger' })}</div>
      <p class="note" id="parent-note" role="status"></p>
    </div>
    ${btn('回遊戲', 'village', { cls: 'primary big' })}
  </div>`;
}

function render() {
  const views = {
    village: villageView, bridge: bridgeView, free: freeView, pick: pickView,
    mission: missionView, 'today-done': todayDoneView, parent: parentView,
  };
  app.innerHTML = views[route.view]();
  app.dataset.view = route.view;
  woodCount.textContent = state.wood;
  villagerTotal.textContent = villagerCount(state);
  for (const nav of document.querySelectorAll('[data-nav]')) {
    const current = route.view === 'mission' ? (route.today ? 'mission' : 'village') :
      route.view === 'free' ? 'bridge' : route.view;
    nav.toggleAttribute('aria-current', nav.dataset.nav === current);
  }
  freshPlanks = 0;
  freshRow = -1;
  save();
}

// ── 動作
function startMission(size, count, today = false) {
  const key = factKey(size, count);
  if (!state.missions[key] || state.missions[key].phase === 'done') {
    state.missions[key] = {
      mode: isNewFact(state, size, count) ? 'explore' : 'ask',
      phase: 'ask', opened: 0, hint: 0, missed: false, draft: '', feedback: '',
    };
  }
  go({ view: 'mission', size, count, today }, true);
}

function autoCount(size) {
  const counts = [2, 3, 4, 5, 6, 7, 8, 9, 1];
  const open = counts.find(count => !isMastered(state.records[factKey(size, count)]));
  return open ?? counts[Math.floor(Math.random() * 8)];
}

function openToday(more = false) {
  const today = state.today;
  if (more || !today || today.index >= today.queue.length) {
    const queue = recommend(state);
    state.today = { queue: more ? queue.slice(0, 1) : queue, index: 0, done: 0 };
  }
  const next = state.today.queue[state.today.index];
  startMission(next.size, next.count, true);
}

function finishMission(mission, outcome) {
  const { size, count } = route;
  record(state, size, count, outcome);
  if (size === 6 && count === 3) state.eggDue = null;
  if (route.today) {
    state.today.index++;
    if (outcome !== 'skipped') state.today.done++;
  }
  if (outcome === 'skipped') {
    delete state.missions[factKey(size, count)];
    state.active = null;
    if (route.today) {
      if (state.today.index < state.today.queue.length) return openToday();
      return go({ view: 'today-done' });
    }
    return go({ view: 'village', selected: size });
  }
  mission.phase = 'done';
  mission.reward = earn(state, rewardFor(outcome));
  state.active = null;
  render();
}

function type(target, digit) {
  if (target.draft.length >= 2) return;
  target.draft = target.draft === '0' ? String(digit) : target.draft + digit;
}

function orderPlanks(segment) {
  const amount = Number(segment.draft);
  segment.draft = '';
  if (!amount) return;
  const { used, extra, missing } = placePlanks(segment, amount);
  freshPlanks = used;
  if (missing || extra) segment.missed = true;
  segment.note = missing ? `鋪了 ${used} 塊，還缺 ${missing} 格。再領一次就好。` :
    extra ? `多領了 ${extra} 塊，沒關係，放在岸邊。` : '';
}

function walkAcross() {
  const index = activeSegment();
  const segment = state.bridge.segments[index];
  const hero = app.querySelector('.hero');
  walking = true;
  hero.style.transform = heroTransform(index + 1);
  setTimeout(() => {
    walking = false;
    segment.flagged = true;
    state.bridge.position = index + 1;
    earn(state, rewardFor('bridge'));
    if (index === 0) record(state, BRIDGE.width, segment.rows, 'explored');
    else {
      record(state, BRIDGE.width, segment.rows, segment.hint || segment.missed ? 'supported' : 'independent');
      state.eggDue = { step: state.step, session: state.session };
    }
    go({ view: 'bridge', celebrate: index });
  }, 1500);
}

const actions = {
  village: () => go({ view: 'village' }),
  parent: () => go({ view: 'parent' }),
  'village-place': el => go({ view: 'village', selected: Number(el.dataset.size) }),
  'select-place': el => go({ view: 'village', selected: Number(el.dataset.size) }),
  resume: () => {
    const active = state.active;
    if (active.view === 'mission') go(active, true);
    else go({ view: 'bridge' }, true);
  },
  bridge: () => go({ view: 'bridge' }, true),
  'bridge-next': () => go({ view: 'bridge' }, true),
  free: () => go({ view: 'free' }),
  today: () => openToday(),
  'today-more': () => openToday(true),
  'today-done': () => go({ view: 'today-done' }),
  pick: el => go({ view: 'pick', size: Number(el.dataset.size) }),
  start: el => startMission(route.size, Number(el.dataset.count)),
  'start-auto': () => startMission(route.size, autoCount(route.size)),
  upgrade: el => {
    upgrade(state, Number(el.dataset.size));
    render();
    app.querySelector('.plot.selected')?.classList.add('grow');
  },
  bundle: () => {
    const segment = state.bridge.segments[0];
    freshPlanks = placePlanks(segment, BRIDGE.width).used;
    render();
  },
  'bridge-hint': () => {
    const segment = state.bridge.segments[1];
    segment.hint++;
    segment.hintRows = segment.hintRows ?? 0;
    render();
  },
  'count-row': () => {
    const segment = state.bridge.segments[1];
    segment.hintRows = Math.min(segment.rows, (segment.hintRows ?? 0) + 1);
    render();
  },
  order: () => { orderPlanks(state.bridge.segments[1]); render(); },
  walk: () => walkAcross(),
  digit: el => { type(currentInput(), el.dataset.digit); render(); },
  erase: () => { const input = currentInput(); input.draft = input.draft.slice(0, -1); render(); },
  'free-size': el => { state.free.size = Number(el.dataset.size); render(); },
  'free-rows': el => {
    state.free.rows = Math.max(1, Math.min(9, state.free.rows + Number(el.dataset.change)));
    if (Number(el.dataset.change) > 0) freshRow = state.free.rows - 1;
    render();
  },
  'open-box': () => {
    const mission = missionOf(route);
    mission.opened = Math.min(route.count, mission.opened + 1);
    if (mission.mode === 'ask' && mission.hint < 2) mission.hint = 2;
    render();
  },
  hint: () => {
    const mission = missionOf(route);
    mission.hint++;
    if (mission.hint === 1) mission.opened = Math.max(mission.opened, 1);
    render();
  },
  answer: () => {
    const mission = missionOf(route);
    const value = Number(mission.draft);
    const total = route.size * route.count;
    const unit = PLACES[route.size].unit;
    mission.draft = '';
    if (value === total) {
      mission.outcome = outcomeOf(mission);
      mission.phase = 'ready';
      mission.feedback = '';
    } else {
      mission.missed = true;
      const more = hintButton(route.size, route.count, mission) ? '可以按下面的線索看看。' : '再想想看。';
      mission.feedback = `${value} ${unit}${value > total ? '太多了' : '不夠喔'}，${more}`;
    }
    render();
  },
  deliver: () => {
    const mission = missionOf(route);
    finishMission(mission, mission.mode === 'explore' ? 'explored' : mission.outcome ?? outcomeOf(mission));
  },
  skip: () => finishMission(missionOf(route), 'skipped'),
  'copy-backup': async () => {
    const field = app.querySelector('#backup-out');
    try {
      await navigator.clipboard.writeText(field.value);
      state.backupAt = Date.now();
      save();
      app.querySelector('.backup-date').textContent = backupDate();
      parentNote('已複製，可以貼到備忘錄保存。');
    } catch {
      field.select();
      parentNote('請長按上面的文字，選「拷貝」。');
    }
  },
  restore: () => {
    const saved = decodeBackup(app.querySelector('#backup-in').value);
    if (!saved) return parentNote('這段備份碼讀不出來，請確認有完整貼上。');
    if (!confirm('要用這個備份碼取代現在的進度嗎？')) return;
    state = revive(saved);
    go({ view: 'parent' });
    parentNote('已還原進度。');
  },
  reset: () => {
    if (!confirm('確定要清除所有進度嗎？建議先複製備份碼。')) return;
    state = freshState();
    go({ view: 'village' });
  },
};

function currentInput() {
  return route.view === 'bridge' ? state.bridge.segments[1] : missionOf(route);
}

function parentNote(message) {
  const note = app.querySelector('#parent-note');
  if (note) note.textContent = message;
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled || walking) return;
  const action = actions[target.dataset.action];
  if (action) action(target);
});

document.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('g[data-action]')) {
    event.preventDefault();
    event.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
});

render();

// 給測試用：在網址後面加 #debug 可以從主控台讀狀態。
if (location.hash === '#debug') window.kaimath = { get state() { return state; }, get route() { return route; } };
