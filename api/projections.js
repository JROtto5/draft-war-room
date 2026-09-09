const {loadProvider}=require('../lib/weekly-projections.cjs');
const cache=new Map(), pending=new Map();
module.exports=async function(req,res){
  const query=new URL(req.url,'http://localhost').searchParams;
  const source=query.get('source'), season=Number(query.get('season')), week=Number(query.get('week'));
  res.setHeader('Content-Type','application/json');
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET' || !['espn','cbs'].includes(source) || !Number.isInteger(week) || week<1 || week>18 || !Number.isInteger(season) || season<2020 || season>new Date().getFullYear()+1){
    res.statusCode=400;res.end(JSON.stringify({error:'Use espn or cbs, a valid season, and week 1–18.'}));return;
  }
  const key=[source,season,week].join(':'), old=cache.get(key);
  try{
    let result=old && Date.now()-old.fetchedAt<15*60e3 ? old : null;
    if(!result){
      if(!pending.has(key)) pending.set(key,loadProvider(source,season,week).then(data=>{
        const value={source,season,week,fetchedAt:Date.now(),publishedAt:null,...data};
        cache.set(key,value);
        if(cache.size>24) cache.delete(cache.keys().next().value);
        return value;
      }).finally(()=>pending.delete(key)));
      result=await pending.get(key);
    }
    res.end(JSON.stringify(result));
  }catch(e){res.statusCode=502;res.end(JSON.stringify({source,season,week,error:e.message}));}
};
