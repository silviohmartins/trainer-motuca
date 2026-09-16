import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createServer } from '../backend/server.js';

if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error('Instale Node.js 22 ou superior em https://nodejs.org/'); process.exitCode=1;
} else {
  try {
    const port=Number(process.env.PORT || 9876);
    if (!Number.isInteger(port) || port<1 || port>65535) throw new Error('PORT deve ser um inteiro de 1 a 65535.');
    const directory=join(process.env.PZ_LUA_DIR || join(process.env.PZ_USER_DIR || join(homedir(),'Zomboid'),'Lua'),'PZWebBridge');
    await mkdir(directory,{recursive:true});
    const probe=join(directory,`write-check-${randomUUID()}.tmp`);
    await writeFile(probe,'',{flag:'wx'}); await rm(probe);
    const server=createServer(); server.requestTimeout=8000;
    server.on('error',error=>{
      console.error(error.code==='EADDRINUSE' ? `A porta ${port} ja esta em uso. Se o trainer ja estiver aberto, acesse http://localhost:${port}. Caso contrario, feche o programa que usa a porta ou configure PORT.` : error.message);
      process.exitCode=1;
    });
    server.listen(port,'127.0.0.1',()=>{
      const url=`http://localhost:${port}`;
      console.log(`Motuca Trainer\n${url}\nPonte: ${directory}\nMantenha esta janela aberta. Para encerrar: Ctrl+C.\nAtive o mod e carregue uma partida solo.`);
      if(process.platform==='win32' && process.env.MOTUCA_NO_BROWSER!=='1') {
        execFile('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true},error=>{if(error) console.log(`Abra o navegador em ${url}`);});
      }
    });
  } catch(error) { console.error(`Nao foi possivel iniciar: ${error.message}\nVerifique o acesso a pasta Zomboid/Lua.`); process.exitCode=1; }
}
