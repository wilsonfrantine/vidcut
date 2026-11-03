// script.js - Final Refactored Version

const ClipCraftApp = {
    // App State
    state: {
        start: 0,
        end: 0,
        videoPath: null,
        videoDuration: 0,
        previewTimeout: null,
        currentMode: 'local',
        isProcessing: false,
        isDownloading: false,
        hasAudioTrack: false,
        includeAudio: true,
        audioMuted: false,
        outputMode: 'video',
        isTimelineScrubbing: false,
        audioTrackDetails: null,
    },

    // DOM Element References
    DOM: {},

    // Initialization
    init() {
        this.DOM = {
            videoFile: document.getElementById('videoFile'),
            uploadStatus: document.getElementById('uploadStatus'),
            videoContainer: document.getElementById('video-container'),
            videoPlayer: document.getElementById('videoPlayer'),
            controls: document.getElementById('controls'),
            timelineSlider: document.getElementById('timeline-slider'),
            startTimeInput: document.getElementById('startTimeInput'),
            endTimeInput: document.getElementById('endTimeInput'),
            outputCommand: document.getElementById('outputCommand'),
            commandArea: document.getElementById('command-area'),
            processButton: document.getElementById('processButton'),
            statusArea: document.getElementById('statusArea'),
            downloadArea: document.getElementById('downloadArea'),
            audioMuteToggle: document.getElementById('audioMuteToggle'),
            audioRemoveToggle: document.getElementById('audioRemoveToggle'),
            audioTrackRow: document.getElementById('audioTrackRow'),
            audioTrackInfo: document.getElementById('audioTrackInfo'),
            videoTrackInfo: document.getElementById('videoTrackInfo'),
            selectionDuration: document.getElementById('selectionDuration'),
            timelineTracks: document.getElementById('timelineTracks'),
            toggleTracks: document.getElementById('toggleTracks'),
            audioSelectionOverlay: document.getElementById('audioSelectionOverlay'),
            renderVideoMode: document.getElementById('renderVideoMode'),
            renderAudioMode: document.getElementById('renderAudioMode'),
            videoTrackPreviews: document.getElementById('videoTrackPreviews'),
            videoSelectionOverlay: document.getElementById('videoSelectionOverlay'),
            audioWaveform: document.getElementById('audioWaveform'),
            videoPlayhead: document.getElementById('videoPlayhead'),
            audioPlayhead: document.getElementById('audioPlayhead'),
        };

        this.addEventListeners();
    },

    // Event Listeners
    addEventListeners() {
        this.DOM.videoFile.addEventListener('change', (e) => this.handleFileUpload(e));
        this.DOM.videoPlayer.addEventListener('loadedmetadata', () => this.setupTimelineSlider());
        this.DOM.videoPlayer.addEventListener('timeupdate', () => this.updatePlayhead());
        this.DOM.videoPlayer.addEventListener('error', () => {
            this.setLoadingState(false, 'Não foi possível abrir a prévia. Tente outro formato de vídeo.', 'red');
        });
        this.DOM.startTimeInput.addEventListener('change', () => this.handleTimeInputChange('start'));
        this.DOM.endTimeInput.addEventListener('change', () => this.handleTimeInputChange('end'));
        this.DOM.processButton.addEventListener('click', () => this.processVideo());

        this.DOM.timelineSlider.addEventListener('mousedown', event => {
            if (event.button !== 0 || event.target.closest('.noUi-handle')) return;
            event.preventDefault();
            event.stopPropagation();
            this.state.isTimelineScrubbing = true;
            this.seekTimelineAt(event.clientX);
        }, true);
        this.DOM.timelineSlider.addEventListener('touchstart', event => {
            if (event.target.closest('.noUi-handle')) return;
            const touch = event.touches[0];
            if (!touch) return;
            event.preventDefault();
            event.stopPropagation();
            this.state.isTimelineScrubbing = true;
            this.seekTimelineAt(touch.clientX);
        }, { capture: true, passive: false });
        window.addEventListener('mousemove', event => {
            if (this.state.isTimelineScrubbing && event.buttons === 1) this.seekTimelineAt(event.clientX);
        });
        window.addEventListener('mouseup', () => { this.state.isTimelineScrubbing = false; });
        window.addEventListener('touchmove', event => {
            if (!this.state.isTimelineScrubbing || !event.touches[0]) return;
            event.preventDefault();
            this.seekTimelineAt(event.touches[0].clientX);
        }, { passive: false });
        window.addEventListener('touchend', () => { this.state.isTimelineScrubbing = false; });

        this.DOM.audioMuteToggle.addEventListener('click', () => {
            if (!this.state.hasAudioTrack || !this.state.includeAudio || this.state.outputMode === 'audio') return;
            this.state.audioMuted = !this.state.audioMuted;
            this.updateAudioTrackActions();
            this.updateExportDescription();
            this.generateCommand();
        });
        this.DOM.audioRemoveToggle.addEventListener('click', () => {
            if (!this.state.hasAudioTrack || this.state.outputMode === 'audio') return;
            this.state.includeAudio = !this.state.includeAudio;
            if (this.state.includeAudio) this.state.audioMuted = false;
            this.updateAudioTrackActions();
            this.updateExportDescription();
            this.generateCommand();
        });
        this.DOM.renderVideoMode.addEventListener('click', () => this.setOutputMode('video'));
        this.DOM.renderAudioMode.addEventListener('click', () => this.setOutputMode('audio'));
        this.DOM.toggleTracks.addEventListener('click', () => {
            const expanded = this.DOM.toggleTracks.getAttribute('aria-expanded') === 'true';
            this.DOM.toggleTracks.setAttribute('aria-expanded', String(!expanded));
            this.DOM.timelineTracks.hidden = expanded;
            this.DOM.toggleTracks.title = expanded ? 'Mostrar trilhas' : 'Ocultar trilhas';
            this.DOM.toggleTracks.setAttribute('aria-label', this.DOM.toggleTracks.title);
        });
    },

    // API Logic
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const hasVideoType = file.type.startsWith('video/');
        const hasVideoExtension = /\.(mkv|avi|mov|mp4|webm|m4v|mpeg|mpg)$/i.test(file.name);
        if (!hasVideoType && !hasVideoExtension) {
            this.setLoadingState(false, 'Selecione um arquivo de vídeo para continuar.', 'red');
            event.target.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('videoFile', file);

        this.setLoadingState(true, `Enviando ${file.name} (${this.formatFileSize(file.size)})...`);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Falha ao enviar o arquivo.');

            this.handleSuccessfulLoad(result);
        } catch (error) {
            this.setLoadingState(false, `Não foi possível enviar: ${error.message}`, 'red');
        }
    },

    async downloadFromYouTube(url) {
        if (this.state.isDownloading) return;
        this.state.isDownloading = true;
        this.setLoadingState(true, 'Baixando vídeo… isso pode levar alguns minutos.');

        try {
            const response = await fetch('/download-from-youtube', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youtubeUrl: url })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Falha ao baixar o vídeo deste link.');

            this.handleSuccessfulLoad(result);
        } catch (error) {
            this.setLoadingState(false, `Não foi possível baixar: ${error.message}`, 'red');
        } finally {
            this.state.isDownloading = false;
        }
    },

    async processVideo() {
        this.DOM.videoPlayer.pause();
        if (!this.state.videoPath || this.state.isProcessing) return;
        if (!Number.isFinite(this.state.start) || !Number.isFinite(this.state.end) ||
            this.state.start < 0 || this.state.end > this.state.videoDuration ||
            this.state.end <= this.state.start) {
            this.showProcessError('Escolha um intervalo válido: o início deve vir antes do fim e estar dentro do vídeo.');
            return;
        }
        if (this.state.outputMode === 'audio' && (!this.state.hasAudioTrack || !this.state.includeAudio)) {
            this.showProcessError('Selecione uma faixa de áudio disponível para exportar somente o áudio.');
            return;
        }

        this.state.isProcessing = true;
        this.DOM.processButton.disabled = true;
        this.DOM.statusArea.innerHTML = `<span>Renderizando seu corte…</span><span class="loading-dots"></span>`;
        this.DOM.statusArea.className = 'status-text loading';
        this.DOM.statusArea.style.color = '';
        this.DOM.downloadArea.style.display = 'none';

        try {
            const response = await fetch('/processar-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoPath: this.state.videoPath,
                    start: this.state.start,
                    end: this.state.end,
                    includeAudio: this.state.includeAudio,
                    muteAudio: this.state.audioMuted,
                    outputMode: this.state.outputMode
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Ocorreu um erro no servidor.');

            this.displayResults(result);

        } catch (error) {
            this.showProcessError(`Não foi possível criar o corte: ${error.message}`);
        } finally {
            this.state.isProcessing = false;
            this.DOM.processButton.disabled = false;
        }
    },

    // UI Update Functions
    handleSuccessfulLoad(result) {
        this.setLoadingState(false, 'Vídeo carregado. Preparando prévia…', 'var(--success-color)');
        this.state.videoPath = result.filename;
        this.state.hasAudioTrack = Boolean(result.mediaInfo?.hasAudio);
        this.state.includeAudio = this.state.hasAudioTrack;
        this.state.audioMuted = false;
        this.state.outputMode = 'video';
        this.state.audioTrackDetails = result.mediaInfo || {};
        this.DOM.audioTrackInfo.classList.toggle('unavailable', !this.state.hasAudioTrack);
        this.DOM.timelineTracks.hidden = false;
        this.DOM.toggleTracks.setAttribute('aria-expanded', 'true');
        this.DOM.toggleTracks.title = 'Ocultar trilhas';
        this.DOM.toggleTracks.setAttribute('aria-label', 'Ocultar trilhas');
        const { width, height } = result.mediaInfo || {};
        const videoCodec = result.mediaInfo?.videoCodec ? ` · ${result.mediaInfo.videoCodec.toUpperCase()}` : '';
        this.DOM.videoTrackInfo.innerText = width && height ? `${width} × ${height}${videoCodec}` : 'Faixa visual';
        this.DOM.videoTrackPreviews.replaceChildren();
        (result.mediaInfo?.videoPreviews || []).forEach((filename, index) => {
            if (!filename) return;
            const frame = document.createElement('img');
            frame.src = `/videos/${encodeURIComponent(filename)}`;
            frame.alt = '';
            frame.loading = index > 1 ? 'lazy' : 'eager';
            this.DOM.videoTrackPreviews.appendChild(frame);
        });
        this.DOM.audioWaveform.removeAttribute('src');
        this.DOM.audioWaveform.hidden = !result.mediaInfo?.audioWaveform;
        if (result.mediaInfo?.audioWaveform) {
            this.DOM.audioWaveform.src = `/videos/${encodeURIComponent(result.mediaInfo.audioWaveform)}`;
        }
        this.setOutputMode('video');
        this.updateAudioTrackActions();
        this.updateExportDescription();
        this.DOM.videoPlayer.removeAttribute('src');
        this.DOM.videoPlayer.src = `/videos/${this.state.videoPath}`;
        this.DOM.videoPlayer.load();
        this.DOM.videoContainer.style.display = 'block';
        this.DOM.controls.style.display = 'block';
        document.dispatchEvent(new CustomEvent('videoUploaded'));
    },

    setupTimelineSlider() {
        this.state.videoDuration = this.DOM.videoPlayer.duration;
        if (!Number.isFinite(this.state.videoDuration) || this.state.videoDuration <= 0) {
            this.setLoadingState(false, 'Este vídeo não pôde ser aberto ou não tem duração válida.', 'red');
            return;
        }
        this.state.start = 0;
        this.state.end = this.state.videoDuration;

        if (this.DOM.timelineSlider.noUiSlider) {
            this.DOM.timelineSlider.noUiSlider.destroy();
        }

        noUiSlider.create(this.DOM.timelineSlider, {
            start: [this.state.start, this.state.end],
            connect: true,
            range: { 'min': 0, 'max': this.state.videoDuration },
            step: 0.01
        });

        this.DOM.timelineSlider.noUiSlider.on('update', (values) => {
            this.state.start = parseFloat(values[0]);
            this.state.end = parseFloat(values[1]);
            this.updateTimelineUI();
        });

        this.DOM.timelineSlider.noUiSlider.on('slide', (values, handle) => {
            this.DOM.videoPlayer.currentTime = parseFloat(values[handle]);
            this.DOM.startTimeInput.value = parseFloat(values[0]).toFixed(2);
            this.DOM.endTimeInput.value = parseFloat(values[1]).toFixed(2);
        });

        this.updateTimelineUI();
        this.updatePlayhead();
    },

    handleTimeInputChange(type) {
        if (!this.state.videoPath) return;
        const input = type === 'start' ? this.DOM.startTimeInput : this.DOM.endTimeInput;
        const candidate = Number(input.value);
        if (input.value.trim() === '' || !Number.isFinite(candidate)) {
            this.showTimeError('Digite um tempo válido em segundos.');
            this.updateTimelineUI();
            return;
        }
        const value = Math.min(this.state.videoDuration, Math.max(0, candidate));
        if (type === 'start') this.state.start = Math.min(value, this.state.end - 0.01);
        else this.state.end = Math.max(value, this.state.start + 0.01);
        this.state.start = Math.max(0, this.state.start);
        this.state.end = Math.min(this.state.videoDuration, this.state.end);
        this.DOM.timelineSlider.noUiSlider.set([this.state.start, this.state.end]);
        this.updateTimelineUI();
        this.DOM.statusArea.innerText = '';
    },

    updateTimelineUI() {
        this.DOM.startTimeInput.value = this.state.start.toFixed(2);
        this.DOM.endTimeInput.value = this.state.end.toFixed(2);
        this.DOM.selectionDuration.innerText = `${(this.state.end - this.state.start).toFixed(2).replace('.', ',')} s selecionados`;
        const duration = this.state.videoDuration || 1;
        this.DOM.videoSelectionOverlay.style.left = `${(this.state.start / duration) * 100}%`;
        this.DOM.videoSelectionOverlay.style.width = `${((this.state.end - this.state.start) / duration) * 100}%`;
        this.DOM.audioSelectionOverlay.style.left = `${(this.state.start / duration) * 100}%`;
        this.DOM.audioSelectionOverlay.style.width = `${((this.state.end - this.state.start) / duration) * 100}%`;
        this.generateCommand();
    },

    seekTimelineAt(clientX) {
        if (!this.state.videoPath || !Number.isFinite(this.state.videoDuration) || this.state.videoDuration <= 0) return;
        const bounds = this.DOM.timelineSlider.getBoundingClientRect();
        if (bounds.width <= 0) return;
        const ratio = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
        this.DOM.videoPlayer.currentTime = ratio * this.state.videoDuration;
        this.updatePlayhead();
    },

    updatePlayhead() {
        const duration = this.state.videoDuration;
        if (!Number.isFinite(duration) || duration <= 0) return;
        const ratio = Math.max(0, Math.min(1, this.DOM.videoPlayer.currentTime / duration));
        const position = `${ratio * 100}%`;
        this.DOM.videoPlayhead.style.left = position;
        this.DOM.audioPlayhead.style.left = position;
    },

    generateCommand() {
        if (!this.state.videoPath) {
            this.DOM.commandArea.style.display = 'none';
            return;
        }
        this.DOM.commandArea.style.display = 'block';
        if (this.state.start >= this.state.end) {
            this.DOM.outputCommand.innerText = 'O início precisa ser anterior ao fim.';
            return;
        }
        const duration = this.state.end - this.state.start;
        const outputFilename = `corte_${this.state.videoPath.replace(/\.[^.]+$/, '')}.mp4`;
        const cmd = this.state.outputMode === 'audio'
            ? `ffmpeg -y -ss ${this.state.start.toFixed(3)} -i "${this.state.videoPath}" -t ${duration.toFixed(3)} -vn -map 0:a:0 -c:a libmp3lame -q:a 2 "${outputFilename.replace(/\.mp4$/, '.mp3')}"`
            : `ffmpeg -y -ss ${this.state.start.toFixed(3)} -i "${this.state.videoPath}" -t ${duration.toFixed(3)} -map 0:v:0 ${this.state.includeAudio ? `-map 0:a? ${this.state.audioMuted ? '-af volume=0 ' : ''}-c:a aac -b:a 192k` : '-an'} -c:v libx264 -preset veryfast -crf 18 -movflags +faststart "${outputFilename}"`;
        this.DOM.outputCommand.innerText = cmd;
    },

    displayResults(result) {
        this.DOM.statusArea.innerText = 'Corte concluído!';
        this.DOM.statusArea.style.color = 'var(--success-color)';
        this.DOM.downloadArea.innerHTML = '';
        const downloadLink = document.createElement('a');
        downloadLink.href = `/output/${result.outputFile}`;
        downloadLink.innerText = this.state.outputMode === 'audio' ? 'Baixar MP3' : 'Baixar vídeo';
        downloadLink.setAttribute('download', result.outputFile);
        downloadLink.className = 'download-button';
        this.DOM.downloadArea.appendChild(downloadLink);
        this.DOM.downloadArea.style.display = 'block';
    },

    setOutputMode(mode) {
        if (mode === 'audio' && !this.state.hasAudioTrack) return;
        this.state.outputMode = mode;
        if (mode === 'audio') {
            this.state.includeAudio = true;
            this.state.audioMuted = false;
        }
        const audioSelected = mode === 'audio';
        this.DOM.renderAudioMode.classList.toggle('active', audioSelected);
        this.DOM.renderAudioMode.setAttribute('aria-pressed', String(audioSelected));
        this.DOM.renderAudioMode.disabled = !this.state.hasAudioTrack;
        this.DOM.renderVideoMode.classList.toggle('active', !audioSelected);
        this.DOM.renderVideoMode.setAttribute('aria-pressed', String(!audioSelected));
        this.updateAudioTrackActions();
        this.updateExportDescription();
        this.generateCommand();
    },

    updateExportDescription() {
        const description = this.state.outputMode === 'audio'
            ? 'Somente a faixa de áudio selecionada será exportada como MP3.'
            : !this.state.hasAudioTrack
                ? 'Este vídeo não possui áudio; o arquivo será exportado sem som.'
                : !this.state.includeAudio
                    ? 'A faixa de áudio foi removida. O vídeo será exportado sem som.'
                    : this.state.audioMuted
                        ? 'A faixa de áudio será mantida, mas ficará silenciada.'
                        : 'O vídeo e a faixa de áudio serão exportados juntos.';
        document.getElementById('resultDescription').innerText = description;
    },

    updateAudioTrackActions() {
        const unavailable = !this.state.hasAudioTrack;
        const audioOnly = this.state.outputMode === 'audio';
        const removed = !this.state.includeAudio;
        const visuallyMuted = removed || this.state.audioMuted || unavailable;
        this.DOM.audioTrackRow.classList.toggle('muted-track', visuallyMuted);
        this.DOM.audioTrackRow.classList.toggle('removed-track', removed || unavailable);
        this.DOM.audioTrackRow.classList.toggle('audio-only-focus', audioOnly);
        this.DOM.audioMuteToggle.classList.toggle('is-muted', visuallyMuted);
        this.DOM.audioMuteToggle.disabled = unavailable || removed || audioOnly;
        this.DOM.audioMuteToggle.title = this.state.audioMuted ? 'Ativar áudio' : 'Silenciar áudio';
        this.DOM.audioMuteToggle.setAttribute('aria-label', this.DOM.audioMuteToggle.title);
        this.DOM.audioRemoveToggle.disabled = unavailable || audioOnly;
        this.DOM.audioRemoveToggle.innerText = removed ? '+' : '×';
        this.DOM.audioRemoveToggle.title = removed ? 'Restaurar faixa de áudio' : 'Remover faixa de áudio';
        this.DOM.audioRemoveToggle.setAttribute('aria-label', this.DOM.audioRemoveToggle.title);
        if (!this.state.hasAudioTrack) {
            this.DOM.audioTrackInfo.innerText = 'Sem faixa de áudio';
            return;
        }
        const details = this.state.audioTrackDetails || {};
        const codec = details.audioCodec ? details.audioCodec.toUpperCase() : 'Áudio';
        const sampleRate = details.sampleRate ? ` · ${(details.sampleRate / 1000).toFixed(0)} kHz` : '';
        const channels = details.channels ? ` · ${details.channels} canal${details.channels === 1 ? '' : 'is'}` : '';
        const status = removed ? 'Removida' : this.state.audioMuted ? 'Silenciada' : audioOnly ? 'Somente áudio' : 'Ativa';
        this.DOM.audioTrackInfo.innerText = `${status} · ${codec}${sampleRate}${channels}`;
    },

    setLoadingState(isLoading, message = '', color = 'orange') {
        if (isLoading) {
            if (message) {
                this.DOM.uploadStatus.innerHTML = `<span>${this.escapeHtml(message)}</span><span class="loading-dots"></span>`;
                this.DOM.uploadStatus.className = 'status-text loading';
            }
            document.querySelectorAll('#youtube-link-area button, #file-upload-area label').forEach(el => el.style.pointerEvents = 'none');
        } else {
            this.DOM.uploadStatus.innerText = message;
            this.DOM.uploadStatus.className = 'status-text';
            this.DOM.uploadStatus.style.color = color;
            document.querySelectorAll('#youtube-link-area button, #file-upload-area label').forEach(el => el.style.pointerEvents = 'auto');
        }
    },
    formatFileSize(bytes) {
        if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    },
    escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    },
    showTimeError(message) {
        this.DOM.statusArea.innerText = message;
        this.DOM.statusArea.className = 'status-text error';
    },
    showProcessError(message) {
        this.DOM.statusArea.innerText = message;
        this.DOM.statusArea.className = 'status-text error';
        this.DOM.statusArea.style.color = 'var(--error-color, #dc2626)';
        this.DOM.downloadArea.style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => ClipCraftApp.init());
