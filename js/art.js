import { BRIDGE, MAX_LEVEL, PLACES, SIZES } from './data.js';
import { isUnlocked, isWeedy, segmentDone } from './model.js';

// 全部用方塊（rect）畫，維持麥塊風的像素感。
const r = (x, y, w, h, fill, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const text = (x, y, value, size, fill = '#2b2b2b', extra = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="middle" font-weight="800" ${extra}>${value}</text>`;
const svg = (w, h, body, extra = '') =>
  `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" ${extra}>${body}</svg>`;
const range = n => Array.from({ length: n }, (_, i) => i);

const GRASS = ['#8cc45a', '#94ca60', '#86bd55', '#90c75d'];
const WATER = ['#4cb4c8', '#52bccf', '#47adc1'];
const pick = (colors, x, y) => colors[Math.abs(x * 7 + y * 13 + x * y) % colors.length];

function plank(x, y, w, h, extra = '') {
  return `<g ${extra}>${r(x, y, w, h, '#b9824c')}${r(x, y, w, 3, '#d29a5e')}${r(x, y + h - 3, w, 3, '#8d5f35')}
    ${r(x + w * 0.25, y + h * 0.45, w * 0.4, 2, '#9c6a3d')}</g>`;
}

export function hero(x, y, extra = '', shirt = '#e2574c') {
  return `<g ${extra}><g transform="translate(${x} ${y})">
    ${r(-8, 22, 16, 4, 'rgba(0,0,0,.18)')}
    ${r(-6, 14, 5, 10, '#33495e')}${r(1, 14, 5, 10, '#33495e')}
    ${r(-8, 2, 16, 13, shirt)}${r(-11, 3, 3, 9, shirt)}${r(8, 3, 3, 9, shirt)}
    ${r(-7, -12, 14, 14, '#f0c08a')}${r(-7, -13, 14, 5, '#5a3b2e')}
    ${r(-4, -5, 2, 3, '#2b2b2b')}${r(2, -5, 2, 3, '#2b2b2b')}
  </g></g>`;
}

export function flag(x, y, raised = true) {
  return `<g transform="translate(${x} ${y})">${r(0, -30, 3, 32, '#6b5a3e')}
    ${raised ? `${r(3, -30, 18, 12, '#f2c14e')}${r(3, -22, 18, 4, '#e07b39')}` : ''}</g>`;
}

export function woodIcon() {
  return svg(16, 16, `${r(1, 4, 14, 9, '#9c6a3d')}${r(1, 4, 14, 2, '#c8894d')}${r(12, 4, 3, 9, '#e3b47a')}
    ${r(13, 6, 1, 5, '#b77d45')}${r(3, 8, 7, 1, '#7d522c')}`, 'class="wood-icon" aria-hidden="true"');
}

// 小圖示：用在箱子標籤、地點招牌。
export function propIcon(kind, x = 0, y = 0, s = 1) {
  const p = (px, py, w, h, fill) => r(x + px * s, y + py * s, w * s, h * s, fill);
  const shapes = {
    shoe: `${p(1, 7, 7, 4, '#c8553d')}${p(1, 4, 4, 4, '#c8553d')}${p(1, 11, 8, 2, '#4a3328')}${p(9, 7, 6, 4, '#c8553d')}${p(9, 4, 4, 4, '#c8553d')}${p(9, 11, 7, 2, '#4a3328')}`,
    trike: `${p(6, 1, 4, 5, '#333')}${p(4, 6, 8, 2, '#c8553d')}${p(7, 6, 2, 6, '#c8553d')}${p(2, 11, 12, 2, '#c8553d')}${p(1, 9, 3, 6, '#333')}${p(12, 9, 3, 6, '#333')}`,
    car: `${p(4, 2, 8, 12, '#8f6bd1')}${p(5, 4, 6, 3, '#cfe8f5')}${p(2, 3, 2, 4, '#333')}${p(12, 3, 2, 4, '#333')}${p(2, 10, 2, 4, '#333')}${p(12, 10, 2, 4, '#333')}`,
    coin: `${p(4, 2, 8, 12, '#e8b730')}${p(2, 4, 12, 8, '#e8b730')}${p(5, 4, 6, 8, '#f6d36b')}${p(7, 5, 3, 1, '#9a6a12')}${p(7, 5, 1, 3, '#9a6a12')}${p(7, 7, 3, 1, '#9a6a12')}${p(9, 8, 1, 2, '#9a6a12')}${p(7, 10, 3, 1, '#9a6a12')}`,
    egg: `${p(1, 8, 14, 6, '#b5793f')}${p(2, 4, 3, 5, '#fbf2dc')}${p(6, 4, 4, 5, '#fbf2dc')}${p(11, 4, 3, 5, '#fbf2dc')}`,
    week: `${p(1, 2, 14, 12, '#f4f1e6')}${p(1, 2, 14, 3, '#d9534f')}${range(3).map(i => p(3 + i * 4, 7, 2, 2, '#4fa88a')).join('')}${range(3).map(i => p(3 + i * 4, 10, 2, 2, '#4fa88a')).join('')}`,
    octopus: `${p(3, 1, 10, 8, '#e0708a')}${p(5, 4, 2, 2, '#2b2b2b')}${p(9, 4, 2, 2, '#2b2b2b')}${range(4).map(i => p(3 + i * 3, 9, 2, 6, '#e0708a')).join('')}`,
    board: `${p(1, 1, 14, 14, '#5d6f82')}${range(9).map(i => p(2 + (i % 3) * 4.4, 2 + Math.floor(i / 3) * 4.4, 3.6, 3.6, i % 2 ? '#c9d6e3' : '#f4f1e6')).join('')}`,
  };
  return shapes[kind] ?? '';
}

// 關著的一組：箱子上寫每組有幾個。
export function closedGroup(size, place) {
  return svg(120, 96, `${r(14, 18, 92, 70, '#a8723f')}${r(14, 18, 92, 6, '#c68c51')}
    ${range(3).map(i => r(14, 38 + i * 18, 92, 2, '#8a5a2f')).join('')}
    ${r(10, 12, 100, 10, '#8a5a2f')}${r(34, 34, 52, 40, '#fbf6e8')}
    ${text(60, 66, size, 30, '#3d2a17')}${propIcon(place.kind, 88, 70, 1)}`, 'class="art" aria-hidden="true"');
}

const DAYS = '一二三四五六日';

// 打開的一組：每個要數的東西都畫成一個看得出來的方塊。
export function openGroup(size, place, delivered = false) {
  const kind = place.kind;
  const body = {
    shoe: () => range(2).map(i => {
      const x = 10 + i * 54;
      return `${r(x, 50, 34, 18, '#c8553d')}${r(x, 32, 18, 20, '#c8553d')}${r(x + 4, 36, 10, 3, '#fff')}${r(x + 4, 42, 10, 3, '#fff')}
        ${r(x, 68, 46, 8, '#4a3328')}${r(x + 34, 56, 12, 12, '#c8553d')}`;
    }).join('') + (delivered ? r(4, 78, 112, 14, '#b5793f') : ''),
    trike: () => `${r(54, 6, 12, 22, '#333')}${r(57, 12, 6, 10, '#777')}${r(36, 30, 48, 5, '#c8553d')}
      ${r(57, 30, 6, 36, '#c8553d')}${r(48, 50, 24, 10, '#5a3b2e')}${r(24, 64, 72, 6, '#c8553d')}
      ${r(14, 54, 12, 24, '#333')}${r(17, 60, 6, 12, '#777')}${r(94, 54, 12, 24, '#333')}${r(97, 60, 6, 12, '#777')}`,
    car: () => `${r(34, 10, 52, 76, place.color)}${r(40, 18, 40, 14, '#cfe8f5')}${r(40, 66, 40, 10, '#cfe8f5')}
      ${[[20, 16], [86, 16], [20, 60], [86, 60]].map(([x, y]) => `${r(x, y, 14, 20, '#333')}${r(x + 4, y + 5, 6, 10, '#777')}`).join('')}`,
    coin: () => `${r(42, 4, 36, 40, '#e8b730')}${r(36, 10, 48, 28, '#e8b730')}${r(46, 10, 28, 28, '#f6d36b')}
      ${text(60, 34, 5, 22, '#8a5a0c')}${range(5).map(i => `${r(8 + i * 22, 58, 18, 18, '#f6e2a0', 'stroke="#b8902f" stroke-width="2"')}${text(17 + i * 22, 71, 1, 11, '#8a5a0c')}`).join('')}
      ${text(60, 92, '5 元', 11, '#8a5a0c')}`,
    egg: () => `${r(4, 40, 112, 14, '#8a5a2f')}
      ${range(6).map(i => { const x = 5 + i * 18.5;
        return `${r(x + 3, 22, 11, 32, '#a07a4a')}${r(x + 1, 27, 15, 24, '#a07a4a')}
          ${r(x + 4, 23, 9, 30, '#f7e7c4')}${r(x + 2, 28, 13, 22, '#f7e7c4')}${r(x + 4, 27, 3, 7, '#fffdf6')}`; }).join('')}
      ${r(4, 50, 112, 34, '#b5793f')}${r(4, 50, 112, 5, '#cf9455')}${r(4, 66, 112, 2, '#9c6a3d')}
      ${delivered ? `${r(4, 14, 112, 8, '#cf9455')}${r(4, 14, 4, 36, '#cf9455')}${r(112, 14, 4, 36, '#cf9455')}` : ''}`,
    week: () => `${r(2, 18, 116, 66, '#f4f1e6')}${r(2, 18, 116, 14, '#d9534f')}${text(60, 29, '一週', 10, '#fff')}
      ${range(7).map(i => { const x = 4 + i * 16.3; return `${r(x, 36, 14.5, 44, '#fff', 'stroke="#d7d0bd" stroke-width="1"')}${text(x + 7.2, 50, DAYS[i], 10, '#555')}
        ${delivered ? `${r(x + 3, 58, 9, 9, '#f2c14e')}${r(x + 5, 56, 5, 13, '#f2c14e')}` : ''}`; }).join('')}`,
    octopus: () => `${r(32, 4, 56, 36, '#e0708a')}${r(28, 14, 64, 24, '#e0708a')}${r(44, 16, 8, 8, '#fff')}${r(68, 16, 8, 8, '#fff')}
      ${r(47, 19, 4, 4, '#2b2b2b')}${r(71, 19, 4, 4, '#2b2b2b')}
      ${range(8).map(i => { const x = 10 + i * 13; const wave = i % 2 ? 4 : 0;
        return `${r(x, 38, 8, 30 + wave, '#e0708a')}${r(x + (i < 4 ? -2 : 2), 66 + wave, 8, 8, '#e0708a')}
          ${delivered ? `${r(x - 1, 62 + wave, 10, 14, '#4fa8d9')}${r(x - 1, 66 + wave, 10, 3, '#fff')}` : ''}`; }).join('')}`,
    board: () => `${r(24, 6, 72, 72, '#5d6f82')}${range(9).map(i => { const x = 27 + (i % 3) * 23; const y = 9 + Math.floor(i / 3) * 23;
      return r(x, y, 20, 20, delivered ? (i % 2 ? '#c9a46e' : '#e6c690') : '#e9eef3'); }).join('')}`,
  }[kind]();
  return svg(120, 96, body, 'class="art" aria-hidden="true"');
}

// ── 修橋地圖：由下往上鋪，第一段 2 排、小島、第二段 3 排、對岸。
const T = 40;
const COLS = 8;
const ROWS = 11;
// 每段由近到遠的格子列（畫面上的第幾列）。
const SEGMENT_ROWS = [[8, 7], [4, 3, 2]];
const STOPS = [10, 5.5, 0.6];

export function heroStop(position) {
  return { x: 4 * T, y: STOPS[position] * T };
}

export const heroTransform = position => {
  const { x, y } = heroStop(position);
  return `translate(${x}px,${y}px)`;
};

export function bridgeScene(bridge, view) {
  const { segment: active, hintRows = 0, focusRow = false, knownRow = false } = view;
  let ground = '';
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const water = (y >= 2 && y <= 4) || (y >= 7 && y <= 8);
      ground += r(x * T, y * T, T, T, water ? pick(WATER, x, y) : pick(GRASS, x, y));
      if (water && (x + y) % 3 === 0) ground += r(x * T + 8, y * T + 18, 14, 3, '#8fdbe6');
      if (!water && x >= 1 && x <= 6) ground += r(x * T, y * T, T, T, pick(['#e3c28a', '#dcb97e', '#e8c993'], x, y));
    }
  }
  let deck = '';
  bridge.segments.forEach((segment, index) => {
    const rows = SEGMENT_ROWS[index];
    rows.forEach((gridY, rowIndex) => {
      for (let i = 0; i < BRIDGE.width; i++) {
        const n = rowIndex * BRIDGE.width + i;
        const x = (1 + i) * T;
        const y = gridY * T;
        if (n < segment.planks) {
          const fresh = index === active && n >= segment.planks - (view.fresh ?? 0);
          deck += plank(x + 1, y + 1, T - 2, T - 2, fresh ? `class="drop" style="animation-delay:${(n % BRIDGE.width) * 60}ms"` : '');
        } else {
          const missing = index === active && segment.planks > 0;
          deck += r(x + 3, y + 3, T - 6, T - 6, missing ? 'rgba(255,240,170,.35)' : 'rgba(255,255,255,.12)',
            `stroke="${missing ? '#ffe27a' : 'rgba(255,255,255,.7)'}" stroke-width="2" stroke-dasharray="5 4" ${missing ? 'class="blink"' : ''}`);
        }
        if (index === active && focusRow && rowIndex === 0) {
          deck += text(x + T / 2, y + 26, i + 1, 16, '#5a2d00') + r(x + 2, y + 2, T - 4, T - 4, 'none', 'stroke="#ff9f1c" stroke-width="3"');
        }
      }
      if (index === active && rowIndex < hintRows) {
        deck += `${r(7 * T + 2, gridY * T + 6, T - 4, T - 12, '#fff7d6', 'stroke="#ff9f1c" stroke-width="2"')}${text(7.5 * T, gridY * T + 27, BRIDGE.width * (rowIndex + 1), 15, '#7a4300')}`;
      }
      if (index === active && view.countRows && rowIndex >= hintRows && !segmentDone(segment)) {
        deck += `<rect x="${T}" y="${gridY * T}" width="${BRIDGE.width * T}" height="${T}" fill="rgba(255,230,120,.22)" stroke="#ffe27a" stroke-width="3" stroke-dasharray="8 5" data-action="count-row" data-row="${rowIndex}" class="tap-row blink"/>`;
      }
    });
    const [near] = rows;
    const far = rows[rows.length - 1];
    if (segmentDone(segment)) {
      deck += r(T - 4, far * T, 4, (near - far + 1) * T, '#6e4724') + r(7 * T, far * T, 4, (near - far + 1) * T, '#6e4724');
    }
    if (index === 0 && knownRow && index !== active && segmentDone(segment)) {
      deck += `${r(T - 6, far * T - 2, BRIDGE.width * T + 12, rows.length * T + 4, 'none', 'stroke="#ff9f1c" stroke-width="4"')}
        ${r(2.2 * T, 7.5 * T - 14, 3.6 * T, 28, '#fff7d6')}${text(4 * T, 7.5 * T + 7, `${BRIDGE.width}×2＝12`, 18, '#7a4300')}`;
    }
  });
  const flags = `${bridge.segments[0].flagged ? flag(6.6 * T, 6.6 * T) : ''}${bridge.segments[1].flagged ? flag(6.6 * T, 1.6 * T) : ''}`;
  const extra = bridge.segments[active]?.extra ?? 0;
  const pile = extra ? `${range(Math.min(extra, 5)).map(i => plank(6.6 * T - i * 3, 9.6 * T - i * 7, 32, 9)).join('')}
    ${text(7.1 * T, 10.8 * T, `多 ${extra} 塊`, 13, '#5a2d00')}` : '';
  const stop = heroStop(bridge.position);
  return svg(COLS * T, ROWS * T, `${ground}${deck}${flags}${pile}
    ${hero(0, 0, `class="hero" style="transform:translate(${stop.x}px,${stop.y}px)"`)}`,
  'class="bridge-svg" role="img" aria-label="修橋地圖"');
}


