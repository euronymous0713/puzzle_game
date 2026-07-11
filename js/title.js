// タイトル画面・ルーム作成/参加UIの制御
window.CCB = window.CCB || {};

(function(CCB){
  const titleScreen = document.getElementById('titleScreen');
  const appScreen = document.getElementById('app');
  const menuButtons = document.getElementById('menuButtons');
  const createPanel = document.getElementById('createPanel');
  const joinPanel = document.getElementById('joinPanel');
  const roomCodeDisplay = document.getElementById('roomCodeDisplay');
  const createStatus = document.getElementById('createStatus');
  const joinStatus = document.getElementById('joinStatus');
  const joinCodeInput = document.getElementById('joinCodeInput');
  const leaveBtn = document.getElementById('leaveBtn');
  const techPanel = document.getElementById('techPanel');
  const techListEl = document.getElementById('techList');
  const howToPanel = document.getElementById('howToPanel');

  function showPanel(panel){
    [menuButtons, createPanel, joinPanel, techPanel, howToPanel].forEach(p => p.classList.add('hidden'));
    panel.classList.remove('hidden');
  }

  function buildTechShapeGrid(cells){
    if(!cells){
      const ph = document.createElement('div');
      ph.className = 'tech-shape-placeholder';
      ph.textContent = '?';
      return ph;
    }
    const maxR = Math.max(...cells.map(c => c[0])) + 1;
    const maxC = Math.max(...cells.map(c => c[1])) + 1;
    const set = new Set(cells.map(c => c[0] + ',' + c[1]));
    const grid = document.createElement('div');
    grid.className = 'tech-shape';
    grid.style.gridTemplateColumns = `repeat(${maxC}, 9px)`;
    grid.style.gridTemplateRows = `repeat(${maxR}, 9px)`;
    for(let r=0;r<maxR;r++){
      for(let c=0;c<maxC;c++){
        const cell = document.createElement('div');
        cell.className = 'tech-shape-cell' + (set.has(r+','+c) ? ' on' : '');
        grid.appendChild(cell);
      }
    }
    return grid;
  }

  function renderTechList(){
    techListEl.innerHTML = '';
    CCB.getTechniqueList().forEach(t => {
      const row = document.createElement('div');
      row.className = 'tech-row';
      row.appendChild(buildTechShapeGrid(t.cells));
      const info = document.createElement('div');
      info.className = 'tech-info';
      const nameEl = document.createElement('div');
      nameEl.className = 'tech-name';
      nameEl.textContent = t.name;
      const multEl = document.createElement('div');
      multEl.className = 'tech-mult';
      multEl.textContent = t.multText;
      info.appendChild(nameEl);
      info.appendChild(multEl);
      row.appendChild(info);
      techListEl.appendChild(row);
    });
  }

  document.getElementById('btnShowTech').addEventListener('click', () => {
    renderTechList();
    showPanel(techPanel);
  });

  document.getElementById('btnCloseTech').addEventListener('click', () => {
    showPanel(menuButtons);
  });

  document.getElementById('btnShowHowTo').addEventListener('click', () => {
    showPanel(howToPanel);
  });

  document.getElementById('btnCloseHowTo').addEventListener('click', () => {
    showPanel(menuButtons);
  });

  function showTitle(){
    CCB.mode = null;
    CCB.rematchSelfWants = false;
    CCB.rematchOppWants = false;
    CCB.net.disconnect();
    appScreen.classList.add('hidden');
    titleScreen.classList.remove('hidden');
    showPanel(menuButtons);
    createStatus.textContent = '';
    joinStatus.textContent = '';
    joinCodeInput.value = '';
  }

  function startBattleScreen(){
    titleScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    CCB.renderAll();
  }

  function fallbackCopy(text){
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try{ document.execCommand('copy'); }catch(e){}
    document.body.removeChild(ta);
  }

  document.getElementById('btnCpu').addEventListener('click', () => {
    CCB.startCpuGame();
    startBattleScreen();
  });

  document.getElementById('btnShowCreate').addEventListener('click', async () => {
    showPanel(createPanel);
    roomCodeDisplay.textContent = '......';
    createStatus.textContent = 'コードを発行しています…';
    try{
      const code = await CCB.net.createRoom();
      roomCodeDisplay.textContent = code;
      createStatus.textContent = '相手の接続を待っています…';
      CCB.net.onConnected = () => {
        CCB.startOnlineGame();
        startBattleScreen();
      };
      CCB.net.onDisconnected = (msg) => { CCB.handleOnlineDisconnect(msg); };
      CCB.net.onMessage = (data) => { CCB.handleRemoteMessage(data); };
    }catch(err){
      createStatus.textContent = 'コード発行に失敗しました。もう一度お試しください。';
    }
  });

  document.getElementById('btnCopyCode').addEventListener('click', () => {
    const text = roomCodeDisplay.textContent;
    if(!text || text.includes('.')) return;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text)
        .then(() => { createStatus.textContent = 'コピーしました'; })
        .catch(() => { fallbackCopy(text); createStatus.textContent = 'コピーしました'; });
    } else {
      fallbackCopy(text);
      createStatus.textContent = 'コピーしました';
    }
  });

  document.getElementById('btnCancelCreate').addEventListener('click', () => {
    CCB.net.disconnect();
    showPanel(menuButtons);
  });

  document.getElementById('btnShowJoin').addEventListener('click', () => {
    showPanel(joinPanel);
    joinStatus.textContent = '';
    joinCodeInput.value = '';
    joinCodeInput.focus();
  });

  document.getElementById('btnJoinConfirm').addEventListener('click', async () => {
    const code = joinCodeInput.value.trim().toUpperCase();
    if(code.length !== 6){
      joinStatus.textContent = '6桁のコードを入力してください';
      return;
    }
    joinStatus.textContent = '接続しています…';
    try{
      await CCB.net.joinRoom(code);
      CCB.net.onConnected = null;
      CCB.net.onDisconnected = (msg) => { CCB.handleOnlineDisconnect(msg); };
      CCB.net.onMessage = (data) => { CCB.handleRemoteMessage(data); };
      CCB.startOnlineGame();
      startBattleScreen();
    }catch(err){
      joinStatus.textContent = '接続できませんでした。コードを確認してください。';
    }
  });

  document.getElementById('btnCancelJoin').addEventListener('click', () => {
    CCB.net.disconnect();
    showPanel(menuButtons);
  });

  leaveBtn.addEventListener('click', () => {
    showTitle();
  });

  CCB.showTitle = showTitle;
})(window.CCB);
