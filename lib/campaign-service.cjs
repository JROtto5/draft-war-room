const {loadProvider,parseEspn}=require('./weekly-projections.cjs');
const {optimize}=require('./campaign-model.js');
const {loadUsage,summary:usageSummary}=require('./usage.cjs');
const BASE='https://api.sleeper.app/v1',cache=new Map(),pending=new Map();
async function cached(key,ttl,fn){const old=cache.get(key);if(old&&Date.now()-old.at<ttl)return old.value;if(pending.has(key))return pending.get(key);const job=fn().then(value=>{cache.set(key,{at:Date.now(),value});if(cache.size>100)cache.delete(cache.keys().next().value);return value;}).finally(()=>pending.delete(key));pending.set(key,job);return job;}
async function json(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Feed unavailable ('+r.status+')');return r.json();}
const norm=n=>String(n||'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b\.?/g,'').replace(/[^a-z0-9]/g,'');
function score(stats,weights){if(!stats||!Object.keys(weights).some(k=>stats[k]!=null))return null;return Object.entries(weights).reduce((n,[k,v])=>n+(Number(stats[k])||0)*v,0);}
function rowScore(row,weights){const s={...row.stats};if(row.position==='DEF'&&s.pts_allow!=null){const p=s.pts_allow;s[p<1?'pts_allow_0':p<7?'pts_allow_1_6':p<14?'pts_allow_7_13':p<21?'pts_allow_14_20':p<28?'pts_allow_21_27':p<35?'pts_allow_28_34':'pts_allow_35p']=1;}return score(s,weights);}
async function outlook(year){return cached('outlook:'+year,6*3600000,async()=>{
 const result=await Promise.allSettled([json(BASE+'/projections/nfl/regular/'+year),json('https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/'+year+'/segments/0/leaguedefaults/3?scoringPeriodId=1&view=kona_player_info',{headers:{'x-fantasy-filter':JSON.stringify({players:{limit:1500,sortPercOwned:{sortPriority:1,sortAsc:false},filterStatsForScoringPeriodIds:{value:[0]}}})}})]);
 const sleeper=result[0].status==='fulfilled'?result[0].value:{};let espn=[];
 if(result[1].status==='fulfilled'){
  const copy=JSON.parse(JSON.stringify(result[1].value));for(const e of copy.players||[])for(const s of e.player.stats||[])if(+s.seasonId===year&&+s.scoringPeriodId===0&&+s.statSplitTypeId===0&&+s.statSourceId===1){s.scoringPeriodId=1;s.statSplitTypeId=1;}
  espn=parseEspn(copy,year,1).filter(p=>p.position!=='DEF');
 }
 return {sleeper,espn,at:Date.now(),sources:result.map((r,i)=>({name:i?'ESPN':'Sleeper',ok:r.status==='fulfilled'}))};
});}
async function build(leagueId,rosterId){return cached('campaign:'+leagueId+':'+rosterId,120000,async()=>{
 const [league,rosters,users,state,players]=await Promise.all([json(BASE+'/league/'+leagueId),json(BASE+'/league/'+leagueId+'/rosters'),json(BASE+'/league/'+leagueId+'/users'),json(BASE+'/state/nfl'),cached('players',86400000,()=>json(BASE+'/players/nfl'))]);
 if(!Array.isArray(rosters)||!rosters.some(r=>r.roster_id===rosterId))throw Error('Roster not found in this league');
 const year=Number(league.season),week=state.season_type==='pre'?1:Math.min(18,Math.max(1,+state.week||1)),lastWeek=(+league.settings.playoff_week_start||15)-1,weights=league.scoring_settings;
 if(year!==+state.season)throw Error('This league is from '+year+'. Connect the current season league.');
 const nfl=await cached('nfl-schedule:'+year,300000,()=>json('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates='+year+'0801-'+(year+1)+'0215&limit=1000')).catch(()=>({events:[]}));
 const gameMap={};for(const e of nfl.events||[])if(+e.season?.year===year&&+e.season?.type===2){for(const c of e.competitions?.[0]?.competitors||[]){const team=c.team.abbreviation;(gameMap[team]||={})[e.week.number]={state:e.status.type.state,kickoff:e.date,started:e.status.type.state!=='pre'||Date.parse(e.date)<=Date.now(),remaining:e.status.type.state==='post'?0:e.status.type.state==='in'?Math.max(0,Math.min(1,(3600-((+e.status.period-1)*900+900-(String(e.status.displayClock||'7:30').split(':').reduce((n,x)=>n*60+(+x||0),0))))/3600)):1};}}
 const result=await Promise.allSettled([cached('weekly:s:'+year+':'+week,900000,()=>json(BASE+'/projections/nfl/regular/'+year+'/'+week)),cached('weekly:e:'+year+':'+week,900000,()=>loadProvider('espn',year,week)),cached('weekly:c:'+year+':'+week,900000,()=>loadProvider('cbs',year,week)),outlook(year),json(BASE+'/players/nfl/trending/add?lookback_hours=24&limit=50'),json(BASE+'/league/'+leagueId+'/transactions/'+week),cached('usage:'+year,1800000,()=>loadUsage(year)),cached('injuries',300000,()=>json('https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries'))]);
 const value=(i,f)=>result[i].status==='fulfilled'?result[i].value:f;
 const injuryFeed=value(7,null),injuryMap={};for(const t of injuryFeed?.injuries||[])for(const i of t.injuries||[])injuryMap[norm(i.athlete?.displayName)]={status:i.status,date:i.date};
 const usage=value(6,{rows:[],at:0,note:'Usage feed unavailable'}),usageById={};for(const row of usage.rows)(usageById[row.player_id]||=[]).push(row);
 const sl=value(0,{}),ep=value(1,{rows:[]}),cb=value(2,{rows:[]}),ros=value(3,{sleeper:{},espn:[],at:0,sources:[]}),trend=value(4,[]),transactions=value(5,[]);
 if(!Object.keys(sl).length&&!ep.rows.length&&!cb.rows.length)throw Error('Weekly projection feeds unavailable');
 const names=new Map();for(const [id,p] of Object.entries(players)){const k=p.position+':'+norm(p.full_name);if(!names.has(k))names.set(k,id);else names.set(k,null);}
 const maps=rows=>{const out={};for(const r of rows){let id=names.get(r.position+':'+norm(r.name));if(r.position==='DEF'){const aliases={WSH:'WAS',JAC:'JAX'};id=aliases[r.team]||r.team;if(!id)id=Object.keys(players).find(k=>players[k].position==='DEF'&&norm(r.name).includes(norm(players[k].last_name)));}if(id)out[id]=rowScore(r,weights);}return out;};
 const em=maps(ep.rows),cm=maps(cb.rows),er=maps(ros.espn),catalog={};
 for(const [id,p] of Object.entries(players)){
  if(!['QB','RB','WR','TE','DEF','K'].includes(p.position))continue;
  const vals=[['Sleeper',score(sl[id],weights)],['ESPN',em[id]],['CBS',cm[id]]].filter(x=>x[1]!=null&&Number.isFinite(x[1]));
  const season=[score(ros.sleeper[id],weights),er[id]].filter(x=>x!=null&&Number.isFinite(x));
  const health=injuryFeed?(injuryMap[norm(p.full_name)]?.status||null):p.injury_status;
  const inactive=['out','ir','injured reserve','suspended','pup'].includes(String(health||'').toLowerCase());
  const teamGames=gameMap[({WAS:'WSH',JAC:'JAX'})[p.team]||p.team],bye=teamGames&&Object.keys(teamGames).length===17?Array.from({length:18},(_,i)=>i+1).find(w=>!teamGames[w]):null;
  const observed=usageSummary(usageById[p.gsis_id]||[],week,weights);
  catalog[id]={id,bye,usage:observed,game:teamGames?.[week]||null,name:p.full_name||p.last_name||id,pos:p.position,team:p.team,injury:health||null,weekly:vals.length?(inactive?0:vals.reduce((a,v)=>a+v[1],0)/vals.length):null,outlook:season.length?season.reduce((a,v)=>a+v,0)/season.length/17:null,sources:vals.map(([name,points])=>({name,points})),trend:0};
 }
 for(const p of Object.values(catalog))if(p.outlook!=null&&p.usage){const weight=Math.min(.3,p.usage.games*.1);p.outlook=p.outlook*(1-weight)+p.usage.points*weight;}
 for(const t of trend)if(catalog[t.player_id])catalog[t.player_id].trend=t.count;
 const owned=new Set(rosters.flatMap(r=>r.players||[])),un=Object.fromEntries(users.map(u=>[u.user_id,u.display_name]));
 const teams=rosters.map(r=>({id:r.roster_id,name:un[r.owner_id]||'Team '+r.roster_id,wins:r.settings.wins||0,ties:r.settings.ties||0,points:(r.settings.fpts||0)+(r.settings.fpts_decimal||0)/100,players:(r.players||[]).filter(id=>!(r.reserve||[]).includes(id)&&!(r.taxi||[]).includes(id)).map(id=>catalog[id]).filter(Boolean),starters:r.starters||[]}));
 const mine=teams.find(r=>r.id===rosterId),rawMine=rosters.find(r=>r.roster_id===rosterId),slots=league.roster_positions.filter(s=>s!=='BN'),base=optimize(mine.players,slots),seasonBase=optimize(mine.players,slots,'outlook');
 const drops={};for(const t of transactions)if(t.status==='complete')for(const [id,owner]of Object.entries(t.drops||{}))if(!owned.has(id)&&Date.now()-(t.status_updated||t.created)<7*86400000)drops[id]={at:t.status_updated||t.created,from:+owner,id:t.transaction_id};
 const bench=mine.players.filter(p=>!mine.starters.includes(p.id)&&!(p.game&&Date.parse(p.game.kickoff)<=Date.now())).sort((a,b)=>(a.outlook??Infinity)-(b.outlook??Infinity));
 const budget=Math.max(0,(+league.settings.waiver_budget||0)-(+rawMine.settings.waiver_budget_used||0));
 const allowed=new Set(slots.flatMap(s=>({FLEX:['RB','WR','TE'],SUPER_FLEX:['QB','RB','WR','TE'],WRRB_FLEX:['WR','RB'],REC_FLEX:['WR','TE']})[s]||[s]));
 const free=Object.values(catalog).filter(p=>allowed.has(p.pos)&&!owned.has(p.id)&&p.team&&p.weekly!=null).sort((a,b)=>(b.weekly+(drops[b.id]?10:0)+Math.min(5,b.trend/1000))-(a.weekly+(drops[a.id]?10:0)+Math.min(5,a.trend/1000))).slice(0,65);
 const opportunities=[];
 for(const p of free){let best=null;for(const drop of bench){
  const ids=mine.players.filter(x=>x.id!==drop.id).concat(p),limit=+league.settings['position_limit_'+p.pos.toLowerCase()];if(limit&&ids.filter(x=>x.pos===p.pos).length>limit)continue;
  const after=optimize(ids,slots),long=optimize(ids,slots,'outlook');if(!after||!base)continue;
  const gain=after.points-base.points,seasonGain=long&&seasonBase?long.points-seasonBase.points:0;
  if(!best||gain+seasonGain>best.gain+best.seasonGain)best={drop:{id:drop.id,name:drop.name},gain,seasonGain};
 }if(best){const recent=drops[p.id];const priority=best.gain>=3?'urgent':best.seasonGain>=1.5||recent&&p.outlook>=10||p.usage&&(p.usage.targets>=7||p.usage.carries>=12)?'watch':'depth';opportunities.push({...p,...best,dropped:recent||null,priority,bid:Math.min(budget,Math.round(budget*(priority==='urgent'?.15:priority==='watch'?.06:.01)))});}}
 opportunities.sort((a,b)=>(b.gain+b.seasonGain+(b.dropped?2:0))-(a.gain+a.seasonGain+(a.dropped?2:0)));
 const schedule={},scheduleResults=await Promise.allSettled(Array.from({length:Math.max(lastWeek,week)},(_,i)=>{const w=i+1;return cached('schedule:'+leagueId+':'+w,w===week?120000:21600000,()=>json(BASE+'/league/'+leagueId+'/matchups/'+w)).then(rows=>({w,rows}));}));
 let scheduleComplete=true;for(const t of teams){t.wins=0;t.ties=0;t.points=0;}for(const r of scheduleResults){if(r.status!=='fulfilled'){scheduleComplete=false;continue;}const {w,rows}=r.value,groups={};
  if(w===week)for(const t of teams){const m=rows.find(m=>+m.roster_id===t.id);if(m){const active=(m.starters||[]).filter(id=>id&&id!=='0');t.current={points:m.custom_points!=null?+m.custom_points:(+m.points||0),playerPoints:m.players_points||{},starters:m.starters||[],final:active.length>0&&active.every(id=>catalog[id]?.game?.state==='post')};}}
  if(w<week)for(const m of rows){const t=teams.find(t=>t.id===+m.roster_id),opp=m.matchup_id!=null?rows.find(o=>o.matchup_id===m.matchup_id&&o.roster_id!==m.roster_id):null;if(t&&opp){const a=m.custom_points!=null?+m.custom_points:(+m.points||0),b=opp.custom_points!=null?+opp.custom_points:(+opp.points||0);t.points+=a;if(a>b)t.wins++;else if(a===b)t.ties++;}}
  for(const m of rows)if(m.matchup_id!=null)(groups[m.matchup_id]||=[]).push(m.roster_id);schedule[w]=Object.values(groups).filter(p=>p.length===2);if(w<=lastWeek&&schedule[w].length*2!==teams.length)scheduleComplete=false;}
 const bracket=week>lastWeek?await json(BASE+'/league/'+leagueId+'/winners_bracket'):[];
 const unsupported=Object.keys(gameMap).length!==32?'NFL schedule unavailable; simulation paused.':!scheduleComplete?'League schedule is incomplete; simulation paused.':league.settings.league_average_match?'League-median matchups are not supported by this model.':league.settings.divisions?'Division-based playoff seeding needs a dedicated model.':+league.settings.playoff_round_type!==0?'Multi-week playoff rounds are not supported by this model.':null;
 return {league:leagueId,leagueName:league.name,roster:rosterId,season:year,week,lastWeek,spots:+league.settings.playoff_teams,slots,teams,schedule,bracket,reseed:!!league.settings.playoff_seed_type,unsupported,opportunities:opportunities.slice(0,16),budget,nflScheduleAt:Date.now(),fetchedAt:Date.now(),outlookAt:ros.at,sources:[{name:'Sleeper weekly',ok:result[0].status==='fulfilled'},{name:'ESPN weekly',ok:result[1].status==='fulfilled'},{name:'CBS weekly',ok:result[2].status==='fulfilled'},...ros.sources.map(s=>({...s,name:s.name+' season outlook'})),{name:'Sleeper transactions and trends',ok:result[4].status==='fulfilled'&&result[5].status==='fulfilled'},{name:'nflverse player usage',ok:usage.rows.length>0,note:usage.note},{name:'ESPN NFL schedule',ok:Object.keys(gameMap).length===32},{name:'ESPN injury reports',ok:!!injuryFeed},{name:'FantasyPros',ok:false,note:'Production API key required'},{name:'RotoWire',ok:false,note:'Licensed feed not connected'}]};
});}
module.exports={build,cached,json,score,norm};