// 自由蓋橋：每排幾格、共幾排都可以調，右邊標出累計。
export function freeScene(size, rows, freshRow) {
  const S = 36;
  const cols = size + 3;
  const height = rows + 2;
  let body = '';
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < cols; x++) {
      const water = y > 0 && y <= rows;
      body += r(x * S, y * S, S, S, water ? pick(WATER, x, y) : pick(GRASS, x, y));
    }
  }
  for (let row = 0; row < rows; row++) {
    const y = (rows - row) * S;
    const fresh = row === freshRow;
    for (let i = 0; i < size; i++) {
      body += plank((1 + i) * S + 1, y + 1, S - 2, S - 2, fresh ? `class="drop" style="animation-delay:${i * 50}ms"` : '');
    }
    body += `${r((size + 1) * S + 4, y + 5, S + 22, S - 10, '#fff7d6')}${text((size + 1.5) * S + 15, y + 24, size * (row + 1), 15, '#7a4300')}`;
  }
  return svg(cols * S, height * S, body, `class="free-svg" role="img" aria-label="每排 ${size} 格，共 ${rows} 排，一共 ${size * rows} 塊木板"`);
}

// ── 村莊地圖：河的這岸是 2～5，過橋到對岸是 6～9。
const PLOTS = {
  6: [20, 18], 7: [190, 18], 8: [450, 18], 9: [620, 18],
  2: [20, 318], 3: [190, 318], 4: [450, 318], 5: [620, 318],
};

