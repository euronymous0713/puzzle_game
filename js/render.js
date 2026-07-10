// DOM構築・描画・演出まわり
window.CCB = window.CCB || {};

(function(CCB){
  const N = CCB.N;

  const selfBoardEl = document.getElementById('selfBoard');
  const oppBoardEl = document.getElementById('oppBoard');
  const trayEl = document.getElementById('tray');
  const selfHpFill = document.getElementById('selfHpFill');
  const selfHpNum = document.getElementById('selfHpNum');
  const oppHpFill = document.getElementById('oppHpFill');
  const oppHpNum = document.getElementById('oppHpNum');
  const toastEl = document.getElementById('toast');
  const overlayEl = document.getElementById('overlay');
  const overlayTitleEl = document.getElementById('overlayTitle');
  const restartBtn = document.getElementById('restartBtn');

  let selfCellEls = [];
  let oppCellEls = [];

  function buildBoardDom(el, targetArr){
    el.innerHTML = '';
    targetArr.length = 0;
    for(let r=0;r<N;r++){
      targetArr.push([]);
      for(let c=0;c<N;c++){
        const d = document.createElement('div');
        d.className = 'cell';
        el.appendChild(d);
        targetArr[r].push(d);
      }
    }
  }
  buildBoardDom(selfBoardEl, selfCellEls);
  buildBoardDom(oppBoardEl, oppCellEls);

  function renderBoard(cellEls, board){
    for(let r=0;r<N;r++){
      for(let c=0;c<N;c++){
        const v = board[r][c];
        cellEls[r][c].style.background = v || '';
      }
    }
  }

  function hpColor(pct){
    if(pct > 0.5) return '#66bb6a';
    if(pct > 0.2) return '#ffd54f';
    return '#ff5252';
  }

  function renderHp(){
    const state = CCB.state;
    const sp = Math.max(0, state.self.hp) / state.self.maxHp;
    selfHpFill.style.width = (sp*100) + '%';
    selfHpFill.style.background = hpColor(sp);
    selfHpNum.textContent = Math.max(0, state.self.hp);

    const op = Math.max(0, state.opp.hp) / state.opp.maxHp;
    oppHpFill.style.width = (op*100) + '%';
    oppHpFill.style.background = hpColor(op);
    oppHpNum.textContent = Math.max(0, state.opp.hp);
  }

  function buildPieceGridEl(piece){
    const {w,h} = CCB.pieceBBox(piece.cells);
    const grid = document.createElement('div');
    grid.className = 'piece-grid';
    grid.style.gridTemplateColumns = `repeat(${w}, 15px)`;
    grid.style.gridTemplateRows = `repeat(${h}, 15px)`;
    const map = {};
    piece.cells.forEach(([r,c], i) => { map[r+','+c] = piece.colors[i]; });
    for(let r=0;r<h;r++){
      for(let c=0;c<w;c++){
        const cell = document.createElement('div');
        cell.className = 'piece-cell';
        const color = map[r+','+c];
        cell.style.background = color || 'transparent';
        grid.appendChild(cell);
      }
    }
    return grid;
  }

  function renderTray(){
    trayEl.innerHTML = '';
    CCB.state.self.tray.forEach((piece, idx) => {
      const slot = document.createElement('div');
      slot.className = 'piece-slot';
      slot.dataset.idx = idx;
      if(piece) slot.appendChild(buildPieceGridEl(piece));
      trayEl.appendChild(slot);
    });
  }

  function renderAll(){
    const state = CCB.state;
    renderBoard(selfCellEls, state.self.board);
    renderBoard(oppCellEls, state.opp.board);
    renderHp();
    renderTray();
    if(state.over){
      overlayTitleEl.textContent = state.disconnectMsg
        ? state.disconnectMsg
        : (state.winner === 'self' ? 'YOU WIN' : 'YOU LOSE');
      restartBtn.textContent = CCB.mode === 'online' ? 'タイトルへ' : 'もう一度';
      overlayEl.style.display = 'flex';
    } else {
      overlayEl.style.display = 'none';
    }
  }

  let toastTimer = null;
  function showToast(text, isEnemy){
    toastEl.textContent = text;
    toastEl.className = isEnemy ? 'enemy' : '';
    toastEl.style.opacity = 1;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.opacity = 0; }, 1400);
  }

  function commitSelfPlacement(idx, r, c){
    const res = CCB.playerAction('self', idx, r, c);
    if(res.ok){
      if(res.names.length) showToast('YOU: ' + res.names.join(' / '), false);
      if(CCB.mode === 'online'){
        CCB.net.send({
          type: 'move',
          board: CCB.state.self.board,
          damage: res.damage,
          names: res.names,
          over: CCB.state.over,
          winner: CCB.state.winner,
        });
      }
      renderAll();
    }
    return res;
  }

  function commitAiTick(){
    const res = CCB.aiTick();
    if(res && res.ok && res.names.length){
      showToast('敵: ' + res.names.join(' / '), true);
    }
    renderAll();
  }

  CCB.selfBoardEl = selfBoardEl;
  CCB.trayEl = trayEl;
  CCB.restartBtn = restartBtn;
  CCB.selfCellEls = selfCellEls;
  CCB.oppCellEls = oppCellEls;
  CCB.buildBoardDom = buildBoardDom;
  CCB.buildPieceGridEl = buildPieceGridEl;
  CCB.renderTray = renderTray;
  CCB.renderAll = renderAll;
  CCB.showToast = showToast;
  CCB.commitSelfPlacement = commitSelfPlacement;
  CCB.commitAiTick = commitAiTick;
})(window.CCB);
