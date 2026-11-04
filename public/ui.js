// Theme control
(function () {
    const themeToggle = document.getElementById('theme-toggle');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme') || (systemPrefersDark ? 'dark' : 'light');

    function applyTheme(theme) {
        document.body.dataset.theme = theme;
        themeToggle.textContent = theme === 'dark' ? '☀' : '☾';
        themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
    }

    applyTheme(savedTheme);

    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem('theme')) {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }
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

    window.VidCutUI = {
        setView,
        resetTabs() {
            viewTabs.forEach(tab => {
                if (tab.dataset.viewTarget !== 'step-1-upload' && tab.dataset.viewTarget !== 'credits-view') {
                    tab.disabled = true;
                }
            });
            setView('step-1-upload');
        }
    };

    function setView(viewId) {
        const destination = document.getElementById(viewId);
        if (!destination || (['step-2-editor', 'step-3-result'].includes(viewId) && !VidCutApp.state.videoPath)) return;

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

            VidCutApp.state.currentMode = button.dataset.mode;
            const mode = button.dataset.mode;
            localFileArea.style.display = mode === 'local' ? 'block' : 'none';
            youtubeLinkArea.style.display = mode === 'youtube' ? 'block' : 'none';
            const searchArea = document.getElementById('search-video-area');
            if (searchArea) searchArea.style.display = mode === 'search' ? 'block' : 'none';
            if (mode === 'youtube') youtubeUrlInput.focus();
            if (mode === 'search') {
                const sInput = document.getElementById('searchInput');
                if (sInput) sInput.focus();
            }
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
        VidCutApp.setLoadingState(false, 'Link colado. Escolha o formato e clique em “Baixar para editar”.', 'var(--success-color)');
        return true;
    }

    document.addEventListener('paste', event => {
        if (VidCutApp.state.currentMode !== 'youtube') return;
        const text = event.clipboardData?.getData('text/plain') || '';
        if (applyPastedLink(text)) event.preventDefault();
    });

    document.addEventListener('keydown', async event => {
        if (VidCutApp.state.currentMode !== 'youtube' || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'v') return;
        if (event.target === youtubeUrlInput) return;
        try {
            const text = await navigator.clipboard.readText();
            if (applyPastedLink(text)) event.preventDefault();
        } catch {
            youtubeUrlInput.focus();
            VidCutApp.setLoadingState(false, 'Cole o link da mídia neste campo usando Ctrl+V.', 'var(--text-secondary)');
        }
    });

    pasteYoutubeButton.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!applyPastedLink(text)) {
                VidCutApp.setLoadingState(false, 'A área de transferência não contém uma URL HTTP ou HTTPS válida.', 'red');
            }
        } catch {
            youtubeUrlInput.focus();
            VidCutApp.setLoadingState(false, 'Permita o acesso à área de transferência ou cole com Ctrl+V.', 'red');
        }
    });

    loadYoutubeButton.addEventListener('click', () => {
        const url = youtubeUrlInput.value.trim();
        if (!isMediaUrl(url)) {
            VidCutApp.setLoadingState(false, 'Cole uma URL HTTP ou HTTPS válida para continuar.', 'red');
            youtubeUrlInput.focus();
            return;
        }
        VidCutApp.downloadFromYouTube(url);
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
        VidCutApp.handleFileUpload({ target: videoFile });
    });

    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', event => {
            const viewId = link.getAttribute('href').slice(1);
            if (!document.getElementById(viewId)?.classList.contains('app-view')) return;
            event.preventDefault();
            if (viewId === 'step-3-result' && window.VidCutApp) {
                const intervalErr = window.VidCutApp.getIntervalError();
                if (intervalErr) {
                    window.VidCutApp.showTimeError(intervalErr);
                    return;
                }
            }
            setView(viewId);
            if (link.classList.contains('process-link')) processButton.click();
        });
    });

    // Painel de atalhos: recolhido por padrão; a preferência fica salva
    const shortcutsToggle = document.getElementById('shortcutsToggle');
    const shortcutsPanel = document.getElementById('shortcutsPanel');
    function setShortcutsVisible(visible) {
        shortcutsPanel.hidden = !visible;
        shortcutsToggle.setAttribute('aria-expanded', String(visible));
        shortcutsToggle.classList.toggle('active', visible);
        localStorage.setItem('shortcutsVisible', String(visible));
    }
    setShortcutsVisible(localStorage.getItem('shortcutsVisible') === 'true');
    shortcutsToggle.addEventListener('click', () => setShortcutsVisible(shortcutsPanel.hidden));

    document.addEventListener('videoUploaded', () => {
        viewTabs.forEach(tab => {
            if (tab.dataset.viewTarget !== 'step-1-upload') tab.disabled = false;
        });
        setView('step-2-editor');
    });


    // Funções de busca de vídeos via yt-dlp
    async function executeSearch(query, listEl, statusEl, onSelect) {
        if (!query.trim()) return;
        statusEl.style.display = 'block';
        statusEl.innerHTML = `<span>Pesquisando vídeos…</span><span class="loading-dots"></span>`;
        statusEl.className = 'search-status loading';
        listEl.innerHTML = '';

        try {
            const resp = await fetch(`/buscar-videos?q=${encodeURIComponent(query.trim())}&limit=8`);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.message || 'Falha ao buscar vídeos.');

            if (!data.results || data.results.length === 0) {
                statusEl.innerHTML = 'Nenhum vídeo encontrado para este termo.';
                statusEl.className = 'search-status';
                return;
            }

            statusEl.style.display = 'none';
            listEl.innerHTML = '';

            data.results.forEach(video => {
                const card = document.createElement('div');
                card.className = 'search-result-card';
                const durationText = VidCutApp.formatTime ? VidCutApp.formatTime(video.duration) : `${video.duration}s`;

                card.innerHTML = `
                    <div class="search-thumb-wrap">
                        <img src="${video.thumbnail}" alt="" loading="lazy">
                        <span class="search-duration-badge">${durationText}</span>
                    </div>
                    <div class="search-card-info">
                        <h4 class="search-card-title" title="${video.title}">${video.title}</h4>
                        <div class="search-card-meta">${video.channel}</div>
                        <button class="nav-button primary search-import-btn" type="button">Importar para editar →</button>
                    </div>
                `;

                card.querySelector('.search-import-btn').addEventListener('click', () => {
                    onSelect(video);
                });

                listEl.appendChild(card);
            });

        } catch (err) {
            statusEl.innerHTML = `⚠ ${err.message}`;
            statusEl.className = 'search-status error';
        }
    }

    // Busca no Passo 1 (Origem)
    const searchForm = document.getElementById('searchVideoForm');
    const searchInput = document.getElementById('searchInput');
    const searchList = document.getElementById('searchResultsList');
    const searchStatus = document.getElementById('searchResultsStatus');

    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            modalSearchInput.value = searchInput.value;
            executeSearch(searchInput.value, searchList, searchStatus, (video) => {
                VidCutApp.downloadFromYouTube(video.url);
            });
        });
    }

    // Modal de Busca no Passo 2 (Editor)
    const searchModal = document.getElementById('searchModal');
    const editorSearchBtn = document.getElementById('editorSearchBtn');
    const closeSearchModal = document.getElementById('closeSearchModal');
    const modalSearchForm = document.getElementById('modalSearchForm');
    const modalSearchInput = document.getElementById('modalSearchInput');
    const modalSearchResults = document.getElementById('modalSearchResults');
    const modalSearchStatus = document.getElementById('modalSearchStatus');

    function openModal() {
        if (!searchModal) return;
        searchModal.style.display = 'flex';
        const p1Input = document.getElementById('searchInput');
        if (p1Input && p1Input.value.trim() && !modalSearchInput.value.trim()) {
            modalSearchInput.value = p1Input.value.trim();
        }
        modalSearchInput.focus();
        if (modalSearchInput.value.trim() && modalSearchResults.children.length === 0) {
            executeSearch(modalSearchInput.value, modalSearchResults, modalSearchStatus, (video) => {
                closeModal();
                VidCutApp.downloadFromYouTube(video.url);
            });
        }
    }

    function closeModal() {
        if (!searchModal) return;
        searchModal.style.display = 'none';
    }

    if (editorSearchBtn) editorSearchBtn.addEventListener('click', openModal);
    if (closeSearchModal) closeSearchModal.addEventListener('click', closeModal);
    if (searchModal) {
        searchModal.addEventListener('click', (e) => {
            if (e.target === searchModal) closeModal();
        });
    }

    if (modalSearchForm) {
        modalSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            executeSearch(modalSearchInput.value, modalSearchResults, modalSearchStatus, (video) => {
                closeModal();
                VidCutApp.downloadFromYouTube(video.url);
            });
        });
    }

    window.VidCutUI.openSearchModal = openModal;
    window.VidCutUI.closeSearchModal = closeModal;

});
