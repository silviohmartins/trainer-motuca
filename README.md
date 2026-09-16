# Motuca · PZ Web Trainer

Dashboard local em português, backend Node.js e mod Lua sem interface. Alvo: **Project Zomboid 42.20.x, Single Player**. As chamadas da API foram conferidas nos arquivos da instalação 42.20.4. A validação automatizada não substitui o teste em uma partida real.

## Idioma

O painel oferece **Português** e **English** no seletor do cabeçalho. A escolha fica salva neste navegador. Os textos ficam centralizados em `web/i18n.js`: para incluir um idioma futuro, adicione-o a `languages` e crie seu catálogo no objeto `catalogs`, sem alterar a lógica de comandos do trainer.

## Iniciar

Requer Node.js 22 ou superior. O servidor não precisa de dependências externas.

```powershell
node scripts/install-mod.js
node backend/server.js
```

1. No jogo, ative **Motuca Web Bridge [B42]**, incluindo-o nos mods do save desejado. Carregue a partida. O trainer continua atendendo durante a pausa, inclusive ao alternar para o navegador.
2. Abra **http://localhost:9876**. O indicador fica conectado somente ao receber um estado recente de um jogador solo vivo.
3. Envie um comando. O registro informa sucesso apenas após a confirmação do Lua.

No Windows, `Iniciar Trainer.bat` verifica a gravação na pasta da ponte, inicia o servidor e abre o navegador. `Instalar Mod Local.bat` executa o instalador opcional. `npm start` usa esse novo inicializador; `npm run install:mod` instala o mod local. Os comandos `node` acima continuam disponíveis sem npm.

## Distribuir a beta

Execute `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-release.ps1` para gerar ZIPs separados do aplicativo Windows e do mod para Workshop, com imagem de apresentação e hashes SHA-256. O script usa uma lista explícita de arquivos e recusa sobrescrever uma compilação existente. Consulte `release/PUBLICAR.md` para os passos de revisão e publicação; gerar os pacotes não publica conteúdo externo.

O instalador copia `mod/PZWebBridge` para `%USERPROFILE%/Zomboid/mods/PZWebBridge` e cria a caixa de mensagens em `%USERPROFILE%/Zomboid/Lua/PZWebBridge`. Ele recusa sobrescrever uma instalação existente. Para atualizar, substitua manualmente os arquivos do mod com o jogo fechado. Para remover, desative o mod e remova somente sua pasta.

Para um diretório de usuário personalizado (por exemplo, jogo iniciado com `-cachedir`), configure `PZ_USER_DIR`. `PZ_LUA_DIR` é um override opcional do diretório Lua:

```powershell
$env:PZ_USER_DIR = 'D:/MeuZomboid'
$env:PZ_LUA_DIR = 'D:/MeuZomboid/Lua'
node scripts/install-mod.js
node backend/server.js
```

`PORT` muda a porta HTTP, que continua vinculada exclusivamente a `127.0.0.1`. Nenhum serviço é publicado na rede.

## Transporte: diferença em relação à proposta TCP

O Lua do PZ usa Kahlua com classes Java explicitamente expostas. A instalação 42.20.4 não expõe `java.net.ServerSocket`; também não fornece LuaSocket. `settimeout(0)` não é uma API de `java.net.ServerSocket` e, em Java, timeout zero significaria espera indefinida. Portanto, este projeto **não implementa um socket TCP dentro do mod**.

O navegador usa JSON/REST em `localhost:9876`. O backend grava uma mensagem JSON por substituição atômica em `Zomboid/Lua/PZWebBridge/command.json`. O mod consulta esse arquivo a cada 150 ms via `Events.OnTickEvenPaused`, executa no máximo um comando e grava `response.json`. Publica `state.json` aproximadamente a cada 500 ms; o painel consulta a API a cada segundo.

Não há espera de rede ou loop de espera no Lua. **A leitura/escrita de arquivos é síncrona** e não existe garantia de zero stuttering em discos lentos. Use disco local. Para cumprir um requisito estrito de I/O inteiramente assíncrono ou TCP no mod, é necessária uma extensão Java adicional com uma thread de I/O e uma fila exposta ao Lua; ela não faz parte desta versão mínima.

O protocolo aceita somente objetos JSON planos, com strings ASCII sem escapes, números finitos e booleanos. Não interpreta código recebido. Cada comando recebe ID, identificação da partida e prazo de validade. Há um único envio em andamento, sem fila persistente e sem reenvio automático. IDs repetidos não são executados novamente na mesma sessão; mensagens de outra partida ou expiradas não alteram o personagem. Se uma resposta for perdida, o resultado é **incerto**, não uma garantia de que a ação falhou.

