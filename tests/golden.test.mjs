// Golden outputs: the auto-written stories and season lines must not drift
// silently. UPDATE_GOLDENS=1 node tests/golden.test.mjs rewrites them.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

function anyProxy(){const fn=function(){};return new Proxy(fn,{get(t,k){if(k===Symbol.toPrimitive)return()=>"";if(k==="length")return 0;if(k===Symbol.iterator)return function*(){};return anyProxy();},set(){return true},apply(){return anyProxy()},construct(){return anyProxy()},has(){return true}});}
const ctx = {console,JSON,Math,Array,Object,String,Number,parseFloat,parseInt,isNaN,setTimeout:()=>0,clearTimeout:()=>{},document:anyProxy(),localStorage:anyProxy(),navigator:anyProxy(),location:{protocol:"file:",search:"",hash:""},window:{},alert:()=>{},confirm:()=>false,prompt:()=>null,requestAnimationFrame:()=>0,MutationObserver:anyProxy(),matchMedia:()=>({matches:false,addEventListener:()=>{}}),Date,fetch:()=>Promise.reject(new Error("x")),Blob:anyProxy(),URL:anyProxy(),FileReader:anyProxy(),indexedDB:{open:()=>({})}};
ctx.window=ctx; ctx.addEventListener=()=>{}; ctx.removeEventListener=()=>{};
vm.createContext(ctx);
for(const f of ["data.js","engine.js","core.js","views.js","wire.js","boot.js"]) vm.runInContext(readFileSync(new URL("../"+f, import.meta.url),"utf8"), ctx);
const g = s => vm.runInContext(s, ctx);

const SUBJECTS = ["Josh Allen","Joe Burrow","Bijan Robinson","Brock Bowers","Jahmyr Gibbs"];
const actual = {};
for(const n of SUBJECTS){
  actual["story:"+n] = g(`storyOf(allPlayers().find(p=>p.name===${JSON.stringify(n)}))`);
  actual["hist:"+n] = JSON.stringify(g(`hist3For(allPlayers().find(p=>p.name===${JSON.stringify(n)}))`));
}
const path = new URL("./goldens.json", import.meta.url);
if(process.env.UPDATE_GOLDENS){
  writeFileSync(path, JSON.stringify(actual, null, 2));
  console.log("goldens updated:", Object.keys(actual).length);
} else {
  assert.ok(existsSync(path), "goldens.json missing — run UPDATE_GOLDENS=1");
  const gold = JSON.parse(readFileSync(path, "utf8"));
  for(const k of Object.keys(gold)) assert.strictEqual(actual[k], gold[k], "golden drift: "+k);
  console.log("golden.test OK —", Object.keys(gold).length, "outputs stable");
}
