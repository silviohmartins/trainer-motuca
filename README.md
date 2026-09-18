# Motuca · PZ Web Trainer

Dashboard local (Português/English), backend Node.js e mod Lua sem interface. Alvo: **Project Zomboid 42.20.x, Single Player**. As chamadas da API foram conferidas nos arquivos da instalação 42.20.4; a validação automatizada não substitui o teste em uma partida real.

## Iniciar

Requer Node.js 22 ou superior. Sem dependências de runtime.

```powershell
node scripts/install-mod.js   # opcional: instala o mod na pasta do jogo
node scripts/start.js         # ou: npm start
```

1. No jogo, ative **Motuca Web Bridge [B42]** nos mods do save e carregue a partida.
2. Abra **http://localhost:9876**. O indicador só conecta com um estado recente de um jogador solo vivo.
3. Envie um comando. O registro informa sucesso apenas após a confirmação do Lua.

No Windows, `Iniciar Trainer.bat` e `Instalar Mod Local.bat` fazem o mesmo sem usar o terminal. O trainer continua atendendo durante a pausa, inclusive ao alternar para o navegador.

Variáveis de ambiente: `PZ_USER_DIR` (diretório Zomboid personalizado, ex.: jogo iniciado com `-cachedir`), `PZ_LUA_DIR` (override do diretório Lua) e `PORT`. O servidor fica vinculado somente a `127.0.0.1`.

O instalador copia `mod/PZWebBridge` para `%USERPROFILE%/Zomboid/mods/PZWebBridge` e cria a caixa de mensagens em `%USERPROFILE%/Zomboid/Lua/PZWebBridge`. Ele recusa sobrescrever instalação existente: para atualizar, substitua os arquivos com o jogo fechado; para remover, desative o mod e apague só essa pasta.

## Controles

- Cura completa, remoção de infecção zumbi, fome/sede e descanso.
- **Explorar catálogo de itens**: popup com nomes do jogo, IDs, busca sem distinção de acentos, filtro por módulo e páginas de 48 itens. Inclui mods ativos e exclui itens ocultos/obsoletos. Após atualizar o mod, reinicie o jogo e aguarde a exportação inicial (100 registros a cada 150 ms).
- Itens por ID, com sugestões e lotes de 1–25. A existência é verificada no jogo.
- Perícias de combate/sobrevivência/artesanato: `+1`, `Max` (10) e adição de XP. Níveis sincronizados com o XP; XP bruto segue multiplicadores do jogo.
- Fome, sede e fadiga 0–1; dor 0–100; temperatura 30–42 °C. As necessidades voltam a evoluir normalmente depois.
- Traços por chave B42 (`BRAVE`, `DEXTEROUS`, `ORGANIZED`…). Altera a coleção e os bônus de XP, sem recalcular receitas, roupas ou níveis da criação do personagem, e sem resolver traços incompatíveis.
- Modo deus temporário, 1–600 s de relógio. Guarda prazo e estado anterior no personagem e restaura no próximo tick após expirar, inclusive durante a pausa e após recarregar o save.
- Teleporte somente a quadrados carregados, livres e com piso, fora de veículos.

Menu principal, jogo fechado ou heartbeat vencido exibem “Aguardando jogo”. O mod rejeita multiplayer, personagem ausente e personagem morto. A cura não ressuscita.

Os textos do painel ficam em `web/i18n.js`; para um novo idioma, adicione-o a `languages` e crie o catálogo em `catalogs`, sem tocar na lógica de comandos.

## API

`GET /api/session` (token local, perícias, sugestões), `GET /api/status` (conexão e estado) `GET /api/traits/catalog` (id e nome de cada traço do jogo e de mods, exportados pelo mod em `traits.json`) e `GET /api/items/catalog?q=&module=&page=1` (catálogo da partida ativa; o mod exporta `catalog.txt` e publica `catalog-meta.json` ao concluir, com cache por sessão no servidor).

POSTs exigem `Content-Type: application/json` e `X-Trainer-Token` obtido na sessão. Origem e Host são validados; sem CORS permissivo. O token protege contra requisições de outros sites, não contra processos locais com acesso aos arquivos.

