/* 麻将钱账 v6：公开房间目录 + 受规则保护的牌局 + 独立管理员登录。
   GitHub Pages 静态托管；Firestore 负责跨手机实时同步。
   成员的密码验证在 Firestore Security Rules 执行，不只是浏览器弹窗。 */
(() => {
  'use strict';
  const cfg = window.MAHJONG_FIREBASE_CONFIG;
  if (!cfg?.apiKey || !cfg?.projectId) { window.MahjongCloud = null; return; }
  const VERSION = '10.14.1';
  const DIRECTORY = 'mahjong_room_index_v5';
  const GAMES = 'mahjong_rooms_v5';
  const SECRETS = 'mahjong_room_secrets_v5';
  const MEMBERS = 'mahjong_room_members_v5';
  const DELETE_AUTH = 'mahjong_room_delete_authorizations_v5';
  const SESSION_KEY = 'mahjong-joined-rooms-v5';
  let db, auth, onChange, onStatus, unsubscribeDirectory = null, directory = [], currentStatus = 'loading';
  const gameDocs = new Map(), subscriptions = new Map();
  let joined;
  try { joined = new Map(JSON.parse(localStorage.getItem(SESSION_KEY) || '[]')); }
  catch { joined = new Map(); }
  const deepClone = x => JSON.parse(JSON.stringify(x));
  const indexRef = id => db.collection(DIRECTORY).doc(id);
  const gameRef = id => db.collection(GAMES).doc(id);
  const secretRef = id => db.collection(SECRETS).doc(id);
  const memberRef = (id, uid) => db.collection(MEMBERS).doc(id).collection('users').doc(uid);
  const deleteAuthRef = (id, userId) => db.collection(DELETE_AUTH).doc(id).collection('users').doc(userId);
  function uid() { return auth?.currentUser?.uid || ''; }
  function isAdmin() { return !!(cfg.adminUid && uid() === cfg.adminUid && !auth.currentUser.isAnonymous); }
  function canManage(room) { return !!room && (isAdmin() || (uid() && room.ownerUid === uid())); }
  function loadScript(src) {
    return new Promise((resolve,reject) => {
      const el=document.createElement('script'); el.src=src; el.onload=resolve;
      el.onerror=()=>reject(new Error('Firebase SDK 载入失败，请检查网络'));
      document.head.appendChild(el);
    });
  }
  function validate(game) {
    if (!game || game.version!==2 || !game.id || !game.ownerUid ||
        !Array.isArray(game.players) || game.players.length<4 || game.players.length>100 ||
        !Array.isArray(game.seats) || game.seats.length!==4 || !Array.isArray(game.entries) ||
        !game.rates || game.entries.length>1300) throw Error('房间数据格式不正确或记录过多');
    if (new TextEncoder().encode(JSON.stringify(game)).length>700000)
      throw Error('房间容量接近限制，请导出备份后创建新房间');
  }
  async function proof(password,salt,purpose='join') {
    if (!crypto?.subtle) throw Error('密码验证要求 HTTPS 安全连接');
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password.normalize('NFKC')),
      'PBKDF2',false,['deriveBits']);
    const roomSalt=Uint8Array.from(salt.match(/.{2}/g).map(v=>parseInt(v,16)));
    const saltBytes=purpose==='delete'
      ? Uint8Array.from([...new TextEncoder().encode('mahjong-room-delete:'), ...roomSalt])
      : roomSalt;
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:150000,salt:saltBytes},key,256);
    return Array.from(new Uint8Array(bits)).map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  function salt() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(v=>v.toString(16).padStart(2,'0')).join('');
  }
  function emit() {
    if (!onChange) return;
    onChange(directory.map(meta => {
      const data=gameDocs.get(meta.id);
      return data ? {...deepClone(data),id:meta.id,hasPassword:meta.hasPassword,ownerUid:meta.ownerUid,locked:false} :
        {...meta,gameName:meta.name,locked:true};
    }),currentStatus);
  }
  function shouldSubscribe(meta) {
    return !meta.hasPassword || canManage(meta) || joined.get(meta.id) === meta.accessVersion;
  }
  function syncSubscriptions() {
    const ids=new Set(directory.filter(shouldSubscribe).map(x=>x.id));
    for(const [id,off] of subscriptions){if(!ids.has(id)){off();subscriptions.delete(id);gameDocs.delete(id);}}
    for(const meta of directory){
      if(!ids.has(meta.id) || subscriptions.has(meta.id))continue;
      const off=gameRef(meta.id).onSnapshot(snap=>{
        if(snap.exists){gameDocs.set(meta.id,snap.data());}else{gameDocs.delete(meta.id);}
        emit();
      },err=>{
        gameDocs.delete(meta.id);
        subscriptions.delete(meta.id); // 权限改变时锁定房间；用户可重新输入密码。
        joined.delete(meta.id);
        saveJoined();
        console.warn('房间无法读取',meta.id,err.code||err.message);
        emit();
      });
      subscriptions.set(meta.id,off);
    }
    for(const id of [...gameDocs.keys()])if(!directory.some(r=>r.id===id))gameDocs.delete(id);
  }
  function saveJoined(){try{localStorage.setItem(SESSION_KEY,JSON.stringify([...joined.entries()]));}catch{}}
  function startDirectory() {
    if(unsubscribeDirectory)unsubscribeDirectory();
    for(const off of subscriptions.values())off();
    subscriptions.clear();gameDocs.clear();directory=[];
    currentStatus='loading';emit();
    unsubscribeDirectory=db.collection(DIRECTORY).onSnapshot({includeMetadataChanges:true},snap=>{
      directory=snap.docs.map(doc=>({...doc.data(),id:doc.id})).sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id));
      currentStatus=snap.metadata.fromCache?'offline':'online';
      syncSubscriptions();emit();
    },err=>{currentStatus=`错误：${err.message}`;emit();});
  }
  async function init(change,status) {
    onChange=change;onStatus=status;
    const base=`https://www.gstatic.com/firebasejs/${VERSION}`;
    await loadScript(`${base}/firebase-app-compat.js`);
    await loadScript(`${base}/firebase-auth-compat.js`);
    await loadScript(`${base}/firebase-firestore-compat.js`);
    if(!firebase.apps.length)firebase.initializeApp(cfg);
    auth=firebase.auth(); db=firebase.firestore();
    auth.onAuthStateChanged(async user=>{
      if(!user){
        try{await auth.signInAnonymously();}catch(err){currentStatus=`登录错误：${err.message}`;emit();}
        return;
      }
      onStatus?.(isAdmin()?'admin':'member');
      startDirectory();
    });
    window.addEventListener('offline',()=>{currentStatus='offline';emit();});
  }
  async function create(game,password='') {
    if(!db || !uid())throw Error('云端未连接');
    const fields=['id','ownerUid','version','gameName','createdAt','updatedAt','players','seats','rates','entries','nextSeq'];
    const clean=Object.fromEntries(fields.filter(k=>game[k]!==undefined).map(k=>[k,deepClone(game[k])]));
    clean.ownerUid=uid();game.ownerUid=uid(); validate(clean);
    const hasPassword=!!password;
    if(hasPassword && (password.length<6 || password.length>64))throw Error('房间密码须为 6–64 个字符');
    const passSalt=hasPassword?salt():'';
    const hash=hasPassword?await proof(password,passSalt):'';
    const deletionHash=hasPassword?await proof(password,passSalt,'delete'):'';
    const now=Date.now();
    const directoryData={name:game.gameName,ownerUid:uid(),hasPassword,salt:passSalt,accessVersion:1,createdAt:now,updatedAt:now};
    const batch=db.batch();
    batch.set(indexRef(game.id),directoryData);
    batch.set(secretRef(game.id),{ownerUid:uid(),verifier:hash,deleteVerifier:deletionHash,updatedAt:now});
    batch.set(gameRef(game.id),clean);
    await batch.commit();
    return clean;
  }
  async function mutate(id,fn) {
    if(!db)throw Error('云端未连接');
    return db.runTransaction(async tx=>{
      const ref=gameRef(id), snap=await tx.get(ref);
      if(!snap.exists)throw Error('房间不存在或无权进入');
      const game=deepClone({...snap.data(),id});
      fn(game);game.updatedAt=Date.now();validate(game);
      tx.set(ref,game);return game;
    });
  }
  async function rename(id,name) {
    if(!db)throw Error('云端未连接');
    if(!name.trim()||name.length>35)throw Error('房间名称须为 1–35 字');
    await db.runTransaction(async tx=>{
      const ref=gameRef(id),idx=indexRef(id);
      const [room,meta]=await Promise.all([tx.get(ref),tx.get(idx)]);
      if(!room.exists||!meta.exists)throw Error('房间不存在');
      tx.update(ref,{gameName:name,updatedAt:Date.now()});
      tx.update(idx,{name,updatedAt:Date.now()});
    });
  }
  async function setPassword(id,newPassword){
    if(!db)throw Error('云端未连接');
    if(newPassword&&(newPassword.length<6||newPassword.length>64))throw Error('房间密码须为 6–64 个字符');
    const hasPassword=!!newPassword,passSalt=hasPassword?salt():'';
    const hash=hasPassword?await proof(newPassword,passSalt):'';
    const deletionHash=hasPassword?await proof(newPassword,passSalt,'delete'):'';
    await db.runTransaction(async tx=>{
      const idx=indexRef(id),secret=secretRef(id);
      const meta=await tx.get(idx);
      if(!meta.exists)throw Error('房间不存在');
      const version=(meta.data().accessVersion||1)+1;
      tx.update(idx,{hasPassword,salt:passSalt,accessVersion:version,updatedAt:Date.now()});
      tx.set(secret,{ownerUid:meta.data().ownerUid,verifier:hash,deleteVerifier:deletionHash,updatedAt:Date.now()});
    });
    if(!hasPassword)joined.delete(id);
    saveJoined();
  }
  async function join(id,password){
    if(!db||!uid())throw Error('尚未连接 Firebase');
    const snap=await indexRef(id).get();
    if(!snap.exists)throw Error('找不到房间');
    const meta=snap.data();
    if(!meta.hasPassword||canManage(meta))return true;
    if(!password)throw Error('请输入房间密码');
    const hash=await proof(password,meta.salt);
    await memberRef(id,uid()).set({uid:uid(),proof:hash,accessVersion:meta.accessVersion,createdAt:Date.now()});
    joined.set(id,meta.accessVersion);saveJoined();
    // 监听器异步返回房间；先读取一次，以便点「进入」后尽快显示。
    try{const s=await gameRef(id).get();if(s.exists)gameDocs.set(id,s.data());}catch(err){joined.delete(id);saveJoined();throw Error('验证失败：密码不正确或没有访问权限');}
    syncSubscriptions();emit();return true;
  }
  async function remove(id){
    if(!db)throw Error('云端未连接');
    const b=db.batch();b.delete(gameRef(id));b.delete(secretRef(id));b.delete(indexRef(id));
    await b.commit();joined.delete(id);saveJoined();
  }
  // 原子批次：同一次请求写入新鲜的密码校验凭证，并删除房间三份文档。
  // Firestore Rules 验证凭证、密码派生值和服务器时间一致，拒绝绕过弹窗的直接删除。
  async function removeWithPassword(id,password){
    if(!db || !uid())throw Error('云端尚未连接');
    if(!password)throw Error('请输入房间密码');
    const metadata=await indexRef(id).get({source:'server'});
    if(!metadata.exists)throw Error('房间已不存在');
    const m=metadata.data();
    if(!m.hasPassword)throw Error('此房间没有密码，请联系创建者或管理员删除');
    const hash=await proof(password,m.salt,'delete');
    const b=db.batch();
    b.set(deleteAuthRef(id,uid()),{
      uid:uid(),proof:hash,createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
    b.delete(gameRef(id));b.delete(secretRef(id));b.delete(indexRef(id));
    try{await b.commit();}
    catch(err){if(err?.code==='permission-denied')throw Error('房间密码不正确，或房间密码刚被修改');throw err;}
    joined.delete(id);saveJoined();gameDocs.delete(id);
  }
  async function loginAdmin(email,password){
    if(!cfg.adminUid || cfg.adminUid==='填写管理员UID')throw Error('请先在 firebase-config.js 配置管理员 UID');
    const result=await auth.signInWithEmailAndPassword(email.trim(),password);
    if(result.user.uid!==cfg.adminUid){await auth.signOut();throw Error('这个账号没有被指定为管理员');}
    return true;
  }
  async function logoutAdmin(){await auth.signOut();}
  window.MahjongCloud={init,create,mutate,rename,setPassword,join,remove,loginAdmin,logoutAdmin,
    uid,isAdmin,canManage,removeWithPassword};
})();
