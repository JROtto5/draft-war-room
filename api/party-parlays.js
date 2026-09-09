const {cached,json}=require('../lib/campaign-service.cjs');
const BASE='https://api.sleeper.app/v1';
const day=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
async function load(){
 const [board,state,players]=await Promise.all([json('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'),json(BASE+'/state/nfl'),cached('party-players',86400000,()=>json(BASE+'/players/nfl'))]);
 const now=Date.now(),today=day(now),events=(board.events||[]).filter(e=>day(e.date)===today&&Date.parse(e.date)>now&&e.status?.type?.state==='pre'&&+e.season?.type===2);
 if(!events.length)return {fetchedAt:now,date:today,games:[],note:'No remaining pregame NFL kickoff tonight. Party ideas return on the next game day.'};
 const year=+state.season,week=+board.week?.number||+state.week;
 const projections=await json(BASE+'/projections/nfl/regular/'+year+'/'+week).catch(()=>({}));
 const games=events.map(e=>{const c=e.competitions[0],home=c.competitors.find(t=>t.homeAway==='home').team,away=c.competitors.find(t=>t.homeAway==='away').team,odds=c.odds?.[0],total=Number(odds?.overUnder);
  const candidates=team=>Object.entries(players).filter(([id,p])=>p.team===team.abbreviation&&['RB','WR','TE'].includes(p.position)&&!['Out','IR','Suspended','PUP'].includes(p.injury_status)).map(([id,p])=>({id,name:p.full_name,pos:p.position,status:p.injury_status,tds:(+projections[id]?.rush_td||0)+(+projections[id]?.rec_td||0)})).filter(p=>p.tds>0).sort((a,b)=>b.tds-a.tds);
  const h=candidates(home)[0],a=candidates(away)[0],recipes=[];
  if(odds&&Number.isFinite(total)&&total>0&&h&&a)for(const [side,team,label]of [['home',home,'Home-team shootout'],['away',away,'Road-team upset']]){
   const price=Number(odds.moneyline?.[side]?.close?.odds);if(!Number.isFinite(price)||Math.abs(price)<100)continue;
   recipes.push({id:e.id+':'+side,title:side==='away'&&price<0?'Road-team shootout':label,legs:[{text:team.displayName+' to win',type:'moneyline',verified:true,referenceOdds:price},{text:'Game total over '+total,type:'total',verified:true},{text:h.name+' anytime touchdown',type:'player-prop',verified:false},{text:a.name+' anytime touchdown',type:'player-prop',verified:false}],note:'Touchdown legs are projection-inspired ideas. Confirm both players are active and these markets can be combined in your sportsbook.'});
  }
  return {id:e.id,name:e.name,kickoff:e.date,source:odds?.provider?.displayName||odds?.provider?.name||'No market provider',sourceUrl:'https://www.espn.com/nfl/game/_/gameId/'+e.id,recipes};
 });return {fetchedAt:Date.now(),date:today,games};
}
module.exports=async(req,res)=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');if(req.method!=='GET'){res.statusCode=405;return res.end('{}');}try{const d=await cached('party:'+day(Date.now()),120000,load);res.end(JSON.stringify(d));}catch(e){res.statusCode=502;res.end(JSON.stringify({error:'Tonight’s NFL markets could not be refreshed.'}));}};
module.exports.day=day;
