// ドラッグ&ドロップ(ポインター操作)まわり
window.CCB = window.CCB || {};

(function(CCB){
  const N = CCB.N;
  const { selfBoardEl, trayEl, selfCellEls, canPlace, pieceBBox, cloneBoard, doPlace, findGroups } = CCB;

  let dragging = null;
  let lastTarget = null;
  let previewCells = []; // [r, c, isPieceCell]

  // ドラッグを中断状態から必ず復帰させる後片付け(pointercancel・多重pointerdown・
  // ウィンドウ外での離しなど、pointerupが発火しないケースの保険)
  function cleanupDrag(){
    if(!dragging) return;
    clearPreview();
    if(dragging.cloneEl) dragging.cloneEl.remove();
    dragging = null;
    lastTarget = null;
    CCB.renderTray();
  }

  function clearPreview(){
    previewCells.forEach(([r,c,isPieceCell]) => {
      const el = selfCellEls[r][c];
      el.classList.remove('preview-valid','preview-invalid','preview-clear');
      if(isPieceCell) el.style.background = '';
    });
    previewCells = [];
  }

  function applyPreview(or, oc, piece, valid){
    clearPreview();
    if(!valid){
      piece.cells.forEach(([r,c], i) => {
        const ar = or+r, ac = oc+c;
        if(ar>=0&&ar<N&&ac>=0&&ac<N){
          const el = selfCellEls[ar][ac];
          el.style.background = piece.colors[i];
          el.classList.add('preview-invalid');
          previewCells.push([ar,ac,true]);
        }
      });
      return;
    }

    // 確定後に消えるグループを事前にシミュレートしてハイライトする
    const sim = cloneBoard(CCB.state.self.board);
    doPlace(sim, piece, or, oc);
    const clearSet = new Set();
    findGroups(sim).forEach(g => g.cells.forEach(([r,c]) => clearSet.add(r+','+c)));

    piece.cells.forEach(([r,c], i) => {
      const ar = or+r, ac = oc+c;
      const el = selfCellEls[ar][ac];
      el.style.background = piece.colors[i];
      el.classList.add(clearSet.has(ar+','+ac) ? 'preview-clear' : 'preview-valid');
      previewCells.push([ar,ac,true]);
    });

    // ピース自体には含まれないが、同時に消える既存セルもハイライトする
    clearSet.forEach(key => {
      const [r,c] = key.split(',').map(Number);
      const isPieceCell = piece.cells.some(([pr,pc]) => or+pr===r && oc+pc===c);
      if(!isPieceCell){
        selfCellEls[r][c].classList.add('preview-clear');
        previewCells.push([r,c,false]);
      }
    });
  }

  trayEl.addEventListener('pointerdown', (e) => {
    if(CCB.state.over) return;
    const slot = e.target.closest('.piece-slot');
    if(!slot) return;
    const idx = +slot.dataset.idx;
    const piece = CCB.state.self.tray[idx];
    if(!piece) return;
    if(dragging) cleanupDrag(); // 前のドラッグが中断状態で残っていたら片付けてから開始する
    dragging = { idx, piece, pointerId: e.pointerId };
    lastTarget = null;
    if(slot.setPointerCapture) slot.setPointerCapture(e.pointerId);
    slot.style.opacity = '0.25';
    const clone = CCB.buildPieceGridEl(piece);
    clone.classList.add('dragging-clone');
    clone.style.left = e.clientX + 'px';
    clone.style.top = e.clientY + 'px';
    clone.style.transform = 'translate(-50%,-50%)';
    document.body.appendChild(clone);
    dragging.cloneEl = clone;
    e.preventDefault();
  });

  document.addEventListener('pointermove', (e) => {
    if(!dragging || e.pointerId !== dragging.pointerId) return;
    dragging.cloneEl.style.left = e.clientX + 'px';
    dragging.cloneEl.style.top = e.clientY + 'px';
    const rect = selfBoardEl.getBoundingClientRect();
    const cellSize = rect.width / N;
    const {w,h} = pieceBBox(dragging.piece.cells);
    let or = Math.round((e.clientY - rect.top) / cellSize - h/2);
    let oc = Math.round((e.clientX - rect.left) / cellSize - w/2);
    or = Math.max(0, Math.min(N-h, or));
    oc = Math.max(0, Math.min(N-w, oc));
    const valid = canPlace(CCB.state.self.board, dragging.piece.cells, or, oc);
    applyPreview(or, oc, dragging.piece, valid);
    lastTarget = { or, oc, valid };
  });

  document.addEventListener('pointerup', (e) => {
    if(!dragging || e.pointerId !== dragging.pointerId) return;
    clearPreview();
    dragging.cloneEl.remove();
    const idx = dragging.idx;
    const target = lastTarget;
    dragging = null; lastTarget = null;
    if(target && target.valid){
      CCB.commitSelfPlacement(idx, target.or, target.oc);
    } else {
      CCB.renderTray();
    }
  });

  // OSやブラウザにドラッグを中断された場合(スクロール競合・アプリ切替・
  // ウィンドウ外でのポインター解放など)に必ず後片付けする保険
  document.addEventListener('pointercancel', (e) => {
    if(!dragging || e.pointerId !== dragging.pointerId) return;
    cleanupDrag();
  });
  window.addEventListener('blur', cleanupDrag);
})(window.CCB);
