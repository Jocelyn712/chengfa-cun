// 每個乘法一個村莊地點。題目一律是「每組幾個 × 有幾組」。
export const PLACES = {
  2: {
    name: '鞋店', kind: 'shoe', color: '#d9785b',
    group: '雙', item: '隻鞋', unit: '隻',
    each: '一雙鞋有 2 隻',
    ask: n => `裝 ${n} 雙鞋進貨箱，一共幾隻鞋？`,
    deliver: '裝箱出貨', done: '鞋子都裝箱了！',
  },
  3: {
    name: '三輪車修理站', kind: 'trike', color: '#5b8fd9',
    group: '台', item: '個輪子', unit: '個',
    each: '一台三輪車有 3 個輪子',
    ask: n => `修好 ${n} 台三輪車，一共要幾個輪子？`,
    deliver: '裝上輪子', done: '三輪車都修好了！',
  },
  4: {
    name: '車庫', kind: 'car', color: '#8f6bd1',
    group: '台', item: '個輪胎', unit: '個',
    each: '一台小汽車有 4 個輪胎',
    ask: n => `幫 ${n} 台小汽車換輪胎，一共要幾個輪胎？`,
    deliver: '換好輪胎', done: '小汽車都換好輪胎了！',
  },
  5: {
    name: '市集', kind: 'coin', color: '#e0a92e',
    group: '枚', item: '元', unit: '元',
    each: '一枚五元硬幣值 5 元',
    ask: n => `你有 ${n} 枚五元硬幣，一共是幾元？`,
    deliver: '去市集付錢', done: '在市集買好東西了！',
  },
  6: {
    name: '雞舍', kind: 'egg', color: '#e8c35a',
    group: '盒', item: '顆蛋', unit: '顆',
    each: '一盒有 6 顆蛋',
    ask: n => `送 ${n} 盒蛋給村民，一共幾顆蛋？`,
    deliver: '把蛋送出去', done: '村民收到雞蛋了！',
  },
  7: {
    name: '活動中心', kind: 'week', color: '#4fa88a',
    group: '週', item: '張貼紙', unit: '張',
    each: '一週有 7 天，每天貼 1 張貼紙',
    ask: n => `活動有 ${n} 週，每天貼一張，一共要幾張貼紙？`,
    deliver: '貼上週曆', done: '活動週曆貼好了！',
  },
  8: {
    name: '章魚池', kind: 'octopus', color: '#d9607a',
    group: '隻', item: '隻襪子', unit: '隻',
    each: '一隻章魚有 8 隻腳，每隻腳穿 1 隻襪子',
    ask: n => `幫 ${n} 隻章魚穿襪子，一共要幾隻襪子？`,
    deliver: '幫章魚穿襪子', done: '章魚都穿好襪子了！',
  },
  9: {
    name: '棋盤廣場', kind: 'board', color: '#7a8fa6',
    group: '張', item: '塊地磚', unit: '塊',
    each: '一張井字棋盤有 9 格，每格鋪 1 塊地磚',
    ask: n => `鋪好 ${n} 張棋盤，一共要幾塊地磚？`,
    deliver: '鋪好棋盤', done: '棋盤廣場鋪好了！',
  },
};

export const SIZES = [2, 3, 4, 5, 6, 7, 8, 9];
export const NEW_SIZES = [6, 7, 8, 9];

// 地點升級：第 1、2、3 級各要幾塊木材。第 3 級會有村民搬進來。
export const UPGRADE_COST = [3, 6, 9];
export const MAX_LEVEL = UPGRADE_COST.length;

export const VILLAGERS = {
  2: '鞋匠阿布', 3: '修車的小輪', 4: '車庫的阿駕', 5: '市集的金金',
  6: '養雞的蛋蛋', 7: '活動的週週', 8: '章魚阿八', 9: '棋王九九',
};

export const REWARD = { independent: 3, supported: 2, explored: 2, bridge: 3 };

// 修橋：每排 6 格，第一段 2 排、第二段 3 排。
export const BRIDGE = { width: 6, segments: [2, 3] };
