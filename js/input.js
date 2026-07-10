// ドラッグ&ドロップ(ポインター操作)まわり
window.CCB = window.CCB || {};

(function(CCB){
  const N = CCB.N;
  const { selfBoardEl, trayEl, selfCellEls, canPlace, pieceBBox } = CCB;

  let dragging = null;
  let previewCells = [];

  function clearPreview(){
    previewCells.forEach(([r,c]) => {
      selfCellEls[r][c].classList.remove('preview-valid','preview-invalid');
    });
    previewCells = [];
  }

  function applyPreview(or, oc, piece, valid){
    clearPreview();
    piece.cells.forEach(([r,c]) => {
      const ar = or+r, ac = oc+c;
      if(ar>=0&&ar<N&&ac>=0&&ac<N){
        selfCellEls[ar][ac].classList.add(valid ? 'preview-valid' : 'preview-invalid');
        previewCells.push([ar,ac]);
      }
    });
  }

  let lastTarget = null;

  trayEl.addEventListener('pointerdown', (e) => {
    if(CCB.state.over) return;
    const slot = e.target.closest('.piece-slot');
    if(!slot) return;
    const idx = +slot.dataset.idx;
    const piece = CCB.state.self.tray[idx];
    if(!piece) return;
    dragging = { idx, piece };
    lastTarget = null;
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
    if(!dragging) return;
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

  document.addEventListener('pointerup', () => {
    if(!dragging) return;
    clearPreview();
    dragging.cloneEl.remove();
    if(lastTarget && lastTarget.valid){
      CCB.commitSelfPlacement(dragging.idx, lastTarget.or, lastTarget.oc);
    } else {
      CCB.renderTray();
    }
    dragging = null; lastTarget = null;
  });
})(window.CCB);
