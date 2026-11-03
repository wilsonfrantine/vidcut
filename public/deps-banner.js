// deps-banner.js - Aviso de dependências externas ausentes ou desatualizadas

(function () {
    const PLATFORM_NAMES = { linux: 'Linux', macos: 'macOS', windows: 'Windows' };
    const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

    // Sem yt-dlp a aba "Link da web" não funciona: desabilita e volta para arquivo local.
    function applyLinkAvailability(report) {
        const ytdlp = report.dependencies.find(dep => dep.id === 'ytdlp');
        const button = document.querySelector('.mode-selector-btn[data-mode="youtube"]');
        if (!button || !ytdlp) return;
        const missing = ytdlp.status === 'missing';
        button.disabled = missing;
        button.title = missing ? 'Indisponível: yt-dlp não encontrado (veja o aviso no topo)' : '';
        if (missing && button.classList.contains('active')) {
            document.querySelector('.mode-selector-btn[data-mode="local"]').click();
        }
    }

    function render(report) {
        applyLinkAvailability(report);
        const old = document.getElementById('deps-banner');
        if (old) old.remove();
        const problems = report.dependencies.filter(dep => dep.status !== 'ok');
        if (problems.length === 0) return;

        // ffmpeg e ffprobe compartilham as mesmas instruções de instalação
        const seen = new Set();
        const blocks = problems.filter(dep => {
            const key = JSON.stringify(dep.hints);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).map(dep => {
            const platforms = Object.keys(PLATFORM_NAMES).sort((a, b) => (b === report.platform) - (a === report.platform));
            const name = dep.id === 'ytdlp' ? 'yt-dlp' : 'FFmpeg';
            return `<div class="deps-block"><strong>Como resolver (${name}):</strong>${platforms.map(p =>
                `<details ${p === report.platform ? 'open' : ''}><summary>${PLATFORM_NAMES[p]}${p === report.platform ? ' (seu sistema)' : ''}</summary><pre>${esc(dep.hints[p].join('\n'))}</pre></details>`
            ).join('')}</div>`;
        }).join('');

        const banner = document.createElement('div');
        banner.id = 'deps-banner';
        banner.setAttribute('role', 'alert');
        banner.innerHTML = `
            <div class="deps-header"><strong>⚠ Dependências com problema</strong>
                <span><button type="button" id="deps-recheck">Verificar novamente</button><button type="button" id="deps-close" aria-label="Fechar">×</button></span></div>
            <ul>${problems.map(dep => `<li>${esc(dep.message)}</li>`).join('')}</ul>${blocks}`;
        document.querySelector('main').prepend(banner);
        banner.querySelector('#deps-close').addEventListener('click', () => banner.remove());
        banner.querySelector('#deps-recheck').addEventListener('click', check);
    }

    function check() {
        fetch('/api/dependencies').then(r => r.json()).then(render).catch(() => {});
    }

    document.addEventListener('DOMContentLoaded', check);
})();
