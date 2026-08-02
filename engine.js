"use strict";
/* Draft War Room — pure engine kernel (no DOM, no globals).
   Loaded before app.js in the page; imported directly by node tests;
   available to sim-worker.js via importScripts. */

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}

function isSubseq(needle, hay){
  let i=0;
  for(let j=0; j<hay.length && i<needle.length; j++) if(hay[j]===needle[i]) i++;
  return i===needle.length;
}

function nq(s){ return s.toLowerCase().replace(/[.'’\-]/g,"").trim(); }

function parsePicks(str, teams){
  const t = teams || 12, out = [];
  String(str).split(/[,\s]+/).filter(Boolean).forEach(tok=>{
    const m = tok.match(/^(\d+)\.(\d+)$/);
    if(m) out.push((+m[1]-1)*t + Math.min(t,+m[2]));
    else if(/^\d+$/.test(tok)) out.push(+tok);
  });
  return out;
}

function ordSuffix(n){ return n%10===1&&n%100!==11?"st":n%10===2&&n%100!==12?"nd":n%10===3&&n%100!==13?"rd":"th"; }

function ordinal(n){ return n+(n%10===1&&n%100!==11?"st":n%10===2&&n%100!==12?"nd":n%10===3&&n%100!==13?"rd":"th"); }

function fmt(n){ return Math.round(n).toLocaleString("en-US"); }

const STARTABLE = {QB:2, RB:5, WR:5, TE:2, DEF:1};

function satAdjust(pos, curCount, score, startable){
  const st = startable || STARTABLE;
  const over = curCount + 1 - (st[pos]||1);
  if(over <= 0) return {score, note:null};
  if(over === 1 && pos!=="DEF") return {score: score*(pos==="QB"?0.45:0.3), note:"your "+pos+" starters are set — depth value only"};
  return {score: Math.min(score,0)-400, note:"you're saturated at "+pos};
}

function injSeverity(status){
  const s = String(status||"").toLowerCase();
  if(!s || s.indexOf("active")===0) return null;
  if(s.indexOf("quest")===0 || s.indexOf("day-to-day")>=0) return {code:"Q", mult:0.97, cls:"sevq", label:"Questionable"};
  if(s.indexOf("doubt")===0) return {code:"D", mult:0.92, cls:"sevd", label:"Doubtful"};
  if(s.indexOf("out")===0) return {code:"O", mult:0.85, cls:"sevo", label:"Out"};
  if(s.indexOf("injured reserve")>=0 || s==="ir" || s.indexOf("pup")===0 || s.indexOf("unable")>=0 ||
     s.indexOf("sus")===0 || s.indexOf("nfi")>=0 || s.indexOf("dnr")>=0)
    return {code:"IR", mult:0.5, cls:"sevir", label:status};
  return {code:"?", mult:0.96, cls:"sevq", label:status};
}

const PRIME = {RB:[23,27], WR:[24,29], TE:[25,30], QB:[26,36]};
