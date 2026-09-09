const P=require('../lib/season-push.cjs');
module.exports=async(req,res)=>{
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');const reply=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
 if(req.method==='GET'){const health=P.configured()?await P.health().catch(()=>null):null;return reply(200,{configured:P.configured(),publicKey:P.configured()?process.env.SEASON_VAPID_PUBLIC:null,checkedAt:health?.checkedAt||null});}
 if(req.method!=='POST')return reply(405,{error:'Use GET or POST'});
 if(!P.configured())return reply(503,{error:'Background alerts are not configured'});
 const origin=req.headers.origin;if(origin&&!['https://draft-war-room-chi.vercel.app','http://127.0.0.1:8771'].includes(origin))return reply(403,{error:'Unexpected origin'});
 try{const b=await P.body(req);if(!P.validSubscription(b.subscription))return reply(400,{error:'Invalid push subscription'});
  if(b.action==='unsubscribe'){await P.remove(b.subscription);return reply(200,{ok:true});}
  // This personal deployment monitors only the owner's configured league and roster.
  const league=process.env.SEASON_LEAGUE_ID||'1357910286874464256',roster=+(process.env.SEASON_ROSTER_ID||12);
  if(b.league!==league||+b.roster!==roster)return reply(400,{error:'This deployment is configured for the owner’s Sleeper roster'});
  const existing=await P.documents(),prior=existing.find(x=>P.idOf(x.doc.subscription)===P.idOf(b.subscription))?.doc;
  if(!prior&&existing.length>=20)return reply(429,{error:'Device limit reached. Remove an old device first.'});
  const doc=prior?{...prior,subscription:b.subscription}:{subscription:b.subscription,league,roster,createdAt:Date.now(),seen:{},injuries:{},initialized:false};
  await P.save(doc);await P.send(b.subscription,{title:'Season alerts enabled',body:'Meaningful waiver upgrades, league drops and roster injury changes will reach this device.',tag:'season-welcome'});
  return reply(200,{ok:true});
 }catch(e){return reply(502,{error:'Could not save or send push notification. Please retry.'});}
};
