// PeerJS(WebRTC)を使った1対1ルーム通信ラッパー。サーバー不要のP2P接続。
window.CCB = window.CCB || {};

(function(CCB){
  const PEER_PREFIX = 'ccbattle-';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい 0/O/1/I を除外

  function genCode(len){
    let s = '';
    for(let i=0;i<len;i++) s += CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)];
    return s;
  }

  const net = {
    peer: null,
    conn: null,
    onMessage: null,
    onConnected: null,
    onDisconnected: null,
  };

  function teardown(){
    if(net.conn){ try{ net.conn.close(); }catch(e){} net.conn = null; }
    if(net.peer){ try{ net.peer.destroy(); }catch(e){} net.peer = null; }
  }

  function wireConn(conn){
    net.conn = conn;
    conn.on('data', (data) => { net.onMessage && net.onMessage(data); });
    conn.on('close', () => { net.onDisconnected && net.onDisconnected('相手が切断しました'); });
    conn.on('error', () => { net.onDisconnected && net.onDisconnected('通信エラーが発生しました'); });
  }

  function createRoom(){
    return new Promise((resolve, reject) => {
      teardown();
      const code = genCode(6);
      const peer = new Peer(PEER_PREFIX + code);
      net.peer = peer;
      let opened = false;
      peer.on('open', () => { opened = true; resolve(code); });
      peer.on('connection', (conn) => {
        wireConn(conn);
        conn.on('open', () => { net.onConnected && net.onConnected(); });
      });
      peer.on('error', (err) => { if(!opened) reject(err); });
    });
  }

  function joinRoom(code){
    return new Promise((resolve, reject) => {
      teardown();
      const peer = new Peer();
      net.peer = peer;
      let settled = false;
      peer.on('open', () => {
        const conn = peer.connect(PEER_PREFIX + code, { reliable:true });
        conn.on('open', () => {
          if(settled) return;
          settled = true;
          wireConn(conn);
          resolve();
        });
        conn.on('error', (err) => { if(!settled){ settled = true; reject(err); } });
        setTimeout(() => { if(!settled){ settled = true; reject(new Error('timeout')); } }, 15000);
      });
      peer.on('error', (err) => { if(!settled){ settled = true; reject(err); } });
    });
  }

  function send(data){
    if(net.conn && net.conn.open) net.conn.send(data);
  }

  function disconnect(){
    net.onMessage = null;
    net.onConnected = null;
    net.onDisconnected = null;
    teardown();
  }

  net.createRoom = createRoom;
  net.joinRoom = joinRoom;
  net.send = send;
  net.disconnect = disconnect;

  CCB.net = net;
})(window.CCB);
