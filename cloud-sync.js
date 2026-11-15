/* 云端房间同步（Firebase Cloud Firestore）。
   所有手机都可编辑同一个房间，但无需在页面上选择自己是谁。
   使用匿名认证仅用于 Firebase 安全规则，而非玩家身份。 */
(() => {
  'use strict';
  const config = window.MAHJONG_FIREBASE_CONFIG;
  if (!config || !config.apiKey || !config.projectId) {
    window.MahjongCloud = null;
    return;
  }
  const COLLECTION = 'mahjong_rooms_v4';
  const VERSION = '10.14.1';
  let firestore, onChange, onStatus, latestRooms = [];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error('无法载入 Firebase，请检查网络')); 
      document.head.appendChild(script);
    });
  }
  function validate(game) {
    if (!game || game.version !== 2 || !game.id || !Array.isArray(game.players) ||
      !Array.isArray(game.seats) || game.seats.length !== 4 ||
      !Array.isArray(game.entries) || !game.rates ||
      game.entries.length > 1300) throw new Error('房间资料格式不正确或记录过多，请备份后建立新房间');
    const bytes = new TextEncoder().encode(JSON.stringify(game)).length;
    if (bytes > 700000) throw new Error('云端单房间资料接近容量限制，请备份后建立新房间');
  }
  async function init(change, status) {
    onChange = change;
    onStatus = status;
    onStatus('loading');
    const base = `https://www.gstatic.com/firebasejs/${VERSION}`;
    await loadScript(`${base}/firebase-app-compat.js`);
    await loadScript(`${base}/firebase-auth-compat.js`);
    await loadScript(`${base}/firebase-firestore-compat.js`);
    if (!firebase.apps.length) firebase.initializeApp(config);
    await firebase.auth().signInAnonymously();
    firestore = firebase.firestore();
    firestore.collection(COLLECTION).onSnapshot({ includeMetadataChanges: true }, snapshot => {
      latestRooms = snapshot.docs.map(doc => ({...doc.data(), id: doc.id}));
      latestRooms.sort((a,b) => (a.createdAt||0)-(b.createdAt||0) || a.id.localeCompare(b.id));
      onChange(latestRooms, snapshot.metadata.fromCache ? 'offline' : 'online');
    }, error => {
      onChange(latestRooms, `错误：${error.message}`);
    });
    window.addEventListener('offline', () => onChange(latestRooms, 'offline'));
  }
  async function create(game) {
    if (!firestore) throw new Error('云端未连接');
    validate(game);
    const ref = firestore.collection(COLLECTION).doc(game.id);
    await firestore.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (snapshot.exists) throw new Error('房间编号已存在');
      tx.set(ref, game);
    });
  }
  async function mutate(id, fn) {
    if (!firestore) throw new Error('云端未连接');
    const ref = firestore.collection(COLLECTION).doc(id);
    // Firestore 事务可在多部手机同时写入时重试，防止其中一笔被覆盖。
    return firestore.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw new Error('房间已被删除');
      const current = JSON.parse(JSON.stringify({...snapshot.data(),id}));
      fn(current);
      current.updatedAt = Date.now();
      validate(current);
      tx.set(ref, current);
      return current;
    });
  }
  async function remove(id) {
    if (!firestore) throw new Error('云端未连接');
    const ref=firestore.collection(COLLECTION).doc(id);
    await firestore.runTransaction(async tx => {
      const snap=await tx.get(ref);
      if (!snap.exists) throw new Error('房间已经删除');
      tx.delete(ref);
    });
  }
  window.MahjongCloud = { init, create, mutate, remove };
})();
