// Theme control
(function () {
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'light';

    function applyTheme(theme) {
        document.body.dataset.theme = theme;
        themeToggle.textContent = theme === 'dark' ? '☀' : '☾';
        themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
    }

    applyTheme(savedTheme);
    themeToggle.addEventListener('click', () => {
        const nextTheme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
        applyTheme(nextTheme);
        localStorage.setItem('theme', nextTheme);
    });
})();

document.addEventListener('DOMContentLoaded', () => {
    const processButton = document.getElementById('processButton');
    const videoFile = document.getElementById('videoFile');
    const localFileArea = document.getElementById('local-file-area');
    const youtubeLinkArea = document.getElementById('youtube-link-area');
    const youtubeUrlInput = document.getElementById('youtubeUrlInput');
    const loadYoutubeButton = document.getElementById('loadYoutubeVideo');
    const pasteYoutubeButton = document.getElementById('pasteYoutubeLink');
    const modeButtons = document.querySelectorAll('.mode-selector-btn');
    const viewTabs = document.querySelectorAll('.tab-button[data-view-target]');
    const views = document.querySelectorAll('.app-view');
    const fileDropzone = document.getElementById('file-upload-area');

    function setView(viewId) {
        const destination = document.getElementById(viewId);
        if (!destination || (['step-2-editor', 'step-3-result'].includes(viewId) && !ClipCraftApp.state.videoPath)) return;

        views.forEach(view => view.classList.toggle('active', view.id === viewId));
        viewTabs.forEach(tab => {
            const selected = tab.dataset.viewTarget === viewId;
            tab.classList.toggle('active', selected);
            if (selected) tab.setAttribute('aria-current', 'page');
            else tab.removeAttribute('aria-current');
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    viewTabs.forEach(tab => tab.addEventListener('click', () => setView(tab.dataset.viewTarget)));

    modeButtons.forEach(button => {
        button.addEventListener('click', () => {
            modeButtons.forEach(option => {
                const selected = option === button;
                option.classList.toggle('active', selected);
                option.setAttribute('aria-pressed', String(selected));
            });

            ClipCraftApp.state.currentMode = button.dataset.mode;
            const isLocal = button.dataset.mode === 'local';
            localFileArea.style.display = isLocal ? 'block' : 'none';
            youtubeLinkArea.style.display = isLocal ? 'none' : 'block';
            if (!isLocal) youtubeUrlInput.focus();
        });
    });

    function isMediaUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }

    function applyPastedLink(value) {
        const link = value.trim();
        if (!isMediaUrl(link)) return false;
        youtubeUrlInput.value = link;
        ClipCraftApp.setLoadingState(false, 'Link colado. Escolha o formato e clique em “Baixar para editar”.', 'var(--success-color)');
        return true;
    }

    document.addEventListener('paste', event => {
        if (ClipCraftApp.state.currentMode !== 'youtube') return;
        const text = event.clipboardData?.getData('text/plain') || '';
        if (applyPastedLink(text)) event.preventDefault();
    });

    document.addEventListener('keydown', async event => {
        if (ClipCraftApp.state.currentMode !== 'youtube' || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'v') return;
        if (event.target === youtubeUrlInput) return;
        try {
            const text = await navigator.clipboard.readText();
            if (applyPastedLink(text)) event.preventDefault();
        } catch {
            youtubeUrlInput.focus();
            ClipCraftApp.setLoadingState(false, 'Cole o link da mídia neste campo usando Ctrl+V.', 'var(--text-secondary)');
        }
    });

    pasteYoutubeButton.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!applyPastedLink(text)) {
                ClipCraftApp.setLoadingState(false, 'A área de transferência não contém uma URL HTTP ou HTTPS válida.', 'red');
            }
        } catch {
            youtubeUrlInput.focus();
            ClipCraftApp.setLoadingState(false, 'Permita o acesso à área de transferência ou cole com Ctrl+V.', 'red');
        }
    });

    loadYoutubeButton.addEventListener('click', () => {
        const url = youtubeUrlInput.value.trim();
        if (!isMediaUrl(url)) {
            ClipCraftApp.setLoadingState(false, 'Cole uma URL HTTP ou HTTPS válida para continuar.', 'red');
            youtubeUrlInput.focus();
            return;
        }
        ClipCraftApp.downloadFromYouTube(url);
    });

    fileDropzone.addEventListener('dragover', event => {
        event.preventDefault();
        fileDropzone.classList.add('drag-active');
    });
    fileDropzone.addEventListener('dragleave', event => {
        if (!fileDropzone.contains(event.relatedTarget)) fileDropzone.classList.remove('drag-active');
    });
    fileDropzone.addEventListener('drop', event => {
        event.preventDefault();
        fileDropzone.classList.remove('drag-active');
        const file = event.dataTransfer.files[0];
        if (!file) return;
        const transfer = new DataTransfer();
        transfer.items.add(file);
        videoFile.files = transfer.files;
        ClipCraftApp.handleFileUpload({ target: videoFile });
    });

    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', event => {
            const viewId = link.getAttribute('href').slice(1);
            if (!document.getElementById(viewId)?.classList.contains('app-view')) return;
            event.preventDefault();
            setView(viewId);
            if (link.classList.contains('process-link')) processButton.click();
        });
    });

    document.addEventListener('videoUploaded', () => {
        viewTabs.forEach(tab => {
            if (tab.dataset.viewTarget !== 'step-1-upload') tab.disabled = false;
        });
        setView('step-2-editor');
    });

});
