// エントリーポイント: 再戦/退出ボタン・CPUループ・デバッグ用フック
window.CCB = window.CCB || {};

(function(CCB){
  CCB.restartBtn.addEventListener('click', () => {
    if(CCB.mode === 'online'){
      if(CCB.state.disconnectMsg){
        CCB.showTitle();
      } else {
        CCB.requestRematch();
      }
    } else {
      CCB.startCpuGame();
      CCB.renderAll();
    }
  });

  document.getElementById('leaveMatchBtn').addEventListener('click', () => {
    CCB.showTitle();
  });

  // CPU対戦中のみ動作するAIループ(タイトル画面/オンライン対戦中は何もしない)
  setInterval(() => {
    if(CCB.mode === 'cpu' && !CCB.state.over) CCB.commitAiTick();
  }, 2200);

  // ---------- debug hooks for automated testing ----------
  window.__debug = {
    getState: () => JSON.parse(JSON.stringify(CCB.state)),
    place: (who, idx, r, c) => {
      if(who === 'self') return CCB.commitSelfPlacement(idx, r, c);
      const res = CCB.playerAction(who, idx, r, c);
      CCB.renderAll();
      return res;
    },
    aiTick: () => CCB.commitAiTick(),
    isOver: () => CCB.state.over,
    mode: () => CCB.mode,
    reset: () => { CCB.startCpuGame(); CCB.renderAll(); },
  };
})(window.CCB);
