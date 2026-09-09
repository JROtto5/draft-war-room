// Local equivalent of the static Vercel site, its fixed feed rewrites, and projection function.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('..',import.meta.url));
const require=createRequire(import.meta.url);
const projections=require('../api/projections.js');
const handlers=Object.fromEntries(['party-parlays','campaign','edge-record','season-alerts','season-scan'].map(n=>['/api/'+n,async(req,res)=>require('../api/'+n+'.js')(req,res)]));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const feeds={'/feeds/nfl/injuries':'injuries','/feeds/nfl/scoreboard':'scoreboard'};
const port=Number(process.argv[process.argv.indexOf('--port')+1])||8767;
createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(handlers[url.pathname]) return await handlers[url.pathname](req,res);
    if(url.pathname==='/api/projections') return await projections(req,res);
    if(feeds[url.pathname]){
      const upstream=await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/'+feeds[url.pathname]+url.search,{signal:AbortSignal.timeout(18000)});
      res.writeHead(upstream.status,{'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(Buffer.from(await upstream.arrayBuffer()));return;
    }
    const path=['/','/draft','/season'].includes(url.pathname)?'/index.html':url.pathname==='/bets'?'/bets.html':decodeURIComponent(url.pathname);
    const file=resolve(root,'.'+path);
    if(!file.startsWith(root)){res.writeHead(403);res.end();return;}
    const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(body);
  }catch(e){res.writeHead(e.code==='ENOENT'?404:502);res.end('Resource unavailable');}
}).listen(port,'127.0.0.1',()=>console.log('War Room: http://127.0.0.1:'+port));
