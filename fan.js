/* 香港麻将单一番制：番表、动态示范、手牌辅助识别、可选结算加价。 */
(function(){
'use strict';
const data=window.MahjongFanData;
const $=id=>document.getElementById(id);
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={m:'万',p:'筒',s:'索',E:'东',S:'南',W:'西',N:'北',R:'中',G:'发',B:'白'};
const numeral=['','一','二','三','四','五','六','七','八','九'];
const SUITS=['m','p','s'];const HONORS=['E','S','W','N','R','G','B'];
const TILECODES=[...SUITS.flatMap(s=>Array.from({length:9},(_,i)=>s+(i+1))),...HONORS];
const RULES={hk:data.HK};
const DEFAULT_CONFIG={enabled:false,mode:'hk',priceEnabled:false,pricePerUnit:0.1,hkMin:0,hkCap:13};
let game=null, onApply=()=>{}, onPreview=()=>{}, onSave=()=>{};
let viewMode='hk', selected=new Set(), multiplicities={}, selectionOrigin='manual', previewRule=null, search='', hand=[], pending=null, lastAnalysis=null, studioReady=false;
let demoSerial=0;
function cfg(){const old=game?.fanConfig||{};const result={...DEFAULT_CONFIG,...old,mode:'hk'};if(old.mode==='mcr'){result.enabled=false;result.priceEnabled=false;}return result;}
function byId(id){return RULES[viewMode].find(r=>r.id===id);}
function getRules(){return RULES[viewMode];}
function formatTile(code){
 if(!code)return '';
 if(/^f[1-8]$/.test(code))return `<span class="fan-honor green" style="font-size:22px">${['春','夏','秋','冬','梅','兰','竹','菊'][Number(code.slice(1))-1]}</span>`;
 if(HONORS.includes(code))return `<span class="fan-honor ${code==='R'?'red':code==='G'?'green':code==='B'?'white':''}">${code==='B'?'白':names[code]}</span>`;
 const suit=code[0],n=Number(code.slice(1));
 if(suit==='m')return `<span class="fan-number">${numeral[n]}</span><span class="fan-wan">萬</span>`;
 if(suit==='p'){
  const pos=Array.from({length:n},(_,i)=>i);const cells=Array.from({length:9},(_,i)=>{
    const shown=n===1?i===4:n===2?[1,7].includes(i):n===3?[0,4,8].includes(i):n===4?[0,2,6,8].includes(i):n===5?[0,2,4,6,8].includes(i):n===6?[0,2,3,5,6,8].includes(i):n===7?[0,2,3,4,5,6,8].includes(i):n===8?i!==4:true;
    return `<span class="${shown?'fan-dot '+((i%3===1)?'red':i%2?'green':''):' '}" style="${shown?'':'visibility:hidden'}"></span>`;
  }).join('');return `<span class="fan-dots">${cells}</span>`;
 }
 if(n===1)return `<span class="fan-bird">🦜</span>`;
 const active=Array.from({length:9},(_,i)=>i).filter((_,i)=>i<n);
 return `<span class="fan-bamboo">${Array.from({length:9},(_,i)=>`<span class="${active.includes(i)?'fan-stick '+(i%4===2?'red':''):''}" style="${active.includes(i)?'':'visibility:hidden'}"></span>`).join('')}</span>`;
}
function tile(code,{animated=false,index=0,clickable=false,last=false}={}){
 return `<span class="fan-tile ${animated?'demo-enter':''} ${last?'last-tile':''}" ${clickable?'data-fan-hand-remove="'+index+'" role="button" tabindex="0" title="点击移除此牌"':''} style="--deal-index:${index}">${formatTile(code)}</span>`;
}
function tileName(code){return code[0]==='f'?'花牌'+code.slice(1):HONORS.includes(code)?names[code]+'牌':numeral[Number(code.slice(1))]+names[code[0]];}
function sampleGroups(str){return String(str||'').split('/').map(g=>g.trim().split(/\s+/).filter(Boolean)).filter(g=>g.length);}
function showDemo(rule){
 previewRule=rule||getRules()[0];demoSerial++;
 const example=previewRule?.example||'';const groups=sampleGroups(example);
 $('fanDemoName').textContent=previewRule?previewRule.name+' · '+previewRule.score+' 番':'牌型示范';
 $('fanDemoExplanation').textContent=previewRule?.description||'点击左边番种观看牌型示范。';
 $('fanDemoLegal').textContent=groups.length?`教学${previewRule?.conceptOnly?'概念牌例':'牌谱'} · ${groups.reduce((sum,g)=>sum+g.length,0)} 张 · 动画发牌${previewRule?.conceptOnly?' · 过程／条件须另外确认':''}${groups.reduce((sum,g)=>sum+g.length,0)===14?'（14张牌）':''}`:'此番需要特殊过程／牌型，规则定义如下，须人工确认。';
 const flat=groups.flat();let index=0;
 $('fanDemoTiles').innerHTML=flat.length?groups.map(g=>`<div class="fan-set">${g.map(x=>tile(x,{animated:true,index:index++,last:flat.length===14&&index===flat.length})).join('')}</div>`).join(''):'<div class="fan-demo-message">此类番种涉及和牌过程、暗明牌状态或复杂组合；请参照规则定义，并使用下方「14张手牌试算」操作。</div>';
 $('fanAddRule').disabled=!previewRule;
 const more=$('fanMoreRule');if(more){more.classList.toggle('hidden',maxQty(previewRule?.id)===1);more.textContent='＋ 次数（目前 '+(multiplicities[previewRule?.id]||0)+'/'+maxQty(previewRule?.id)+'）';}
 $('fanLoadDemo').disabled=!groups.length || flat.length!==14;
 $('fanAddRule').textContent=selected.has(previewRule?.id)?'✓ 已选，点击移除':'＋ 添加此番';
}
function renderRules(){
 const term=search.toLocaleLowerCase(),rules=getRules().filter(r=>r.name.toLowerCase().includes(term)||r.description.toLowerCase().includes(term)||String(r.score)===term||String(r.index||'')===term);
 $('fanRuleCount').textContent=`显示 ${rules.length}/${getRules().length} 种番型`;
 $('fanRuleList').innerHTML=rules.map(r=>`<button type="button" class="fan-rule ${previewRule?.id===r.id?'selected':''}" data-fan-show="${r.id}"><span class="fan-points">${r.score}番</span><span class="fan-rule-text"><b>${r.index?'<span class="fan-index">#'+r.index+'</span> ':''}${h(r.name)}</b><small>${h(r.description)}</small>${r.house?'<small class="fan-manual">自订桌规</small>':''}</span></button>`).join('')||'<div class="empty">没有找到相符的番型。</div>';
}
const SPECIAL_HK=['big4','thirteen','fourkong','heaven','earth','human','allhonor','pureterm','nine'];
function normalizeSelection(){
 const ids=Array.from(selected);
 if(viewMode==='hk'){
  for(const r of ids){if(r==='full')selected.delete('half');if(r==='half'&&selected.has('full'))selected.delete('half');}
  const exclusives=[['big4','small4','seatwind','roundwind','pungs','half'],['big3','small3','dragon'],['small3','dragon'],['termhon','pungs'],['kongflower','self']];
  for(const [top,...lower] of exclusives)if(selected.has(top))lower.forEach(x=>selected.delete(x));
  const limits=Array.from(selected).filter(id=>SPECIAL_HK.includes(id));
  if(limits.length){const max=limits.map(id=>byId(id)).filter(Boolean).sort((a,b)=>b.score-a.score)[0];selected=new Set([max.id]);}
 }
}
function calcSelected(){
 normalizeSelection();
 const chosen=[...selected].map(byId).filter(Boolean);
 const raw=chosen.reduce((n,r)=>n+r.score*(multiplicities[r.id]||1),0);
 return {mode:'hk',points:Math.min(raw,cfg().hkCap),rawPoints:raw,extra:0,
  selected:chosen.map(r=>({id:r.id,name:r.name,points:r.score*(multiplicities[r.id]||1),qty:multiplicities[r.id]||1})),
  valid:chosen.length>0 && raw>=cfg().hkMin};
}
function renderSummary(){
 const sum=calcSelected();
 $('fanScore').textContent=`${sum.points} 番`;
 $('fanPointsStatus').textContent=!selected.size?'尚未选择番型':sum.valid?'达到当前起糊设定（请核对牌形）':'低于设定起糊番数';
 $('fanSelectedText').innerHTML=sum.selected.length?sum.selected.map(r=>`<button type="button" class="fan-chip" data-fan-drop="${r.id}" title="移除">${h(r.name)} ${r.qty>1?'×'+r.qty+' ':''}+${r.points} ×</button>`).join(''):'<span class="muted">点选番型并添加，或输入14张牌尝试识别。</span>';
 $('fanApply').disabled=!sum.valid;
 $('fanAddRule').textContent=previewRule&&selected.has(previewRule.id)?'✓ 已选，点击移除':'＋ 添加此番';
 $('fanStudioWarning').textContent='香港麻将番数和部分特殊胡法依牌桌而异；此工具仅自动识别常见牌型，花牌、吃碰与和牌方式须人工核对。';
}
function changeMode(newMode){
 viewMode='hk';selected.clear();multiplicities={};selectionOrigin='manual';previewRule=null;lastAnalysis=null;search='';$('fanSearch').value='';$('fanRuleset').value='hk';
 $('fanMinInfo').textContent='只使用香港麻将参考番表。起糊与封顶可在本房间设置，默认起糊 0 番以兼容你们原来的「只要能胡」玩法。';
 showDemo(getRules()[0]);renderRules();renderSummary();
}
function sameHand(a,b){return a.length===b.length && a.slice().sort().join(',')===b.slice().sort().join(',');}
function countMap(arr){const o={};arr.forEach(t=>o[t]=(o[t]||0)+1);return o;}
function splitMelds(hand){
 const count=countMap(hand),solutions=[];
 function go(melds){
  if(melds.length===4){if(Object.values(count).every(v=>v===0))solutions.push(melds.map(x=>x.slice()));return;}
  const first=TILECODES.find(t=>count[t]>0);if(!first)return;
  if(count[first]>=3){count[first]-=3;go([...melds,[first,first,first]]);count[first]+=3;}
  if('mps'.includes(first[0])&&first.length>1){const n=Number(first.slice(1));const b=first[0]+(n+1),c=first[0]+(n+2);
   if(n<=7&&count[b]>0&&count[c]>0){count[first]--;count[b]--;count[c]--;go([...melds,[first,b,c]]);count[first]++;count[b]++;count[c]++;}}
 }
 for(const pair of TILECODES)if((count[pair]||0)>=2){count[pair]-=2;go([]);count[pair]+=2;}
 // Pair is in each complete solution? Reconstruct with pair to avoid false match on certain patterns.
 return solutions;
}
function breakStandard(hand){
 const count=countMap(hand),options=[];
 function melds(pair){
  function go(arr){if(arr.length===4){if(Object.values(count).every(v=>v===0))options.push({pair,groups:arr});return;}
   const first=TILECODES.find(t=>count[t]>0);if(!first)return;
   if(count[first]>=3){count[first]-=3;go([...arr,[first,first,first]]);count[first]+=3;}
   if('mps'.includes(first[0])&&first.length>1){const n=Number(first.slice(1));const b=first[0]+(n+1),c=first[0]+(n+2);if(n<=7&&(count[b]||0)&&(count[c]||0)){count[first]--;count[b]--;count[c]--;go([...arr,[first,b,c]]);count[first]++;count[b]++;count[c]++;}}
  }go([]);
 }
 for(const pair of TILECODES)if((count[pair]||0)>=2){count[pair]-=2;melds(pair);count[pair]+=2;}
 return options;
}
function autoAnalyze(arr,meta={}){
 const invalid=arr.length!==14?`请输入完整 14 张牌，目前 ${arr.length} 张。`:Object.entries(countMap(arr)).find(([,v])=>v>4)?'同种麻将牌最多四张。':'';
 if(invalid)return {error:invalid,patterns:[],options:[]};
 const cnt=countMap(arr),grouping=breakStandard(arr),orphans=['m1','m9','p1','p9','s1','s9','E','S','W','N','R','G','B'];
 const thirteen=orphans.every(t=>(cnt[t]||0)>=1)&&orphans.reduce((s,t)=>s+(cnt[t]||0),0)===14;
 const pairs=Object.values(cnt).filter(v=>v===2).length===7;
 if(!grouping.length&&!thirteen&&!pairs)return {error:'这 14 张牌不符合常见「四副面子一将／七对／十三幺」结构。无法自动判定，特殊牌型请人工核查。',patterns:[],options:[]};
 const has=(tile,n=3)=>cnt[tile]>=n;
 const suits=[...new Set(arr.filter(t=>t.length>1).map(t=>t[0]))];
 const honors=arr.some(t=>t.length===1),numeric=arr.some(t=>t.length>1);
 const onlyTerminals=arr.every(t=>t.length>1&&['1','9'].includes(t.slice(1)));
 const mixedTerminals=arr.every(t=>t.length===1||['1','9'].includes(t.slice(1)));
 const allpungs=grouping.some(g=>g.groups.every(x=>x[0]===x[1]));
 const allchows=grouping.some(g=>g.groups.every(x=>x[0]!==x[1]));
 const lower=arr.every(t=>t.length===1||!['1','9'].includes(t.slice(1)));
 const small3=['R','G','B'].filter(x=>has(x)).length===2&&['R','G','B'].some(x=>cnt[x]===2);
 const small4=['E','S','W','N'].filter(x=>has(x)).length===3&&['E','S','W','N'].some(x=>cnt[x]===2);
 const nine=suits.length===1&&!honors&&SUITS.includes(suits[0])&&[3,1,1,1,1,1,1,1,3].every((n,i)=>cnt[suits[0]+(i+1)]>=n);
 const base={ping:allchows,pungs:allpungs,half:suits.length===1&&honors&&numeric,full:suits.length===1&&!honors,dragon:['R','G','B'].some(x=>has(x)),small3,big3:['R','G','B'].every(x=>has(x)),small4,big4:['E','S','W','N'].every(x=>has(x)),thirteen,seven:pairs,allhonor:!numeric,pureterm:onlyTerminals,termhon:mixedTerminals&&honors&&numeric,nine,seatwind:has(meta.seatWind||'E'),roundwind:has(meta.roundWind||'E'),missing:suits.length<=2,noflower:false};
 const detections=[];const add=(id)=>{if(!detections.includes(id))detections.push(id);};
 ['big4','thirteen','allhonor','pureterm','nine','big3','small4','small3','full','half','termhon','pungs','ping'].forEach(id=>{if(base[id])add(id);});
 if(base.dragon&&!base.big3&&!base.small3)add('dragon');
 if(base.seatwind&&!base.big4)add('seatwind');
 if(base.roundwind&&!base.big4)add('roundwind');
 if(meta.closed&&!base.nine&&!base.thirteen)add('closed');
 if(meta.selfDraw)add('self');
 if(meta.allowHouse&&pairs)add('seven');
 if(meta.allowHouse&&base.missing&&!base.full&&!base.half)add('missing');
 return {error:null,patterns:detections,options:grouping,kind:thirteen?'十三幺':pairs&&!grouping.length?'七对':grouping.length?'标准四副面子一将':'特殊结构'};
}
function addSelected(id){
 const rule=byId(id);if(!rule)return;
 if(selected.has(id)){selected.delete(id);delete multiplicities[id];}else{
  if(SPECIAL_HK.includes(id))selected.clear();
  else if(Array.from(selected).some(x=>SPECIAL_HK.includes(x)))selected.clear();
  selected.add(id);multiplicities[id]=1;
 }
 selectionOrigin='manual';renderSummary();showDemo(rule);
}
function maxQty(id){return id==='dragon'?3:id==='seatflower'?2:id==='flower4'?2:1;}
function moreRule(){
 if(!previewRule)return;
 const id=previewRule.id,limit=maxQty(id);
 if(limit===1)return;
 if(!selected.has(id)){selected.add(id);multiplicities[id]=1;}
 else multiplicities[id]=(multiplicities[id]||1)>=limit?1:(multiplicities[id]||1)+1;
 selectionOrigin='manual';renderSummary();showDemo(previewRule);
}
function setHand(codes){
 hand=codes.slice(0,18);renderHand();
}
function renderHand(){
 $('fanHandCount').textContent=hand.length+' / 14 张';
 $('fanHand').innerHTML=hand.map((code,i)=>tile(code,{clickable:true,index:i})).join('')+Array.from({length:Math.max(0,14-hand.length)},()=>'<span class="fan-empty-slot">＋</span>').join('');
 $('fanHandMessage').textContent=hand.length===14?'点「自动识别常见番型」，也可点击某张手牌将其移除。':'从下面牌库点击选牌，达到14张后即可尝试分析；手牌可直接点击删除。';
}
function runAnalyze(){
 const result=autoAnalyze(hand,{mode:'hk',selfDraw:$('fanSelfDraw').checked,closed:$('fanClosed').checked,seatWind:$('fanSeatWind').value,roundWind:$('fanRoundWind').value,allowHouse:$('fanHouse').checked});
 lastAnalysis=result;
 if(result.error){$('fanAnalysisResult').innerHTML=`<div class="fan-standby">⚠️ ${h(result.error)}</div>`;return;}
 selected=new Set(result.patterns);multiplicities={};
 if(selected.has('dragon'))multiplicities.dragon=['R','G','B'].filter(x=>countMap(hand)[x]>=3).length;
 selectionOrigin='auto';normalizeSelection();renderSummary();
 const sum=calcSelected();$('fanAnalysisResult').innerHTML=`<div class="fan-standby"><strong>识别结构：${h(result.kind)}</strong><p>识别到 ${sum.selected.length} 项可能番种，合计 <b>${sum.points+sum.extra} 番</b>。<br>请核对吃碰杠、花牌、门风圈风和是否有不得重复计番的牌型；自动结果仅作参考。</p></div>`;
}
function refreshApplied(){
 const active=!!(pending && game?.id===pending.roomId);const value=active?`香港麻将 · ${pending.points} 番 · ${pending.selected.map(r=>r.name).join('、')}`:'尚未套用番型；直接记账仍按原本 RM 规则。';
 const el=$('fanWinSummary');if(el)el.textContent=value;
 $('fanPendingClear')?.classList.toggle('hidden',!active);
}
function apply(){
 const sum=calcSelected();if(!game){alert('请先打开一个房间');return;}
 if(!cfg().enabled){alert('当前房间尚未开启可选算番，请先到「玩家／规则」开启。');return;}
 if(!sum.valid){alert('番数尚未满足起和要求（或未选番型），请再检查。');return;}
 pending={roomId:game.id,mode:viewMode,points:sum.points+sum.extra,basePoints:sum.points,selected:sum.selected,origin:selectionOrigin,analyzedHand:lastAnalysis?.error?null:hand.slice(0,14)};
 refreshApplied();onApply(pending);$('fanApplyStatus').textContent='✓ 已套用到下一笔胡牌。请返回「记一笔」，检查金额并确认。';
 document.querySelector('[data-tab="new"]')?.click();$('fanWinSummary')?.scrollIntoView({block:'center',behavior:'smooth'});
}
function setGame(newGame){
 if(game?.id!==newGame?.id){pending=null;selected.clear();multiplicities={};hand=[];lastAnalysis=null;}
 game=newGame;
 const desired=cfg().mode;
 if(!studioReady)return;
 if(viewMode!==desired)changeMode(desired);
 const enabled=!!game&&cfg().enabled;
 $('fanRoomActive').textContent=!game?'请先选择房间':enabled?'当前房间已启用香港麻将算番':'当前房间未启用算番；仍可查看牌型教学。';
 $('fanWinPanel')?.classList.toggle('hidden',!enabled);
 refreshApplied();
}
function init(opts={}){
 onApply=opts.onApply||onApply;onPreview=opts.onPreview||onPreview;onSave=opts.onSave||onSave;
 $('fanTilePalette').innerHTML=TILECODES.map(code=>`<button title="${tileName(code)}" type="button" data-fan-tile="${code}">${tile(code)}</button>`).join('');
 studioReady=true;
 $('fanRuleset').value=viewMode;
 changeMode(viewMode);renderHand();
 document.addEventListener('click',e=>{
  const show=e.target.closest('[data-fan-show]');if(show){const rule=byId(show.dataset.fanShow);showDemo(rule);renderRules();return;}
  const drop=e.target.closest('[data-fan-drop]');if(drop){const id=drop.dataset.fanDrop;if((multiplicities[id]||1)>1)multiplicities[id]--;else{selected.delete(id);delete multiplicities[id];}renderSummary();return;}
  const pick=e.target.closest('[data-fan-tile]');if(pick){if(hand.length>=14){$('fanHandMessage').textContent='已满14张，请先移除一张。';return;}if(hand.filter(x=>x===pick.dataset.fanTile).length>=4){$('fanHandMessage').textContent='同种牌最多四张，请选其他牌。';return;}hand.push(pick.dataset.fanTile);renderHand();return;}
  const remove=e.target.closest('[data-fan-hand-remove]');if(remove){hand.splice(Number(remove.dataset.fanHandRemove),1);renderHand();return;}
 });
 $('fanSearch').addEventListener('input',e=>{search=e.target.value;renderRules();});
 $('fanAddRule').addEventListener('click',()=>previewRule&&addSelected(previewRule.id));
 $('fanMoreRule').addEventListener('click',moreRule);
 $('fanPlayDemo').addEventListener('click',()=>showDemo(previewRule));
 $('fanLoadDemo').addEventListener('click',()=>{const arr=sampleGroups(previewRule?.example).flat();if(arr.length!==14)return;setHand(arr);$('fanAnalysisResult').textContent='已载入牌例。可点「自动识别常见番型」。';});
 $('fanAnalyze').addEventListener('click',runAnalyze);
 $('fanClearHand').addEventListener('click',()=>{setHand([]);lastAnalysis=null;$('fanAnalysisResult').textContent='';});
 $('fanClearSelected').addEventListener('click',()=>{selected.clear();multiplicities={};renderSummary();});
 $('fanApply').addEventListener('click',apply);
 $('fanPendingClear').addEventListener('click',()=>{pending=null;refreshApplied();onPreview();});
 renderSummary();setGame(game);
}
function getPending(method){
 if(!game||!cfg().enabled||!pending||pending.roomId!==game.id||pending.mode!=='hk')return null;
 const score=Math.min(999,pending.points);
 // 特殊情况如杠上开花须避免重复计自摸，由牌友现场核对。
 return {used:true,mode:pending.mode,points:score,patterns:pending.selected.map(x=>({id:x.id,name:x.name,points:x.points,qty:x.qty||1})),origin:pending.origin,hand:pending.origin==='auto'?pending.analyzedHand:null};
}
function clearPending(){pending=null;selected.clear();multiplicities={};lastAnalysis=null;refreshApplied();renderSummary();}
function showRecordedFan(fan){
 if(!fan?.used)return;
 if(fan.mode==='mcr'){$('fanApplyStatus').textContent='这是旧版竞赛分历史记录，仅保留原始金额，不会自动按香港番数重新计算。';return;}
 changeMode('hk');
 selected=new Set((fan.patterns||[]).map(x=>x.id).filter(id=>!!byId(id)));multiplicities=Object.fromEntries((fan.patterns||[]).map(x=>[x.id,x.qty||1]));
 const primary=byId((fan.patterns||[])[0]?.id)||getRules()[0];
 showDemo(primary);
 if(Array.isArray(fan.hand)&&fan.hand.length===14){setHand(fan.hand);$('fanAnalysisResult').textContent='历史记录中的14张牌。可重新点击「自动识别」，核对番型。';}
 renderRules();renderSummary();
 $('fanApplyStatus').textContent='正在查看历史牌型（仅供回看，不会改变原有账目）。';
}
function priceExtra(form,gameInfo){
 const fc={...DEFAULT_CONFIG,...(gameInfo?.fanConfig||{})};
 if(fc.mode==='mcr'||!fc.enabled||!fc.priceEnabled||!form.fan?.used||form.type!=='win'||form.fan.mode!=='hk')return 0;
 const unit=Number(fc.pricePerUnit);const points=Number(form.fan.points);
 if(!Number.isFinite(unit)||unit<0||unit>1000||!Number.isFinite(points)||points<0||points>999)return 0;
 return Math.round(unit*points*100)/100;
}
window.MahjongFan={init,setGame,getPending,clearPending,priceExtra,showRecordedFan,autoAnalyze,getCatalog:()=>data,DEFAULT_CONFIG};
})();