// 🌿 長草：幾叢比地面深的草，長在空地上，看得出來這裡沒人管。輕輕搖，讓孩子注意到。
function weeds(x, y) {
  const tuft = (tx, ty, h, delay) =>
    `<g class="weed" style="animation-delay:${delay}ms">
      ${r(tx + 4, ty, 4, h, '#3f7a2c')}${r(tx, ty + 5, 4, h - 5, '#56993d')}${r(tx + 8, ty + 7, 4, h - 7, '#56993d')}
      ${r(tx + 4, ty, 4, 4, '#6fb84e')}</g>`;
  return [[x + 6, y + 142, 26], [x + 32, y + 150, 20], [x + 68, y + 154, 16],
    [x + 104, y + 146, 24], [x + 134, y + 140, 28]]
    .map(([tx, ty, h], i) => tuft(tx, ty, h, i * 240)).join('');
}

function building(size, level, selected, locked = false, weedy = false) {
  const place = PLACES[size];
  const [x, y] = PLOTS[size];
  const parts = [];
  parts.push(r(x, y, 160, 180, 'transparent'));
  if (level === 0) {
    parts.push(r(x + 30, y + 70, 100, 70, '#c9a46e'), r(x + 30, y + 70, 100, 4, '#b48e58'));
    for (let i = 0; i < 4; i++) parts.push(r(x + 40 + i * 22, y + 90 + (i % 2) * 18, 10, 6, '#a88550'));
    parts.push(r(x + 76, y + 40, 6, 40, '#6b5a3e'), r(x + 58, y + 30, 42, 28, '#d9b27c'), r(x + 58, y + 30, 42, 4, '#b48e58'));
    parts.push(text(x + 79, y + 52, size, 20, '#5a3b2e'));
  } else {
    const wall = '#f1e2c2';
    parts.push(r(x + 30, y + 72, 100, 70, wall), r(x + 30, y + 132, 100, 10, '#c9b48d'));
    parts.push(r(x + 20, y + 54, 120, 22, place.color), r(x + 34, y + 38, 92, 18, place.color), r(x + 50, y + 26, 60, 14, place.color));
    parts.push(r(x + 20, y + 72, 120, 4, 'rgba(0,0,0,.18)'));
    parts.push(r(x + 68, y + 100, 24, 42, '#7a5233'), r(x + 86, y + 120, 3, 3, '#f2c14e'));
    parts.push(r(x + 40, y + 90, 20, 18, '#a9d8ea'), r(x + 100, y + 90, 20, 18, '#a9d8ea'));
    parts.push(r(x + 62, y + 58, 36, 16, '#fbf6e8'), propIcon(place.kind, x + 72, y + 58, 1));
    if (level >= 2) {
      for (let i = 0; i < 8; i++) parts.push(r(x + 6 + i * 20, y + 150, 5, 18, '#a8723f'));
      parts.push(r(x + 6, y + 155, 150, 4, '#a8723f'));
      parts.push(propIcon(place.kind, x + 128, y + 116, 1.8));
      parts.push(r(x + 8, y + 136, 6, 6, '#f26b8a'), r(x + 18, y + 140, 6, 6, '#f2c14e'));
    }
    if (level >= 3) {
      parts.push(hero(x + 20, y + 112, '', place.color));
      parts.push(r(x + 124, y + 4, 3, 26, '#6b5a3e'), r(x + 127, y + 4, 20, 12, '#f2c14e'));
    }
  }
  const nameplate = `${r(x, y - 6, 120, 26, 'rgba(251,246,232,.95)')}${text(x + 60, y + 13, `${size} ${place.name}`, size === 3 ? 14 : 17, '#3d2a17')}`;
  const stars = range(MAX_LEVEL).map(i => r(x + 52 + i * 20, y + 172, 14, 8, i < level ? '#f2c14e' : 'rgba(0,0,0,.18)')).join('');
  // 對岸還過不去的時候，蓋一層霧，只看得到輪廓。
  const fog = locked ? `${r(x - 4, y - 12, 168, 202, 'rgba(226,241,247,.76)')}
    ${r(x + 8, y + 94, 144, 28, 'rgba(251,246,232,.92)')}
    ${text(x + 80, y + 113, '修好橋才過得去', 15, '#4a6b7a')}` : '';
  const label = locked ? '在河的對岸，還過不去' : `第 ${level} 級${weedy ? '，長草了' : ''}`;
  return `<g class="plot ${selected ? 'selected' : ''} ${locked ? 'locked' : ''}" data-action="select-place" data-size="${size}" role="button" tabindex="0"
      aria-label="${size} 的乘法，${place.name}，${label}">
    ${selected ? r(x - 4, y - 4, 168, 190, 'none', 'stroke="#fff" stroke-width="5" stroke-dasharray="14 8"') : ''}
    ${parts.join('')}${weedy ? weeds(x, y) : ''}${nameplate}${stars}${fog}</g>`;
}

