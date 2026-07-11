// ピース生成・形状分類・ダメージ計算などの純粋ロジック
window.CCB = window.CCB || {};

(function(CCB){
  const N = 8;
  const COLORS = ['#ff5252','#4fc3f7','#66bb6a','#ffd54f'];

  // 回復ブロック: 色マッチには参加しない特殊マス。消えるマスに隣接していると
  // 一緒に消えて「消したマス数」分だけHPを回復する。
  const HEAL = 'HEAL';
  const HEAL_BG = 'radial-gradient(circle at 35% 30%, #ffffff, #7cffb2 45%, #22c55e 90%)';
  const HEAL_CHANCE = 1/3; // ミノ1個ごとに独立でこの確率(上限なし)
  function cellBg(v){
    if(!v) return '';
    return v === HEAL ? HEAL_BG : v;
  }

  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]] = [arr[j],arr[i]];
    }
    return arr;
  }

  function genShape(size){
    const cells = [[0,0]];
    const occupied = new Set(['0,0']);
    let guard = 0;
    while(cells.length < size && guard < 500){
      guard++;
      const base = cells[Math.floor(Math.random()*cells.length)];
      const dirs = shuffle([[1,0],[-1,0],[0,1],[0,-1]]);
      let added = false;
      for(const [dr,dc] of dirs){
        const nr = base[0]+dr, nc = base[1]+dc;
        const key = nr+','+nc;
        if(!occupied.has(key)){
          cells.push([nr,nc]); occupied.add(key); added = true; break;
        }
      }
      if(!added){
        outer:
        for(const [br,bc] of cells){
          for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
            const nr = br+dr, nc = bc+dc, key = nr+','+nc;
            if(!occupied.has(key)){ cells.push([nr,nc]); occupied.add(key); break outer; }
          }
        }
      }
    }
    const minR = Math.min(...cells.map(c=>c[0])), minC = Math.min(...cells.map(c=>c[1]));
    return cells.map(([r,c]) => [r-minR, c-minC]);
  }

  // ブロック数が多いほど出現率が上がるようにする(1:2:3:4マス = 10:20:30:40%)
  const SIZE_WEIGHTS = [ [1,1], [2,2], [3,3], [4,4] ];
  function pickSize(){
    const total = SIZE_WEIGHTS.reduce((sum, [,w]) => sum + w, 0);
    let roll = Math.random() * total;
    for(const [size, w] of SIZE_WEIGHTS){
      if(roll < w) return size;
      roll -= w;
    }
    return SIZE_WEIGHTS[SIZE_WEIGHTS.length - 1][0];
  }

  function genPiece(){
    const size = pickSize();
    const cells = genShape(size);
    const colors = cells.map(() => COLORS[Math.floor(Math.random()*COLORS.length)]);
    if(Math.random() < HEAL_CHANCE){
      colors[Math.floor(Math.random()*colors.length)] = HEAL;
    }
    return { cells, colors, id: Math.random().toString(36).slice(2) };
  }

  function pieceBBox(cells){
    const w = Math.max(...cells.map(c=>c[1])) + 1;
    const h = Math.max(...cells.map(c=>c[0])) + 1;
    return {w,h};
  }

  // ---- shape classification for "技" ----
  function normalize(cells){
    const minR = Math.min(...cells.map(c=>c[0])), minC = Math.min(...cells.map(c=>c[1]));
    return cells.map(([r,c]) => [r-minR, c-minC]).sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  }
  function shapeKey(cells){ return normalize(cells).map(c => c[0]+','+c[1]).join(';'); }
  function rot90(cells){ return cells.map(([r,c]) => [c,-r]); }
  function reflectH(cells){ return cells.map(([r,c]) => [r,-c]); }
  function allOrientKeys(base){
    const keys = new Set();
    let cur = base;
    for(let f=0; f<2; f++){
      for(let i=0;i<4;i++){ keys.add(shapeKey(cur)); cur = rot90(cur); }
      cur = reflectH(base);
    }
    return keys;
  }

  const TETROMINO = {
    I: { cells:[[0,0],[0,1],[0,2],[0,3]], name:'ライン・ブレイク', mult:1.3 },
    O: { cells:[[0,0],[0,1],[1,0],[1,1]], name:'スクエアクラッシュ', mult:1.3 },
    T: { cells:[[0,0],[0,1],[0,2],[1,1]], name:'Tフォーム', mult:1.15 },
    S: { cells:[[0,1],[0,2],[1,0],[1,1]], name:'Sツイスト', mult:1.15 },
    Z: { cells:[[0,0],[0,1],[1,1],[1,2]], name:'Zツイスト', mult:1.15 },
    J: { cells:[[0,0],[1,0],[1,1],[1,2]], name:'Jフック', mult:1.15 },
    L: { cells:[[0,2],[1,0],[1,1],[1,2]], name:'Lフック', mult:1.15 },
  };
  const TETROMINO_LOOKUP = {};
  for(const [k,v] of Object.entries(TETROMINO)){
    for(const key of allOrientKeys(v.cells)) TETROMINO_LOOKUP[key] = { name:v.name, mult:v.mult };
  }
  const PLUS5 = [[0,1],[1,0],[1,1],[1,2],[2,1]];
  const PLUS5_KEYS = allOrientKeys(PLUS5);

  function classifyShape(cellsRaw){
    const cells = normalize(cellsRaw);
    const size = cells.length;
    const allSameRow = cells.every(c => c[0]===cells[0][0]);
    const allSameCol = cells.every(c => c[1]===cells[0][1]);
    if(allSameRow || allSameCol){
      return { name:'ライン・ブレイク', mult: 1.2 + 0.05*(size-4) };
    }
    if(size===4){
      const hit = TETROMINO_LOOKUP[shapeKey(cells)];
      if(hit) return hit;
    }
    if(size===5 && PLUS5_KEYS.has(shapeKey(cells))){
      return { name:'クロスバースト', mult:1.4 };
    }
    return { name:'フリーフォーム', mult:1.0 };
  }

  function calcDamage(groups){
    let total = 0;
    const names = [];
    groups.forEach(g => {
      const size = g.cells.length;
      const base = size===4 ? 10 : size===5 ? 16 : size===6 ? 24 : 34;
      const shape = classifyShape(g.cells);
      const dmg = Math.round(base * shape.mult);
      total += dmg;
      names.push(shape.name + ' ' + dmg);
    });
    if(groups.length > 1){
      const bonus = (groups.length-1) * 8;
      total += bonus;
      names.push('同時消し +' + bonus);
    }
    return { total, names };
  }

  CCB.N = N;
  CCB.COLORS = COLORS;
  CCB.HEAL = HEAL;
  CCB.cellBg = cellBg;
  CCB.genPiece = genPiece;
  CCB.pieceBBox = pieceBBox;
  CCB.classifyShape = classifyShape;
  CCB.calcDamage = calcDamage;
})(window.CCB);
