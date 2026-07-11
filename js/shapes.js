// ピース生成・形状分類・ダメージ計算などの純粋ロジック
window.CCB = window.CCB || {};

(function(CCB){
  const N = 8;
  // Two Dots/スイカゲーム的な彩度高めの5色パレット
  const COLORS = ['#FF6B9D','#4ECDC4','#FFE66D','#A78BFA','#FF9F5B'];

  // 回復ブロック: 色マッチには参加しない特殊マス。消えるマスに隣接していると
  // 一緒に消えて「消したマス数」分だけHPを回復する。
  // 通常色にピンクを使うようになったため、紛らわしくないよう赤系のハートにする。
  const HEAL = 'HEAL';
  const HEAL_HEART_SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 29'>" +
    "<path d='M16 29C16 29 0 18.2 0 8.6 0 3.5 4.1 0 8.7 0 12.2 0 15 2.1 16 5.1 17 2.1 19.8 0 23.3 0 27.9 0 32 3.5 32 8.6 32 18.2 16 29 16 29Z' fill='white' stroke='#c22a42' stroke-width='1'/>" +
    "<ellipse cx='10.5' cy='7.5' rx='3' ry='1.8' fill='white' fill-opacity='0.85' transform='rotate(-30 10.5 7.5)'/>" +
    "</svg>";
  const HEAL_GRADIENT = 'linear-gradient(145deg, #ff8a8a, #e63950 65%, #c22a42)';
  const HEAL_BG = 'url("data:image/svg+xml,' + encodeURIComponent(HEAL_HEART_SVG) + '") center/58% no-repeat, ' + HEAL_GRADIENT;
  const HEAL_CHANCE = 1/3; // ミノ1個ごとに独立でこの確率(上限なし)

  // 通常色のブロックにツヤ感を出すための重ねがけ(単色べた塗りだと安っぽく見えるため)。
  const GEM_SHEEN =
    'radial-gradient(circle at 28% 22%, rgba(255,255,255,0.75), rgba(255,255,255,0) 42%), ' +
    'linear-gradient(155deg, rgba(255,255,255,0.28), rgba(0,0,0,0.32) 88%), ';
  // flat=trueの場合はツヤ感を付けない(色を完全一致させて、隣と繋がった時に
  // 境目にグラデーションのズレが見えないようにするため)
  function cellBg(v, flat){
    if(!v) return '';
    if(v === HEAL) return HEAL_BG;
    return flat ? v : (GEM_SHEEN + v);
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

  // ピースは基本的に1色(狙って並べやすくするため)だが、たまに一部のマスだけ
  // 別の色が混ざる(全マス同色だと簡単すぎるため、少しだけ計画を崩す要素を残す)。
  const OFF_COLOR_CHANCE = 0.25;
  function genPiece(){
    const size = pickSize();
    const cells = genShape(size);
    const primary = COLORS[Math.floor(Math.random()*COLORS.length)];
    const colors = cells.map(() => {
      if(Math.random() < OFF_COLOR_CHANCE){
        const others = COLORS.filter(c => c !== primary);
        return others[Math.floor(Math.random()*others.length)];
      }
      return primary;
    });
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

  // 技は5マス以上の消し方にのみ付く。4マス消しは形によらず技名なし。
  // 倍率は「回転・反転させたときに何通りの見た目になるか」を難易度の基準にする。
  // 見た目のパターンが少ない(対称性が高い)ほど狙って作りやすい=倍率低め、
  // 8パターン全部バラバラ(対称性なし)なほど難しい=倍率高め。7マス以上はサイズで別枠。
  const NAMED_SHAPES = [
    // 1パターンのみ(完全対称) — 最も易しい
    { cells:[[0,1],[1,0],[1,1],[1,2],[2,1]], name:'クロスバースト', mult:1.3 },
    // 4パターン(線対称) — 中間
    { cells:[[0,0],[0,1],[0,2],[1,1],[2,1]], name:'Tプラント', mult:1.45 },
    { cells:[[0,0],[0,2],[1,0],[1,1],[1,2]], name:'ホースシュー', mult:1.45 },
    { cells:[[0,0],[1,0],[2,0],[2,1],[2,2]], name:'Vコーナー', mult:1.45 },
    { cells:[[0,0],[1,0],[1,1],[2,1],[2,2]], name:'Wステア', mult:1.45 },
    { cells:[[0,0],[0,1],[1,1],[2,1],[2,2]], name:'Zウェッジ', mult:1.45 },
    // 8パターン全部バラバラ(対称性なし) — 最も難しい
    { cells:[[0,0],[1,0],[2,0],[3,0],[3,1]], name:'Lスラッシュ', mult:1.6 },
    { cells:[[0,0],[0,1],[1,0],[1,1],[2,0]], name:'Pブロック', mult:1.6 },
    { cells:[[0,1],[1,0],[1,1],[2,1],[3,1]], name:'Yランス', mult:1.6 },
    { cells:[[0,1],[1,1],[2,0],[2,1],[3,0]], name:'Nステップ', mult:1.6 },
    { cells:[[0,1],[0,2],[1,0],[1,1],[2,1]], name:'Fツイスト', mult:1.6 },
    // --- 7マス以上(サイズで別枠、対称性より大きさを優先) ---
    { cells:[[0,0],[0,2],[1,0],[1,1],[1,2],[2,0],[2,2]], name:'Hゲート', mult:1.7 },
    { cells:[[0,2],[1,2],[2,0],[2,1],[2,2],[2,3],[2,4],[3,2],[4,2]], name:'グランドクロス', mult:1.85 },
  ];
  const NAMED_SHAPE_LOOKUP = {};
  for(const shape of NAMED_SHAPES){
    for(const key of allOrientKeys(shape.cells)) NAMED_SHAPE_LOOKUP[key] = { name:shape.name, mult:shape.mult };
  }

  function classifyShape(cellsRaw){
    const cells = normalize(cellsRaw);
    const size = cells.length;
    const allSameRow = cells.every(c => c[0]===cells[0][0]);
    const allSameCol = cells.every(c => c[1]===cells[0][1]);
    if(allSameRow || allSameCol){
      return { name:'ライン・ブレイク', mult: 1.2 + 0.05*(size-4) };
    }
    const hit = NAMED_SHAPE_LOOKUP[shapeKey(cells)];
    if(hit) return hit;
    return { name:'フリーフォーム', mult:1.0 };
  }

  // タイトル画面の「技一覧」表示用。5マス以上のみが対象で、4マス消しには技名が付かない。
  function getTechniqueList(){
    const list = [
      { name:'ライン・ブレイク', cells:[[0,0],[0,1],[0,2],[0,3],[0,4]], multText:'1.25倍〜(長いほど上昇)' },
      ...NAMED_SHAPES.map(s => ({ name:s.name, cells:s.cells, multText: s.mult + '倍' })),
      { name:'フリーフォーム', cells:null, multText:'1.0倍(上記以外の形)' },
    ];
    return list;
  }

  function calcDamage(groups){
    let total = 0;
    const names = [];
    let hasTechnique = false;
    groups.forEach(g => {
      const size = g.cells.length;
      const base = size===4 ? 10 : size===5 ? 16 : size===6 ? 24 : 34;
      if(size >= 5){
        const shape = classifyShape(g.cells);
        const dmg = Math.round(base * shape.mult);
        total += dmg;
        names.push(shape.name + ' ' + dmg);
        hasTechnique = true;
      } else {
        total += base;
      }
    });
    if(groups.length > 1){
      const bonus = (groups.length-1) * 8;
      total += bonus;
      names.push('同時消し +' + bonus);
    }
    return { total, names, hasTechnique };
  }

  CCB.N = N;
  CCB.COLORS = COLORS;
  CCB.HEAL = HEAL;
  CCB.cellBg = cellBg;
  CCB.genPiece = genPiece;
  CCB.pieceBBox = pieceBBox;
  CCB.classifyShape = classifyShape;
  CCB.getTechniqueList = getTechniqueList;
  CCB.calcDamage = calcDamage;
})(window.CCB);
