/* Public weekly projection adapters. No season-total records enter these feeds. */
const ESPN_FIELDS = {pass_att:0,pass_cmp:1,pass_yd:3,pass_td:4,pass_2pt:19,pass_int:20,
  rush_att:23,rush_yd:24,rush_td:25,rush_2pt:26,rec_yd:42,rec_td:43,rec_2pt:44,rec:53,fum_lost:72};
const ESPN_POS = {1:'QB',2:'RB',3:'WR',4:'TE',5:'K',16:'DEF'};
const text = html=>html.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&#0?39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
function parseEspn(json, season, week){
  if(!Array.isArray(json.players)) throw new Error('ESPN returned no player records');
  const rows=[];
  for(const entry of json.players){
    const p=entry.player||entry, position=ESPN_POS[p.defaultPositionId];
    if(!position || position==='K') continue;
    const record=(p.stats||[]).find(s=>+s.seasonId===season && +s.scoringPeriodId===week && +s.statSourceId===1 && +s.statSplitTypeId===1);
    if(!record || !record.stats || !Object.keys(record.stats).length) continue;
    const raw=record.stats, stats={};
    if(position==='DEF'){
      const fields={int:95,fum_rec:96,blk_kick:97,safe:98,sack:99,ff:106,pts_allow:120};
      for(const [name,id] of Object.entries(fields)) if(raw[id]!=null) stats[name]=Number(raw[id]);
      stats.def_td=(Number(raw[103])||0)+(Number(raw[104])||0);
      stats.def_st_td=(Number(raw[101])||0)+(Number(raw[102])||0)+(Number(raw[93])||0);
    }else for(const [name,id] of Object.entries(ESPN_FIELDS)) if(raw[id]!=null) stats[name]=Number(raw[id]);
    if(!Object.values(stats).every(Number.isFinite)) continue;
    rows.push({name:p.fullName,position,stats,approximate:position==='DEF'});
  }
  if(rows.length<20) throw new Error('ESPN has too few matching weekly projections');
  return rows;
}
const CBS_COLS={
  QB:{pass_att:2,pass_cmp:3,pass_yd:4,pass_td:6,pass_int:7,rush_att:9,rush_yd:10,rush_td:12,fum_lost:13},
  RB:{rush_att:2,rush_yd:3,rush_td:5,rec:7,rec_yd:8,rec_td:11,fum_lost:12},
  WR:{rec:3,rec_yd:4,rec_td:7,rush_att:8,rush_yd:9,rush_td:11,fum_lost:12},
  TE:{rec:3,rec_yd:4,rec_td:7,fum_lost:8},
  DEF:{int:1,safe:2,sack:3,fum_rec:5,ff:6,def_td:7,pts_allow:8}
};
const CBS_LENGTH={QB:16,RB:15,WR:15,TE:11,DEF:16};
function parseCbs(html, position, season, week){
  const title=text((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'');
  if(!new RegExp('Week\\s+'+week+'\\s+Proj\\b','i').test(title) || !html.includes('/'+season+'/'+week+'/projections/'))
    throw new Error('CBS did not identify the requested weekly projections');
  const rows=[];
  for(const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>m[1]);
    if(cells.length!==CBS_LENGTH[position]) continue;
    let name,team;
    if(position==='DEF'){
      team=(cells[0].match(/href="\/nfl\/teams\/([A-Z]+)\//)||[])[1];
      name=text(cells[0]);
    }else{
      const full=(cells[0].match(/class="CellPlayerName--long"[\s\S]*?<a\b[^>]*>([\s\S]*?)<\/a>/)||[])[1];
      if(!full) continue;
      name=text(full);team=text((cells[0].match(/class="CellPlayerName-team"[^>]*>([\s\S]*?)<\/span>/)||[])[1]||'');
      if(Number(text(cells[1]))!==1) continue; // Reject season totals and absent weekly forecasts.
    }
    if(!name || !team) continue;
    const stats={};let valid=true;
    for(const [key,index] of Object.entries(CBS_COLS[position])){
      const value=text(cells[index]).replace(/,/g,'');
      if(!/^-?\d+(\.\d+)?$/.test(value)){valid=false;break;}
      stats[key]=Number(value);
    }
    if(valid) rows.push({name,team,position,stats,approximate:position==='DEF'});
  }
  if(rows.length<10) throw new Error('CBS weekly table is incomplete or its format changed');
  return rows;
}
async function read(url, options={}){
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(18000)});
  if(!response.ok) throw new Error('Provider returned HTTP '+response.status);
  return response;
}
async function loadProvider(source, season, week){
  if(source==='espn'){
    const url='https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/'+season+'/segments/0/leaguedefaults/3?scoringPeriodId='+week+'&view=kona_player_info';
    const filter={players:{limit:1500,sortPercOwned:{sortPriority:1,sortAsc:false},filterStatsForScoringPeriodIds:{value:[week]}}};
    const response=await read(url,{headers:{'x-fantasy-filter':JSON.stringify(filter)}});
    return {rows:parseEspn(await response.json(),season,week),url:'https://fantasy.espn.com/football/players/projections',notes:['Current-week records only; source update time not supplied.','D/ST points-allowed scoring is approximated from expected points allowed.']};
  }
  if(source==='cbs'){
    const results=await Promise.allSettled(['QB','RB','WR','TE','DEF'].map(async position=>{
      const url='https://www.cbssports.com/fantasy/football/stats/'+(position==='DEF'?'DST':position)+'/'+season+'/'+week+'/projections/ppr/';
      return parseCbs(await (await read(url)).text(),position,season,week);
    }));
    const rows=results.flatMap(r=>r.status==='fulfilled'?r.value:[]), failed=results.filter(r=>r.status==='rejected').length;
    if(!rows.length) throw new Error('CBS weekly projections unavailable');
    return {rows,url:'https://www.cbssports.com/fantasy/football/stats/QB/'+season+'/'+week+'/projections/ppr/',notes:[...(failed?[failed+' position tables unavailable.']:[]),'Rounded stat forecasts; uncommon scoring categories may be absent.','D/ST points-allowed scoring is approximated from expected points allowed.']};
  }
  throw new Error('Unknown projection provider');
}
module.exports={parseEspn,parseCbs,loadProvider};
