import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import fengari from 'fengari';
const { lua, lauxlib, lualib, to_luastring, to_jsstring }=fengari;
const source=readFileSync(new URL('../mod/PZWebBridge/42/media/lua/client/PZWebBridge.lua',import.meta.url),'utf8');
const mocks=`
clock=1700000000000.0; files={}; mutations=0; multiplayer=false; dead=false; god=false; data={}; traits={}; boosts=0; xp=0; levels={Axe=0}; values={HUNGER=.7,THIRST=.8,FATIGUE=.9,PAIN=60,TEMPERATURE=38}
function getTimestampMs() return clock end
function ZombRand() return 42 end
function isClient() return multiplayer end
function isServer() return false end
paused=false
Events={OnGameStart={Add=function(fn) start=fn end},OnMainMenuEnter={Add=function(fn) menu=fn end},OnTick={Add=function(fn) normalTick=fn end},OnTickEvenPaused={Add=function(fn) tick=fn end}}
CharacterStat=setmetatable({}, {__index=function(t,k)return k end})
CharacterTrait={BRAVE='brave'}
traitDefs={}
for _,row in ipairs({{'Brave','Corajoso'},{'NeedsMoreSleep','Dorminhoco'},{'Herbalist_Prof','Herborista'}}) do
 local kind={getName=function()return row[1] end}
 traitDefs[#traitDefs+1]={getType=function()return kind end,getLabel=function()return row[2] end}
end
CharacterTraitDefinition={getTraits=function()return {size=function()return #traitDefs end,get=function(self,i)return traitDefs[i+1] end}end}
Perks={Axe='Axe',None='None',MAX='MAX'}
PerkFactory={PerkList={size=function()return 1 end,get=function()return {getType=function()return 'Axe' end}end}}
function getFileWriter(path,create,append)
 if not path:match('%.txt$') and not path:match('%.json$') then return nil end
 return {write=function(self,s)files[path]=(append and files[path] or '')..s end,close=function()end}
end
function getAllItems() return {size=function()return 0 end} end
function getFileReader(path)
 if not files[path] then return nil end
 return {readLine=function()return files[path]end,close=function()end}
end
local parts={size=function()return 2 end,get=function()return {SetInfected=function()end,SetFakeInfected=function()end}end}
damage={RestoreToFullHealth=function()mutations=mutations+1 end,getBodyParts=function()return parts end,setInfected=function()end,setIsFakeInfected=function()end,setInfectionTime=function()end,setInfectionMortalityDuration=function()end,getOverallBodyHealth=function()return 90 end}
player={
 isDead=function()return dead end,getBodyDamage=function()return damage end,
 getStats=function()return {get=function(self,k)return values[k] or 0 end,set=function(self,k,v)values[k]=v;mutations=mutations+1 end}end,
 getInventory=function()return {AddItem=function(self,id)mutations=mutations+1;return {}end}end,
 getModData=function()return data end,isGodMod=function()return god end,setGodMod=function(self,v)god=v end,
 getX=function()return 100 end,getY=function()return 100 end,getZ=function()return 0 end,
 getPerkLevel=function(self,perk)return levels[perk] or 0 end,LevelPerk=function(self,perk)levels[perk]=(levels[perk] or 0)+1 end,
 getXp=function()return {setXPToLevel=function(self,perk,level)xp=level end,AddXP=function(self,perk,amount)xp=xp+amount end}end,
 hasTrait=function(self,trait)return traits[trait]==true end,
 getCharacterTraits=function()return {add=function(self,trait)traits[trait]=true end,remove=function(self,trait)traits[trait]=nil end,
  getKnownTraits=function()
   local list={}
   for kind in pairs(traits) do list[#list+1]=kind end
   return {size=function()return #list end,get=function(self,i)return list[i+1] end}
  end}end,
 modifyTraitXPBoost=function(self,trait,remove)boosts=boosts+(remove and -1 or 1) end,
 getVehicle=function()return nil end,teleportTo=function(self,x,y,z)destination={x,y,z}end
}
function getPlayer()return player end
function getScriptManager()return {FindItem=function(self,id)if id=='Base.Axe' then return {}end end}end
loaded=true
function getCell()return {getGridSquare=function()if loaded then return {TreatAsSolidFloor=function()return true end,isFree=function()return true end}end end}end
function advance(ms)clock=clock+ms;if not paused and normalTick then normalTick() end;tick()end
`;
function fixture(t) {
  const L=lauxlib.luaL_newstate(); lualib.luaL_openlibs(L); t.after(()=>lua.lua_close(L));
  const run=code=>{const status=lauxlib.luaL_dostring(L,to_luastring(code));if(status!==lua.LUA_OK){const message=to_jsstring(lua.lua_tostring(L,-1));lua.lua_pop(L,1);throw new Error(message);}};
  const set=(key,value)=>{lua.lua_pushstring(L,to_luastring(value));lua.lua_setglobal(L,to_luastring(key));};
  const file=name=>{run(`result=files['PZWebBridge/${name}']`);lua.lua_getglobal(L,to_luastring('result'));const s=lua.lua_tostring(L,-1);const result=s?JSON.parse(to_jsstring(s)):null;lua.lua_pop(L,1);return result;};
  run(mocks);run(source);run('start();tick()');
  let sequence=0;
  const send=(command,extra={})=>{
    const state=file('state.json');
    set('payload',JSON.stringify({protocol:1,session:state.session,id:`command-${++sequence}`,expires:state.at+3000,...command,...extra}));
    run("files['PZWebBridge/command.json']=payload;advance(160)");
    return file('response.json');
  };
  return {run,file,send,set};
}
test('real Lua parses JSON, spawns bounded items once, rejects missing items and malformed payloads',t=>{
  const f=fixture(t);
  assert.equal(f.file('state.json').ready,true);
  assert.equal(f.send({action:'item',item:'Base.Axe',quantity:3}).ok,true);
  f.run('assert(mutations==3);advance(200);assert(mutations==3)');
  assert.equal(f.send({action:'item',item:'Base.Missing',quantity:1}).ok,false);
  assert.equal(f.send({action:'item',item:'Base.Axe',quantity:26}).ok,false);
  f.set('payload','{"action":"item","quantity":1,"quantity":2}');
  f.run("files['PZWebBridge/command.json']=payload;advance(200);assert(mutations==3)");
});
test('real Lua rejects expired, wrong-session, dead, multiplayer and absent-player commands',t=>{
  const f=fixture(t);
  assert.equal(f.send({action:'needs'},{expires:1}).ok,false);
  const previous=f.file('response.json');
  assert.deepEqual(f.send({action:'needs'},{session:'other'}),previous);
  f.run('dead=true');assert.equal(f.send({action:'needs'}).ok,false);
  f.run('dead=false;multiplayer=true');assert.equal(f.send({action:'needs'}).ok,false);
  f.run('multiplayer=false;player=nil');assert.equal(f.send({action:'needs'}).ok,false);
  f.run('assert(mutations==0)');
});
test('real Lua handles needs, health, stat validation, skills and XP',t=>{
  const f=fixture(t);
  for (const action of ['heal','infection','needs','rest']) assert.equal(f.send({action}).ok,true);
  f.run('assert(values.HUNGER==0 and values.THIRST==0 and values.FATIGUE==0 and values.PAIN==0)');
  assert.equal(f.send({action:'stat',stat:'temperature',value:37}).ok,true);
  assert.equal(f.send({action:'stat',stat:'temperature',value:99}).ok,false);
  assert.equal(f.send({action:'skill',perk:'Axe',mode:'plus'}).ok,true);
  f.run('assert(levels.Axe==1 and xp==1)');
  assert.equal(f.send({action:'skill',perk:'Axe',mode:'max'}).ok,true);
  f.run('assert(levels.Axe==10 and xp==10)');
  assert.equal(f.send({action:'xp',perk:'Axe',amount:100}).ok,true);
  f.run('assert(xp==110)');
});
test('real Lua exports the trait list, resolves ids and updates trait XP only for membership transitions',t=>{
  const f=fixture(t);
  assert.deepEqual(f.file('traits.json'),{Brave:'Corajoso',NeedsMoreSleep:'Dorminhoco',Herbalist_Prof:'Herborista'});
  for(let i=0;i<2;i++) assert.equal(f.send({action:'trait',trait:'NeedsMoreSleep',enabled:true}).ok,true);
  f.run('assert(boosts==1);advance(160)');
  assert.equal(f.file('state.json').traits,'NeedsMoreSleep');
  // Legacy Lua constants still resolve: case and underscores are ignored.
  for(let i=0;i<2;i++) assert.equal(f.send({action:'trait',trait:'NEEDS_MORE_SLEEP',enabled:false}).ok,true);
  f.run('assert(boosts==0);advance(160)');
  assert.equal(f.file('state.json').traits,'');
  assert.equal(f.send({action:'trait',trait:'SLEEPYHEAD',enabled:false}).ok,false);
  assert.equal(f.send({action:'trait',trait:'Herbalist_Prof',enabled:true}).ok,true);
  f.run('advance(160)');
  assert.equal(f.file('state.json').traits,'Herbalist_Prof');
});
test('real Lua expires temporary god mode, preserves previous state and rejects stale sessions after reload',t=>{
  const f=fixture(t);
  assert.equal(f.send({action:'god',enabled:true,seconds:1}).ok,true);
  f.run('assert(god);advance(1100);assert(not god and data.PZWebBridgeGodUntil==nil)');
  f.run('god=true');assert.equal(f.send({action:'god',enabled:true,seconds:1}).ok,true);
  f.run('advance(1100);assert(god)');
  assert.equal(f.send({action:'god',enabled:false,seconds:1}).ok,true);
  f.run('assert(not god)');
  assert.equal(f.send({action:'item',item:'Base.Axe',quantity:1}).ok,true);
  f.run('start();advance(200);assert(mutations==1)');
});
test('real Lua teleports to loaded floor and rejects unloaded destinations',t=>{
  const f=fixture(t);
  assert.equal(f.send({action:'teleport',x:110,y:110,z:0}).ok,true);
  f.run('assert(destination[1]==110);loaded=false');
  assert.equal(f.send({action:'teleport',x:120,y:120,z:0}).ok,false);
  f.run('assert(destination[1]==110)');
});
test('paused game keeps heartbeat, executes commands once and expires god mode without normal ticks',t=>{
  const f=fixture(t);
  f.run('paused=true;assert(normalTick==nil);advance(3000)');
  assert.equal(f.file('state.json').at,1700000003000);
  assert.equal(f.file('state.json').ready,true);
  assert.equal(f.send({action:'item',item:'Base.Axe',quantity:1}).ok,true);
  f.run('advance(200);assert(mutations==1)');
  assert.equal(f.send({action:'god',enabled:true,seconds:1}).ok,true);
  f.run('assert(god);advance(1100);assert(not god)');
});
test('main menu invalidates session even with a remaining player reference',t=>{
  const f=fixture(t);
  const previous=f.file('state.json');
  f.run('menu()');
  assert.equal(f.file('state.json').ready,false);
  f.set('payload',JSON.stringify({protocol:1,session:previous.session,id:'late',expires:previous.at+3000,action:'item',item:'Base.Axe',quantity:1}));
  f.run("files['PZWebBridge/command.json']=payload;advance(200);assert(mutations==0)");
  assert.equal(f.file('response.json'),null);
  f.run('start();advance(200);assert(mutations==0)');
  assert.equal(f.file('state.json').ready,true);
  assert.notEqual(f.file('state.json').session,previous.session);
});
test('catalog export is batched, includes mod IDs and localized names, excludes hidden items',t=>{
  const f=fixture(t);
  f.run("assert(getFileWriter('PZWebBridge/catalog.ndjson',true,false)==nil)");
  f.run(`
    function getAllItems() return {size=function()return 205 end,get=function(self,i)
      return {getObsolete=function()return i==0 end,isHidden=function()return i==1 end,
      getFullName=function()return 'MyMod.Item'..i end,getDisplayName=function()return 'Machado especial' end,getModuleName=function()return 'MyMod' end}
    end} end
    advance(200);start();tick()
  `);
  assert.notEqual(f.file('catalog-meta.json').session,f.file('state.json').session);
  f.run('advance(160)');
  assert.notEqual(f.file('catalog-meta.json').session,f.file('state.json').session);
  f.run('advance(160)');
  assert.equal(f.file('catalog-meta.json').count,203);
  f.run("assert(files['PZWebBridge/catalog.txt']:find('MyMod.Item204',1,true));assert(not files['PZWebBridge/catalog.txt']:find('MyMod.Item0',1,true))");
});
