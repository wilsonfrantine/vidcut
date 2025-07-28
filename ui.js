// ui.js - Versão Refatorada

// Lógica de Tema (executa imediatamente)
(function() {
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'light';

    document.body.dataset.theme = savedTheme;
    themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.dataset.theme;
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.body.dataset.theme = newTheme;
        themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        localStorage.setItem('theme', newTheme);
    });
})();

// Lógica de Navegação e UI (executa após o DOM carregar)
document.addEventListener('DOMContentLoaded', () => {
    const processButton = document.getElementById('processButton');
    const navToStep3 = document.querySelector('a[href="#step-3-result"]');
    const localFileArea = document.getElementById('local-file-area');
    const youtubeLinkArea = document.getElementById('youtube-link-area');
    const loadYoutubeVideoBtn = document.getElementById('loadYoutubeVideo');
    const youtubeUrlInput = document.getElementById('youtubeUrlInput');
    const videoContainer = document.getElementById('video-container');
    const controls = document.getElementById('controls');
    const modeSelectorButtons = document.querySelectorAll('.mode-selector-btn');
    const changeSourceLink = document.querySelector('a[href="#step-1-upload"]');


     modeSelectorButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove a classe ativa de todos os botões
            modeSelectorButtons.forEach(btn => btn.classList.remove('active'));
            // Adiciona a classe ativa ao botão clicado
            button.classList.add('active');

            const newMode = button.dataset.mode;
            ClipCraftApp.state.currentMode = newMode; // Atualiza o estado global

            if (newMode === 'local') {
                localFileArea.style.display = 'block';
                youtubeLinkArea.style.display = 'none';
            } else {
                localFileArea.style.display = 'none';
                youtubeLinkArea.style.display = 'block';
            }
        });
    });

    if(changeSourceLink) {
        changeSourceLink.addEventListener('click', () => {
            document.body.classList.remove('video-loaded');
        });
    }

    // Ação do botão "Carregar Vídeo" do YouTube
    loadYoutubeVideoBtn.addEventListener('click', () => {
        const url = youtubeUrlInput.value;
        if (url && ClipCraftApp.downloadFromYouTube) {
            ClipCraftApp.downloadFromYouTube(url);
        } else {
            alert('Por favor, insira uma URL válida do YouTube.');
        }
    });

    // Conecta o botão de navegação ao botão de processamento real
    if (navToStep3 && processButton) {
        navToStep3.addEventListener('click', (e) => {
            e.preventDefault(); 
            document.getElementById('step-3-result').scrollIntoView();
            if (!ClipCraftApp.state.isProcessing) {
                processButton.click();
            }
        });
    }

    loadYoutubeVideoBtn.addEventListener('click', () => {
        const url = youtubeUrlInput.value;
        const uploadStatus = document.getElementById('uploadStatus');

        if (url && ClipCraftApp.downloadFromYouTube) {
            // Prepara a UI para o estado de carregamento ANTES de chamar a função
            uploadStatus.innerHTML = `<span>Downloading... this may take a while. Feel free to grab a coffee ☕</span><span class="loading-dots"></span>`;
            uploadStatus.className = 'status-text loading'; // Adiciona a classe para a animação
            
            ClipCraftApp.downloadFromYouTube(url);
        } else {
            alert('Por favor, insira uma URL válida do YouTube.');
        }
    });


    // Escuta o evento customizado disparado pelo script.js
    document.addEventListener('videoUploaded', () => {
        document.body.classList.add('video-loaded');
        document.getElementById('step-2-editor').scrollIntoView();
    });

    
});