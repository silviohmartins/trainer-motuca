# Motuca Trainer [B42]

Trainer com painel dentro do jogo para **Project Zomboid 42.20.x, Single Player**. Só Lua: sem Node.js, servidor local, navegador ou ponte de arquivos. As chamadas de API foram conferidas contra os arquivos da instalação 42.20.4; a validação automatizada não substitui o teste em uma partida real.

## Instalar

**Workshop:** assine o item, ative **Motuca Trainer [B42]** nos mods do save, carregue a partida e pressione **F6**.

**Local, para desenvolvimento:** copie `mod/MotucaTrainer` para `%USERPROFILE%/Zomboid/mods/MotucaTrainer` e ative no save.

A tecla é registrada em **Opções → Teclas → [Motuca Trainer]** e pode ser trocada lá. A janela é arrastável e alterna com a mesma tecla; o painel responde com o jogo pausado.

## Controles

- **Sobrevivente**: cura completa, remoção de infecção zumbi e febre, saciar fome e sede, descanso. Modo deus temporário de 1–600 s de relógio, que guarda prazo e estado anterior no personagem e restaura no primeiro tick após expirar — inclusive durante a pausa e após recarregar o save. Ajuste direto de fome, sede e fadiga (0–1), dor (0–100) e temperatura (30–42 °C); as necessidades voltam a evoluir normalmente depois.
- **Mochila**: catálogo com os nomes e IDs da instalação, incluindo mods ativos, sem itens ocultos ou obsoletos. Busca por nome ou ID, lotes de 1 a 25, existência verificada antes de adicionar.
- **Perícias**: `+1`, máximo (10) e adição de XP na perícia selecionada. Níveis sincronizados com o XP; XP bruto segue os multiplicadores do jogo.
- **Personagem**: traços do jogo e de mods, lidos das definições carregadas e marcados quando o personagem já os tem. Altera a coleção e os bônus de XP; não recalcula receitas, roupas nem níveis da criação do personagem, e não resolve traços incompatíveis. Teleporte somente para quadrados carregados, livres e com piso, fora de veículos — o botão **Posição atual** preenche as coordenadas.

Sem personagem solo vivo, o painel não abre e a faixa de status informa o motivo. O mod recusa multiplayer, servidor, personagem ausente e personagem morto. A cura não ressuscita.

## Estrutura

```text
mod/MotucaTrainer/42/
  mod.info
  media/lua/client/MotucaTrainer/MotucaCommands.lua    # mutações do jogo e catálogos
  media/lua/client/MotucaTrainer/MotucaTrainerUI.lua   # janela, abas e keybind
  media/lua/shared/Translate/{PTBR,EN}/IG_UI.json      # textos
scripts/build-release.ps1                              # pacote Workshop
tests/lua.test.js                                      # MotucaCommands sob Fengari
```

`MotucaCommands.run` é a única porta de entrada: valida o contexto (solo, vivo), executa em `pcall` e devolve `ok, mensagem`. A UI nunca toca no personagem direto. As faixas válidas de cada necessidade ficam em `MotucaCommands.stats` e a UI lê de lá, então limite e rótulo não se duplicam.

## Textos

Um arquivo por idioma em `media/lua/shared/Translate/<LANG>/IG_UI.json`, no formato JSON plano do B42. Para um novo idioma, copie `EN/IG_UI.json` para a pasta do idioma e traduza os valores; nenhuma mudança de Lua é necessária.

## Validação

```powershell
npm ci
npm test
```

Os testes carregam `MotucaCommands.lua` real sob [Fengari](https://fengari.io) com os objetos do jogo simulados, e cobrem: validação de ID e quantidade de item, recusa fora de single player e com personagem morto, limites de necessidade, perícias e XP, resolução de traço nos dois formatos de id (`NeedsMoreSleep` e `NEEDS_MORE_SLEEP`), expiração do modo deus com o jogo pausado, teleporte para quadrado carregado e filtragem do catálogo. Fengari é dependência só de desenvolvimento; o mod publicado não usa Node.

Validação manual em um save de teste: abrir com F6, adicionar item pelo catálogo, curar, remover infecção, alterar necessidades, subir perícia, adicionar e remover traço, expirar o modo deus (também após salvar, sair e recarregar) e teleportar perto. Pausar o jogo deve manter o painel operando; voltar ao menu principal e carregar outra partida deve recriar a janela sem reaproveitar o personagem anterior.

Erros de Lua aparecem em `%USERPROFILE%/Zomboid/console.txt`.

## Distribuir

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-release.ps1
```

Gera em `dist/<versão>` a pasta Workshop, o ZIP, a imagem de apresentação 512×512 e o hash SHA-256, recusando sobrescrever uma compilação existente. Passos de revisão e publicação em `release/PUBLICAR.md`; gerar os pacotes não publica nada.

## Histórico

Até a `0.1.0-beta.1` o trainer era um painel web com backend Node.js e uma ponte por arquivos JSON, porque o Kahlua do B42 não expõe socket TCP ao Lua do mod. Com a UI dentro do jogo, o transporte deixou de existir: backend, frontend, instalador, inicializadores e o parser JSON em Lua foram removidos, e `MotucaCommands` herdou intacta a camada que altera o personagem. A interface usa apenas `ISUI` do jogo — sem dependência de framework de UI de terceiros, que exigiria uma segunda assinatura do usuário.

Referência: [API LuaManager e acesso a arquivos](https://projectzomboid.com/modding/zombie/Lua/LuaManager.GlobalObject.html). Para B42.20, o Lua distribuído com o jogo é a referência de `CharacterStat`, `CharacterTrait`, `CharacterTraitDefinition`, `teleportTo`, `ISCollapsableWindow` e sincronização de XP.
