// DOM構築・描画・演出まわり
window.CCB = window.CCB || {};

(function(CCB){
  const N = CCB.N;

  const selfBoardEl = document.getElementById('selfBoard');
  const oppBoardEl = document.getElementById('oppBoard');
  const trayEl = document.getElementById('tray');
  const selfHpWrap = document.getElementById('selfHpWrap');
  const oppHpWrap = document.getElementById('oppHpWrap');
  const selfHpFill = document.getElementById('selfHpFill');
  const selfHpNum = document.getElementById('selfHpNum');
  const oppHpFill = document.getElementById('oppHpFill');
  const oppHpNum = document.getElementById('oppHpNum');
  const skillPopupEl = document.getElementById('skillPopup');
  const skillLinesEl = document.getElementById('skillLines');
  const skillDamageEl = document.getElementById('skillDamage');
  const skillHealEl = document.getElementById('skillHeal');
  const overlayEl = document.getElementById('overlay');
  const overlayTitleEl = document.getElementById('overlayTitle');
  const rematchStatusEl = document.getElementById('rematchStatus');
  const restartBtn = document.getElementById('restartBtn');
  const leaveMatchBtn = document.getElementById('leaveMatchBtn');

  let selfCellEls = [];
  let oppCellEls = [];
  let prevSelfBoard = null;
  let prevOppBoard = null;
  let prevSelfHp = null;
  let prevOppHp = null;

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

  // 演出用クラスを一度リセットしてから付け直し、アニメーションを毎回再生させる
  function playAnim(el, className){
    el.classList.remove(className);
    void el.offsetWidth; // reflow
    el.classList.add(className);
  }

  function renderBoard(cellEls, board, prevBoard){
    for(let r=0;r<N;r++){
      for(let c=0;c<N;c++){
        const v = board[r][c];
        const prev = prevBoard ? prevBoard[r][c] : undefined;
        const el = cellEls[r][c];
        if(prev === v) continue;
        if(v && !prev){
          // heal-cellは無限ループのpulseアニメーションを持つため、cell-popと同時に
          // 付いているとCSSの優先順位でcell-pop側が再生されない。一旦外してポップ
          // 演出を終わらせてから、必要ならheal-cellを付け直す。
          el.classList.remove('cell-clear', 'heal-cell');
          el.style.background = CCB.cellBg(v);
          playAnim(el, 'cell-pop');
          if(v === CCB.HEAL){
            el.addEventListener('animationend', function onPopEnd(){
              el.classList.add('heal-cell');
              el.removeEventListener('animationend', onPopEnd);
            }, { once:true });
          }
        } else if(!v && prev){
          // 同様の理由で、heal-cellが付いたままだとcell-clearの消滅アニメーションが
          // 再生されず(animationendも発火せず)ブロックが消えなくなるため先に外す。
          const wasHeal = prev === CCB.HEAL;
          el.classList.remove('heal-cell');
          el.style.background = CCB.cellBg(prev);
          el.classList.remove('cell-pop');
          playAnim(el, wasHeal ? 'heal-clear' : 'cell-clear');
          el.addEventListener('animationend', function onEnd(){
            el.style.background = '';
            el.classList.remove('cell-clear', 'heal-clear');
            el.removeEventListener('animationend', onEnd);
          }, { once:true });
        } else {
          el.style.background = CCB.cellBg(v);
          el.classList.toggle('heal-cell', v === CCB.HEAL);
        }
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
    const selfHp = Math.max(0, state.self.hp);
    const oppHp = Math.max(0, state.opp.hp);

    const sp = selfHp / state.self.maxHp;
    selfHpFill.style.width = (sp*100) + '%';
    selfHpFill.style.background = hpColor(sp);
    selfHpNum.textContent = selfHp;

    const op = oppHp / state.opp.maxHp;
    oppHpFill.style.width = (op*100) + '%';
    oppHpFill.style.background = hpColor(op);
    oppHpNum.textContent = oppHp;

    if(prevSelfHp !== null && selfHp < prevSelfHp) playAnim(selfHpWrap, 'hp-hit');
    if(prevOppHp !== null && oppHp < prevOppHp) playAnim(oppHpWrap, 'hp-hit');
    if(prevSelfHp !== null && selfHp > prevSelfHp) playAnim(selfHpWrap, 'hp-heal');
    if(prevOppHp !== null && oppHp > prevOppHp) playAnim(oppHpWrap, 'hp-heal');
    prevSelfHp = selfHp;
    prevOppHp = oppHp;
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
        cell.style.background = color ? CCB.cellBg(color) : 'transparent';
        if(color === CCB.HEAL) cell.classList.add('heal-cell');
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
    renderBoard(selfCellEls, state.self.board, prevSelfBoard);
    renderBoard(oppCellEls, state.opp.board, prevOppBoard);
    prevSelfBoard = CCB.cloneBoard(state.self.board);
    prevOppBoard = CCB.cloneBoard(state.opp.board);
    renderHp();
    renderTray();
    if(state.over){
      const isOnline = CCB.mode === 'online';
      const disconnected = !!state.disconnectMsg;
      overlayTitleEl.textContent = disconnected
        ? state.disconnectMsg
        : (state.winner === 'self' ? 'YOU WIN' : 'YOU LOSE');

      if(isOnline && !disconnected){
        restartBtn.textContent = 'もう一度';
        leaveMatchBtn.classList.remove('hidden');
        rematchStatusEl.textContent = CCB.rematchSelfWants
          ? '相手を待っています…'
          : (CCB.rematchOppWants ? '相手が再戦を希望しています' : '');
      } else {
        restartBtn.textContent = isOnline ? 'タイトルへ' : 'もう一度';
        leaveMatchBtn.classList.add('hidden');
        rematchStatusEl.textContent = '';
      }
      overlayEl.classList.add('show');
    } else {
      overlayEl.classList.remove('show');
      rematchStatusEl.textContent = '';
    }
  }

  let skillTimer = null;
  function showSkillPopup(names, damage, heal, isEnemy){
    clearTimeout(skillTimer);
    skillLinesEl.innerHTML = '';
    names.forEach((name, i) => {
      const line = document.createElement('div');
      line.className = 'skill-line';
      line.style.animationDelay = (i * 0.08) + 's';
      line.textContent = name;
      skillLinesEl.appendChild(line);
    });
    if(damage > 0){
      skillDamageEl.textContent = '-' + damage;
      skillDamageEl.style.display = '';
    } else {
      skillDamageEl.style.display = 'none';
    }
    if(heal > 0){
      skillHealEl.textContent = '+' + heal;
      skillHealEl.style.display = '';
    } else {
      skillHealEl.style.display = 'none';
    }
    skillPopupEl.classList.toggle('enemy', !!isEnemy);
    skillPopupEl.classList.toggle('mega', damage >= 25);
    playAnim(skillPopupEl, 'show');
    skillTimer = setTimeout(() => { skillPopupEl.classList.remove('show'); }, 1500);
  }

  function commitSelfPlacement(idx, r, c){
    const res = CCB.playerAction('self', idx, r, c);
    if(res.ok){
      if(res.names.length) showSkillPopup(res.names, res.damage, res.heal, false);
      if(CCB.mode === 'online'){
        CCB.net.send({
          type: 'move',
          board: CCB.state.self.board,
          damage: res.damage,
          heal: res.heal,
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
      showSkillPopup(res.names, res.damage, res.heal, true);
    }
    renderAll();
    return res;
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
  CCB.showSkillPopup = showSkillPopup;
  CCB.commitSelfPlacement = commitSelfPlacement;
  CCB.commitAiTick = commitAiTick;
})(window.CCB);