| Endpoint POST | Corpo |
|---|---|
| `/api/player/heal` | `{}` |
| `/api/player/infection` | `{}` |
| `/api/player/needs` | `{}` |
| `/api/player/rest` | `{}` |
| `/api/items/add` | `{"item":"Base.Axe","quantity":1}` |
| `/api/player/stat` | `{"stat":"temperature","value":37}` |
| `/api/skills/change` | `{"perk":"Axe","mode":"plus"}` ou `"max"` |
| `/api/skills/xp` | `{"perk":"Axe","amount":100}` |
| `/api/traits/change` | `{"trait":"NeedsMoreSleep","enabled":true}` |
| `/api/player/god` | `{"enabled":true,"seconds":60}` |
| `/api/player/teleport` | `{"x":10600,"y":9800,"z":0}` |

Erros: 400 entrada inválida; 403 origem/token; 409 comando em andamento; 422 rejeição pelo jogo; 503 sem partida ativa; 504 confirmação não recebida. Mutação parcialmente aplicada antes de uma exceção não é revertida.

## Transporte

O Lua do PZ usa Kahlua e a instalação 42.20.4 não expõe `java.net.ServerSocket` nem LuaSocket, então **não há socket TCP dentro do mod**.

O navegador usa JSON/REST em `localhost:9876`. O backend grava uma mensagem JSON por substituição atômica em `Zomboid/Lua/PZWebBridge/command.json`. O mod lê esse arquivo a cada 150 ms via `Events.OnTickEvenPaused`, executa no máximo um comando e grava `response.json`; publica `state.json` a cada ~500 ms e o painel consulta a API a cada segundo. Sem espera de rede ou busy-wait no Lua, mas **a leitura/escrita de arquivos é síncrona** — use disco local, pois não há garantia de zero stuttering em discos lentos. I/O totalmente assíncrono ou TCP no mod exigiria uma extensão Java, fora desta versão.

O protocolo aceita só objetos JSON planos (strings ASCII sem escapes, números finitos, booleanos) e não interpreta código recebido. Cada comando tem ID, identificação da partida e prazo de validade. Há um único envio em andamento, sem fila persistente nem reenvio. IDs repetidos não reexecutam na mesma sessão; mensagens de outra partida ou expiradas não alteram o personagem. Resposta perdida deixa o resultado **incerto**, não garante falha.

## Estrutura

```text
mod/PZWebBridge/42/          # mod.info + media/lua/client/PZWebBridge.lua (pasta versionada B42)
backend/                     # HTTP, validação e caixa de mensagens
web/                         # HTML/CSS/JS, sem CDN ou build
scripts/                     # start.js, install-mod.js, build-release.ps1
tests/
```

## Validação e diagnóstico

`npm ci && npm test` roda os testes de backend, catálogo e Lua (Fengari é dependência só de desenvolvimento). Sem npm: `node --test tests/backend.test.js`.

Validação manual em um save de teste: adicionar item, curar, remover infecção, alterar necessidades, subir perícia, adicionar/remover traço, expirar o modo deus (também após salvar/sair e recarregar) e teleportar perto. Pausar ou alternar para o navegador deve manter a conexão; voltar ao menu principal deve interrompê-la sem repetir comandos na partida seguinte.

Se não conectar, confira a ativação do mod no save, `PZ_LUA_DIR`, se a partida está carregada e `%USERPROFILE%/Zomboid/console.txt` (prefixo `[PZWebBridge]`). Só uma instância do backend pode usar a mesma caixa de mensagens — mudar a porta não cria caixa separada.

## Distribuir

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-release.ps1` gera ZIPs separados do aplicativo Windows e do mod para Workshop, com imagem de apresentação e hashes SHA-256, a partir de uma lista explícita de arquivos, recusando sobrescrever compilação existente. Passos de revisão e publicação em `release/PUBLICAR.md`; gerar os pacotes não publica nada.

Referência: [API LuaManager e acesso a arquivos](https://projectzomboid.com/modding/zombie/Lua/LuaManager.GlobalObject.html). Para B42.20, o Lua distribuído com o jogo é a referência de `CharacterStat`, `CharacterTrait`, `CharacterTraitDefinition`, `teleportTo` e sincronização de XP.
