import { cp, mkdir, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const userDir=process.env.PZ_USER_DIR || join(homedir(),'Zomboid');
const destination=join(userDir,'mods','PZWebBridge');
let exists=false;
try { await access(destination); exists=true; }
catch(error) { if(error.code!=='ENOENT') throw error; }
if(exists) { console.error(`Destino já existe: ${destination}. Renomeie-o ou remova-o manualmente antes de reinstalar.`); process.exitCode=1; }
else {
  await mkdir(join(process.env.PZ_LUA_DIR || join(userDir,'Lua'),'PZWebBridge'),{recursive:true});
  await cp(join(root,'mod','PZWebBridge'),destination,{recursive:true,errorOnExist:true,force:false});
  console.log(`Mod instalado em ${destination}\nAtive Motuca Web Bridge e carregue uma partida solo.`);
}
