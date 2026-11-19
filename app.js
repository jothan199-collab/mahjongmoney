/* 麻将钱账 v7 — 删除房间密码验证、分享网站与分享房间。
   GitHub Pages 仅发布静态网页。云端多人同步由 Firestore 提供。 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const SEATS = ['东','南','西','北'];
  const RATES = {normal:1,selfDraw:1,discard:2,fly:1,exposed:2,concealed:4};
  const FAN_DEFAULT={enabled:false,mode:'hk',priceEnabled:false,pricePerUnit:0.1,hkMin:0,hkCap:13};
  const RATE_INFO = [['normal','点炮：其余两家'],['selfDraw','自摸：每家'],['discard','点炮者'],['fly','每粒飞：每家'],['exposed','明杠：每家'],['concealed','暗杠：每家']];
  const STORE_KEY='mahjong-money-multiroom-v3', ACTIVE_KEY='mahjong-active-room-v4';
  const cloudMode=!!(window.MAHJONG_FIREBASE_CONFIG?.apiKey && window.MAHJONG_FIREBASE_CONFIG?.projectId);
  const cloud=cloudMode?window.MahjongCloud:null;
  let cloudReady=false,cloudStatus=cloudMode?'云端连接中…':'本机版 · 不同步';
  const siteUrl=()=>`${location.origin}${location.pathname}${location.search}`;
  const shareUrl=id=>`${siteUrl()}#room=${encodeURIComponent(id)}`;
  const hashRoom=()=>{try{return decodeURIComponent((location.hash.match(/^#room=(.*)$/)||[])[1]||'');}catch{return '';}};
  const setRoomHash=id=>{if(cloudMode){try{history.replaceState(null,'',id?'#room='+encodeURIComponent(id):location.pathname+location.search);}catch(err){console.warn('浏览器不允许更新房间网址',err);}}};
  const PREVIOUS_KEY='mahjong-money-app-v2', OLDEST_KEY='mahjong-money-app-v1';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>'RM '+(Math.abs(v)/100).toFixed(2);
  const signed=v=>(v>0?'+':v<0?'−':'')+money(v);
  const fmtTime=ts=>new Date(Number(ts)||Date.now()).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
  const cents=v=>{const n=Number(v);return Number.isFinite(n) && n>=0 && n<=99999 && Math.abs(n*100-Math.round(n*100))<.00001?Math.round(n*100):NaN;};
  const uuid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  const freshGame=()=>{const players=SEATS.map((seat,i)=>({id:uuid(),name:seat+'家',createdAt:Date.now()+i}));return {version:2,gameName:'今晚麻将',createdAt:Date.now(),players,seats:players.map(x=>x.id),rates:{...RATES},fanConfig:{...FAN_DEFAULT},entries:[],nextSeq:1};};
  const clone=obj=>JSON.parse(JSON.stringify(obj));
  const activeEntries=s=>s.entries.filter(e=>!e.voided).slice().sort((a,b)=>a.seq-b.seq);
  const allEntries=s=>s.entries.slice().sort((a,b)=>a.seq-b.seq);
  const nameOf=(s,id)=>s.players.find(p=>p.id===id)?.name||'未知玩家';
  const getBalances=s=>{const result=Object.fromEntries(s.players.map(p=>[p.id,0]));for(const e of activeEntries(s)){for(const t of e.transfers){result[t.from]=(result[t.from]||0)-t.cents;result[t.to]=(result[t.to]||0)+t.cents;}}return result;};
  const getRoundInfo=s=>{let round=1;const map={};for(const e of allEntries(s)){map[e.id]=round;if(!e.voided&&e.type==='win')round++;}return {map,next:round,completed:round-1};};
  const getStats=s=>{const balances=getBalances(s);const result=s.players.map(p=>({id:p.id,name:p.name,active:s.seats.includes(p.id),wins:0,zimo:0,discardWin:0,discarded:0,exposed:0,concealed:0,flies:0,fanHK:0,fanMCR:0,balance:balances[p.id]||0}));const m=Object.fromEntries(result.map(x=>[x.id,x]));for(const e of activeEntries(s)){if(e.type==='win'&&m[e.winner]){m[e.winner].wins++;if(e.subtype==='zimo')m[e.winner].zimo++;else{m[e.winner].discardWin++;if(m[e.discarder])m[e.discarder].discarded++;}m[e.winner].flies+=Number(e.flies)||0;if(e.fan?.used){if(e.fan.mode==='hk')m[e.winner].fanHK+=Number(e.fan.points)||0;else if(e.fan.mode==='mcr')m[e.winner].fanMCR+=Number(e.fan.points)||0;}}if(e.type==='kong'&&m[e.actor]){if(e.subtype==='exposed')m[e.actor].exposed++;else m[e.actor].concealed++;}}return result;};
  const getPayments=s=>{const balances=getBalances(s);const owe=Object.entries(balances).filter(([,x])=>x<0).map(([id,x])=>({id,remaining:-x})).sort((a,b)=>b.remaining-a.remaining);const paid=Object.entries(balances).filter(([,x])=>x>0).map(([id,x])=>({id,remaining:x})).sort((a,b)=>b.remaining-a.remaining);const result=[];let i=0,j=0;while(i<owe.length&&j<paid.length){const n=Math.min(owe[i].remaining,paid[j].remaining);if(n>0)result.push({from:owe[i].id,to:paid[j].id,cents:n});owe[i].remaining-=n;paid[j].remaining-=n;if(!owe[i].remaining)i++;if(!paid[j].remaining)j++;}return result;};
  const volume=e=>e.transfers.reduce((s,t)=>s+t.cents,0);
  const migrate=s=>{if(!s||typeof s!=='object')throw Error('不正确的备份');if(s.version===2){if(!Array.isArray(s.players)||s.players.length<4||!Array.isArray(s.seats)||s.seats.length!==4||!Array.isArray(s.entries)||!s.rates)throw Error('备份缺少玩家、座位或记录');return {...s,nextSeq:Math.max(1,...s.entries.map(e=>(Number(e.seq)||0)+1))};}if(s.version!==1||!Array.isArray(s.players)||s.players.length!==4||!Array.isArray(s.entries))throw Error('不支持的备份格式');const players=s.players.map((n,i)=>({id:'legacy-'+i,name:String(n).slice(0,24),createdAt:s.startedAt||Date.now()}));return {version:2,gameName:s.gameName||'麻将牌局',createdAt:s.startedAt||Date.now(),players,seats:players.map(p=>p.id),rates:{...RATES,...s.rates},entries:s.entries.map((e,i)=>({...e,id:'legacy-entry-'+i,seq:i+1,voided:false,winner:Number.isInteger(e.winner)?players[e.winner].id:null,discarder:Number.isInteger(e.discarder)?players[e.discarder].id:null,actor:Number.isInteger(e.actor)?players[e.actor].id:null,transfers:e.transfers.map(t=>({from:players[t.from].id,to:players[t.to].id,cents:t.cents}))})),nextSeq:s.entries.length+1};};
  function loadStore(){
    try{
      const raw=localStorage.getItem(STORE_KEY);
      if(raw){
        const loaded=JSON.parse(raw);
        if(loaded?.version!==3||!Array.isArray(loaded.rooms))throw Error('多房间资料格式有误');
        return loaded;
      }
      const legacy=localStorage.getItem(PREVIOUS_KEY)||localStorage.getItem(OLDEST_KEY);
      const first=legacy?migrate(JSON.parse(legacy)):freshGame();
      first.id=uuid(); first.updatedAt=Date.now();
      return {version:3,rooms:[first],lastRoomId:first.id};
    }catch(error){
      console.warn('无法读取旧账本，已建立初始房间',error);
      const first=freshGame();first.id=uuid();first.updatedAt=Date.now();
      return {version:3,rooms:[first],lastRoomId:first.id};
    }
  }
  function latestStore(){
    if(cloudMode)return store;
    try{const raw=localStorage.getItem(STORE_KEY);if(!raw)return store;
      const parsed=JSON.parse(raw);if(parsed.version===3&&Array.isArray(parsed.rooms))return parsed;
    }catch(error){console.warn('读取最新房间资料失败',error);}
    return store;
  }
  function currentRoom(){const r=store.rooms.find(r=>r.id===activeRoomId);return r && Array.isArray(r.seats) && Array.isArray(r.entries) ? r : null;}
  let store=cloudMode?{version:3,rooms:[],lastRoomId:null}:loadStore();
  let activeRoomId=cloudMode?(hashRoom()||sessionStorage.getItem(ACTIVE_KEY)):sessionStorage.getItem(ACTIVE_KEY);
  if(!cloudMode&&!store.rooms.some(r=>r.id===activeRoomId))activeRoomId=store.lastRoomId||store.rooms[0]?.id||null;
  let game=currentRoom(),busy=false,manageRoomId=null,unlockRoomId=null,deleteRoomId=null,initialRoomPrompted=false;
  const ui={tab:'new',type:'win',method:'zimo',kong:'exposed',kongPay:'all',flies:0,winner:null,discarder:null,actor:null,kongPayer:null};
  const haveSeat=id=>Boolean(game?.seats.includes(id));
  const firstOther=id=>game?.seats.find(x=>x!==id)||null;
  function saveAll(){
    try{
      if(!cloudMode)localStorage.setItem(STORE_KEY,JSON.stringify(store));
      if(activeRoomId)sessionStorage.setItem(ACTIVE_KEY,activeRoomId);
      else sessionStorage.removeItem(ACTIVE_KEY);
      return true;
    }catch(error){
      notify('无法保存：浏览器储存空间不足或被禁用，请立即导出备份');
      console.error('saveAll',error);return false;
    }
  }
  saveAll();
  function notify(msg){const t=$('toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(notify.timer);notify.timer=setTimeout(()=>t.classList.add('hidden'),3500);}
  function syncChoice(){
    if(!game)return;
    if(!haveSeat(ui.winner))ui.winner=game.seats[0];
    if(!haveSeat(ui.actor))ui.actor=game.seats[0];
    if(!haveSeat(ui.discarder)||ui.discarder===ui.winner)ui.discarder=firstOther(ui.winner);
    if(!haveSeat(ui.kongPayer)||ui.kongPayer===ui.actor)ui.kongPayer=firstOther(ui.actor);
  }
  function makeTransfers(s,form){const results=[],seat=s.seats,rate=s.rates;const tx=(from,to,n)=>{const v=cents(n);if(Number.isInteger(v)&&v>0&&v<=9999900)results.push({from,to,cents:v});};if(form.type==='win'){if(!seat.includes(form.winner))return [];if(form.method==='discard'&&(!seat.includes(form.discarder)||form.discarder===form.winner))return [];for(const id of seat)if(id!==form.winner){const basic=form.method==='zimo'?rate.selfDraw:(id===form.discarder?rate.discard:rate.normal);const fanExtra=window.MahjongFan?.priceExtra(form,s)||0;tx(id,form.winner,basic+form.flies*rate.fly+fanExtra);}}else if(form.type==='kong'){if(!seat.includes(form.actor))return [];if(form.kongPay==='one'&&(!seat.includes(form.kongPayer)||form.kongPayer===form.actor))return [];for(const id of seat)if(id!==form.actor&&(form.kongPay==='all'||id===form.kongPayer))tx(id,form.actor,rate[form.kong]);}else{const a=cents(form.adjustAmount);if(seat.includes(form.adjustFrom)&&seat.includes(form.adjustTo)&&form.adjustFrom!==form.adjustTo&&a>0)results.push({from:form.adjustFrom,to:form.adjustTo,cents:a});}return results;}
  function getForm(){return {...ui,adjustFrom:$('adjustFrom').value,adjustTo:$('adjustTo').value,adjustAmount:$('adjustAmount').value,note:$('entryNote').value.trim().slice(0,80),fan:window.MahjongFan?.getPending(ui.method)||null};}
  function describe(e){if(e.type==='win')return `${nameOf(game,e.winner)} ${e.subtype==='zimo'?'自摸':'胡牌（'+nameOf(game,e.discarder)+' 点炮）'}${e.flies?' · 飞 '+e.flies+' 粒':''}${e.fan?.used?' · '+e.fan.points+(e.fan.mode==='mcr'?'分（旧记录）':'番'):''}`;if(e.type==='kong')return `${nameOf(game,e.actor)} ${e.subtype==='exposed'?'明杠':'暗杠'}`;return `${nameOf(game,e.transfers[0]?.from)} → ${nameOf(game,e.transfers[0]?.to)} 转账调整`;}
  function whoHtml(id){return esc(nameOf(game,id));}
  function scoreRanks(){
    const balances=getBalances(game);
    const sorted=game.seats.map((id,seat)=>({id,seat,balance:balances[id]||0})).sort((a,b)=>b.balance-a.balance||a.seat-b.seat);
    return Object.fromEntries(sorted.map((row,i)=>[row.id,i+1]));
  }
  function scores(){
    const balances=getBalances(game),ranks=scoreRanks();
    $('scoreGrid').innerHTML=game.seats.map((id,i)=>{
      const name=nameOf(game,id),value=balances[id]||0;
      const length=Array.from(name).length;
      const wmSize=length<=2?98:length<=4?75:length<=6?62:49;
      return `<div class="score" data-watermark="${esc(name)}" style="--wm-size:${wmSize}px">
        <div class="score-head"><span class="seat">${SEATS[i]}位</span><span class="rank-number" title="第 ${ranks[id]} 名">${ranks[id]}</span></div>
        <div class="name" title="${esc(name)}">${esc(name)}</div>
        <div class="amount ${value>0?'positive':value<0?'negative':'zero'}">${signed(value)}</div>
        <button type="button" class="quick-win" data-quick-winner="${esc(id)}" title="选择 ${esc(name)} 胡牌">🀄 ${esc(name)} 胡牌</button></div>`;
    }).join('');
    const round=getRoundInfo(game);
    $('gameTitle').textContent=game.gameName;
    $('sessionMeta').textContent=`${round.completed} 局已胡牌 · ${activeEntries(game).length} 笔有效记录 · ${game.players.length} 位登记玩家`;
    $('roundNow').textContent='进行中 · 第 '+round.next+' 局';
    $('statCounter').textContent=`${round.completed} 局已完成`;
  }
  function choiceHtml(current,exclude){return game.seats.map((id,i)=>`<button class="choice ${id===current?'active':''}" data-id="${esc(id)}" ${id===exclude?'disabled':''}><small>${SEATS[i]}位</small>${whoHtml(id)}</button>`).join('');}
  function updateChoices(){syncChoice();$('winnerChoice').innerHTML=choiceHtml(ui.winner,null);$('discardChoice').innerHTML=choiceHtml(ui.discarder,ui.winner);$('actorChoice').innerHTML=choiceHtml(ui.actor,null);$('kongPayerChoice').innerHTML=choiceHtml(ui.kongPayer,ui.actor);for(const [id,key,val] of [['typeButtons','type',ui.type],['winMethods','method',ui.method],['kongMethods','kong',ui.kong],['kongPayMethods','kongPay',ui.kongPay]]){$(id).querySelectorAll('button').forEach(b=>b.classList.toggle('active',(b.dataset.type||b.dataset.value)===val));}for(const [id,show] of [['winFields',ui.type==='win'],['kongFields',ui.type==='kong'],['adjustFields',ui.type==='adjust'],['discardField',ui.type==='win'&&ui.method==='discard'],['kongPayerField',ui.type==='kong'&&ui.kongPay==='one']])$(id).classList.toggle('hidden',!show);$('flyValue').textContent=ui.flies;const pairs=game.seats.map(id=>`<option value="${esc(id)}">${whoHtml(id)}</option>`).join('');for(const id of ['adjustFrom','adjustTo']){const select=$(id),old=select.value;select.innerHTML=pairs;select.value=game.seats.includes(old)?old:(id==='adjustFrom'?game.seats[0]:game.seats[1]);}if($('adjustFrom').value===$('adjustTo').value)$('adjustTo').value=firstOther($('adjustFrom').value);drawPreview();}
  function drawPreview(){const form=getForm(),transfers=makeTransfers(game,form);$('previewRound').textContent='第 '+getRoundInfo(game).next+' 局';$('previewLines').innerHTML=transfers.length?transfers.map(t=>`<div class="preview-line"><span>${whoHtml(t.from)} → ${whoHtml(t.to)}</span><b>${money(t.cents)}</b></div>`).join(''):'<div class="empty">请检查选择的玩家与金额。</div>';$('previewAmount').textContent=money(transfers.reduce((s,t)=>s+t.cents,0));$('recordBtn').disabled=busy||(!cloudReady&&cloudMode)||!transfers.length;}
  function historyItem(e,round){return `<div class="history-item ${e.voided?'voided':''}"><div class="history-content"><div class="history-title">第 ${round} 局 · ${esc(describe(e))} ${e.voided?'<span class="former">已撤销</span>':''}</div><div class="history-sub">${fmtTime(e.ts)} · ${money(volume(e))}${e.note?' · '+esc(e.note):''}</div></div><div class="history-right">${e.fan?.used?`<button class="btn small" data-fan-record="${esc(e.id)}">演示牌型</button>`:''}<button class="btn small ${e.voided?'':'danger'}" data-entry="${esc(e.id)}" data-undo="${e.voided?'0':'1'}">${e.voided?'恢复':'撤销'}</button></div></div>`;}
  function history(){const all=allEntries(game),info=getRoundInfo(game);$('historyRows').innerHTML=all.length?all.slice().reverse().map(e=>historyItem(e,info.map[e.id])).join(''):'<div class="empty">尚未记录任何一局。</div>';$('recentRows').innerHTML=all.filter(e=>!e.voided).slice(-4).reverse().map(e=>`<div class="preview-line"><span>第${info.map[e.id]}局 · ${esc(describe(e))}</span><b>${money(volume(e))}</b></div>`).join('')||'<div class="empty">暂时没有记录。</div>';}
  function stats(){
    const ranks=scoreRanks();
    const rows=getStats(game).sort((a,b)=>{
      if(a.active!==b.active)return a.active?-1:1;
      return a.active?ranks[a.id]-ranks[b.id]:a.name.localeCompare(b.name,'zh');
    });
    $('statsRows').innerHTML=rows.map(p=>`<tr><td>${p.active?'<span class="rank-number" style="width:23px;height:23px;font-size:13px">'+ranks[p.id]+'</span>':'—'}</td><td><b>${esc(p.name)}</b>${p.active?'':'<span class="former">离席</span>'}</td><td>${p.wins}</td><td>${p.zimo}</td><td>${p.discardWin}</td><td>${p.discarded}</td><td>${p.exposed}</td><td>${p.concealed}</td><td>${p.flies}</td><td>${p.fanHK?p.fanHK+'番':'—'}</td><td class="${p.balance>0?'positive':p.balance<0?'negative':'zero'}"><b>${signed(p.balance)}</b></td></tr>`).join('');
  }
  function settlements(){const balances=getBalances(game),payments=getPayments(game);$('settleBalances').innerHTML=game.players.map(p=>`<div class="settle-line"><span>${esc(p.name)}${game.seats.includes(p.id)?'':' <span class="former">离席</span>'}</span><strong class="${balances[p.id]>0?'positive':balances[p.id]<0?'negative':'zero'}">${signed(balances[p.id]||0)}</strong></div>`).join('');$('settlePayments').innerHTML=payments.length?payments.map(t=>`<div class="settle-line"><span>${whoHtml(t.from)} → ${whoHtml(t.to)}</span><strong>${money(t.cents)}</strong></div>`).join(''):'<div class="empty">目前无须转账。</div>';}
  function settings(){
    $('seatSettings').innerHTML=game.seats.map((id,i)=>{
      const playerName=nameOf(game,id),retired=game.players.filter(p=>!game.seats.includes(p.id));
      return `<div class="setting-seat">
        <div class="label">${SEATS[i]}位目前是<b>${esc(playerName)}</b></div>
        <div class="change-block"><input class="field" id="seatRename-${i}" maxlength="24" value="${esc(playerName)}" aria-label="${SEATS[i]}位的显示名字"><button class="btn small" data-rename="${i}" style="white-space:nowrap">改名字</button></div>
        <input class="field" id="seatNew-${i}" maxlength="24" placeholder="换人：输入新名字" aria-label="${SEATS[i]}位换入新玩家">
        <div class="swap-controls"><select class="field" id="seatOld-${i}" aria-label="${SEATS[i]}位选择旧玩家"><option value="">或找回离席玩家</option>${retired.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}（离席）</option>`).join('')}</select><button class="btn small" data-swap="${i}" style="white-space:nowrap">换人</button></div>
      </div>`;
    }).join('');
    $('rateSettings').innerHTML=RATE_INFO.map(([key,label])=>`<label>${label}<input class="field" id="rate-${key}" type="number" step="0.01" min="0" max="99999" inputmode="decimal" value="${Number(game.rates[key]).toFixed(2)}"></label>`).join('');
    const fan={...FAN_DEFAULT,...(game.fanConfig||{})};$('fanEnabled').checked=fan.mode==='mcr'?false:fan.enabled;$('fanModeRoom').value='hk';$('fanPriceEnabled').checked=fan.mode==='mcr'?false:fan.priceEnabled;$('fanPricePerUnit').value=Number(fan.pricePerUnit).toFixed(2);$('fanHkMin').value=fan.hkMin;$('fanHkCap').value=fan.hkCap;
  }
  function canManageRoom(room){return !cloudMode || !!cloud?.canManage(room);}
  function roomList(){
    const term=($('roomSearch')?.value||'').trim().toLocaleLowerCase();
    const visible=store.rooms.map((room,i)=>({room,i})).filter(x=>!term ||
      x.room.gameName.toLocaleLowerCase().includes(term) || x.room.id.toLocaleLowerCase().includes(term));
    $('syncStatus').textContent=cloudMode?`${cloudStatus} · ${store.rooms.length} 个房间`:`本机 · ${store.rooms.length} 个房间`;
    $('adminStatus').textContent=cloudMode?(cloud?.isAdmin()?'🛡 超级管理员':'普通牌友'):'本机模式';
    $('adminLoginBtn').classList.toggle('hidden',!cloudMode || !!cloud?.isAdmin());
    $('adminLogoutBtn').classList.toggle('hidden',!cloudMode || !cloud?.isAdmin());
    $('createRoom').disabled=busy||(cloudMode&&!cloudReady);
    $('roomPassword').disabled=!cloudMode;
    $('roomSearchCount').textContent=term?`找到 ${visible.length} / ${store.rooms.length} 个房间`:`共 ${store.rooms.length} 个房间`;
    $('roomList').innerHTML=visible.length?visible.map(({room,i})=>{
      const active=room.id===activeRoomId, locked=!!room.locked;
      const round=locked?null:getRoundInfo(room),hasEntries=locked?0:activeEntries(room).length;
      const manager=canManageRoom(room);
      return `<article class="room-card ${active?'current':''} ${locked?'room-faded':''}">
        <div><div class="room-card-header"><span class="room-card-label">房间 ${String(i+1).padStart(2,'0')}</span>${active?'<span class="room-current">正在选择</span>':''}</div>
        <h3>${esc(room.gameName)} ${room.hasPassword?'🔒':''}</h3>
        <p class="${room.hasPassword?'room-locked':''}">${locked?(room.hasPassword?'密码保护 · 输入密码后可查看账目':'同步账目中…'):(`${round.completed} 局完成 · ${hasEntries} 笔有效记录 · ${room.players.length} 位玩家`)}</p>
        ${manager?'<span class="room-manage-owner">'+(cloudMode?(cloud?.isAdmin()?'管理员管理':'本房间创建者'):'本机可管理')+'</span>':''}
        </div><div class="room-card-controls">
          <button class="btn ${active&&!locked?'ghost':'primary'} small" data-open-room="${esc(room.id)}" ${active&&!locked?'disabled':''}>${locked&&room.hasPassword&&!manager?'🔓 输入密码':'进入房间'}</button>
          <button class="btn small" data-share-room="${esc(room.id)}">↗ 分享房间</button>
          ${manager?`<button class="btn small" data-manage-room="${esc(room.id)}">管理／改名</button>`:''}
          ${(manager || (cloudMode && room.hasPassword))?`<button class="btn danger small" data-delete-room="${esc(room.id)}">删除房间</button>`:''}
        </div>
      </article>`;
    }).join(''):`<div class="room-empty">${term?'没有找到符合条件的房间。':cloudMode&&!cloudReady?'正在连接云端房间，请检查网络和 Firebase 设置…':'还没有房间。输入名称，点击「＋ 创建房间」即可开始。'}</div>`;
  }
  function render(){
    roomList();
    game=currentRoom();
    $('gameArea').classList.toggle('hidden',!game);
    for(const id of ['csvBtn','backupBtn'])$(id).disabled=!game;
    if(!game){window.MahjongFan?.setGame(null);return;}
    window.MahjongFan?.setGame(game);syncChoice();scores();updateChoices();history();stats();settlements();
    if(ui.tab==='settings')settings();
  }
  function switchTab(tab){ui.tab=tab;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));document.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active',x.id==='panel-'+tab));if(tab==='settings')settings();}
  function setBusy(next){busy=next;if(game)drawPreview();$('createRoom').disabled=next||(cloudMode&&!cloudReady);}
  async function changeCurrent(mutator){
    if(cloudMode){
      if(!cloudReady||!cloud)throw Error('云端尚未连接；为防止两部手机账目不一致，暂时禁止写入');
      const id=activeRoomId;
      const changed=await cloud.mutate(id,mutator);
      const pos=store.rooms.findIndex(r=>r.id===id);
      if(pos>=0)store.rooms[pos]=changed;
      game=currentRoom();render();
      return changed;
    }
    const fresh=latestStore();
    store=fresh;
    const pos=store.rooms.findIndex(r=>r.id===activeRoomId);
    if(pos<0)throw Error('当前房间已被删除，请选择其他房间');
    const changed=clone(store.rooms[pos]);
    mutator(changed);
    changed.updatedAt=Date.now();
    store.rooms[pos]=changed;game=changed;
    if(!saveAll())throw Error('修改未能写入浏览器储存');
    render();
    return changed;
  }
  async function modifyMeta(fn){
    if(busy)return;
    setBusy(true);
    try{
      await changeCurrent(meta=>{const changed=fn(meta);if(!changed)throw Error('没有变更');Object.assign(meta,changed);});
      notify('更改已保存');
    }catch(err){notify('保存失败：'+humanErr(err));console.error(err);}
    finally{setBusy(false);}
  }
  function humanErr(err){return String(err?.message||err).slice(0,105);}
  async function changeSeat(i){
    const typed=$('seatNew-'+i).value.trim(),returned=$('seatOld-'+i).value;
    if(!typed&&!returned){notify('请输入新玩家名字，或选择离席的旧玩家');return;}
    if(typed&&returned){notify('换人方式二选一，请不要同时填写');return;}
    await modifyMeta(meta=>{
      if(!meta.seats[i])throw Error('找不到座位');
      let player=returned?meta.players.find(p=>p.id===returned):meta.players.find(p=>p.name.toLocaleLowerCase()===typed.toLocaleLowerCase());
      if(returned&&!player)throw Error('旧玩家不存在');
      if(!player){if(!typed||typed.length>24)throw Error('名字须为 1–24 字');player={id:uuid(),name:typed,createdAt:Date.now()};meta.players.push(player);}
      if(meta.seats.includes(player.id))throw Error('这位玩家已在牌桌上');
      meta.seats[i]=player.id;
      return {players:meta.players,seats:meta.seats};
    });
  }
  async function renameSeat(i){
    const typed=$('seatRename-'+i)?.value.trim();
    if(!typed||typed.length>24){notify('名字须为 1–24 字');return;}
    await modifyMeta(meta=>{
      const id=meta.seats[i],person=meta.players.find(p=>p.id===id);
      if(!person)throw Error('找不到玩家');
      if(meta.players.some(p=>p.id!==id&&p.name.toLocaleLowerCase()===typed.toLocaleLowerCase()))throw Error('这个名字已被其他登记玩家使用');
      person.name=typed;return {players:meta.players};
    });
  }
  async function record(){
    if(busy||!game)return;
    const form=getForm(),initialSeats=game.seats.slice(),initialRates=JSON.stringify(game.rates);
    if(form.type==='win'&&form.fan?.used){
      const ids=(form.fan.patterns||[]).map(p=>p.id);
      const mustZimo=['self','kongflower','doublekong'];
      const mustDiscard=['robkong'];
      if(form.method!=='zimo'&&ids.some(x=>mustZimo.includes(x))){notify('所选番型需要自摸；请先更改胡牌方式或重新选择番型');return;}
      if(form.method!=='discard'&&ids.some(x=>mustDiscard.includes(x))){notify('所选番型要求点和／抢杠；请核对胡牌方式');return;}
    }
    const proposed=makeTransfers(game,form);
    if(!proposed.length){notify('请选择正确的玩家和金额');return;}
    setBusy(true);
    try{
      let entry;
      const entryId=uuid();
      await changeCurrent(meta=>{
        if(JSON.stringify(meta.seats)!==JSON.stringify(initialSeats)||JSON.stringify(meta.rates)!==initialRates)throw Error('座位或规则已更新，请重新确认');
        const transfers=makeTransfers(meta,form);
        if(!transfers.length)throw Error('本笔金额无效');
        entry={id:entryId,seq:meta.nextSeq++,ts:Date.now(),type:form.type,subtype:form.type==='win'?form.method:form.type==='kong'?form.kong:'manual',winner:form.type==='win'?form.winner:null,discarder:form.type==='win'&&form.method==='discard'?form.discarder:null,actor:form.type==='kong'?form.actor:null,flies:form.type==='win'?form.flies:0,note:form.note,fan:form.type==='win'?form.fan:null,transfers,voided:false};
        meta.entries.push(entry);
      });
      ui.flies=0;window.MahjongFan?.clearPending();$('entryNote').value='';render();
      notify('已记账：'+money(volume(entry)));
    }catch(err){notify('记账失败：'+humanErr(err));console.error(err);}
    finally{setBusy(false);}
  }
  async function toggleEntry(id,voided){
    if(busy||!game)return;
    const entry=game.entries.find(e=>e.id===id);
    if(!entry)return;
    const verb=voided?'撤销':'恢复';
    if(!confirm(`确定${verb}「${describe(entry)}」吗？撤销记录可以再恢复。`))return;
    setBusy(true);
    try{
      await changeCurrent(meta=>{
        const target=meta.entries.find(e=>e.id===id);
        if(!target)throw Error('交易不存在');
        target.voided=voided;target.voidedAt=Date.now();
      });
      notify(`已${verb}交易，局数、排名和统计都已更新`);
    }catch(err){notify('操作失败：'+humanErr(err));}
    finally{setBusy(false);}
  }
  function csvExport(){const rows=[['序号','局数','状态','记录时间','类型','详细内容','番制','番／分','番种','付款人','收款人','金额(RM)','备注']];const info=getRoundInfo(game);for(const e of allEntries(game))for(const t of e.transfers)rows.push([e.seq,info.map[e.id],e.voided?'已撤销':'有效',fmtTime(e.ts),e.type,describe(e),e.fan?.mode||'',e.fan?.points??'',e.fan?.patterns?.map(x=>x.name).join('、')||'',nameOf(game,t.from),nameOf(game,t.to),(t.cents/100).toFixed(2),e.note||'']);const cell=v=>{let txt=String(v);if(/^[=+@\-\t\r]/.test(txt))txt="'"+txt;return '"'+txt.replace(/"/g,'""')+'"';};download('麻将计分_'+safeFilename()+'.csv','\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8');}
  function safeFilename(){return game.gameName.replace(/[\\/:*?"<>|\s]/g,'_').slice(0,28)||'牌局';}
  function download(filename,content,mime){const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
  function backup(){
    if(!game)return;
    download('麻将房间_'+safeFilename()+'.json',JSON.stringify(game,null,2),'application/json');
    notify('当前房间备份已下载');
  }
  function backupAll(){
    store=latestStore();
    const accessible=store.rooms.filter(r=>Array.isArray(r.entries)&&Array.isArray(r.seats));
    const snapshot={version:3,rooms:accessible,lastRoomId:activeRoomId};
    download('麻将全部房间备份.json',JSON.stringify(snapshot,null,2),'application/json');
    notify('已备份 '+accessible.length+' 个可访问房间'+(accessible.length<store.rooms.length?'；加密且未解锁的房间未包含在内':''));
  }
  function settlementText(){const bal=getBalances(game),info=getRoundInfo(game);return [`🀄 ${game.gameName}`,`已完成 ${info.completed} 局 · 有效记录 ${activeEntries(game).length} 笔`,'','【个人余额】',...game.players.map(p=>`${p.name}${game.seats.includes(p.id)?'':'（离席）'}：${signed(bal[p.id]||0)}`),'','【建议转账】',...(getPayments(game).map(t=>`${nameOf(game,t.from)} → ${nameOf(game,t.to)}：${money(t.cents)}`))].join('\n');}
  async function copy(text){try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text);else{const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();if(!document.execCommand('copy'))throw Error('无法复制');area.remove();}notify('已复制');return true;}catch(err){notify('复制失败，请手动分享网址');return false;}}
  async function importBackup(file){
    if(!file)return;
    try{
      const str=await file.text();
      if(str.length>15000000)throw Error('备份文件过大');
      const data=JSON.parse(str);
      const originals=data?.version===3&&Array.isArray(data.rooms)?data.rooms:[data];
      if(!originals.length)throw Error('备份没有房间');
      const imported=originals.map(raw=>{
        const candidate=migrate(raw);
        if(candidate.players.some(p=>!p.id||!p.name)||candidate.seats.some(id=>!candidate.players.some(p=>p.id===id)))throw Error('玩家资料不完整');
        if(candidate.entries.some(e=>!Array.isArray(e.transfers)||e.transfers.some(t=>!candidate.players.some(p=>p.id===t.from)||!candidate.players.some(p=>p.id===t.to)||!Number.isSafeInteger(t.cents)||t.cents<0)))throw Error('账目资料不完整');
        return {...candidate,id:uuid(),gameName:(candidate.gameName||'麻将牌局').slice(0,35),updatedAt:Date.now()};
      });
      if(!confirm(`将从备份新增 ${imported.length} 个房间，旧房间不会被覆盖。确定导入？`))return;
      if(cloudMode){
        if(!cloudReady)throw Error('云端未连接');
        for(const room of imported)await cloud.create(room,'');
        for(const room of imported)if(!store.rooms.some(x=>x.id===room.id))store.rooms.push(room);
      }else{
        store=latestStore();store.rooms.push(...imported);
      }
      activeRoomId=imported[0].id;
      store.lastRoomId=activeRoomId;
      if(!saveAll())throw Error('无法保存本机房间');
      setRoomHash(activeRoomId);
      game=currentRoom();render();notify('已导入 '+imported.length+' 个新房间');
    }catch(err){notify('导入失败：'+humanErr(err));}
    finally{$('importFile').value='';$('lobbyImportFile').value='';}
  }
  async function reset(){
    if(!game)return;
    if(!confirm(`确定清空「${game.gameName}」的全部记账记录吗？此操作无法撤销，请先备份。其他房间不会受影响。`))return;
    try{
      await changeCurrent(meta=>{
        const active=meta.seats.map(id=>meta.players.find(p=>p.id===id));
        meta.players=active;meta.entries=[];meta.nextSeq=1;
      });
      notify('当前房间已清空，其他房间没有改变');
    }catch(err){notify('清空失败：'+humanErr(err));}
  }
  async function createRoom(){
    if(busy||(cloudMode&&!cloudReady))return;
    const name=$('roomName').value.trim().slice(0,35);
    const password=$('roomPassword').value;
    if(password && !cloudMode){notify('房间密码必须先配置 Firebase 云端');return;}
    if(password && (password.length<6 || password.length>64)){notify('密码至少 6 位，最多 64 位');return;}
    if(!cloudMode)store=latestStore();
    const index=store.rooms.length+1;
    const fresh=freshGame();fresh.id=uuid();fresh.updatedAt=Date.now();fresh.gameName=name||`麻将房间 ${index}`;
    setBusy(true);
    try{
      if(cloudMode)await cloud.create(fresh,password);
      if(cloudMode)fresh.hasPassword=!!password;
      if(!store.rooms.some(room=>room.id===fresh.id))store.rooms.push(fresh);
      activeRoomId=fresh.id;store.lastRoomId=activeRoomId;
      if(!saveAll())throw Error('无法保存房间');
      setRoomHash(activeRoomId);
      $('roomName').value='';$('roomPassword').value='';ui.winner=null;ui.actor=null;game=fresh;
      switchTab('new');render();notify(`已创建「${fresh.gameName}」`);
    }catch(error){notify('创建失败：'+humanErr(error));}
    finally{setBusy(false);}
  }
  function openRoom(id){
    if(!cloudMode)store=latestStore();
    const selected=store.rooms.find(room=>room.id===id);
    if(!selected){notify('找不到这个房间');return;}
    if(selected.locked && selected.hasPassword && !canManageRoom(selected)){showUnlockDialog(id);return;}
    activeRoomId=id;store.lastRoomId=id;game=currentRoom();
    ui.winner=null;ui.actor=null;ui.discarder=null;ui.kongPayer=null;
    saveAll();setRoomHash(id);switchTab('new');render();notify(game?'已进入房间：'+game.gameName:'已选择房间，正在同步账目…');
  }
  async function deleteRoom(id){
    if(busy)return;
    if(!cloudMode)store=latestStore();
    const room=store.rooms.find(r=>r.id===id);
    if(!room){notify('房间不存在或已经被删除');return;}
    if(canManageRoom(room)){await performDeleteRoom(id,null);return;}
    if(!cloudMode || !room.hasPassword){notify('公开房间只有创建者或管理员可删除；请先由房主设置房间密码');return;}
    deleteRoomId=id;
    $('deleteRoomTitle').textContent='删除「'+room.gameName+'」';
    $('deleteRoomPassword').value='';
    $('deleteDialog').showModal();
  }
  async function performDeleteRoom(id,password){
    if(busy)return;
    const room=store.rooms.find(r=>r.id===id);
    if(!room){notify('房间不存在或已经被删除');return;}
    const detail=room.locked?'该房间全部记录':`${room.entries?.length||0} 笔记录`;
    if(!confirm(`确定永久删除「${room.gameName}」吗？${detail}将被删除，不能撤销。建议先备份。其他房间不会受影响。`))return;
    setBusy(true);
    try{
      if(cloudMode){
        if(!cloudReady)throw Error('云端尚未连接');
        if(password!==null)await cloud.removeWithPassword(id,password);
        else await cloud.remove(id);
      }
      store.rooms=store.rooms.filter(r=>r.id!==id);
      if(activeRoomId===id||!store.rooms.some(r=>r.id===activeRoomId))activeRoomId=store.rooms[0]?.id||null;
      store.lastRoomId=activeRoomId;
      if(!saveAll())throw Error('删除结果保存失败');
      setRoomHash(activeRoomId);
      if($('deleteDialog').open)$('deleteDialog').close();
      $('deleteRoomPassword').value='';deleteRoomId=null;
      game=currentRoom();ui.winner=null;ui.actor=null;
      switchTab('new');render();notify('房间已删除，所有已连接的牌友将同步看到变更');
    }catch(error){notify('删除失败：'+humanErr(error));console.warn(error);}
    finally{setBusy(false);}
  }
  async function submitDeleteRoom(e){
    e.preventDefault();
    if(busy)return;
    const password=$('deleteRoomPassword').value;
    if(!password){notify('请输入房间密码才能删除');return;}
    if(!deleteRoomId){notify('请重新选择要删除的房间');return;}
    await performDeleteRoom(deleteRoomId,password);
  }
  function showUnlockDialog(id){
    const room=store.rooms.find(r=>r.id===id);if(!room)return;
    unlockRoomId=id;
    $('passwordRoomTitle').textContent='房间：'+room.gameName;
    $('roomUnlockPassword').value='';
    if(!$('passwordDialog').open)$('passwordDialog').showModal();
  }
  async function submitUnlock(e){
    e.preventDefault();
    if(!cloudMode){notify('本机房间没有云端密码');return;}
    const id=unlockRoomId,pass=$('roomUnlockPassword').value;
    try{
      await cloud.join(id,pass);
      $('passwordDialog').close();
      openRoom(id);
      notify('密码验证成功');
    }catch(err){notify('无法进入：'+humanErr(err));}
  }
  function showManageDialog(id){
    const room=store.rooms.find(r=>r.id===id);if(!room)return;
    if(!canManageRoom(room)){notify('只有房间创建者或管理员可以管理');return;}
    manageRoomId=id;
    $('manageRoomTitle').textContent=room.hasPassword?'🔒 目前有密码保护':'目前是公开房间';
    $('manageNewName').value=room.gameName;
    $('manageNewPassword').value='';
    $('manageRemovePassword').checked=false;
    $('manageNewPassword').disabled=false;
    $('manageNewPassword').disabled=!cloudMode;
    $('manageRemovePassword').disabled=!cloudMode || !room.hasPassword;
    if(!$('manageDialog').open)$('manageDialog').showModal();
  }
  async function submitManage(e){
    e.preventDefault();
    const id=manageRoomId,room=store.rooms.find(r=>r.id===id);
    if(!room||!canManageRoom(room)){notify('没有房间管理权限');return;}
    const name=$('manageNewName').value.trim(),pass=$('manageNewPassword').value,remove=$('manageRemovePassword').checked;
    if(!name||name.length>35){notify('房间名称须为 1–35 字');return;}
    if(pass && (pass.length<6||pass.length>64)){notify('新密码须为 6–64 字符');return;}
    setBusy(true);
    try{
      if(cloudMode){
        if(remove || pass)await cloud.setPassword(id,remove?'':pass);
        if(name!==room.gameName)await cloud.rename(id,name);
      }else if(name!==room.gameName){
        store=latestStore();
        const target=store.rooms.find(r=>r.id===id);
        if(!target)throw Error('房间已不存在');
        target.gameName=name;target.updatedAt=Date.now();saveAll();
      }
      $('manageDialog').close();render();notify('房间管理设置已保存');
    }catch(err){notify('管理失败：'+humanErr(err));console.warn(err);}
    finally{setBusy(false);}
  }
  async function submitAdmin(e){
    e.preventDefault();
    if(!cloudMode){notify('请先配置 Firebase 云端');return;}
    try{
      await cloud.loginAdmin($('adminEmail').value,$('adminPassword').value);
      $('adminPassword').value='';$('adminDialog').close();notify('管理员登录成功');
    }catch(err){notify('登录失败：'+humanErr(err));}
  }
  async function shareLink(title,message,url){
    if(!/^https:\/\//i.test(url)){notify('请先部署到 GitHub Pages，才能分享正式网址');return;}
    if(typeof navigator.share==='function'){
      try{await navigator.share({title,text:message,url});return;}
      catch(err){if(err?.name==='AbortError')return;}
    }
    if(await copy(url))notify('链接已复制，可以贴到 WhatsApp 群组');
  }
  async function shareWebsite(){
    await shareLink('🀄 麻将钱账','打开麻将算钱网站，选择房间一起记账',siteUrl());
  }
  async function shareRoom(id){
    const room=store.rooms.find(r=>r.id===id);
    if(!room){notify('房间不存在');return;}
    if(!cloudMode){notify('本机模式不能跨手机共享房间，请先配置 Firebase');return;}
    await shareLink('🀄 '+room.gameName,'来「'+room.gameName+'」麻将房间一起记账'+(room.hasPassword?'（进入时需输入房间密码）':''),shareUrl(id));
  }
  async function shareCurrentRoom(){
    if(activeRoomId)await shareRoom(activeRoomId);
    else notify('请先进入或建立房间');
  }
  function onRemoteRooms(rooms,status){
    cloudReady=status==='online';cloudStatus=cloudReady?'云端已同步':status==='offline'?'云端离线 · 暂停写入':status==='loading'?'云端连接中…':`连接错误：${status}`;
    const oldId=activeRoomId;
    store={version:3,rooms,lastRoomId:oldId};
    const target=hashRoom();
    if(target&&store.rooms.some(r=>r.id===target))activeRoomId=target;
    else if(!store.rooms.some(r=>r.id===activeRoomId))activeRoomId=store.rooms[0]?.id||null;
    store.lastRoomId=activeRoomId;
    if(activeRoomId!==oldId){ui.winner=null;ui.actor=null;ui.discarder=null;ui.kongPayer=null;}
    game=currentRoom();saveAll();render();
    if(target&&!initialRoomPrompted && store.rooms.some(r=>r.id===target)){
      initialRoomPrompted=true;
      const requested=store.rooms.find(r=>r.id===target);
      if(requested.locked && requested.hasPassword && !canManageRoom(requested))showUnlockDialog(target);
    }
  }
  function wire(){
    document.addEventListener('click',e=>{
      const tab=e.target.closest('[data-tab]');if(tab){switchTab(tab.dataset.tab);return;}
      const open=e.target.closest('[data-open-room]');if(open){openRoom(open.dataset.openRoom);return;}
      const del=e.target.closest('[data-delete-room]');if(del){deleteRoom(del.dataset.deleteRoom);return;}
      const share=e.target.closest('[data-share-room]');if(share){shareRoom(share.dataset.shareRoom);return;}
      const manage=e.target.closest('[data-manage-room]');if(manage){showManageDialog(manage.dataset.manageRoom);return;}
      const close=e.target.closest('[data-close-dialog]');if(close){$(close.dataset.closeDialog).close();return;}
      const quick=e.target.closest('[data-quick-winner]');if(quick){ui.type='win';ui.winner=quick.dataset.quickWinner;ui.discarder=firstOther(ui.winner);switchTab('new');updateChoices();$('recordBtn').scrollIntoView({behavior:'smooth',block:'center'});notify('已选择赢家，确认胡牌方式后记账');return;}
      const rename=e.target.closest('[data-rename]');if(rename){renameSeat(Number(rename.dataset.rename));return;}
      const swap=e.target.closest('[data-swap]');if(swap){changeSeat(Number(swap.dataset.swap));return;}
      const oldFan=e.target.closest('[data-fan-record]');if(oldFan){const e0=game?.entries.find(x=>x.id===oldFan.dataset.fanRecord);if(e0?.fan){window.MahjongFan?.showRecordedFan(e0.fan);switchTab('fan');}return;}
      const entry=e.target.closest('[data-entry]');if(entry){toggleEntry(entry.dataset.entry,entry.dataset.undo==='1');return;}
    });
    $('typeButtons').addEventListener('click',e=>{const b=e.target.closest('button[data-type]');if(b){ui.type=b.dataset.type;updateChoices();}});
    for(const [container,key] of [['winnerChoice','winner'],['discardChoice','discarder'],['actorChoice','actor'],['kongPayerChoice','kongPayer']]){
      $(container).addEventListener('click',e=>{const b=e.target.closest('button[data-id]');if(!b||b.disabled)return;ui[key]=b.dataset.id;if(key==='winner')ui.discarder=firstOther(ui.winner);if(key==='actor')ui.kongPayer=firstOther(ui.actor);updateChoices();});
    }
    for(const [container,key] of [['winMethods','method'],['kongMethods','kong'],['kongPayMethods','kongPay']]){
      $(container).addEventListener('click',e=>{const b=e.target.closest('button[data-value]');if(!b)return;ui[key]=b.dataset.value;updateChoices();});
    }
    $('flyMinus').addEventListener('click',()=>{ui.flies=Math.max(0,ui.flies-1);updateChoices();});
    $('flyPlus').addEventListener('click',()=>{ui.flies=Math.min(99,ui.flies+1);updateChoices();});
    ['adjustFrom','adjustTo','adjustAmount'].forEach(id=>$(id).addEventListener('input',drawPreview));
    $('recordBtn').addEventListener('click',record);
    $('csvBtn').addEventListener('click',csvExport);$('historyCsv').addEventListener('click',csvExport);
    $('backupBtn').addEventListener('click',backup);$('backupBtn2').addEventListener('click',backup);
    $('backupAllBtn').addEventListener('click',backupAll);
    $('backupAllLobby').addEventListener('click',backupAll);
    $('copySettlement').addEventListener('click',()=>copy(settlementText()));
    $('saveFanSettings').addEventListener('click',()=>{
      const newFan={enabled:$('fanEnabled').checked,mode:'hk',priceEnabled:$('fanPriceEnabled').checked,pricePerUnit:Number($('fanPricePerUnit').value),hkMin:Number($('fanHkMin').value),hkCap:Number($('fanHkCap').value)};
      if(newFan.mode!=='hk'||!Number.isInteger(newFan.hkMin)||newFan.hkMin<0||newFan.hkMin>13||!Number.isInteger(newFan.hkCap)||newFan.hkCap<1||newFan.hkCap>30||newFan.hkMin>newFan.hkCap||!Number.isFinite(newFan.pricePerUnit)||newFan.pricePerUnit<0||newFan.pricePerUnit>1000||Math.round(newFan.pricePerUnit*100)!==newFan.pricePerUnit*100){notify('番数规则或金额不正确，请重新检查');return;}
      modifyMeta(()=>({fanConfig:newFan}));
    });
    $('saveSettings').addEventListener('click',()=>{
      const rates={};
      for(const [key] of RATE_INFO){const val=$('rate-'+key).value.trim();if(!/^\d+(\.\d{1,2})?$/.test(val)||!Number.isInteger(cents(val))){notify('金额请输入 0 到 99999，最多两位小数');return;}rates[key]=Number(val);}
      modifyMeta(()=>({rates}));
    });
    $('importFile').addEventListener('change',e=>importBackup(e.target.files[0]));
    $('lobbyImportFile').addEventListener('change',e=>importBackup(e.target.files[0]));
    $('resetBtn').addEventListener('click',reset);
    $('createRoom').addEventListener('click',createRoom);
    $('shareWebsite').addEventListener('click',shareWebsite);
    $('shareCurrentRoom').addEventListener('click',shareCurrentRoom);
    $('roomSearch').addEventListener('input',roomList);
    $('passwordForm').addEventListener('submit',submitUnlock);
    $('deleteRoomForm').addEventListener('submit',submitDeleteRoom);
    $('manageForm').addEventListener('submit',submitManage);
    $('adminForm').addEventListener('submit',submitAdmin);
    $('adminLoginBtn').addEventListener('click',()=>{if(!cloudMode){notify('管理员登录必须先配置 Firebase');return;}$('adminDialog').showModal();});
    $('adminLogoutBtn').addEventListener('click',async()=>{try{await cloud.logoutAdmin();onRemoteRooms([],'loading');notify('已退出管理员账号');}catch(err){notify('退出失败：'+humanErr(err));}});
    $('manageRemovePassword').addEventListener('change',()=>{$('manageNewPassword').disabled=$('manageRemovePassword').checked;});
    $('roomName').addEventListener('keydown',e=>{if(e.key==='Enter')createRoom();});
    window.addEventListener('storage',e=>{
      if(cloudMode||e.key!==STORE_KEY)return;
      store=latestStore();
      if(!store.rooms.some(r=>r.id===activeRoomId)){
        activeRoomId=store.rooms[0]?.id||null;
        if(activeRoomId)sessionStorage.setItem(ACTIVE_KEY,activeRoomId);else sessionStorage.removeItem(ACTIVE_KEY);
      }
      game=currentRoom();render();
    });
  }
  window.MahjongFan?.init({onApply:()=>drawPreview(),onPreview:()=>drawPreview()});
  wire();render();
  if(cloudMode){
    if(!cloud){cloudStatus='找不到云端连接模块，请检查 cloud-sync.js';roomList();}
    else cloud.init(onRemoteRooms,()=>{roomList();}).catch(err=>{
      cloudReady=false;cloudStatus='连接错误：'+humanErr(err);render();console.error('Firebase init',err);
    });
  }
  window.__mahjongVerify={freshGame,makeTransfers,getStats,getBalances,getRoundInfo,getPayments,migrate,getGame:()=>game,getStore:()=>store,createRoom,openRoom,deleteRoom,performDeleteRoom,shareRoom,shareWebsite,siteUrl,shareUrl,scoreRanks,record,changeSeat,renameSeat,toggleEntry,roomList,showManageDialog,showUnlockDialog};
})();
