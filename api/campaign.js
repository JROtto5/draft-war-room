const {build}=require('../lib/campaign-service.cjs');
module.exports=async(req,res)=>{
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 const q=new URL(req.url,'http://localhost').searchParams,league=q.get('league'),roster=Number(q.get('roster'));
 if(req.method!=='GET'||!/^\d{15,22}$/.test(league||'')||!Number.isInteger(roster)||roster<1||roster>32){res.statusCode=400;return res.end(JSON.stringify({error:'A Sleeper league and roster are required.'}));}
 try{res.end(JSON.stringify(await build(league,roster)));}catch(e){res.statusCode=502;res.end(JSON.stringify({error:e.message}));}
};