// 小人在村莊裡站的位置：點哪個地方就走到那家門口。對岸還過不去時，只走到橋頭。
const VILLAGE_HOME = { x: 400, y: 470 };
const BRIDGE_FOOT = { x: 400, y: 334 };
const BRIDGE_TOP = { x: 400, y: 206 };
// 這條線以上是對岸，要過河就得走橋。
const RIVER_Y = 310;

export function villageHeroStop(state, selected) {
  if (!selected || !PLOTS[selected]) return VILLAGE_HOME;
  if (!isUnlocked(state, selected)) return BRIDGE_FOOT;
  const [x, y] = PLOTS[selected];
  return { x: x + 80, y: y + 134 };
}

// 要去對岸就先走到橋頭，再從橋上過去，不會直接從水面上穿過去。
export function villageHeroPath(from, to) {
  if ((from.y > RIVER_Y) === (to.y > RIVER_Y)) return [to];
  return from.y > RIVER_Y ? [BRIDGE_FOOT, BRIDGE_TOP, to] : [BRIDGE_TOP, BRIDGE_FOOT, to];
}

export function villageScene(state, selected, heroAt = VILLAGE_HOME) {
  let ground = '';
  for (let y = 0; y < 26; y++) {
    for (let x = 0; x < 40; x++) {
      const water = y >= 11 && y <= 14;
      const road = x >= 18 && x <= 21 && !water;
      ground += r(x * 20, y * 20, 20, 20, water ? pick(WATER, x, y) : road ? pick(['#e3c28a', '#dcb97e'], x, y) : pick(GRASS, x, y));
      if (water && (x + y) % 4 === 0) ground += r(x * 20 + 4, y * 20 + 9, 9, 2, '#8fdbe6');
    }
  }
  const [first, second] = state.bridge.segments;
  let bridge = '';
  const segmentArt = (segment, rows, startY) => {
    const filled = Math.min(segment.planks, segment.rows * BRIDGE.width);
    for (let n = 0; n < filled; n++) {
      const row = Math.floor(n / BRIDGE.width);
      const col = n % BRIDGE.width;
      bridge += plank(363 + col * 12.5, startY - row * 16 - 16, 12, 15);
    }
    for (let n = filled; n < rows * BRIDGE.width; n++) {
      const row = Math.floor(n / BRIDGE.width);
      const col = n % BRIDGE.width;
      bridge += r(364 + col * 12.5, startY - row * 16 - 15, 10, 13, 'rgba(255,255,255,.15)', 'stroke="rgba(255,255,255,.6)" stroke-dasharray="3 3"');
    }
  };
  segmentArt(first, 2, 300);
  segmentArt(second, 3, 268);
  bridge = `<g data-action="bridge" role="button" tabindex="0" aria-label="修橋" class="plot">${r(355, 210, 90, 100, 'transparent')}${bridge}
    ${first.flagged ? flag(452, 292) : ''}${second.flagged ? flag(452, 222) : ''}</g>`;
  const plots = SIZES.map(size => building(size, state.levels[size], selected === size,
    !isUnlocked(state, size), isWeedy(state, size))).join('');
  const walker = hero(0, 0, `class="hero walker" style="transform:translate(${heroAt.x}px,${heroAt.y}px)"`);
  return svg(800, 520, `${ground}${bridge}${plots}${walker}`, 'class="village-svg" role="group" aria-label="村莊地圖"');
}
