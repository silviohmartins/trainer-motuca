import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Bridge } from './bridge.js';
import { Catalog } from './catalog.js';
import { ApiError, validate, skills, items } from './protocol.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const luaDir = process.env.PZ_LUA_DIR || join(process.env.PZ_USER_DIR || join(homedir(), 'Zomboid'), 'Lua');
export const routes = { '/api/player/heal':'heal', '/api/player/infection':'infection', '/api/player/needs':'needs', '/api/player/rest':'rest', '/api/player/stat':'stat', '/api/items/add':'item', '/api/skills/change':'skill', '/api/skills/xp':'xp', '/api/traits/change':'trait', '/api/player/god':'god', '/api/player/teleport':'teleport' };
export function createServer(bridge = new Bridge(join(luaDir, 'PZWebBridge'))) {
  const catalog = new Catalog(bridge);
  const token = randomBytes(32).toString('hex');
  return http.createServer(async (req, res) => {
    const json = (status, body) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(body)); };
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const port = res.socket.localPort;
      const hosts = [`localhost:${port}`, `127.0.0.1:${port}`];
      if (!hosts.includes(req.headers.host)) throw new ApiError(403, 'Host não permitido.');
      if (req.headers.origin && !hosts.map(h => `http://${h}`).includes(req.headers.origin)) throw new ApiError(403, 'Origem não permitida.');
      if (req.headers['sec-fetch-site'] === 'cross-site') throw new ApiError(403, 'Requisição externa bloqueada.');
      const path = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET') {
        if (path === '/api/session') return json(200, { token, skills, items });
        if (path === '/api/status') return json(200, await bridge.status());
        if (path === '/api/items/catalog') return json(200, await catalog.query(new URL(req.url,'http://localhost').searchParams));
        const file = { '/':'index.html', '/app.js':'app.js', '/i18n.js':'i18n.js', '/style.css':'style.css' }[path];
        if (!file) throw new ApiError(404, 'Não encontrado.');
        const data = await readFile(join(root, 'web', file));
        res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
        return res.end(data);
      }
      if (req.method !== 'POST' || !Object.hasOwn(routes, path)) throw new ApiError(404, 'Rota não encontrada.');
      const supplied = Buffer.from(req.headers['x-trainer-token'] || '');
      if (supplied.length !== token.length || !timingSafeEqual(supplied, Buffer.from(token))) throw new ApiError(403, 'Token inválido. Recarregue o painel.');
      if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new ApiError(415, 'Envie application/json.');
      let body = '';
      for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 4096) throw new ApiError(413, 'Payload muito grande.'); }
      let input; try { input = JSON.parse(body); } catch { throw new ApiError(400, 'JSON inválido.'); }
      return json(200, await bridge.send(validate(routes[path], input)));
    } catch (error) {
      if (!error.status) console.error('[Motuca] Falha na requisição:', error);
      json(error.status || 500, { error: error.status ? error.message : 'Falha interna no servidor. Consulte o terminal do backend.' });
    }
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 9876);
  const server = createServer();
  server.requestTimeout = 8000;
  server.on('error', error => { console.error(`Não foi possível iniciar: ${error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Motuca Trainer · http://localhost:${port}\nPonte: ${luaDir}/PZWebBridge`));
}
