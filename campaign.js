/* Season home: live league opportunities, all-team simulations, and phone alerts. */
const CAMPAIGN={data:null,sim:null,loading:false,error:null,at:0};
async function campaignRefresh(force=false){
 if(CAMPAIGN.loading||(!force&&Date.now()-CAMPAIGN.at<5*60e3))return;
 const league=S.settings.sleeperLeagueId,roster=+S.settings.sleeperRosterId;if(!league||!roster||!SEASON.on)return;
 if(CAMPAIGN.data&&(CAMPAIGN.data.league!==league||CAMPAIGN.data.roster!==roster)){CAMPAIGN.data=null;CAMPAIGN.sim=null;}
 CAMPAIGN.loading=true;CAMPAIGN.error=null;
 try{
  const response=await fetch('/api/campaign?league='+encodeURIComponent(league)+'&roster='+roster,{cache:'no-store',signal:AbortSignal.timeout(60000)});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Season feeds unavailable');
  if(league!==S.settings.sleeperLeagueId||roster!==+S.settings.sleeperRosterId)return;
  CAMPAIGN.data=data;CAMPAIGN.at=Date.now();CAMPAIGN.sim=null;
  const ids=sleeperToOurs();CAMPAIGN.playerMap={};for(const p of data.teams.flatMap(t=>t.players).concat(data.opportunities))if(ids[p.id])CAMPAIGN.playerMap[ids[p.id]]=p;
  try{CAMPAIGN.sim=CampaignModel.simulate(data,5000,data.season*100+data.week);SEASON.lastOdds=Object.fromEntries(CAMPAIGN.sim.rows.map(r=>[r.id,Math.round(r.make)]));}catch(e){CAMPAIGN.error=e.message;}
  campaignLocalAlerts(data);
  if(new URLSearchParams(location.search).has('radar')&&!window._radarOpened){window._radarOpened=true;campaignWaivers();}
 }catch(e){CAMPAIGN.error=e.message;}
 finally{CAMPAIGN.loading=false;if(typeof renderSeasonPage==='function')renderSeasonPage();}
}
function campaignLocalAlerts(data){
 if(!alertCfg().waiver)return;
 const key=LS_KEY+'-radar-'+data.league+'-'+data.roster+'-'+data.season;let seen={};try{seen=JSON.parse(localStorage.getItem(key)||'{}');}catch(e){}
 for(const p of data.opportunities){if(p.priority!=='urgent'&&!(p.dropped&&p.priority==='watch'))continue;
  const event=p.id+':'+(p.dropped?.id||data.week)+':'+p.priority;if(seen[event])continue;seen[event]=Date.now();
  alertFire('waiver',(p.dropped?'Dropped in your league: ':'Waiver upgrade: ')+p.name,'+'+p.gain.toFixed(1)+' projected lineup points; consider dropping '+p.drop.name+'. FAAB estimate $'+p.bid+'. Review in Sleeper.');
 }
 localStorage.setItem(key,JSON.stringify(seen));
}
function campaignSummaryHtml(){
 const d=CAMPAIGN.data,sim=CAMPAIGN.error?null:CAMPAIGN.sim,mine=sim?.rows.find(r=>r.id===+S.settings.sleeperRosterId);
 const button=(view,text)=>'<button class="hbtn" data-campaign="'+view+'">'+text+'</button>';
 return '<section class="campaign-card" id="campaignHub" aria-label="Season command center"><div class="campaign-heading"><div><span class="campaign-eyebrow">SEASON COMMAND CENTER</span><h2>Win this week. Build for January.</h2></div>'+button('refresh',CAMPAIGN.loading?'Updating…':'Refresh')+'</div><nav class="campaign-nav" aria-label="Season essentials">'+button('lineup','This week')+button('waivers','Waiver radar')+button('odds','Title odds')+button('scores','Scores')+'<a class="hbtn" href="/bets">NFL + college bets</a>'+button('alerts','Phone alerts')+button('sources','Sources')+'</nav><div class="campaign-metrics"><div><b>'+(mine?mine.make.toFixed(1)+'%':'—')+'</b><span>Make playoffs'+(d?' · '+d.spots+' spots':'')+'</span></div><div><b>'+(mine?mine.title.toFixed(1)+'%':'—')+'</b><span>Win championship</span></div><div><b>'+(d?d.opportunities.filter(p=>p.priority==='urgent').length:'—')+'</b><span>Immediate waiver upgrades</span></div></div><p class="campaign-note">'+(CAMPAIGN.error?esc(CAMPAIGN.error):d?'5,000 model scenarios · refreshed '+new Date(d.fetchedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})+' · estimates, not guarantees.':'Connecting current league data and season forecasts…')+'</p></section>';
}
function campaignModal(title,body){
 document.getElementById('campaignOverlay')?.remove();const el=document.createElement('div');el.id='campaignOverlay';el.className='snov';el.innerHTML='<div class="sbcard campaign-dialog" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><button class="sbx" data-campaign="close" aria-label="Close">✕</button><h2>'+esc(title)+'</h2>'+body+'</div>';document.body.append(el);el.querySelector('button').focus();el.addEventListener('click',e=>{if(e.target===el)el.remove();});
}
function campaignWaivers(){
 const d=CAMPAIGN.data;if(!d){campaignRefresh(true);return campaignModal('Waiver radar','<p>Loading your live league. Reopen after the refresh completes.</p>');}
 const rows=d.opportunities.filter(p=>p.priority!=='depth'||p.gain>.5||p.seasonGain>.5||p.trend>=1500);
 campaignModal('Waiver radar · Week '+d.week,'<p>Only unrostered players in '+esc(d.leagueName)+'. Remaining FAAB: <b>$'+d.budget+'</b>. Claims and drops must be submitted in Sleeper.</p>'+(rows.length?rows.map(p=>'<article class="campaign-opportunity"><div class="campaign-heading"><h3>'+esc(p.name)+' <small>'+esc(p.pos+' · '+p.team)+'</small></h3><span class="campaign-pill">'+(p.priority==='urgent'?'LINEUP UPGRADE':p.dropped?'RECENT DROP':'MONITOR')+'</span></div><p>'+p.weekly.toFixed(1)+' projected this week · '+p.sources.length+' sources'+(p.dropped?' · dropped '+new Date(p.dropped.at).toLocaleString():'')+'</p><p>'+(p.gain>.5||p.seasonGain>.5?'<b>+'+p.gain.toFixed(1)+' starter points</b> · possible drop: '+esc(p.drop.name)+' · FAAB estimate <b>$'+p.bid+'</b>':'Monitor only — no clear lineup upgrade or drop recommended.')+'</p>'+(p.usage?'<p>Recent '+p.usage.games+' games: '+p.usage.targets.toFixed(1)+' targets · '+p.usage.carries.toFixed(1)+' carries · '+(p.usage.targetShare*100).toFixed(0)+'% target share</p>':'')+'<p class="campaign-note">'+p.sources.map(v=>esc(v.name)+' '+v.points.toFixed(1)).join(' · ')+(p.injury?' · '+esc(p.injury):'')+'</p></article>').join(''):'<p class="campaign-empty">No clear upgrade right now. The radar will keep checking league drops and changing projections.</p>')+'<p class="campaign-note">FAAB bids are budget-based heuristics, not predictions of winning bids. Long-term estimates use current season outlooks; protect valuable depth before submitting a drop. Newly unrostered players may still be on waivers.</p><a class="hbtn primary" target="_blank" rel="noopener" href="https://sleeper.com/leagues/'+d.league+'/team">Review in Sleeper ↗</a>');
}
function campaignOdds(){
 const d=CAMPAIGN.data,s=CAMPAIGN.sim;if(!d||!s)return campaignModal('Championship outlook','<p>'+esc(CAMPAIGN.error||'Season simulation is loading.')+'</p>');
 campaignModal('Championship outlook','<p>'+s.N.toLocaleString()+' scenarios · '+d.spots+' playoff teams · playoffs start Week '+(d.lastWeek+1)+'</p><div class="campaign-table"><table><thead><tr><th>Team</th><th>Playoffs</th><th>Final</th><th>Title</th><th>Avg wins</th></tr></thead><tbody>'+s.rows.map(r=>'<tr'+(r.id===d.roster?' class="campaign-mine"':'')+'><td>'+esc(r.name)+'</td><td>'+r.make.toFixed(1)+'%</td><td>'+r.final.toFixed(1)+'%</td><td>'+r.title.toFixed(1)+'%</td><td>'+r.wins.toFixed(1)+'</td></tr>').join('')+'</tbody></table></div><details open><summary>What goes into these odds</summary><p>Actual league scoring, roster slots, standings and remaining matchups; current weekly consensus; freshly fetched ESPN/Sleeper full-season totals divided by 17 for future per-game baselines, blended with up to 30% recent actual production once nflverse publishes completed games; current NFL bye weeks; your league’s playoff field and reseeding setting.</p><p>All teams get optimal projected lineups. Weekly scoring uncertainty and a 10% season-long team-strength variation represent forecast risk. This is a scenario model, not a historically calibrated probability. Future injuries, trades and waivers are not individually predicted. More simulations reduce sampling noise, not forecast error. Missing bench projections are excluded; missing complete lineups pause the model.</p><p>Full-season baselines are not dedicated rest-of-season forecasts. nflverse contributes recent targets, carries, target share and league-scored production as games become available. Completed matchup results are fixed. In-progress forecasts use points scored plus a clock-based remaining estimate; live score detail is in Scores.</p></details>');
}
function campaignSources(){const d=CAMPAIGN.data;campaignModal('Sources & freshness','<p>Only connected feeds contribute to the calculations. Each weekly provider gets one equal vote.</p>'+(d?d.sources.map(s=>'<div class="sbply"><span>'+esc(s.name)+'</span><b>'+ (s.ok?'Connected':esc(s.note||'Unavailable'))+'</b></div>').join(''):'<p>Loading source status…</p>')+'<p class="campaign-note">Weekly feeds refresh about every 15 minutes. Season outlooks cache for 6 hours. Transaction and roster scans refresh every 2 minutes when requested. ESPN NFL schedule supplies current bye weeks.</p><p>FantasyPros and RotoWire are not counted as live sources until licensed access is configured. Rankings are not fantasy-point projections.</p>');}
async function campaignAlerts(){
 let cfg={};try{cfg=await (await fetch('/api/season-alerts',{cache:'no-store'})).json();}catch(e){}
 campaignModal('Phone alerts','<p>Priority alerts for meaningful free-agent upgrades, valuable league drops, and injury changes on your roster. Repeated events are deduplicated.</p><p id="campaignPushStatus">'+(cfg.configured?'Background service is configured. '+(cfg.checkedAt?'Last server check: '+new Date(cfg.checkedAt).toLocaleString()+'. ':'First scheduled check is pending. ')+'Enable notifications on each phone you want to receive alerts.':'Background push is not configured yet. In-app alerts work while this page is open.')+'</p><button class="hbtn primary" data-campaign="enablepush"'+(!cfg.configured?' disabled':'')+'>Enable phone alerts</button> <button class="hbtn" data-campaign="disablepush">Turn off this device</button><p class="campaign-note">On iPhone, add this site to your Home Screen, open the installed app, then enable alerts. Background scans are scheduled every 5 minutes; scheduler or provider delays can occur. No alert means no detected change, not a guarantee nothing changed.</p><button class="hbtn" data-campaign="log">Open alert history</button>');
}
async function campaignPush(enable){
 const status=document.getElementById('campaignPushStatus');try{
  if(!('serviceWorker' in navigator)||!('PushManager'in window))throw Error('This browser needs an installed app with Web Push support.');
  const reg=await navigator.serviceWorker.ready;
  if(!enable){const sub=await reg.pushManager.getSubscription();if(sub){await fetch('/api/season-alerts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'unsubscribe',subscription:sub.toJSON()})});await sub.unsubscribe();}if(status)status.textContent='Phone alerts are off for this device.';return;}
  const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Allow notifications in your browser or device settings to receive alerts.');
  const cfg=await(await fetch('/api/season-alerts')).json();if(!cfg.configured)throw Error('Background service is not configured.');
  const raw=atob(cfg.publicKey.replace(/-/g,'+').replace(/_/g,'/')),key=Uint8Array.from(raw,c=>c.charCodeAt(0));
  const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  const r=await fetch('/api/season-alerts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:sub.toJSON(),league:S.settings.sleeperLeagueId,roster:+S.settings.sleeperRosterId})});const body=await r.json();if(!r.ok)throw Error(body.error||'Could not save subscription');if(status)status.textContent='Phone alerts are enabled. You will receive meaningful updates even with the app closed.';
 }catch(e){if(status)status.textContent=e.message;else toast(e.message);}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-campaign]');if(!b)return;const action=b.dataset.campaign;
 if(action==='close')document.getElementById('campaignOverlay')?.remove();
 if(action==='refresh')campaignRefresh(true);
 if(action==='waivers')campaignWaivers();if(action==='odds')campaignOdds();if(action==='sources')campaignSources();if(action==='alerts')campaignAlerts();
 if(action==='enablepush')campaignPush(true);if(action==='disablepush')campaignPush(false);
 if(action==='scores')renderScoreboard();if(action==='log'){document.getElementById('campaignOverlay')?.remove();renderAlertCenter();}
 if(action==='lineup')document.querySelector('.weekly-advice,#weeklyAdvice,.week-advice')?.scrollIntoView({behavior:'smooth'});
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('campaignOverlay')?.remove();});
