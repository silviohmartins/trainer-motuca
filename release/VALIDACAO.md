# Verificação da beta 0.2.0-beta.1

Realizado localmente:

- 7 testes automatizados passaram: `MotucaCommands.lua` real sob Fengari, com os objetos do jogo simulados, cobrindo validação de item, recusa fora de single player, limites de necessidade, perícias e XP, traços nos dois formatos de id, expiração do modo deus com o jogo pausado, teleporte e filtragem do catálogo.
- Assinaturas de `ISCollapsableWindow`, `ISTabPanel`, `ISScrollingListBox`, `ISTextEntryBox`, `ISComboBox`, `ISButton` e `ISLabel` conferidas nos arquivos Lua da instalação 42.20.4, não na memória nem em wiki.
- Formato de tradução conferido contra `media/lua/shared/Translate/PTBR/IG_UI.json` do jogo e contra mods B42 da Workshop: JSON plano, um arquivo por idioma.
- Registro de keybind conferido contra `ISSearchManager`, que insere em `keyBinding` dentro de `OnGameBoot`.
- Escolha da tecla F7 conferida contra `shared/keyBinding.lua`: F1 a F6 e F10/F11 já têm uso no jogo (F6 é "Fast Forward x3" e `ToggleAnimationText`), F8 é usada pelo editor de mapa e F12 é screenshot da Steam. Dos 214 mods instalados na máquina de desenvolvimento, 6 registram keybind e nenhum usa tecla de função.

Não verificado:

- **A janela nunca foi aberta em uma partida.** Layout, posições, recorte de texto, comportamento das abas, foco dos campos e a keybind F7 não foram testados no jogo. Este é o item bloqueante antes de publicar.
- Custo em quadros da lista de itens com todos os mods carregados. O limite de 300 linhas visíveis é uma precaução, não uma medição.
- Comportamento ao morrer com a janela aberta e ao recarregar outro save na mesma sessão.
- Empacotamento: `scripts/build-release.ps1` foi reescrito e não foi executado.
- Instalação por assinatura da Workshop.

Nenhum arquivo foi publicado externamente nesta preparação.
