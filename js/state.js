// ゲーム状態の管理とプレイヤー/AIのターン処理
window.CCB = window.CCB || {};

(function(CCB){
  const { genPiece, calcDamage } = CCB;
  const { boardEmpty, canPlace, doPlace, cloneBoard, findGroups, hasAnyValidMove } = CCB;

  function initPlayer(){
    return { board: boardEmpty(), hp:100, maxHp:100, tray:[genPiece(),genPiece(),genPiece()] };
  }

  function freshState(){
    return { self: initPlayer(), opp: initPlayer(), over:false, winner:null, disconnectMsg:null };
  }

  CCB.state = freshState();
  CCB.mode = null; // 'cpu' | 'online'

  function playerAction(who, trayIdx, or, oc){
    const player = CCB.state[who];
    const opp = CCB.state[who==='self' ? 'opp' : 'self'];
    if(CCB.state.over) return { ok:false };
    const piece = player.tray[trayIdx];
    if(!piece) return { ok:false };
    if(!canPlace(player.board, piece.cells, or, oc)) return { ok:false };
    doPlace(player.board, piece, or, oc);
    // 3個セットのミノを使い切ったら、まとめて次の3個セットを補充する
    player.tray[trayIdx] = null;
    if(player.tray.every(p => !p)){
      player.tray = [genPiece(), genPiece(), genPiece()];
    }
    const groups = findGroups(player.board);
    const result = { ok:true, damage:0, heal:0, names:[], hasTechnique:false };
    if(groups.length){
      const clearedSet = new Set();
      groups.forEach(g => g.cells.forEach(([r,c]) => clearedSet.add(r+','+c)));

      // 消えるマスに隣接する回復ブロックを探す(重複なし)
      const healCells = [];
      const healSeen = new Set();
      clearedSet.forEach(key => {
        const [r,c] = key.split(',').map(Number);
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc]) => {
          const nr = r+dr, nc = c+dc;
          if(nr<0||nr>=CCB.N||nc<0||nc>=CCB.N) return;
          const nk = nr+','+nc;
          if(clearedSet.has(nk) || healSeen.has(nk)) return;
          if(player.board[nr][nc] === CCB.HEAL){
            healSeen.add(nk);
            healCells.push([nr,nc]);
          }
        });
      });

      groups.forEach(g => g.cells.forEach(([r,c]) => { player.board[r][c] = null; }));
      const calc = calcDamage(groups);
      opp.hp = Math.max(0, opp.hp - calc.total);
      result.damage = calc.total;
      result.names = calc.names;
      result.hasTechnique = calc.hasTechnique;

      if(healCells.length){
        const healTotal = clearedSet.size * healCells.length;
        healCells.forEach(([r,c]) => { player.board[r][c] = null; });
        player.hp = Math.min(player.maxHp, player.hp + healTotal);
        result.heal = healTotal;
        result.names.push('回復 +' + healTotal);
      }
    }
    if(opp.hp <= 0){
      CCB.state.over = true; CCB.state.winner = who;
    } else if(!hasAnyValidMove(player.board, player.tray)){
      CCB.state.over = true; CCB.state.winner = (who==='self') ? 'opp' : 'self';
    }
    return result;
  }

  function aiTick(){
    if(CCB.state.over) return null;
    const player = CCB.state.opp;
    let best = null;
    for(let i=0;i<3;i++){
      const piece = player.tray[i];
      if(!piece) continue;
      for(let r=0;r<CCB.N;r++){
        for(let c=0;c<CCB.N;c++){
          if(!canPlace(player.board, piece.cells, r, c)) continue;
          const sim = cloneBoard(player.board);
          doPlace(sim, piece, r, c);
          const groups = findGroups(sim);
          const dmg = groups.length ? calcDamage(groups).total : 0;
          const score = dmg + Math.random()*0.01;
          if(!best || score > best.score) best = { i, r, c, score };
        }
      }
    }
    if(best) return playerAction('opp', best.i, best.r, best.c);
    CCB.state.over = true; CCB.state.winner = 'self';
    return null;
  }

  function startCpuGame(){
    CCB.mode = 'cpu';
    CCB.state = freshState();
  }

  function startOnlineGame(){
    CCB.mode = 'online';
    CCB.state = freshState();
    CCB.rematchSelfWants = false;
    CCB.rematchOppWants = false;
  }

  CCB.rematchSelfWants = false;
  CCB.rematchOppWants = false;

  // 「もう一度」を押した側が呼ぶ。双方が希望した時点で次の試合を始める
  function requestRematch(){
    if(CCB.mode !== 'online' || !CCB.state.over || CCB.state.disconnectMsg) return;
    // 「もう一度」を押した時点で相手が既にいなければ、待ち続けさせずにすぐ知らせる
    if(!CCB.net.conn || !CCB.net.conn.open){
      CCB.state.disconnectMsg = '相手が切断しました';
      CCB.renderAll();
      return;
    }
    CCB.rematchSelfWants = true;
    CCB.net.send({ type:'rematch' });
    if(CCB.rematchOppWants){
      startOnlineGame();
    }
    CCB.renderAll();
  }

  // 相手クライアントから届いたメッセージを自分の状態へ反映する
  function handleRemoteMessage(msg){
    if(CCB.mode !== 'online') return;

    if(msg.type === 'move'){
      if(CCB.state.over) return;
      const state = CCB.state;
      state.opp.board = msg.board;
      if(msg.damage > 0){
        state.self.hp = Math.max(0, state.self.hp - msg.damage);
        CCB.showSkillPopup(msg.names, msg.damage, msg.heal, true);
        if(msg.hasTechnique) CCB.flashBoard(CCB.oppBoardEl);
      }
      if(msg.heal > 0){
        state.opp.hp = Math.min(state.opp.maxHp, state.opp.hp + msg.heal);
      }
      if(msg.over){
        state.over = true;
        state.winner = msg.winner === 'self' ? 'opp' : 'self';
      }
      CCB.renderAll();
      return;
    }

    if(msg.type === 'rematch'){
      if(!CCB.state.over || CCB.state.disconnectMsg) return;
      CCB.rematchOppWants = true;
      if(CCB.rematchSelfWants){
        startOnlineGame();
      }
      CCB.renderAll();
      return;
    }
  }

  function handleOnlineDisconnect(reason){
    if(CCB.mode !== 'online') return;
    // 対戦中、または再戦の返事待ちの場合のみ切断表示を出す
    if(CCB.state.over && !CCB.rematchSelfWants && !CCB.rematchOppWants) return;
    CCB.state.over = true;
    CCB.state.disconnectMsg = reason;
    CCB.rematchSelfWants = false;
    CCB.rematchOppWants = false;
    CCB.renderAll();
  }

  CCB.initPlayer = initPlayer;
  CCB.freshState = freshState;
  CCB.playerAction = playerAction;
  CCB.aiTick = aiTick;
  CCB.startCpuGame = startCpuGame;
  CCB.startOnlineGame = startOnlineGame;
  CCB.requestRematch = requestRematch;
  CCB.handleRemoteMessage = handleRemoteMessage;
  CCB.handleOnlineDisconnect = handleOnlineDisconnect;
})(window.CCB);
