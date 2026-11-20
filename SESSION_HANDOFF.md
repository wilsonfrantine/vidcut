# 📋 Session Handoff — VidCut

**Data da Sessão:** 2026-11-19  
**Status do Repositório:** `main` sincronizado com `origin/main` (último commit: `f5a84dc`).

---

## 🤖 Nota para o próximo LLM (Leitura Recomendada para Contexto)

Para recuperar rapidamente o contexto completo deste projeto, leia nesta ordem:
1. [README.md](file:///home/wilson/github/vidcut/README.md): Visão geral do produto e lista de recursos atualizados (incluindo o NLE multipistas).
2. [ROADMAP.md](file:///home/wilson/github/vidcut/ROADMAP.md): Status detalhado de cada fase e lista do que já foi entregue vs. pendências imediatas.
3. [test/server.test.js](file:///home/wilson/github/vidcut/test/server.test.js): Suíte de testes automatizados com 11 cenários cobrindo segurança, NLE, exportação sem áudio (`-an`), isolamento de MP3 e stream copy (`-c copy`).
4. [server.js](file:///home/wilson/github/vidcut/server.js): Backend Node.js que orquestra os comandos FFmpeg e a integração com yt-dlp.

---

## 📌 O que foi realizado nesta sessão

1. **Correção Crítica no Modo de Corte Simples e Exportações Específicas**:
   - Corrigido o bug onde cortes simples devolviam apenas áudio; garantido mapeamento `-map 0:v:0` e fallback de aspect ratio `original`.
   - Implementado suporte correto a **vídeo mutado**: se o áudio estiver desligado/mutado, a saída conterá estritamente vídeo sem faixa de áudio (`-an`).
   - Implementado suporte estrito a **Somente Áudio (MP3)**: saída de áudio puro via `libmp3lame` com `-vn`.
   - Adicionados testes automatizados cobrindo cada um desses cenários (todos passando com `npm test`).
2. **Atualização da Documentação**:
   - `README.md` e `ROADMAP.md` atualizados refletindo as capacidades de NLE multipistas e status de entrega.
   - Commits enviados respeitando a política de privacidade de email do GitHub (`65643259+wilsonfrantine@users.noreply.github.com`).
3. **Criação de Hábitos e Skills Globais**:
   - Criada a skill `session-closing` e a skill `session-initiation` no diretório global `~/.gemini/skills/`.
   - Adicionada regra permanente em `~/.gemini/GEMINI.md` para orientar todos os futuros agentes a oferecer o caminho de leitura no início e perguntar sobre a documentação de encerramento.

---

## 🎯 Próximos Passos Prioritários e Issues Abertos

1. **[Issue Prioritário] Otimização da Detecção de Corte Rápido / Stream Copy (`-c copy`)**:
   - **Problema**: A exportação continua acionando o pipeline de reencodamento completo (`-filter_complex` com x264/AAC) em situações onde a opção selecionada é "Original (Sem conversão)" e o usuário apenas realizou cortes simples (um clipe único ou trilhas alinhadas sem sobreposição, sem múltiplos clipes ativos na mesma trilha, e sem efeitos de fade in/out no vídeo ou áudio).
   - **Ação necessária**: Refinar no front-end (`script.js` em `processVideo()` e `shouldUseNle`) e no backend (`server.js` em `shouldUseNle` / `isPureCopy`) a condição que despacha para o corte clássico rápido (`-c copy`), garantindo que se houver apenas 1 clipe efetivo na timeline e nenhum fade ativo, o corte rápido seja preservado imediatamente sem invocar reencodamento.
2. **Progresso Real da Renderização e Download (SSE / WebSockets)**:
   - Capturar o progresso do FFmpeg (`-progress`) e yt-dlp e exibir barra percentual ao usuário.
3. **Manipulação Livre na Timeline (Drag & Drop)**:
   - Permitir mover clipes livremente na régua temporal, incluindo gaps e deslocamentos.
4. **Transições Automáticas**:
   - Implementar `xfade` e `acrossfade` para transições suaves entre clipes sobrepostos.
