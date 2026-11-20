# Roadmap — Frontend e UX (2026-11-03)

Base: revisão de `public/index.html`, `script.js`, `ui.js` e `server.js`. A parte visual (`style.css`) ainda precisa ser validada no navegador.

## Fase 1 — Bugs e inconsistências
- [x] 1. Cortes se sobrescrevem (`corte_<nome>` fixo) → nome único por corte
- [x] 2. Recursos externos (Google Fonts, noUiSlider via CDN, ícone Flaticon) → servir localmente / remover
- [x] 3. Textos provisórios de apoio (Pix com `alert`, PayPal `href="#"`) → configuração; ocultar se vazio
- [x] 4. Nome unificado como VidCut e README em português
- [x] 7. (extra) Ctrl+C apagava as pastas `videos/` e `output/` junto com o `.gitkeep` → limpeza agora preserva a estrutura
- [x] 5. Aba "Link da web" habilitada mesmo sem yt-dlp → desabilitar quando ausente
- [x] 6. Mensagens de erro genéricas → mostrar causa (stderr resumido, binário não encontrado)

## Fase 2 — Funcionalidade (maior valor primeiro)
- [ ] Progresso real (FFmpeg `-progress`, yt-dlp `--newline`, via SSE) + botão Cancelar
- [x] Ferramentas de edição: marcar início/fim (`I`/`O`), loop da seleção, atalhos (espaço, setas, J/K/L), tempo em `mm:ss.cc`
- [x] Opções de exportação: corte rápido (`-c copy`), nome do arquivo customizado
- [x] Resultado: player do corte, tamanho/duração, "fazer outro corte" e "novo vídeo" + fallback no Passo 1 com retenção dos pontos de corte
- [ ] Persistência de sessão (listar `videos/` e retomar)
- [ ] Limpeza automática de `videos/` e `output/` + botão "Descartar vídeo"
- [x] Vários trechos por vídeo (lote ou concatenação) — implementado na Timeline Multipistas NLE (split/cut/trilhas/concatenação)

## Fase 3 — UI/UX
- [x] Desacoplamento e fluxo limpo: Editor 100% focado na linha do tempo; Passo 3 transformado em Central de Exportação com escolha ativa de formato e nome
- [x] Tema padrão via `prefers-color-scheme` (respeita preferência do sistema operacional)
- [ ] Formulário de link: avisar yt-dlp indisponível; opção só áudio
- [ ] Linha do tempo: mais quadros e zoom
- [ ] Acessibilidade (aria nos handles, teclado, abas desabilitadas) e responsividade mobile
- [x] Banner de dependências contextual (FFmpeg/FFprobe global; yt-dlp contextualizado apenas na aba de Link da web)

## Outros
- [x] Testes mínimos automatizados com node:test nativo (segurança de arquivos em /public, rotas essenciais, integridade de dependências)
- [x] Guia de instalação e dependências documentado e verificado no README

- [x] Busca de vídeos integrada via yt-dlp (terceira opção no Passo 1 + atalho/modal Spotlight 'S' no Editor)

---

## 🚀 VidCut Studio (Editor Multipistas / NLE) — Status de Implementação

Transformação do VidCut de cortador minimalista em um **editor de vídeo não-linear (NLE) completo no navegador**, combinando múltiplas mídias com renderização profissional via FFmpeg.

### 1. Linha do Tempo Multipistas (Multi-track Timeline)
- [x] **Suporte a Múltiplos Vídeos & Áudios**: Adicionar múltiplos vídeos/áudios via arquivo local, URL ou busca integrada diretamente no Editor (Passo 2).
- [x] **Trilhas Empilhadas**: Trilhas de vídeo (V1...) e áudio (A1...) com controles individuais de mute/silenciamento e visibilidade.
- [ ] **Arraste e Reposicionamento Livre (Drag & Drop)**: Reordenar livremente e reposicionar clipes com offset temporal na timeline (atualmente ordenados sequencialmente na trilha).

### 2. Ferramentas de Edição e Manipulação de Clipes
- [x] **Divisão (Split / Razor Tool - Tecla `C`)**: Dividir clipe no playhead em dois clipes independentes com recálculo automático de durações e limites.
- [x] **Corte & Ajuste de Bordas (Trim / Handles)**: Redimensionar início e fim de cada clipe individual na timeline.
- [x] **Exclusão (Delete - Tecla `Del` / `Backspace`)**: Remover clipe selecionado da trilha.
- [x] **Seleção de Proporção de Tela (Canvas Aspect Ratio)**: Alternar entre Original, 16:9 (Horizontal/YouTube), 9:16 (Vertical/Shorts/TikTok), 1:1 (Quadrado) e 4:5.

### 3. Transições e Efeitos
- [x] **Fade In / Fade Out**: Suporte a fade in e fade out de vídeo e áudio por clipe (com duração configurável de 0.5s padrão).
- [ ] **Crossfade / Efeitos entre Clipes Consecutivos**: `xfade` e `acrossfade` automáticos entre clipes sobrepostos.

### 4. Pipeline de Renderização e Exportação (FFmpeg)
- [x] **Corte Rápido Sem Conversão (`-c copy`)**:
  - Preserva contêiner original (ex: `.webm` para WebM, `.mp4` para MP4).
  - Suporta exportação sem áudio (`-an`) mantendo stream copy do vídeo.
- [x] **Renderização com Reencodamento (Multi-track / Efeitos / Aspect Ratio)**:
  - Geração dinâmica de `-filter_complex` com `trim`, `atrim`, `setpts`, `asetpts`, `fade`, `afade`, `concat`, `scale` e `crop`.
  - Força encapsulamento `.mp4` (H.264 + AAC) para máxima compatibilidade web/player.
- [x] **Exportação de Áudio Isolado**: Modo "Somente Áudio" (`MP3` via `libmp3lame`, com `-vn`).
- [x] **Exportação de Vídeo Mudo**: Suporta mutar individualmente as trilhas ou o áudio global, gerando vídeo limpo sem faixa de áudio (`-an`).
- [ ] **Progresso Real da Renderização (SSE / WebSockets)**: Acompanhamento em porcentagem durante o processamento do FFmpeg e download do yt-dlp.

---

## 🔐 Autenticação e Download do YouTube (yt-dlp)
- [x] **Extração com JS Runtime (Node.js)**: Configurado `--js-runtimes node` para solucionar desafios de assinatura do YouTube.
- [x] **Fallback de Clientes YouTube**: Cascata de clientes (`web`, `mweb`, `android`, `ios`, `tv_embedded`).
- [x] **Autenticação por Cookies**: Detecção automática de `cookies.txt` e script auxiliar local (`npm run get-cookies`).
- [x] **Busca Integrada**: Busca com filtros de ordenação (relevância, data, visualizações) e modal Spotlight (atalho `S`).
