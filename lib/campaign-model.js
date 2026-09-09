/* Shared league-slot optimizer and league-format Monte Carlo. No DOM or provider calls. */
(function(root){
'use strict';
const POS={QB:['QB'],RB:['RB'],WR:['WR'],TE:['TE'],DEF:['DEF'],K:['K'],FLEX:['RB','WR','TE'],SUPER_FLEX:['QB','RB','WR','TE'],WRRB_FLEX:['RB','WR'],REC_FLEX:['WR','TE']};
function optimize(players,slots,field='weekly',fixed=[]){
 slots=slots.filter(s=>s!=='BN');if(slots.length>12||slots.some(s=>!POS[s]))return null;
 const n=1<<slots.length,dp=new Float64Array(n).fill(-Infinity),lines=new Array(n);dp[0]=0;lines[0]=[];
 for(const p of players){if(!Number.isFinite(p[field]))continue;for(let m=n-1;m>=0;m--){if(!Number.isFinite(dp[m]))continue;
  for(let i=0;i<slots.length;i++){if(m&(1<<i)||!POS[slots[i]].includes(p.pos)||(fixed[i]&&fixed[i]!==p.id)||(fixed.includes(p.id)&&fixed[i]!==p.id)||(p.locked&&!fixed.includes(p.id)))continue;let k=m|(1<<i),v=dp[m]+p[field];if(v>dp[k]){dp[k]=v;lines[k]=[...lines[m],{slot:i,id:p.id,points:p[field]}];}}
 }}
 if(!Number.isFinite(dp[n-1]))return null;return {points:dp[n-1],line:lines[n-1].sort((a,b)=>a.slot-b.slot)};
}
function bracket(seeds,game,reseed=false){
 let rounds=seeds.length===8?[[0,7],[3,4],[1,6],[2,5]]:seeds.length===6?[[2,5],[3,4]]:seeds.length===4?[[0,3],[1,2]]:seeds.length===2?[[0,1]]:null;
 if(!rounds)throw Error('Supported playoff fields: 2, 4, 6, 8');
 let r=0,alive=rounds.map(([a,b])=>game(seeds[a],seeds[b],r));
 if(seeds.length===6){if(reseed)alive.sort((a,b)=>seeds.indexOf(a)-seeds.indexOf(b));alive=[game(seeds[0],alive[1],++r),game(seeds[1],alive[0],r)];}
 let finalists=seeds.length===2?seeds:null;
 while(alive.length>1){if(reseed)alive.sort((a,b)=>seeds.indexOf(a)-seeds.indexOf(b));if(alive.length===2)finalists=alive.slice();r++;let next=[];for(let i=0;i<alive.length/2;i++)next.push(game(alive[reseed?i:i*2],alive[reseed?alive.length-1-i:i*2+1],r));alive=next;}
 return {winner:alive[0],finalists:finalists||alive};
}
function simulate(data,N=5000,seed=2026){
 if(![2,4,6,8].includes(data.spots))throw Error('Unsupported playoff format');
 if(data.unsupported)throw Error(data.unsupported);
 const teams=data.teams,ids=teams.map(t=>t.id),rows=Object.fromEntries(ids.map(id=>[id,{make:0,final:0,title:0,wins:0}]));
 let z=seed>>>0;const rand=()=>{z+=0x6D2B79F5;let t=z;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
 const normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-10,rand())))*Math.cos(2*Math.PI*rand());
 const mu={},sd={};
 for(const t of teams){mu[t.id]={};sd[t.id]={};for(let w=data.week;w<=Math.min(18,data.lastWeek+3);w++){
  const fixed=w===data.week?(t.current?.starters||t.starters||[]).map(id=>t.players.find(p=>p.id===id)?.game?.started?id:null):[];
  const ps=t.players.map(p=>{const current=w===data.week,g=current?p.game:null;const fraction=g?.state==='post'?0:g?.state==='in'?(g.remaining??.5):1;return {...p,locked:current&&!!g?.started,value:current?(fraction===0?(t.current?.playerPoints?.[p.id]||0):p.weekly==null?null:(g?.started?(t.current?.playerPoints?.[p.id]||0):0)+p.weekly*fraction):(p.bye===w?0:p.outlook)};});
  const best=optimize(ps,data.slots,'value',fixed);if(!best)throw Error('Incomplete projections or unsupported starting slots for '+t.name);
  mu[t.id][w]=best.points;sd[t.id][w]=Math.max(0,Math.sqrt(best.line.reduce((a,x)=>{const g=w===data.week?t.players.find(p=>p.id===x.id)?.game:null;const fraction=g?.state==='post'?0:g?.state==='in'?(g.remaining??.5):1;return a+Math.pow(Math.max(3,x.points*.55),2)*fraction;},0)));
  if(w===data.week&&t.current?.final){mu[t.id][w]=t.current.points;sd[t.id][w]=0;}
 }}
 for(let n=0;n<N;n++){
  const wins={},pf={},strength={};for(const t of teams){wins[t.id]=t.wins+t.ties*.5;pf[t.id]=t.points;strength[t.id]=Math.max(.6,1+normal()*.10);}
  const score=(id,w)=>{const team=teams.find(t=>t.id===id);if(w===data.week&&team.current?.final)return team.current.points;return Math.max(0,mu[id][w]*strength[id]+normal()*sd[id][w]);};
  for(let w=data.week;w<=data.lastWeek;w++)for(const pair of data.schedule[w]||[]){let [a,b]=pair;const x=score(a,w),y=score(b,w);pf[a]+=x;pf[b]+=y;if(x===y){wins[a]+=.5;wins[b]+=.5;}else wins[x>y?a:b]++;}
  const order=ids.slice().sort((a,b)=>wins[b]-wins[a]||pf[b]-pf[a]);for(const id of ids)rows[id].wins+=wins[id];
  let seeds=order.slice(0,data.spots),result;
  if(data.week>data.lastWeek){
   const matches=data.bracket||[],done={},champ=matches.find(m=>m.p===1);if(!champ)throw Error('Live playoff bracket not available');
   const resolve=(v,from)=>v!=null?Number(v):from&&done[from.w]!=null?done[from.w]:null;
   for(const m of matches.slice().sort((a,b)=>a.r-b.r)){if(m.p&&m.p!==1)continue;const a=resolve(m.t1,m.t1_from),b=resolve(m.t2,m.t2_from);if(a==null||b==null)continue;const w=Math.max(data.week,data.lastWeek+m.r);done[m.m]=m.w!=null?Number(m.w):(score(a,w)>score(b,w)?a:b);}
   const a=resolve(champ.t1,champ.t1_from),b=resolve(champ.t2,champ.t2_from);result={winner:done[champ.m],finalists:[a,b]};seeds=[...new Set(matches.flatMap(m=>[m.t1,m.t2]).filter(x=>x!=null).map(Number))];
  }else result=bracket(seeds,(a,b,r)=>score(a,data.lastWeek+1+r)>score(b,data.lastWeek+1+r)?a:b,data.reseed);
  for(const id of seeds)if(rows[id])rows[id].make++;for(const id of result.finalists)if(rows[id])rows[id].final++;if(rows[result.winner])rows[result.winner].title++;
 }
 return {N,at:Date.now(),rows:teams.map(t=>({id:t.id,name:t.name,make:100*rows[t.id].make/N,final:100*rows[t.id].final/N,title:100*rows[t.id].title/N,wins:rows[t.id].wins/N,mean:mu[t.id][data.week]})).sort((a,b)=>b.title-a.title)};
}
const api={optimize,bracket,simulate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CampaignModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
