# 📼 VidCut – Cortador de vídeo simples

**VidCut** é uma ferramenta local e minimalista para cortar trechos de vídeos (ou extrair o áudio em MP3).
O aplicativo roda localmente com um servidor Node.js e oferece uma interface web acessível pelo navegador. Tudo é processado na sua máquina.

---

## ✨ Recursos

- Corte por tempo de início e fim, com linha do tempo e prévia.
- Exportação em vídeo (MP4) ou somente áudio (MP3), com opção de silenciar ou remover o áudio.
- Envio de arquivo local ou download a partir de um link (via yt-dlp).
- Processamento local com FFmpeg, sem depender de serviços externos.

---

## 🧰 Requisitos

- [Node.js](https://nodejs.org/) 18+
- [FFmpeg](https://ffmpeg.org/) (inclui o `ffprobe`), versão 4 ou superior
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (necessário apenas para links da web), mantido atualizado

O VidCut **não instala** essas ferramentas automaticamente. Ao iniciar, o servidor as verifica, e a interface exibe um aviso com os comandos de instalação se algo estiver ausente ou desatualizado.

| Sistema | Instalação |
|---|---|
| Debian/Ubuntu | `sudo apt install ffmpeg` · `pipx install yt-dlp` |
| Fedora | `sudo dnf install ffmpeg` · `pipx install yt-dlp` |
| Arch | `sudo pacman -S ffmpeg yt-dlp` |
| macOS | `brew install ffmpeg yt-dlp` |
| Windows | O app executa as ferramentas **dentro do WSL**: `wsl sudo apt install ffmpeg` · `wsl pipx install yt-dlp` |

Atualize o yt-dlp com frequência (`pipx upgrade yt-dlp` / `brew upgrade yt-dlp`), pois mudanças nos sites costumam quebrar versões antigas.

Confira a instalação com `ffmpeg -version` e `yt-dlp --version`.

Se os executáveis estiverem fora do `PATH`, defina `FFMPEG_PATH`, `FFPROBE_PATH` e/ou `YTDLP_PATH`:

```bash
FFMPEG_PATH=/opt/ffmpeg/bin/ffmpeg npm start
```

---

## 🚀 Instalação e uso

```bash
# Clone este repositório
git clone https://github.com/your-username/vidcut.git
cd vidcut

# Instale as dependências
npm install

# Inicie o servidor
npm start
```

Depois abra no navegador:

```
http://localhost:3000
```

Use `npm run dev` para reiniciar o servidor automaticamente ao editar o código.

---

## 📂 Estrutura do projeto

```
vidcut/
├── public/             # Arquivos estáticos servidos ao navegador
│   ├── index.html      # Interface principal
│   ├── style.css       # Estilos
│   ├── script.js       # Lógica do front-end
│   ├── ui.js           # Funções auxiliares de interface
│   ├── deps-banner.js  # Aviso de dependências ausentes/desatualizadas
│   ├── support.js      # Opções de apoio (exibidas só se configuradas)
│   └── config.js       # Configuração opcional da interface
├── videos/             # Vídeos enviados/baixados (conteúdo ignorado pelo Git)
├── output/             # Cortes gerados (conteúdo ignorado pelo Git)
├── server.js           # Backend Node.js que executa o FFmpeg
├── deps.js             # Detecção de dependências (ffmpeg, ffprobe, yt-dlp)
└── package.json        # Dependências do projeto
```

As pastas `videos/` e `output/` são esvaziadas ao encerrar o servidor com Ctrl+C.

---

## ⚙️ Configuração opcional

Em `public/config.js` é possível informar um link do PayPal e/ou uma chave Pix. Se ficarem vazios, as opções de apoio não aparecem.

---

## ⚠️ Observações

- O vídeo de entrada precisa estar disponível localmente ou acessível por link.
- O FFmpeg deve estar instalado e acessível pelo terminal.

---

## 📄 Licença

Uso livre para fins pessoais. Contribuições são bem-vindas.
