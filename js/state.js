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
    player.tray[trayIdx] = genPiece();
    const groups = findGroups(player.board);
    const result = { ok:true, damage:0, names:[] };
    if(groups.length){
      groups.forEach(g => g.cells.forEach(([r,c]) => { player.board[r][c] = null; }));
      const calc = calcDamage(groups);
      opp.hp = Math.max(0, opp.hp - calc.total);
      result.damage = calc.total;
      result.names = calc.names;
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
  }

  // 相手クライアントから届いた着手メッセージを自分のopp側へ反映する
  function handleRemoteMessage(msg){
    if(CCB.mode !== 'online' || CCB.state.over) return;
    if(msg.type !== 'move') return;
    const state = CCB.state;
    state.opp.board = msg.board;
    if(msg.damage > 0){
      state.self.hp = Math.max(0, state.self.hp - msg.damage);
      CCB.showToast('敵: ' + msg.names.join(' / '), true);
    }
    if(msg.over){
      state.over = true;
      state.winner = msg.winner === 'self' ? 'opp' : 'self';
    }
    CCB.renderAll();
  }

  function handleOnlineDisconnect(reason){
    if(CCB.mode !== 'online' || CCB.state.over) return;
    CCB.state.over = true;
    CCB.state.disconnectMsg = reason;
    CCB.renderAll();
  }

  CCB.initPlayer = initPlayer;
  CCB.freshState = freshState;
  CCB.playerAction = playerAction;
  CCB.aiTick = aiTick;
  CCB.startCpuGame = startCpuGame;
  CCB.startOnlineGame = startOnlineGame;
  CCB.handleRemoteMessage = handleRemoteMessage;
  CCB.handleOnlineDisconnect = handleOnlineDisconnect;
})(window.CCB);
