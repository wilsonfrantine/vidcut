// script.js - Final Refactored Version

const VidCutApp = {
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
        outputMode: 'original', // 'original' (sem conversão), 'mp4' (compatível), 'audio' (mp3)
        isTimelineScrubbing: false,
        loopSelection: true,
        customName: '',
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
            
            
            processButton: document.getElementById('processButton'),
            statusArea: document.getElementById('statusArea'),
            editorStatusArea: document.getElementById('editorStatusArea'),
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
            videoTrackPreviews: document.getElementById('videoTrackPreviews'),
            videoSelectionOverlay: document.getElementById('videoSelectionOverlay'),
            audioWaveform: document.getElementById('audioWaveform'),
            videoPlayhead: document.getElementById('videoPlayhead'),
            audioPlayhead: document.getElementById('audioPlayhead'),
            customFilenameInput: document.getElementById('customFilenameInput'),
            filenameExtensionBadge: document.getElementById('filenameExtensionBadge'),
            exportFormCard: document.getElementById('exportFormCard'),
            formatCardAudio: document.getElementById('formatCardAudio'),
            resultPreviewContainer: document.getElementById('resultPreviewContainer'),
            resultMediaWrapper: document.getElementById('resultMediaWrapper'),
            resultMetaInfo: document.getElementById('resultMetaInfo'),
            resultActionButtons: document.getElementById('resultActionButtons'),
            editAgainButton: document.getElementById('editAgainButton'),
            newVideoButton: document.getElementById('newVideoButton'),
            activeSessionBar: document.getElementById('activeSessionBar'),
            sessionVideoName: document.getElementById('sessionVideoName'),
            resumeEditButton: document.getElementById('resumeEditButton'),
            markStart: document.getElementById('markStart'),
            markEnd: document.getElementById('markEnd'),
            loopToggle: document.getElementById('loopToggle'),
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
        if (this.DOM.editAgainButton) {
            this.DOM.editAgainButton.addEventListener('click', () => {
                if (window.VidCutUI && window.VidCutUI.setView) {
                    window.VidCutUI.setView('step-2-editor');
                }
            });
        }
        if (this.DOM.newVideoButton) {
            this.DOM.newVideoButton.addEventListener('click', () => this.resetSession());
        }
        if (this.DOM.resumeEditButton) {
            this.DOM.resumeEditButton.addEventListener('click', () => {
                if (window.VidCutUI && window.VidCutUI.setView) {
                    window.VidCutUI.setView('step-2-editor');
                }
            });
        }
        this.DOM.markStart.addEventListener('click', () => this.markBoundary('start'));
        this.DOM.markEnd.addEventListener('click', () => this.markBoundary('end'));
        this.DOM.loopToggle.addEventListener('click', () => this.toggleLoop());
        this.DOM.videoPlayer.addEventListener('play', () => this.startLoopWatcher());
        document.addEventListener('keydown', event => this.handleShortcut(event));

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
        // Seleção de formato de saída na tela de exportação
        document.querySelectorAll('input[name="exportFormat"]').forEach(radio => {
            radio.addEventListener('change', e => {
                if (e.target.checked) {
                    this.setOutputMode(e.target.value);
                }
            });
        });
        if (this.DOM.customFilenameInput) {
            this.DOM.customFilenameInput.addEventListener('input', e => {
                this.state.customName = e.target.value.trim();
                this.generateCommand();
            });
        }
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
            if (!response.ok) throw new Error(this.errorText(result, 'Falha ao enviar o arquivo.'));

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
            if (!response.ok) throw new Error(this.errorText(result, 'Falha ao baixar o vídeo deste link.'));

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
        const validationErr = this.getIntervalError();
        if (validationErr) {
            this.showProcessError(validationErr);
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
                    outputMode: this.state.outputMode,
                    customName: this.state.customName
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(this.errorText(result, 'Ocorreu um erro no servidor.'));

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
        this.state.outputMode = 'original';
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
        this.setOutputMode('original');
        this.updateAudioTrackActions();
        this.updateExportDescription();
        this.DOM.videoPlayer.removeAttribute('src');
        this.DOM.videoPlayer.src = `/videos/${this.state.videoPath}`;
        this.DOM.videoPlayer.load();
        this.DOM.videoContainer.style.display = 'block';
        this.DOM.controls.style.display = 'block';
        this.updateSessionBanner();
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
            this.DOM.startTimeInput.value = this.formatTime(parseFloat(values[0]));
            this.DOM.endTimeInput.value = this.formatTime(parseFloat(values[1]));
        });

        this.updateTimelineUI();
        this.updatePlayhead();
    },

    // Tempo: formatação e leitura (aceita "90.5", "1:30.5" ou "1:02:03")
    formatTime(seconds) {
        const total = Math.max(0, seconds);
        const cs = Math.round(total * 100);
        const h = Math.floor(cs / 360000);
        const m = Math.floor((cs % 360000) / 6000);
        const s = ((cs % 6000) / 100).toFixed(2).padStart(5, '0');
        return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
    },
    parseTime(text) {
        const value = String(text).trim().replace(',', '.');
        if (!/^\d+(\.\d+)?(:\d+(\.\d+)?){0,2}$/.test(value)) return NaN;
        return value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
    },

    // Define início ou fim com validações claras e feedback ao usuário
    applyBoundary(type, candidate) {
        if (!Number.isFinite(candidate) || candidate < 0) {
            this.showTimeError('O tempo deve ser um valor positivo.');
            return;
        }

        if (candidate > this.state.videoDuration) {
            this.showTimeError(`O tempo limite não pode ultrapassar o tamanho do vídeo (${this.formatTime(this.state.videoDuration)}).`);
            return;
        }

        if (type === 'start') {
            if (candidate >= this.state.end) {
                this.showTimeError(`O início (${this.formatTime(candidate)}) não pode ser igual ou posterior ao fim (${this.formatTime(this.state.end)}).`);
                this.updateTimelineUI();
                return;
            }
            this.state.start = candidate;
        } else {
            if (candidate <= this.state.start) {
                this.showTimeError(`O fim (${this.formatTime(candidate)}) não pode ser igual ou anterior ao início (${this.formatTime(this.state.start)}).`);
                this.updateTimelineUI();
                return;
            }
            this.state.end = candidate;
        }

        this.clearTimeError();
        this.DOM.timelineSlider.noUiSlider.set([this.state.start, this.state.end]);
        this.updateTimelineUI();
    },

    handleTimeInputChange(type) {
        if (!this.state.videoPath) return;
        const input = type === 'start' ? this.DOM.startTimeInput : this.DOM.endTimeInput;
        const candidate = this.parseTime(input.value);
        if (!Number.isFinite(candidate)) {
            this.showTimeError('Digite um tempo válido, como 75, 1:15 ou 1:15.50.');
            this.updateTimelineUI();
            return;
        }
        this.applyBoundary(type, candidate);
    },

    markBoundary(type) {
        if (!this.state.videoPath || !this.DOM.timelineSlider.noUiSlider) return;
        this.applyBoundary(type, this.DOM.videoPlayer.currentTime);
    },

    toggleLoop() {
        this.state.loopSelection = !this.state.loopSelection;
        this.DOM.loopToggle.setAttribute('aria-pressed', String(this.state.loopSelection));
        this.DOM.loopToggle.classList.toggle('active', this.state.loopSelection);
        if (this.state.loopSelection) this.startLoopWatcher();
    },

    startLoopWatcher() {
        if (this.loopFrame) return;
        const tick = () => {
            const player = this.DOM.videoPlayer;
            if (player.paused || !this.state.loopSelection) { this.loopFrame = null; return; }
            if (player.currentTime >= this.state.end || player.currentTime < this.state.start - 0.05) {
                player.currentTime = this.state.start;
            }
            this.loopFrame = requestAnimationFrame(tick);
        };
        this.loopFrame = requestAnimationFrame(tick);
    },

    seekBy(delta) {
        const player = this.DOM.videoPlayer;
        player.currentTime = Math.max(0, Math.min(this.state.videoDuration, player.currentTime + delta));
        this.updatePlayhead();
    },

    togglePlayback() {
        const player = this.DOM.videoPlayer;
        if (!player.paused) { player.pause(); return; }
        if (this.state.loopSelection && (player.currentTime < this.state.start || player.currentTime >= this.state.end)) {
            player.currentTime = this.state.start;
        }
        player.play().catch(() => {});
    },

    handleShortcut(event) {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (!document.getElementById('step-2-editor').classList.contains('active') || !this.state.videoPath) return;
        if (event.target.closest('input, textarea, select, [contenteditable]')) return;
        const frame = 0.04;
        const actions = {
            ' ': () => this.togglePlayback(),
            k: () => this.togglePlayback(),
            i: () => this.markBoundary('start'),
            o: () => this.markBoundary('end'),
            r: () => this.toggleLoop(),
            '?': () => document.getElementById('shortcutsToggle').click(),
            s: () => {
                if (window.VidCutUI && window.VidCutUI.openSearchModal) {
                    window.VidCutUI.openSearchModal();
                }
            },
            j: () => this.seekBy(-5),
            l: () => this.seekBy(5),
            ArrowLeft: () => this.seekBy(event.shiftKey ? -frame : -1),
            ArrowRight: () => this.seekBy(event.shiftKey ? frame : 1)
        };
        const action = actions[event.key.length === 1 ? event.key.toLowerCase() : event.key];
        if (!action) return;
        if (event.target.closest('button') && event.key === ' ') return; // espaço em botão = ativar o botão
        event.preventDefault();
        action();
    },

    updateTimelineUI() {
        this.DOM.startTimeInput.value = this.formatTime(this.state.start);
        this.DOM.endTimeInput.value = this.formatTime(this.state.end);
        this.DOM.selectionDuration.innerText = `${this.formatTime(this.state.end - this.state.start).replace('.', ',')} selecionados`;
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
        if (!this.state.videoPath || !this.DOM.commandArea) {
            return;
        }
        this.DOM.commandArea.style.display = 'block';
        if (this.state.start >= this.state.end) {
            return;
        }
        const duration = this.state.end - this.state.start;
        const origExt = this.state.videoPath ? (this.state.videoPath.split('.').pop() || 'mp4').toLowerCase() : 'mp4';
        const ext = this.state.outputMode === 'audio' ? 'mp3' : (this.state.outputMode === 'original' ? origExt : 'mp4');
        const baseName = this.state.customName 
            ? this.state.customName.replace(/[\\/:*?"<>|\x00-\x1F]/g, '_')
            : `corte_${this.state.videoPath.replace(/\.[^.]+$/, '')}_${Math.round(this.state.start * 1000)}-${Math.round(this.state.end * 1000)}`;
        const outputFilename = `${baseName}.${ext}`;

        let cmd = '';
        if (this.state.outputMode === 'audio') {
            cmd = `ffmpeg -y -ss ${this.state.start.toFixed(3)} -i "${this.state.videoPath}" -t ${duration.toFixed(3)} -vn -map 0:a:0 -c:a libmp3lame -q:a 2 "${outputFilename}"`;
        } else if (this.state.outputMode === 'original' && this.state.includeAudio && !this.state.audioMuted) {
            cmd = `ffmpeg -y -ss ${this.state.start.toFixed(3)} -i "${this.state.videoPath}" -t ${duration.toFixed(3)} -c copy -map 0 "${outputFilename}"`;
        } else {
            cmd = `ffmpeg -y -ss ${this.state.start.toFixed(3)} -i "${this.state.videoPath}" -t ${duration.toFixed(3)} -map 0:v:0 ${this.state.includeAudio ? `-map 0:a? ${this.state.audioMuted ? '-af volume=0 ' : ''}-c:a aac -b:a 192k` : '-an'} -c:v libx264 -preset veryfast -crf 18 -movflags +faststart "${outputFilename}"`;
        }
        
    },

    displayResults(result) {
        this.DOM.statusArea.innerText = 'Corte concluído!';
        this.DOM.statusArea.style.color = 'var(--success-color)';
        
        // Exibir player de prévia do corte
        if (this.DOM.resultPreviewContainer && this.DOM.resultMediaWrapper) {
            this.DOM.resultMediaWrapper.innerHTML = '';
            const isAudio = result.outputMode === 'audio';
            const mediaEl = document.createElement(isAudio ? 'audio' : 'video');
            mediaEl.controls = true;
            mediaEl.src = `/output/${encodeURIComponent(result.outputFile)}`;
            mediaEl.className = isAudio ? 'result-audio-player' : 'result-video-player';
            this.DOM.resultMediaWrapper.appendChild(mediaEl);
            
            // Metadados (Tamanho e Duração)
            const metaParts = [];
            if (result.duration) {
                metaParts.push(`Duração: <strong>${this.formatTime(result.duration)}</strong>`);
            }
            if (result.fileSize) {
                metaParts.push(`Tamanho: <strong>${this.formatFileSize(result.fileSize)}</strong>`);
            }
            if (this.DOM.resultMetaInfo) {
                this.DOM.resultMetaInfo.innerHTML = metaParts.length ? metaParts.join(' &nbsp;·&nbsp; ') : '';
            }
            this.DOM.resultPreviewContainer.style.display = 'block';
        }

        // Botão de download
        this.DOM.downloadArea.innerHTML = '';
        const downloadLink = document.createElement('a');
        downloadLink.href = `/output/${encodeURIComponent(result.outputFile)}`;
        downloadLink.innerText = this.state.outputMode === 'audio' ? '⬇ Baixar MP3' : '⬇ Baixar vídeo';
        downloadLink.setAttribute('download', result.outputFile);
        downloadLink.className = 'download-button';
        this.DOM.downloadArea.appendChild(downloadLink);
        this.DOM.downloadArea.style.display = 'block';

        // Botões de ação subsequente
        if (this.DOM.resultActionButtons) {
            this.DOM.resultActionButtons.style.display = 'flex';
        }
        this.updateSessionBanner();
    },

    updateSessionBanner() {
        if (!this.DOM.activeSessionBar) return;
        if (this.state.videoPath) {
            this.DOM.activeSessionBar.style.display = 'flex';
            if (this.DOM.sessionVideoName) {
                this.DOM.sessionVideoName.textContent = `${this.state.videoPath} (${this.formatTime(this.state.start)} - ${this.formatTime(this.state.end)})`;
            }
        } else {
            this.DOM.activeSessionBar.style.display = 'none';
        }
    },

    async resetSession() {
        if (!confirm('Deseja descartar o vídeo atual e limpar os arquivos temporários do servidor?')) return;
        
        try {
            await fetch('/limpar-sessao', { method: 'POST' });
        } catch (_) {}

        this.state.videoPath = null;
        this.state.videoDuration = 0;
        this.state.start = 0;
        this.state.end = 0;
        this.state.hasAudioTrack = false;
        
        if (this.DOM.videoPlayer) {
            this.DOM.videoPlayer.pause();
            this.DOM.videoPlayer.removeAttribute('src');
            this.DOM.videoPlayer.load();
        }
        if (this.DOM.videoContainer) this.DOM.videoContainer.style.display = 'none';
        if (this.DOM.controls) this.DOM.controls.style.display = 'none';
        if (this.DOM.downloadArea) this.DOM.downloadArea.style.display = 'none';
        if (this.DOM.resultPreviewContainer) this.DOM.resultPreviewContainer.style.display = 'none';
        if (this.DOM.resultActionButtons) this.DOM.resultActionButtons.style.display = 'none';
        if (this.DOM.videoFile) this.DOM.videoFile.value = '';
        const ytInput = document.getElementById('youtubeUrlInput');
        if (ytInput) ytInput.value = '';
        this.setLoadingState(false, '');
        this.updateSessionBanner();

        if (window.VidCutUI && window.VidCutUI.resetTabs) {
            window.VidCutUI.resetTabs();
        }
    },

    setOutputMode(mode) {
        if (mode === 'audio' && !this.state.hasAudioTrack) return;
        this.state.outputMode = mode;
        if (mode === 'audio') {
            this.state.includeAudio = true;
            this.state.audioMuted = false;
        }
        
        // Atualiza radio buttons e cards visuais
        document.querySelectorAll('.format-card').forEach(card => {
            const input = card.querySelector('input[name="exportFormat"]');
            if (input) {
                const isSelected = input.value === mode;
                input.checked = isSelected;
                card.classList.toggle('active', isSelected);
            }
        });

        // Atualiza extensão exibida no badge
        if (this.DOM.filenameExtensionBadge) {
            const origExt = this.state.videoPath ? (this.state.videoPath.split('.').pop() || 'mp4').toLowerCase() : 'mp4';
            const ext = mode === 'audio' ? 'mp3' : (mode === 'original' ? origExt : 'mp4');
            this.DOM.filenameExtensionBadge.textContent = `.${ext}`;
        }

        if (this.DOM.formatCardAudio) {
            this.DOM.formatCardAudio.style.opacity = this.state.hasAudioTrack ? '1' : '0.4';
            this.DOM.formatCardAudio.querySelector('input').disabled = !this.state.hasAudioTrack;
        }

        this.updateAudioTrackActions();
        this.updateExportDescription();
        this.generateCommand();
    },

    updateExportDescription() {
        const description = this.state.outputMode === 'audio'
            ? 'Somente a faixa de áudio selecionada será exportada em MP3.'
            : this.state.outputMode === 'original'
                ? '⚡ O trecho selecionado será extraído instantaneamente no formato original sem perda de qualidade (-c copy).'
                : 'O vídeo será recodificado em formato MP4 padrão (H.264 + AAC) para compatibilidade universal.';
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
    errorText(result, fallback) {
        const message = result.message || fallback;
        return result.detail ? `${message} (${result.detail})` : message;
    },
    escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    },
    getIntervalError() {
        if (!Number.isFinite(this.state.start) || this.state.start < 0) {
            return 'Ponto de início inválido: informe um tempo maior ou igual a zero.';
        }
        if (!Number.isFinite(this.state.end) || this.state.end <= 0) {
            return 'Ponto de término inválido: informe um tempo maior que zero.';
        }
        if (this.state.end > this.state.videoDuration + 0.05) {
            return `O fim selecionado (${this.formatTime(this.state.end)}) ultrapassa a duração total do vídeo (${this.formatTime(this.state.videoDuration)}).`;
        }
        if (this.state.start >= this.state.end) {
            return `O tempo de início (${this.formatTime(this.state.start)}) precisa ser estritamente menor que o fim (${this.formatTime(this.state.end)}).`;
        }
        if (this.state.end - this.state.start < 0.1) {
            return 'O trecho selecionado é muito curto (mínimo de 0,1 segundo).';
        }
        return null;
    },

    showTimeError(message) {
        if (this.DOM.editorStatusArea) {
            this.DOM.editorStatusArea.textContent = `⚠ ${message}`;
            this.DOM.editorStatusArea.style.display = 'block';
            this.DOM.editorStatusArea.className = 'status-text editor-status-bar error';
        }
        if (this.DOM.statusArea) {
            this.DOM.statusArea.innerText = message;
            this.DOM.statusArea.className = 'status-text error';
        }
    },

    clearTimeError() {
        if (this.DOM.editorStatusArea) {
            this.DOM.editorStatusArea.style.display = 'none';
            this.DOM.editorStatusArea.textContent = '';
        }
        if (this.DOM.statusArea) {
            this.DOM.statusArea.innerText = '';
        }
    },

    showProcessError(message) {
        this.DOM.statusArea.innerText = `⚠ ${message}`;
        this.DOM.statusArea.className = 'status-text error';
        this.DOM.statusArea.style.color = 'var(--error-color, #dc2626)';
        this.DOM.downloadArea.style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => VidCutApp.init());
