// 盤面(board)そのものの操作ロジック
window.CCB = window.CCB || {};

(function(CCB){
  const N = CCB.N;

  function boardEmpty(){ return Array.from({length:N}, () => Array(N).fill(null)); }

  function canPlace(board, cells, or, oc){
    for(const [r,c] of cells){
      const ar = or+r, ac = oc+c;
      if(ar<0||ar>=N||ac<0||ac>=N) return false;
      if(board[ar][ac] !== null) return false;
    }
    return true;
  }

  function doPlace(board, piece, or, oc){
    piece.cells.forEach(([r,c], i) => {
      board[or+r][oc+c] = piece.colors[i];
    });
  }

  function cloneBoard(board){ return board.map(row => row.slice()); }

  function findGroups(board){
    const visited = Array.from({length:N}, () => Array(N).fill(false));
    const groups = [];
    for(let r=0;r<N;r++){
      for(let c=0;c<N;c++){
        if(board[r][c]===null || visited[r][c]) continue;
        const color = board[r][c];
        const stack = [[r,c]]; visited[r][c]=true;
        const comp = [];
        while(stack.length){
          const [cr,cc] = stack.pop();
          comp.push([cr,cc]);
          for(const [nr,nc] of [[cr-1,cc],[cr+1,cc],[cr,cc-1],[cr,cc+1]]){
            if(nr<0||nr>=N||nc<0||nc>=N||visited[nr][nc]) continue;
            if(board[nr][nc] !== color) continue;
            visited[nr][nc]=true; stack.push([nr,nc]);
          }
        }
        if(comp.length >= 4) groups.push({color, cells:comp});
      }
    }
    return groups;
  }

  function hasAnyValidMove(board, tray){
    for(const piece of tray){
      if(!piece) continue;
      for(let r=0;r<N;r++) for(let c=0;c<N;c++){
        if(canPlace(board, piece.cells, r, c)) return true;
      }
    }
    return false;
  }

  CCB.boardEmpty = boardEmpty;
  CCB.canPlace = canPlace;
  CCB.doPlace = doPlace;
  CCB.cloneBoard = cloneBoard;
  CCB.findGroups = findGroups;
  CCB.hasAnyValidMove = hasAnyValidMove;
})(window.CCB);