## Controles

- Cura completa, remoção de infecção zumbi, fome/sede e descanso.
- Botão **Explorar catálogo de itens**: popup com nomes do jogo, IDs, busca sem distinção de acentos, filtro por módulo e páginas de 48 itens. Selecionar preenche o spawner; ajuste a quantidade e clique em Adicionar item. O catálogo inclui os mods ativos e exclui itens ocultos/obsoletos, como o painel nativo. Após atualizar o mod, reinicie o jogo e aguarde a exportação inicial (100 registros a cada 150 ms).
- Itens por ID, com sugestões e lotes de 1–25. A existência é verificada no jogo, permitindo itens de mods.
- Perícias de combate/sobrevivência/artesanato: `+1`, `Max` (10) e adição de XP. Os níveis são sincronizados com o XP; XP bruto segue as regras e multiplicadores do jogo.
- Fome, sede e fadiga entre 0–1; dor entre 0–100; temperatura entre 30–42 °C. As necessidades voltam a evoluir normalmente após a mudança.
- Traços por chave B42, como `BRAVE`, `DEXTEROUS`, `ORGANIZED`. Modifica a coleção e os bônus de XP dos traços, sem recalcular receitas, roupas ou níveis da criação do personagem; não faz resolução automática de traços incompatíveis.
- Modo deus temporário, 1–600 segundos de relógio. Guarda no personagem o prazo e o estado anterior, restaurando-o no próximo tick após expirar, inclusive ao recarregar o save. A restauração também ocorre durante a pausa, pelo evento `OnTickEvenPaused`. Desativar manualmente força o estado desligado.
- Teleporte somente a quadrados carregados, livres e com piso, fora de veículos. Não oferece viagem para regiões descarregadas.

Menu principal, jogo fechado ou heartbeat vencido exibem “Aguardando jogo”. O mod rejeita multiplayer, personagem ausente e personagem morto. A cura não ressuscita personagens.

## API

`GET /api/items/catalog?q=&module=&page=1` consulta o catálogo da partida ativa. O mod exporta `catalog.txt` e publica `catalog-meta.json` somente ao concluir; o servidor mantém cache por sessão.

`GET /api/session` retorna token local, perícias e sugestões. `GET /api/status` retorna conexão e estado. POSTs exigem `Content-Type: application/json` e `X-Trainer-Token` obtido na sessão. Origem e Host são validados; não há CORS permissivo. O token protege o navegador contra requisições de outros sites, não contra processos locais com acesso aos arquivos.

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
| `/api/traits/change` | `{"trait":"BRAVE","enabled":true}` |
| `/api/player/god` | `{"enabled":true,"seconds":60}` |
| `/api/player/teleport` | `{"x":10600,"y":9800,"z":0}` |

Erros: 400 entrada inválida; 403 origem/token; 409 comando em andamento; 422 rejeição pelo jogo; 503 sem partida ativa; 504 confirmação não recebida. Mutação parcialmente aplicada antes de uma exceção não é revertida.

## Estrutura B42

```text
mod/PZWebBridge/
  common/
  42/
    mod.info
    media/lua/client/PZWebBridge.lua
backend/                 # HTTP, validação e caixa de mensagens
web/                     # HTML/CSS/JS, sem CDN ou build
scripts/install-mod.js
tests/
```

O `mod.info` está na pasta versionada `42`, e não na raiz de um mod B41.

## Validação e diagnóstico

Execute `node --test tests/backend.test.js` para testar API e transporte. Os testes Lua usam Fengari apenas como dependência de desenvolvimento; após `npm ci`, execute `npm test`.

Validação manual no jogo: em um save de teste, adicionar um item, curar, remover infecção, alterar necessidades, aumentar uma perícia, adicionar/remover um traço, testar expiração do modo deus e teleporte próximo. Pausar ou alternar para o navegador deve manter a conexão e permitir comandos. Voltar ao menu principal deve interromper a conexão, sem repetir comandos na partida seguinte. Teste o modo deus também após salvar/sair e recarregar.

Se não conectar, confira a ativação do mod no save, o diretório `PZ_LUA_DIR`, se a partida está carregada e `%USERPROFILE%/Zomboid/console.txt` (prefixo `[PZWebBridge]`). Somente uma instância do backend deve usar a mesma caixa de mensagens. Uma mudança de porta não cria uma caixa separada.

Referência pública: [API LuaManager e acesso a arquivos](https://projectzomboid.com/modding/zombie/Lua/LuaManager.GlobalObject.html). Para B42.20, o código Lua distribuído com o jogo é a referência usada para `CharacterStat`, `CharacterTrait`, `teleportTo` e sincronização de XP.
