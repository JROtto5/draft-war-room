import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {parseEspn,parseCbs}=require('../lib/weekly-projections.cjs');
const stats={3:234,4:1.9,20:.65,24:25,25:.2,53:0,72:.2};
const players=Array.from({length:20},(_,i)=>({player:{fullName:'Quarterback '+i,defaultPositionId:1,stats:[
 {seasonId:2025,scoringPeriodId:1,statSourceId:1,statSplitTypeId:1,stats:{3:9999}},
 {seasonId:2026,scoringPeriodId:0,statSourceId:1,statSplitTypeId:0,stats:{3:6000}},
 {seasonId:2026,scoringPeriodId:1,statSourceId:0,statSplitTypeId:1,stats:{3:50}},
 {seasonId:2026,scoringPeriodId:1,statSourceId:1,statSplitTypeId:1,stats}
]}}));
const espn=parseEspn({players},2026,1);
assert.equal(espn[0].stats.pass_yd,234,'select the current season/week forecast, not history or a season total');
assert.equal(espn[0].stats.rec,0,'receptions use ESPN stat 53, not receiving yards');
assert.equal(espn[0].stats.pass_int,.65);
assert.throws(()=>parseEspn({players},2026,2),/too few/);
const cells=['<span class="CellPlayerName--long"><a>Justin Herbert</a><span class="CellPlayerName-team">LAC</span></span>',1,32.4,22.8,254,254,2.3,.7,108.1,5.1,35.7,7,.2,.1,27,27];
const makeHtml=(cs,week=1)=>'<title>Week '+week+' Proj Fantasy Football Stats</title>/QB/2026/'+week+'/projections/ppr/<table>'+Array.from({length:10},()=>'<tr>'+cs.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</table>';
const cbs=parseCbs(makeHtml(cells),'QB',2026,1);
assert.equal(cbs[0].stats.pass_td,2.3);assert.equal(cbs[0].stats.rush_yd,35.7);assert.equal(cbs[0].stats.fum_lost,.1);
assert.throws(()=>parseCbs(makeHtml(cells,2),'QB',2026,1),/requested weekly/);
assert.throws(()=>parseCbs(makeHtml(cells),'QB',2025,1),/requested weekly/);
assert.throws(()=>parseCbs(makeHtml(cells.map((v,i)=>i===1?17:v)),'QB',2026,1),/incomplete/,'reject season-scale games played');
assert.throws(()=>parseCbs(makeHtml(cells.map((v,i)=>i===6?'—':v)),'QB',2026,1),/incomplete/,'missing cells must not become zero');
const handler=require('../api/projections.js');
for(const query of ['source=https://example.com&season=2026&week=1','source=espn&season=2026&week=0','source=espn&season=2026&week=19']){
 const res={setHeader(){},end(body){this.body=body;}};
 await handler({method:'GET',url:'/api/projections?'+query},res);assert.equal(res.statusCode,400);
}
console.log('provider parsing, weekly identity, and endpoint validation tests passed');
