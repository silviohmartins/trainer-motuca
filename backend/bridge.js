import { readFile, writeFile, rename, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { ApiError } from './protocol.js';

export class Bridge {
  constructor(directory, timeout = 3500) { this.directory = directory; this.timeout = timeout; this.busy = false; }
  async read(name) {
    try { const raw = await readFile(join(this.directory, name), 'utf8'); if (raw.length > 32768) return null; return JSON.parse(raw); }
    catch { return null; } // A Lua write may be in progress; the next poll retries.
  }
  async status() {
    const state = await this.read('state.json');
    const age = Date.now() - state?.at;
    const connected = !!(state?.protocol === 1 && typeof state.session === 'string' && age >= -1000 && age < 2500 && state.ready === true);
    return { connected, busy: this.busy, state: connected ? state : null };
  }
  async send(command) {
    if (this.busy) throw new ApiError(409, 'Outro comando está em andamento.');
    this.busy = true;
    const id = randomUUID();
    const temp = join(this.directory, `command-${id}.tmp`);
    try {
      const { connected, state } = await this.status();
      if (!connected) throw new ApiError(503, 'Aguardando jogo. Carregue uma partida solo com o mod ativo.');
      await mkdir(this.directory, { recursive: true });
      const message = { ...command, protocol:1, id, session:state.session, expires:Date.now() + this.timeout - 250 };
      await writeFile(temp, JSON.stringify(message), 'utf8');
      await rename(temp, join(this.directory, 'command.json'));
      const deadline = Date.now() + this.timeout;
      while (Date.now() < deadline) {
        const response = await this.read('response.json');
        if (response?.id === id && response.session === state.session) {
          if (!response.ok) throw new ApiError(422, response.error || 'O jogo rejeitou o comando.');
          return response;
        }
        await delay(60);
      }
      throw new ApiError(504, 'Sem confirmação do jogo. O resultado é incerto; confira antes de repetir.');
    } catch (error) {
      if (['EACCES', 'EPERM'].includes(error.code)) {
        throw new ApiError(503, 'Sem permissão para gravar comandos na pasta Zomboid/Lua/PZWebBridge. Reinicie o backend em um terminal local com acesso a essa pasta.');
      }
      throw error;
    } finally {
      await rm(temp, { force:true }).catch(() => {});
      // Only one in-flight writer. Expiry/session checks protect commands if removal fails.
      await rm(join(this.directory, 'command.json'), { force:true }).catch(() => {});
      this.busy = false;
    }
  }
}
