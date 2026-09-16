import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ApiError } from './protocol.js';

export class Catalog {
  constructor(bridge) { this.bridge=bridge; this.session=null; this.items=[]; }
  async query(params) {
    const {connected,state}=await this.bridge.status();
    if (!connected) throw new ApiError(503,'Carregue uma partida para consultar os itens disponíveis.');
    if (this.session !== state.session) {
      const meta=await this.bridge.read('catalog-meta.json');
      if (meta?.session !== state.session) throw new ApiError(503,'Catálogo ainda não disponível. Aguarde alguns segundos; se acabou de atualizar o mod, reinicie o jogo.');
      if (meta.error) throw new ApiError(503,meta.error);
      try {
        const path=join(this.bridge.directory,'catalog.txt');
        if ((await stat(path)).size > 16*1024*1024) throw new Error('Catalog too large');
        const rows=(await readFile(path,'utf8')).split('\n').filter(Boolean).map(line=>JSON.parse(line));
        if (rows.length!==meta.count || rows.some(row=>typeof row.id!=='string'||typeof row.name!=='string'||typeof row.module!=='string')) throw new Error('Invalid catalog');
        // Verify the export was not replaced by another save during the read.
        const current=await this.bridge.status();
        if (!current.connected || current.state.session!==state.session) throw new Error('Session changed');
        this.items=rows.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')||a.id.localeCompare(b.id));
        this.session=state.session;
      } catch { throw new ApiError(503,'O catálogo está sendo atualizado. Tente novamente em instantes.'); }
    }
    const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const term=normalize((params.get('q')||'').slice(0,100));
    const module=params.get('module')||'';
    const page=Math.max(1,Math.min(10000,Number.parseInt(params.get('page'),10)||1));
    const matches=this.items.filter(item=>(!module||item.module===module)&&normalize(`${item.name} ${item.id}`).includes(term));
    const pages=Math.max(1,Math.ceil(matches.length/48));
    const actual=Math.min(page,pages);
    return {items:matches.slice((actual-1)*48,actual*48),total:matches.length,page:actual,pages,modules:[...new Set(this.items.map(item=>item.module))].sort()};
  }
}
