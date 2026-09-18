import { getLocale, languages, localizeDocument, number, setLocale, t, time } from './i18n.js';

const $ = selector => document.querySelector(selector);
localizeDocument();
const language = $('#language');
language.replaceChildren(...Object.entries(languages).map(([code, name]) => new Option(name, code)));
language.value = getLocale();
language.addEventListener('change', () => setLocale(language.value));
let token, connected = false, busy = false, timer, polling = false;
const route = { heal:'player/heal', infection:'player/infection', needs:'player/needs', rest:'player/rest', item:'items/add', skill:'skills/change', xp:'skills/xp', trait:'traits/change', god:'player/god', stat:'player/stat', teleport:'player/teleport' };
function controls() {
  document.querySelectorAll('.panel button').forEach(button => { button.disabled = !connected || busy; });
}
function notify(message, error = false) {
  const toast = $('#toast'); toast.textContent = message; toast.className = error ? 'error' : ''; toast.hidden = false;
  clearTimeout(timer); timer = setTimeout(() => { toast.hidden = true; }, 6000);
  const entry = document.createElement('li'); entry.className = error ? 'error' : '';
  const timestamp = document.createElement('time'); timestamp.textContent = time(new Date());
  entry.append(timestamp, document.createTextNode(message));
  $('#log .muted')?.remove(); $('#log').prepend(entry);
  while ($('#log').children.length > 30) $('#log').lastChild.remove();
}
async function json(url, options) {
  const response = await fetch(url, { ...options, signal:AbortSignal.timeout(6000) });
  const body = await response.json(); if (!response.ok) throw new Error(body.error || t('Falha na conexão.')); return body;
}
async function send(action, data, label) {
  if (busy || !connected) return;
  busy = true; controls();
  try {
    await json(`/api/${route[action]}`, {method:'POST', headers:{'Content-Type':'application/json','X-Trainer-Token':token},body:JSON.stringify(data)});
    notify(`${label}: ${t('confirmado pelo jogo.')}`);
  } catch (error) { notify(error.name === 'TimeoutError' ? t('Sem confirmação. Confira o jogo antes de repetir.') : error.message, true); }
  finally { busy=false; await status(); controls(); }
}
async function status() {
  if (polling) return; polling=true;
  try {
    const result = await json('/api/status'); connected = result.connected;
    $('#connection').textContent = connected ? t('Conectado') : t('Aguardando jogo');
    $('#connection').classList.toggle('online', connected); $('#waiting').hidden = connected;
    $('#waiting').textContent=t('Ative o mod Motuca Web Bridge e carregue uma partida solo. O trainer também funciona com o jogo pausado.');
    const s = result.state;
    const owned = s?.traits || '';
    if (owned !== traitsSignature) { traitsSignature=owned; traitsOwned=owned?owned.split(','):[]; if ($('#trait-dialog').open) renderTraits(); }
    for (const key of ['health','hunger','thirst','fatigue']) {
      const value = s?.[key]; $(`#${key}`).textContent = typeof value === 'number' ? `${Math.round(key === 'health' ? value : value * 100)}%` : '—';
      $(`#${key}-meter`).value = typeof value === 'number' ? (key === 'health' ? value : value * 100) : 0;
    }
    $('#health-meter').value = s?.health || 0;
    $('#position').textContent = s ? `${s.x.toFixed(0)} / ${s.y.toFixed(0)} / ${s.z.toFixed(0)}` : '— / — / —';
    $('#god-state').textContent = s ? s.god ? 'ATIVO' : 'DESATIVADO' : '—';
    document.querySelectorAll('.skill').forEach(row => { row.querySelector('.level').textContent = s?.[`skill_${row.dataset.perk}`] ?? '—'; });
  } catch {
    connected=false; $('#connection').textContent=t('Servidor indisponível'); $('#connection').classList.remove('online'); $('#waiting').hidden=false;
    $('#waiting').textContent=t('Não foi possível acessar o servidor local. Verifique se npm start está em execução e recarregue o painel.');
    for (const key of ['health','hunger','thirst','fatigue','position','god-state']) $(`#${key}`).textContent='—';
    document.querySelectorAll('.telemetry meter').forEach(meter => { meter.value=0; }); document.querySelectorAll('.level').forEach(el => el.textContent='—');
  } finally { polling=false; controls(); }
}
function form(id, action, convert, label) {
  $(id).addEventListener('submit', event => { event.preventDefault(); send(action, convert(Object.fromEntries(new FormData(event.target))), label); });
}
let traitLabels={}, traitsOwned=[], traitsSignature=null;
const normalize = text => text.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
function renderTraits() {
  const term=normalize($('#trait-search').value), mine=$('#trait-filter').value==='mine';
  const rows=Object.entries(traitLabels)
    .filter(([id,label])=>(!mine||traitsOwned.includes(id))&&normalize(`${label} ${id}`).includes(term))
    .sort((a,b)=>a[1].localeCompare(b[1],getLocale()));
  $('#trait-status').textContent=rows.length ? `${number(rows.length)} ${rows.length===1?t('traço encontrado'):t('traços encontrados')} · ${t('clique para selecionar')}` : t('Nenhum traço encontrado. Tente outro nome ou id.');
  $('#trait-results').replaceChildren(...rows.map(([id,label])=>{
    const owned=traitsOwned.includes(id);
    const button=document.createElement('button'); button.type='button'; button.className='catalog-item';
    const name=document.createElement('strong'); name.textContent=label;
    const key=document.createElement('small'); key.textContent=id;
    const action=document.createElement('span'); action.textContent=owned?t('o personagem tem · remover'):t('adicionar');
    button.append(name,key,action);
    button.addEventListener('click',()=>{
      $('#trait').value=id; $('#trait-enabled').value=owned?'false':'true'; $('#trait-dialog').close();
    });
    return button;
  }));
}
async function loadTraits() {
  $('#trait-status').textContent=t('Carregando traços…');
  $('#trait-results').replaceChildren(); $('#trait-results').setAttribute('aria-busy','true');
  try {
    traitLabels=await json('/api/traits/catalog');
    if (!Object.keys(traitLabels).length) { $('#trait-status').textContent=t('Lista indisponível. Carregue uma partida com o mod ativo e aguarde alguns segundos.'); return; }
    // The text field stays typeable: ids from mods loaded later still work.
    $('#trait-ids').replaceChildren(...Object.keys(traitLabels).sort().map(id=>new Option(traitLabels[id],id)));
    renderTraits();
  } catch(error) { $('#trait-status').textContent=error.message; }
  finally { $('#trait-results').setAttribute('aria-busy','false'); }
}
$('#browse-traits').addEventListener('click',()=>{ $('#trait-dialog').showModal(); loadTraits(); });
$('#trait-close').addEventListener('click',()=>$('#trait-dialog').close());
$('#trait-search').addEventListener('input',renderTraits);
$('#trait-filter').addEventListener('change',renderTraits);
$('#trait-refresh').addEventListener('click',()=>loadTraits());
let catalogPage=1, catalogPages=1, catalogRequest=0, catalogTimer;
async function loadCatalog(page=1) {
  clearTimeout(catalogTimer);
  const request=++catalogRequest;
  $('#catalog-status').textContent=t('Carregando catálogo…');
  $('#catalog-results').replaceChildren();
  $('#catalog-results').setAttribute('aria-busy','true');
  $('#catalog-prev').disabled=true; $('#catalog-next').disabled=true;
  $('#catalog-page').textContent='';
  try {
    const params=new URLSearchParams({q:$('#catalog-search').value,module:$('#catalog-module').value,page:String(page)});
    const result=await json(`/api/items/catalog?${params}`);
    if(request!==catalogRequest) return;
    const selected=$('#catalog-module').value;
    const all=new Option(t('Todos os módulos'),'');
    $('#catalog-module').replaceChildren(all,...result.modules.map(m=>new Option(m,m)));
    $('#catalog-module').value=result.modules.includes(selected)?selected:'';
    if(selected && !result.modules.includes(selected)) return loadCatalog(1);
    catalogPage=result.page; catalogPages=result.pages;
    $('#catalog-status').textContent=result.total ? `${number(result.total)} ${result.total===1?t('item encontrado'):t('itens encontrados')} · ${t('clique para selecionar')}` : t('Nenhum item encontrado. Tente outro nome ou módulo.');
    for(const item of result.items) {
      const button=document.createElement('button'); button.type='button'; button.className='catalog-item';
      const name=document.createElement('strong'); name.textContent=item.name;
      const id=document.createElement('small'); id.textContent=item.id;
      const module=document.createElement('span'); module.textContent=item.module;
      button.append(name,id,module);
      button.addEventListener('click',()=>{
        $('#item').value=item.id; $('#item-dialog').close(); $('#quantity').focus(); $('#quantity').select();
      });
      $('#catalog-results').append(button);
    }
    $('#catalog-page').textContent=`${t('Página')} ${catalogPage} ${t('de')} ${catalogPages}`;
    $('#catalog-prev').disabled=catalogPage<=1; $('#catalog-next').disabled=catalogPage>=catalogPages;
  } catch(error) { if(request===catalogRequest) $('#catalog-status').textContent=error.message; }
  finally { if(request===catalogRequest) $('#catalog-results').setAttribute('aria-busy','false'); }
}
$('#browse-items').addEventListener('click',()=>{ $('#item-dialog').showModal(); loadCatalog(); });
$('#catalog-close').addEventListener('click',()=>$('#item-dialog').close());
$('#item-dialog').addEventListener('close',()=>{++catalogRequest;clearTimeout(catalogTimer);});
$('#catalog-search').addEventListener('input',()=>{++catalogRequest;clearTimeout(catalogTimer);catalogTimer=setTimeout(()=>loadCatalog(),220);});
$('#catalog-module').addEventListener('change',()=>loadCatalog());
$('#catalog-refresh').addEventListener('click',()=>loadCatalog());
$('#catalog-prev').addEventListener('click',()=>loadCatalog(catalogPage-1));
$('#catalog-next').addEventListener('click',()=>loadCatalog(catalogPage+1));
controls();
try {
  const config = await json('/api/session'); token=config.token;
  for (const item of config.items) { const option=document.createElement('option'); option.value=item; $('#items').append(option); }
  for (const [perk,name] of Object.entries(config.skills)) {
    const row=document.createElement('div'); row.className='skill'; row.dataset.perk=perk;
    const displayName=t(name);
    const title=document.createElement('span'); title.className='skill-name'; title.textContent=displayName;
    const code=document.createElement('small'); code.textContent=perk; title.append(code);
    const level=document.createElement('span'); level.className='level'; level.textContent='—'; row.append(title,level);
    for (const [mode,text] of [['plus','+1'],['max','Max']]) { const button=document.createElement('button'); button.textContent=text; button.setAttribute('aria-label',`${displayName}: ${text}`); button.addEventListener('click',()=>send('skill',{perk,mode},`${displayName} ${text}`)); row.append(button); }
    $('#skills').append(row);
    const option=document.createElement('option'); option.value=perk; option.textContent=displayName; $('#xp-perk').append(option);
  }
  document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>send(button.dataset.action,{},button.querySelectorAll('span')[1].firstChild.textContent)));
  form('#item-form','item',d=>({...d,quantity:Number(d.quantity)}),'Adicionar item');
  form('#god-form','god',d=>({enabled:true,seconds:Number(d.seconds)}),'Ativar modo deus');
  $('#god-off').addEventListener('click',()=>send('god',{enabled:false,seconds:1},'Desativar modo deus'));
  form('#stat-form','stat',d=>({...d,value:Number(d.value)}),'Alterar necessidade');
  form('#trait-form','trait',d=>({...d,enabled:d.enabled==='true'}),'Alterar traço');
  form('#xp-form','xp',d=>({...d,amount:Number(d.amount)}),'Adicionar XP');
  form('#teleport-form','teleport',d=>Object.fromEntries(Object.entries(d).map(([k,v])=>[k,Number(v)])),'Teleporte');
  $('#stat').addEventListener('change',()=>{ const temp=$('#stat').value==='temperature'; const pain=$('#stat').value==='pain'; const input=$('#stat-value'); input.min=temp?30:0; input.max=temp?42:pain?100:1; input.value=temp?37:0; });
  $('#skill-search').addEventListener('input',event=>{const term=event.target.value.toLocaleLowerCase('pt-BR');document.querySelectorAll('.skill').forEach(row=>{row.hidden=!row.textContent.toLocaleLowerCase('pt-BR').includes(term);});});
  $('#clear-log').addEventListener('click',()=>$('#log').replaceChildren());
  await status(); setInterval(status,1000);
} catch(error) { notify(`${t('Não foi possível iniciar o painel:')} ${error.message}. ${t('Recarregue a página.')}`,true); }
