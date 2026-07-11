// 盤面上で同色に繋がったセルの集合を、1つの滑らかな輪郭(SVG path)に変換するための
// 純粋な幾何ロジック。DOMに依存しないのでNode上でも単体テストできる。
window.CCB = window.CCB || {};

(function(CCB){
  // board上の同色連結成分(回復ブロック・空マスは対象外)を全て求める。
  // findGroups(board.js)と違い、サイズ4未満やそもそもマッチ数を問わず、
  // 繋がっている限りすべて1つの領域として返す。
  function getColorRegions(board, N){
    const visited = Array.from({length:N}, () => Array(N).fill(false));
    const regions = [];
    for(let r=0;r<N;r++){
      for(let c=0;c<N;c++){
        const v = board[r][c];
        if(!v || v === CCB.HEAL || visited[r][c]) continue;
        const stack = [[r,c]]; visited[r][c] = true;
        const cells = [];
        while(stack.length){
          const [cr,cc] = stack.pop();
          cells.push([cr,cc]);
          for(const [nr,nc] of [[cr-1,cc],[cr+1,cc],[cr,cc-1],[cr,cc+1]]){
            if(nr<0||nr>=N||nc<0||nc>=N||visited[nr][nc]) continue;
            if(board[nr][nc] !== v) continue;
            visited[nr][nc] = true; stack.push([nr,nc]);
          }
        }
        regions.push({ color: v, cells });
      }
    }
    return regions;
  }

  // セル集合(マス目の単位)の外周を、格子座標の頂点列としてトレースする。
  // 1マスは(r,c)〜(r+1,c+1)の正方形とみなす。穴がある場合や複数の輪(外周+穴)がある
  // 場合に備えて、輪ごとの配列を返す。
  function traceRegionBoundary(cells){
    const set = new Set(cells.map(([r,c]) => r + ',' + c));
    const has = (r,c) => set.has(r + ',' + c);
    const edges = [];
    for(const [r,c] of cells){
      if(!has(r-1,c)) edges.push([[r,c],[r,c+1]]);       // 上辺
      if(!has(r,c+1)) edges.push([[r,c+1],[r+1,c+1]]);   // 右辺
      if(!has(r+1,c)) edges.push([[r+1,c+1],[r+1,c]]);   // 下辺
      if(!has(r,c-1)) edges.push([[r+1,c],[r,c]]);       // 左辺
    }
    const key = ([r,c]) => r + ',' + c;
    const byStart = new Map();
    for(const e of edges){
      const k = key(e[0]);
      if(!byStart.has(k)) byStart.set(k, []);
      byStart.get(k).push(e);
    }
    const used = new Set();
    const loops = [];
    for(const start of edges){
      if(used.has(start)) continue;
      const loop = [start[0]];
      let current = start;
      used.add(current);
      let guard = 0;
      while(guard++ < 4000){
        if(key(current[1]) === key(start[0])) break;
        const candidates = (byStart.get(key(current[1])) || []).filter(e => !used.has(e));
        if(candidates.length === 0) break;
        const next = candidates[0];
        loop.push(next[0]);
        used.add(next);
        current = next;
      }
      if(loop.length >= 4) loops.push(loop);
    }
    return loops;
  }

  // 格子座標の輪(頂点リスト)を、角を丸めたSVG pathの文字列に変換する。
  // unit: 1マス分のピクセルサイズ。radius: 角丸半径(px)。
  function loopToRoundedPath(loop, unit, radius){
    const n = loop.length;
    if(n < 4) return '';
    const pt = ([r,c]) => ({ x: c*unit, y: r*unit });
    let d = '';
    for(let i=0;i<n;i++){
      const prev = pt(loop[(i - 1 + n) % n]);
      const curr = pt(loop[i]);
      const next = pt(loop[(i + 1) % n]);
      const inX = curr.x - prev.x, inY = curr.y - prev.y;
      const inLen = Math.hypot(inX, inY) || 1;
      const inNX = inX / inLen, inNY = inY / inLen;
      const outX = next.x - curr.x, outY = next.y - curr.y;
      const outLen = Math.hypot(outX, outY) || 1;
      const outNX = outX / outLen, outNY = outY / outLen;
      const r = Math.min(radius, inLen / 2, outLen / 2);
      const ax = curr.x - inNX * r, ay = curr.y - inNY * r;
      const bx = curr.x + outNX * r, by = curr.y + outNY * r;
      // 内積が0(直進、角なし)の場合はそのまま直線でつなぐ
      const cross = inNX * outNY - inNY * outNX;
      if(i === 0){
        d += `M ${ax} ${ay} `;
      } else {
        d += `L ${ax} ${ay} `;
      }
      if(Math.abs(cross) < 0.01){
        d += `L ${curr.x} ${curr.y} `;
      } else {
        const sweep = cross > 0 ? 1 : 0;
        d += `A ${r} ${r} 0 0 ${sweep} ${bx} ${by} `;
      }
    }
    d += 'Z';
    return d;
  }

  // 領域(cellsの配列)から、角丸済みのSVG path文字列(複数の輪をまとめたもの)を作る。
  function regionToPath(cells, unit, radius){
    const loops = traceRegionBoundary(cells);
    return loops.map(loop => loopToRoundedPath(loop, unit, radius)).join(' ');
  }

  CCB.getColorRegions = getColorRegions;
  CCB.traceRegionBoundary = traceRegionBoundary;
  CCB.loopToRoundedPath = loopToRoundedPath;
  CCB.regionToPath = regionToPath;
})(window.CCB);
