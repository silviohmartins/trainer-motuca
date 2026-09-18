# Publicação da beta 0.2.0-beta.1

Os arquivos em `dist` são candidatos locais; nada foi enviado à Steam ou ao GitHub.

1. Execute `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-release.ps1` na raiz do projeto. A saída fica em `dist/0.2.0-beta.1`. O script recusa sobrescrever uma compilação existente.
2. **Antes de publicar, teste em uma partida real.** Copie `mod/MotucaTrainer` para `%USERPROFILE%/Zomboid/mods/`, ative no save e percorra a lista de validação manual do `README.md`. Nenhum teste automatizado cobre o desenho da janela.
3. Copie a pasta `MotucaTrainer` do pacote para `%USERPROFILE%/Zomboid/Workshop/`. Dentro dela estão `Contents/mods/MotucaTrainer`, `preview.png` e `workshop.txt`.
4. Use a opção de envio à Workshop no menu principal do Project Zomboid e selecione essa pasta. Confira título, descrição e imagem no jogo antes de enviar. O pacote começa com visibilidade **privada** para revisão; escolha a visibilidade desejada no fluxo de publicação. A aceitação dos termos da Steam deve ser feita pelo titular da conta.
5. Opcionalmente, crie uma release GitHub marcada como **pré-lançamento**, versão `v0.2.0-beta.1`, anexando o ZIP e `SHA256SUMS.txt`.
6. Depois de obter o link da Workshop, acrescente-o à release GitHub e publique para o grupo beta.

Se a publicação anterior `Motuca Web Bridge [B42]` já estiver no ar, ela descreve um mod que exige aplicativo externo e não se aplica mais. Decida se vai atualizá-la no lugar (mesmo item, id `PZWebBridge` trocado por `MotucaTrainer` — quebra saves que listam o id antigo) ou publicar um item novo e marcar o antigo como obsoleto. Publicar item novo é o caminho sem surpresa para quem já assinou.

## Escopo do pacote

- Somente o mod Lua e a apresentação. Não contém executáveis, backend, Node.js nem dependências.
- Não inclui saves, logs, backups, `node_modules`, dependências de testes ou assets do jogo.
- A imagem de apresentação é tipográfica, criada pelo projeto, sem imagens de terceiros.
