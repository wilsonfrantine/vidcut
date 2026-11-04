// deps-banner.js - Aviso contextual de dependências externas ausentes ou desatualizadas

(function () {
    const PLATFORM_NAMES = { linux: 'Linux', macos: 'macOS', windows: 'Windows' };
    const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

    let latestReport = null;

    function buildHintsBlock(dep, platform) {
        const platforms = Object.keys(PLATFORM_NAMES).sort((a, b) => (b === platform) - (a === platform));
        const name = dep.id === 'ytdlp' ? 'yt-dlp' : 'FFmpeg';
        return `<div class="deps-block"><strong>Como resolver (${name}):</strong>${platforms.map(p =>
            `<details ${p === platform ? 'open' : ''}><summary>${PLATFORM_NAMES[p]}${p === platform ? ' (seu sistema)' : ''}</summary><pre>${esc((dep.hints[p] || []).join('\n'))}</pre></details>`
        ).join('')}</div>`;
    }

    // Gerencia o alerta contextual de yt-dlp dentro do painel de Link da Web
    function renderYtdlpContextualWarning(ytdlpDep, platform) {
        const oldCtx = document.getElementById('ytdlp-contextual-warning');
        if (oldCtx) oldCtx.remove();
        if (!ytdlpDep || ytdlpDep.status === 'ok') return;

        const ytPanel = document.querySelector('.youtube-panel');
        if (!ytPanel) return;

        const isMissing = ytdlpDep.status === 'missing';
        const warnBox = document.createElement('div');
        warnBox.id = 'ytdlp-contextual-warning';
        warnBox.className = `deps-contextual-box ${isMissing ? 'error' : 'warning'}`;
        warnBox.innerHTML = `
            <div class="deps-contextual-header">
                <strong>${isMissing ? '⛔ Download por link indisponível' : '⚠ Atenção com yt-dlp'}</strong>
            </div>
            <p class="deps-contextual-msg">${esc(ytdlpDep.message)}</p>
            ${buildHintsBlock(ytdlpDep, platform)}
        `;
        ytPanel.prepend(warnBox);

        // Desabilita inputs se estiver ausente
        const ytInput = document.getElementById('youtubeUrlInput');
        const ytBtn = document.getElementById('loadYoutubeVideo');
        const searchModeBtn = document.querySelector('.mode-selector-btn[data-mode="search"]');
        const editorSearchBtn = document.getElementById('editorSearchBtn');
        if (searchModeBtn) {
            searchModeBtn.disabled = isMissing;
            searchModeBtn.title = isMissing ? 'Indisponível: yt-dlp não instalado' : '';
        }
        if (editorSearchBtn) {
            editorSearchBtn.disabled = isMissing;
            editorSearchBtn.title = isMissing ? 'Busca indisponível: yt-dlp não instalado' : 'Buscar vídeo na web (S)';
        }
        if (ytInput) ytInput.disabled = isMissing;
        if (ytBtn) ytBtn.disabled = isMissing;
    }

    function renderGlobalFfmpegBanner(ffmpegProblems, platform) {
        const old = document.getElementById('deps-banner');
        if (old) old.remove();
        if (!ffmpegProblems.length) return;

        const seen = new Set();
        const blocks = ffmpegProblems.filter(dep => {
            const key = JSON.stringify(dep.hints);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).map(dep => buildHintsBlock(dep, platform)).join('');

        const banner = document.createElement('div');
        banner.id = 'deps-banner';
        banner.setAttribute('role', 'alert');
        banner.innerHTML = `
            <div class="deps-header"><strong>⚠ Dependência essencial com problema</strong>
                <span><button type="button" id="deps-recheck">Verificar novamente</button><button type="button" id="deps-close" aria-label="Fechar">×</button></span></div>
            <ul>${ffmpegProblems.map(dep => `<li>${esc(dep.message)}</li>`).join('')}</ul>${blocks}`;
        document.querySelector('main').prepend(banner);
        banner.querySelector('#deps-close').addEventListener('click', () => banner.remove());
        banner.querySelector('#deps-recheck').addEventListener('click', check);
    }

    function render(report) {
        latestReport = report;
        const ffmpegProblems = report.dependencies.filter(dep => (dep.id === 'ffmpeg' || dep.id === 'ffprobe') && dep.status !== 'ok');
        const ytdlpDep = report.dependencies.find(dep => dep.id === 'ytdlp');

        // Banner global apenas para FFmpeg/FFprobe (que afetam tudo)
        renderGlobalFfmpegBanner(ffmpegProblems, report.platform);

        // Alerta contextual apenas dentro do painel do YouTube/Link da Web
        renderYtdlpContextualWarning(ytdlpDep, report.platform);
    }

    function check() {
        fetch('/api/dependencies').then(r => r.json()).then(render).catch(() => {});
    }

    document.addEventListener('DOMContentLoaded', check);
})();
