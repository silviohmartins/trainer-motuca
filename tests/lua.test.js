import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import fengari from 'fengari';
const { lua, lauxlib, lualib, to_luastring, to_jsstring }=fengari;
const source=readFileSync(new URL('../mod/MotucaTrainer/42/media/lua/client/MotucaTrainer/MotucaCommands.lua',import.meta.url),'utf8');
const mocks=`
clock=1700000000000.0; mutations=0; multiplayer=false; dead=false; god=false; data={}; traits={}; boosts=0; xp=0; levels={Axe=0}; values={HUNGER=.7,THIRST=.8,FATIGUE=.9,PAIN=60,TEMPERATURE=38}
function getTimestampMs() return clock end
function getText(key) return key end
function isClient() return multiplayer end
function isServer() return false end
Events={OnGameStart={Add=function(fn) start=fn end},OnTickEvenPaused={Add=function(fn) tick=fn end}}
CharacterStat=setmetatable({}, {__index=function(t,k)return k end})
CharacterTrait={BRAVE='brave'}
traitDefs={}
for _,row in ipairs({{'Brave','Corajoso'},{'NeedsMoreSleep','Dorminhoco'},{'Herbalist_Prof','Herborista'}}) do
 local kind={getName=function()return row[1] end}
 traitDefs[#traitDefs+1]={getType=function()return kind end,getLabel=function()return row[2] end}
end
CharacterTraitDefinition={getTraits=function()return {size=function()return #traitDefs end,get=function(self,i)return traitDefs[i+1] end}end}
Perks={Axe='Axe',None='None',MAX='MAX'}
PerkFactory={PerkList={size=function()return 1 end,get=function()return {getType=function()return 'Axe' end,getName=function()return 'Machado' end}end}}
function getAllItems() return {size=function()return 0 end} end
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
function getScriptManager()return {FindItem=function(self,id)if id=='Base.Axe' or id=='MyMod.Vest_Medium-Black' then return {}end end}end
loaded=true
function getCell()return {getGridSquare=function()if loaded then return {TreatAsSolidFloor=function()return true end,isFree=function()return true end}end end}end
function advance(ms)clock=clock+ms;tick()end
`;
function fixture(t) {
  const L=lauxlib.luaL_newstate(); lualib.luaL_openlibs(L); t.after(()=>lua.lua_close(L));
  const run=code=>{const status=lauxlib.luaL_dostring(L,to_luastring(code));if(status!==lua.LUA_OK){const message=to_jsstring(lua.lua_tostring(L,-1));lua.lua_pop(L,1);throw new Error(message);}};
  const read=name=>{lua.lua_getglobal(L,to_luastring(name));const value=lua.lua_toboolean(L,-1)?(lua.lua_isstring(L,-1)?to_jsstring(lua.lua_tostring(L,-1)):true):false;lua.lua_pop(L,1);return value;};
  run(mocks);run(source);
  // Devolve true quando o comando foi aplicado, ou a mensagem de erro.
  const send=command=>{run(`ok, err = MotucaCommands.run(${command})`);return read('ok') ? true : read('err');};
  return {run,read,send};
}
test('valida id, quantidade e existencia do item, e aplica o lote uma unica vez',t=>{
  const f=fixture(t);
  assert.equal(f.send("{action='item',item='Base.Axe',quantity=3}"),true);
  f.run('assert(mutations==3)');
  assert.equal(f.send("{action='item',item='Base.Missing',quantity=1}"),'IGUI_Motuca_ErrItemMissing');
  assert.equal(f.send("{action='item',item='Base.Axe',quantity=26}"),'IGUI_Motuca_ErrRange');
  // Ids de mod trazem '-': quem valida e o FindItem do jogo, nao um charset adivinhado.
  assert.equal(f.send("{action='item',item='MyMod.Vest_Medium-Black',quantity=1}"),true);
  assert.equal(f.send("{action='item',item='sem ponto',quantity=1}"),'IGUI_Motuca_ErrItemMissing');
  // Campo ausente vem como nil do formulario vazio: continua sendo recusado.
  assert.equal(f.send("{action='item',item='Base.Axe'}"),'IGUI_Motuca_ErrRange');
  f.run('assert(mutations==4)');
});
test('recusa comando sem personagem solo vivo',t=>{
  const f=fixture(t);
  f.run('dead=true');assert.equal(f.send("{action='needs'}"),'IGUI_Motuca_ErrNoPlayer');
  f.run('dead=false;multiplayer=true');assert.equal(f.send("{action='needs'}"),'IGUI_Motuca_ErrSolo');
  f.run('multiplayer=false;player=nil');assert.equal(f.send("{action='needs'}"),'IGUI_Motuca_ErrNoPlayer');
  f.run('assert(mutations==0)');
  assert.equal(f.send("{action='inexistente'}"),'IGUI_Motuca_ErrNoPlayer');
});
test('aplica cura, necessidades, limites de stat, pericias e XP',t=>{
  const f=fixture(t);
  for (const action of ['heal','infection','needs','rest']) assert.equal(f.send(`{action='${action}'}`),true);
  f.run('assert(values.HUNGER==0 and values.THIRST==0 and values.FATIGUE==0 and values.PAIN==0)');
  assert.equal(f.send("{action='stat',stat='temperature',value=37}"),true);
  assert.equal(f.send("{action='stat',stat='temperature',value=99}"),'IGUI_Motuca_ErrRange');
  assert.equal(f.send("{action='stat',stat='inventada',value=0}"),'IGUI_Motuca_ErrStat');
  assert.equal(f.send("{action='skill',perk='Axe',mode='plus'}"),true);
  f.run('assert(levels.Axe==1 and xp==1)');
  assert.equal(f.send("{action='skill',perk='Axe',mode='max'}"),true);
  f.run('assert(levels.Axe==10 and xp==10)');
  assert.equal(f.send("{action='skill',perk='Axe',mode='torto'}"),'IGUI_Motuca_ErrMode');
  assert.equal(f.send("{action='xp',perk='Axe',amount=100}"),true);
  f.run('assert(xp==110)');
  assert.equal(f.send("{action='xp',perk='Inexistente',amount=1}"),'IGUI_Motuca_ErrPerk');
  assert.equal(f.send("{action='inexistente'}"),'IGUI_Motuca_ErrUnknown');
});
test('lista tracos com rotulo, resolve os dois formatos de id e mexe no XP so na transicao',t=>{
  const f=fixture(t);
  f.run('kinds, labels = MotucaCommands.traits()');
  f.run("assert(labels.Brave=='Corajoso' and labels.NeedsMoreSleep=='Dorminhoco' and labels.Herbalist_Prof=='Herborista')");
  for (let i=0;i<2;i++) assert.equal(f.send("{action='trait',trait='NeedsMoreSleep',enabled=true}"),true);
  f.run('assert(boosts==1)');
  // Constantes Lua antigas continuam resolvendo: ignora caixa e sublinhado.
  for (let i=0;i<2;i++) assert.equal(f.send("{action='trait',trait='NEEDS_MORE_SLEEP',enabled=false}"),true);
  f.run('assert(boosts==0)');
  assert.equal(f.send("{action='trait',trait='SLEEPYHEAD',enabled=false}"),'IGUI_Motuca_ErrTrait');
  assert.equal(f.send("{action='trait',trait='Herbalist_Prof',enabled=true}"),true);
  assert.equal(f.send("{action='trait',trait='Brave'}"),'IGUI_Motuca_ErrTrait');
});
test('modo deus temporario expira com o jogo pausado e devolve o estado anterior',t=>{
  const f=fixture(t);
  assert.equal(f.send("{action='god',enabled=true,seconds=1}"),true);
  f.run('assert(god);advance(1100);assert(not god and data.MotucaGodUntil==nil)');
  f.run('god=true');assert.equal(f.send("{action='god',enabled=true,seconds=1}"),true);
  f.run('advance(1100);assert(god)');
  assert.equal(f.send("{action='god',enabled=false,seconds=1}"),true);
  f.run('assert(not god)');
  assert.equal(f.send("{action='god',enabled=true,seconds=601}"),'IGUI_Motuca_ErrRange');
});
test('teleporta para piso carregado e recusa destino sem quadrado',t=>{
  const f=fixture(t);
  assert.equal(f.send("{action='teleport',x=110,y=110,z=0}"),true);
  f.run('assert(destination[1]==110);loaded=false');
  assert.equal(f.send("{action='teleport',x=120,y=120,z=0}"),'IGUI_Motuca_ErrTeleport');
  f.run('loaded=true');
  assert.equal(f.send("{action='teleport',x=120,y=120,z=99}"),'IGUI_Motuca_ErrRange');
  f.run('assert(destination[1]==110)');
});
test('catalogo de itens ignora obsoletos e ocultos, ordena por nome e esquece na troca de partida',t=>{
  const f=fixture(t);
  f.run(`
    function getAllItems() return {size=function()return 4 end,get=function(self,i)
      local names={'Zarabatana','Machado','Bandagem','Escondido'}
      return {getObsolete=function()return i==0 end,isHidden=function()return i==3 end,
      getFullName=function()return 'MyMod.Item'..i end,getDisplayName=function()return names[i+1] end,getModuleName=function()return 'MyMod' end}
    end} end
    rows = MotucaCommands.items()
  `);
  f.run("assert(#rows==2, 'esperava 2 itens, veio '..#rows)");
  f.run("assert(rows[1].name=='Bandagem' and rows[1].id=='MyMod.Item2')");
  f.run("assert(rows[2].name=='Machado' and rows[2].module=='MyMod')");
  // Mesma partida reaproveita o cache; OnGameStart descarta.
  f.run('assert(MotucaCommands.items()==rows);start();assert(MotucaCommands.items()~=rows)');
});
