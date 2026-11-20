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

        // Sistema Multipistas & Edição NLE
        tracks: [
            { id: 'v1', type: 'video', label: 'Vídeo 1 (V1)', muted: false, hidden: false, linkGroup: 'g1' },
            { id: 'a1', type: 'audio', label: 'Áudio 1 (A1)', muted: false, hidden: false, linkGroup: 'g1' }
        ],
        clips: [], // [{ id, trackId, type, name, filename, trackStart, trimStart, trimEnd, duration, mediaInfo, transitionIn, transitionOut }]
        selectedClipId: null,
        clipboardClip: null,
        history: [], // Pilha de Undo
        redoStack: [], // Pilha de Redo

        // Virtual Engine State
        currentTime: 0,
        isPlaying: false,
        mediaPool: {}, // filename -> HTMLVideoElement / HTMLAudioElement

        // Zoom e Altura de Pistas
        zoomLevel: 1.0, // 0.5x a 5.0x
        trackHeight: 54, // 36px a 110px
        canvasAspectRatio: '16:9',
        canvasFitMode: 'cover', // 'cover' (preenche e corta bordas excedentes) ou 'contain' (letterbox)
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
            editorCanvas: document.getElementById('editorCanvas'),
            canvasPlayBtn: document.getElementById('canvasPlayBtn'),
            canvasTimeDisplay: document.getElementById('canvasTimeDisplay'),
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
            resetSelectionBtn: document.getElementById('resetSelectionBtn'),
            loopToggle: document.getElementById('loopToggle'),
            undoBtn: document.getElementById('undoBtn'),
            redoBtn: document.getElementById('redoBtn'),
            duplicateClipBtn: document.getElementById('duplicateClipBtn'),
            timelineRuler: document.getElementById('timelineRuler'),
            rulerCanvas: document.getElementById('rulerCanvas'),
            rulerSelectionHighlight: document.getElementById('rulerSelectionHighlight'),
            rulerPlayhead: document.getElementById('rulerPlayhead'),
            contextMenu: document.getElementById('timelineContextMenu'),
            trackContextMenu: document.getElementById('trackContextMenu'),
            canvasAspectSelect: document.getElementById('canvasAspectSelect'),
            canvasFitToggleBtn: document.getElementById('canvasFitToggleBtn'),
            addMediaBtn: document.getElementById('addMediaBtn') || document.getElementById('editorSearchBtn'),
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
        if (this.DOM.resetSelectionBtn) {
            this.DOM.resetSelectionBtn.addEventListener('click', () => this.resetSelection());
        }
        this.DOM.loopToggle.addEventListener('click', () => this.toggleLoop());
        if (this.DOM.undoBtn) this.DOM.undoBtn.addEventListener('click', () => this.undo());
        if (this.DOM.redoBtn) this.DOM.redoBtn.addEventListener('click', () => this.redo());
        if (this.DOM.duplicateClipBtn) this.DOM.duplicateClipBtn.addEventListener('click', () => this.duplicateSelectedClip());
        if (this.DOM.canvasPlayBtn) this.DOM.canvasPlayBtn.addEventListener('click', () => this.togglePlayback());
        if (this.DOM.editorCanvas) this.DOM.editorCanvas.addEventListener('click', () => this.togglePlayback());
        this.setupRulerInteractions();
        this.setupZoomAndScrollInteractions();
        this.setupContextMenu();
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

        if (this.DOM.audioMuteToggle) {
            this.DOM.audioMuteToggle.addEventListener('click', () => {
                if (!this.state.hasAudioTrack || !this.state.includeAudio || this.state.outputMode === 'audio') return;
                this.state.audioMuted = !this.state.audioMuted;
                this.updateAudioTrackActions();
                this.updateExportDescription();
                this.generateCommand();
            });
        }
        if (this.DOM.audioRemoveToggle) {
            this.DOM.audioRemoveToggle.addEventListener('click', () => {
                if (!this.state.hasAudioTrack || this.state.outputMode === 'audio') return;
                this.state.includeAudio = !this.state.includeAudio;
                if (this.state.includeAudio) this.state.audioMuted = false;
                this.updateAudioTrackActions();
                this.updateExportDescription();
                this.generateCommand();
            });
        }
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
        if (this.DOM.canvasAspectSelect) {
            this.DOM.canvasAspectSelect.addEventListener('change', e => {
                const val = e.target.value || '16:9:cover';
                const parts = val.split(':');
                const ratio = `${parts[0]}:${parts[1]}`;
                const fit = parts[2] || this.state.canvasFitMode || 'cover';
                this.state.canvasFitMode = fit;
                this.setCanvasAspectRatio(ratio);
            });
        }
        if (this.DOM.canvasFitToggleBtn) {
            this.DOM.canvasFitToggleBtn.addEventListener('click', () => {
                this.toggleCanvasFitMode();
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
    async handleFileUpload(event, options = {}) {
        const file = event.target.files[0];
        if (!file) return;
        const hasVideoType = file.type.startsWith('video/') || file.type.startsWith('audio/');
        const hasVideoExtension = /\.(mkv|avi|mov|mp4|webm|m4v|mpeg|mpg|mp3|wav|ogg)$/i.test(file.name);
        if (!hasVideoType && !hasVideoExtension) {
            this.setLoadingState(false, 'Selecione um arquivo de vídeo ou áudio para continuar.', 'red');
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

            this.handleSuccessfulLoad(result, options);
        } catch (error) {
            this.setLoadingState(false, `Não foi possível enviar: ${error.message}`, 'red');
        }
    },

    async downloadFromYouTube(url, options = {}) {
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

            this.handleSuccessfulLoad(result, options);
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
            // Prepara os clipes com início/fim normalizados
            const formattedClips = (this.state.clips || [])
                .filter(c => c && c.type === 'video')
                .map(c => ({
                    ...c,
                    start: Number.isFinite(c.trimStart) ? c.trimStart : 0,
                    end: Number.isFinite(c.trimEnd) ? c.trimEnd : (c.duration || 0)
                }))
                .filter(c => c.end > c.start);

            const hasMultipleClipsOrTransitions = formattedClips.length > 1 ||
                formattedClips.some(c => c.transitionIn || c.transitionOut);

            const isMuted = this.state.audioMuted || !this.state.includeAudio || 
                (this.state.tracks && this.state.tracks.filter(t => t.type === 'audio').length > 0 && 
                 this.state.tracks.filter(t => t.type === 'audio').every(t => t.muted));

            const response = await fetch('/processar-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoPath: this.state.videoPath,
                    start: this.state.start,
                    end: this.state.end,
                    includeAudio: !isMuted,
                    muteAudio: isMuted,
                    outputMode: this.state.outputMode,
                    customName: this.state.customName,
                    aspectRatio: this.state.canvasAspectRatio || 'original',
                    fitMode: this.state.canvasFitMode || 'cover',
                    clips: hasMultipleClipsOrTransitions ? formattedClips : undefined
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
    handleSuccessfulLoad(result, options = {}) {
        const isAppend = options.insertMode === 'append' && this.state.videoPath && this.state.clips.length > 0;
        
        if (isAppend) {
            this.setLoadingState(false, 'Clipe inserido com sucesso.', 'var(--success-color)');
            this.pushHistoryState('Adicionar nova trilha');
            const clipDuration = Number(result.mediaInfo?.duration) || 10;
            const currentVideoTracks = this.state.tracks.filter(t => t.type === 'video');
            const currentAudioTracks = this.state.tracks.filter(t => t.type === 'audio');
            const maxTracks = 4; // Limite saudável de 4 pistas de vídeo e 4 de áudio

            let targetVTrack = `v${Math.min(currentVideoTracks.length + 1, maxTracks)}`;
            let targetATrack = `a${Math.min(currentAudioTracks.length + 1, maxTracks)}`;

            // Cria pista de vídeo se ainda não atingiu o limite
            if (!this.state.tracks.some(t => t.id === targetVTrack) && currentVideoTracks.length < maxTracks) {
                this.state.tracks.unshift({
                    id: targetVTrack,
                    type: 'video',
                    label: `Vídeo ${targetVTrack.slice(1)} (${targetVTrack.toUpperCase()})`,
                    muted: false,
                    hidden: false
                });
            } else {
                targetVTrack = currentVideoTracks[0]?.id || 'v1';
            }

            // Cria pista de áudio associada se tiver áudio
            if (result.mediaInfo?.hasAudio && !this.state.tracks.some(t => t.id === targetATrack) && currentAudioTracks.length < maxTracks) {
                this.state.tracks.push({
                    id: targetATrack,
                    type: 'audio',
                    label: `Áudio ${targetATrack.slice(1)} (${targetATrack.toUpperCase()})`,
                    muted: false,
                    hidden: false
                });
            } else if (!result.mediaInfo?.hasAudio) {
                targetATrack = null;
            }

            const currentTime = this.DOM.videoPlayer.currentTime || 0;
            const newVClip = {
                id: 'clip_v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                trackId: targetVTrack,
                type: 'video',
                name: result.filename,
                filename: result.filename,
                trackStart: currentTime,
                trimStart: 0,
                trimEnd: clipDuration,
                duration: clipDuration,
                mediaInfo: result.mediaInfo || {},
                transitionIn: null,
                transitionOut: null
            };
            this.state.clips.push(newVClip);

            if (targetATrack && result.mediaInfo?.hasAudio) {
                const newAClip = {
                    id: 'clip_a_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    trackId: targetATrack,
                    type: 'audio',
                    name: `Áudio: ${result.filename}`,
                    filename: result.filename,
                    trackStart: currentTime,
                    trimStart: 0,
                    trimEnd: clipDuration,
                    duration: clipDuration,
                    mediaInfo: result.mediaInfo || {},
                    linkedClipId: newVClip.id
                };
                newVClip.linkedClipId = newAClip.id;
                this.state.clips.push(newAClip);
            }

            this.state.selectedClipId = newVClip.id;
            // Atualiza duração total do projeto se o clipe passar do fim
            const clipEnd = currentTime + clipDuration;
            if (clipEnd > this.state.videoDuration) {
                this.state.videoDuration = clipEnd;
                this.state.end = clipEnd;
            }

            this.showEditorNotification(`Nova trilha ${targetVTrack.toUpperCase()} adicionada à timeline.`);
            this.renderTracksUI();
            this.renderClipsTimeline();
            return;
        }

        this.setLoadingState(false, 'Vídeo carregado com sucesso.', 'var(--success-color)');
        this.pushHistoryState('Carregar vídeo principal');
        this.state.videoPath = result.filename;
        this.state.hasAudioTrack = Boolean(result.mediaInfo?.hasAudio);
        this.state.includeAudio = this.state.hasAudioTrack;
        this.state.audioMuted = false;
        this.state.outputMode = 'original';
        this.state.audioTrackDetails = result.mediaInfo || {};

        // Inicializar pistas base V1 e A1 vinculadas por padrão em 'g1'
        this.state.tracks = [
            { id: 'v1', type: 'video', label: 'Vídeo 1 (V1)', muted: false, hidden: false, linkGroup: 'g1' }
        ];
        if (this.state.hasAudioTrack) {
            this.state.tracks.push({ id: 'a1', type: 'audio', label: 'Áudio 1 (A1)', muted: false, hidden: false, linkGroup: 'g1' });
        }

        const initialDuration = Number(result.mediaInfo?.duration) || 0;
        if (initialDuration > 0) {
            this.state.videoDuration = initialDuration;
            this.state.start = 0;
            this.state.end = initialDuration;
        }
        const rootVClip = {
            id: 'clip_root_v_' + Date.now(),
            trackId: 'v1',
            type: 'video',
            name: result.filename,
            filename: result.filename,
            trackStart: 0,
            trimStart: 0,
            trimEnd: initialDuration,
            duration: initialDuration,
            mediaInfo: result.mediaInfo || {},
            transitionIn: null,
            transitionOut: null
        };
        this.state.clips = [rootVClip];

        if (this.state.hasAudioTrack) {
            const rootAClip = {
                id: 'clip_root_a_' + Date.now(),
                trackId: 'a1',
                type: 'audio',
                name: `Áudio: ${result.filename}`,
                filename: result.filename,
                trackStart: 0,
                trimStart: 0,
                trimEnd: initialDuration,
                duration: initialDuration,
                mediaInfo: result.mediaInfo || {},
                linkedClipId: rootVClip.id
            };
            rootVClip.linkedClipId = rootAClip.id;
            this.state.clips.push(rootAClip);
        }

        this.state.selectedClipId = rootVClip.id;
        this.DOM.timelineTracks.hidden = false;
        this.DOM.toggleTracks.setAttribute('aria-expanded', 'true');
        this.DOM.toggleTracks.title = 'Ocultar trilhas';
        this.DOM.toggleTracks.setAttribute('aria-label', 'Ocultar trilhas');
        this.setOutputMode('original');
        this.updateExportDescription();
        this.DOM.videoPlayer.removeAttribute('src');
        this.DOM.videoPlayer.src = `/videos/${this.state.videoPath}`;
        this.DOM.videoPlayer.load();
        this.DOM.videoContainer.style.display = 'flex';
        this.DOM.controls.style.display = 'block';
        this.updateSessionBanner();
        this.renderTracksUI();
        this.setCanvasAspectRatio(this.state.canvasAspectRatio || '16:9');
        document.dispatchEvent(new CustomEvent('videoUploaded'));
        requestAnimationFrame(() => {
            this.setCanvasAspectRatio(this.state.canvasAspectRatio || '16:9');
            this.renderTimelineRuler();
            this.renderClipsTimeline();
            this.renderCanvasFrame();
        });
        setTimeout(() => {
            this.setCanvasAspectRatio(this.state.canvasAspectRatio || '16:9');
            this.renderTimelineRuler();
            this.renderClipsTimeline();
            this.renderCanvasFrame();
        }, 120);
    },

    setupTimelineSlider() {
        // Usa a duração do elemento HTMLVideoElement ou mantém a duração já detectada com precisão pelo ffprobe
        const playerDur = this.DOM.videoPlayer.duration;
        if (Number.isFinite(playerDur) && playerDur > 0) {
            this.state.videoDuration = playerDur;
        }
        if (!Number.isFinite(this.state.videoDuration) || this.state.videoDuration <= 0) {
            this.setLoadingState(false, 'Este vídeo não pôde ser aberto ou não tem duração válida.', 'red');
            return;
        }
        // Se start/end não tiverem sido inicializados ou se end exceder a duração real, sincroniza
        if (!Number.isFinite(this.state.start) || this.state.start < 0) this.state.start = 0;
        if (!Number.isFinite(this.state.end) || this.state.end <= 0 || this.state.end > this.state.videoDuration + 0.05) {
            this.state.end = this.state.videoDuration;
        }

        if (this.DOM.timelineSlider && typeof noUiSlider !== 'undefined') {
            if (this.DOM.timelineSlider.noUiSlider) {
                this.DOM.timelineSlider.noUiSlider.destroy();
            }

            try {
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
            } catch (err) {
                console.warn('Slider opcional não inicializado:', err);
            }
        }

        this.updateTimelineUI();
        this.updatePlayhead();
        this.renderTimelineRuler();
        this.renderClipsTimeline();
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
        if (this.DOM.timelineSlider?.noUiSlider) {
            this.DOM.timelineSlider.noUiSlider.set([this.state.start, this.state.end]);
        }
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
        if (!this.state.videoPath) return;

        // Determina o tempo atual no cursor da timeline (playhead virtual ou player)
        const curTime = Number.isFinite(this.state.currentTime)
            ? this.state.currentTime
            : (this.DOM.videoPlayer && Number.isFinite(this.DOM.videoPlayer.currentTime) ? this.DOM.videoPlayer.currentTime : 0);

        // Se houver um clipe selecionado na timeline multipista, apara o clipe ao cursor
        if (this.state.selectedClipId && this.state.clips && this.state.clips.length) {
            const clip = this.state.clips.find(c => c.id === this.state.selectedClipId);
            if (clip) {
                const tStart = clip.trackStart || 0;
                const origTrimStart = clip.trimStart || 0;
                const origTrimEnd = clip.trimEnd || clip.duration;
                const clipDur = origTrimEnd - origTrimStart;
                const tEnd = tStart + clipDur;

                // Encontra itens de pistas vinculadas
                const currentTrack = this.state.tracks.find(t => t.id === clip.trackId);
                let linkedTrackClips = [];
                if (currentTrack && currentTrack.linkGroup) {
                    const groupTrackIds = new Set(
                        this.state.tracks
                            .filter(t => t.linkGroup === currentTrack.linkGroup)
                            .map(t => t.id)
                    );
                    linkedTrackClips = this.state.clips.filter(c => 
                        c.id !== clip.id && 
                        groupTrackIds.has(c.trackId) && 
                        Math.abs((c.trackStart || 0) - tStart) < 0.05
                    );
                }

                if (type === 'start') {
                    // Marcar início: se o cursor estiver após o início do clipe e antes do fim
                    if (curTime > tStart && curTime < tEnd - 0.1) {
                        this.pushHistoryState('Aparar início do clipe selecionado');
                        const delta = curTime - tStart;
                        const newTrimStart = origTrimStart + delta;
                        clip.trimStart = newTrimStart;
                        clip.trackStart = curTime;

                        linkedTrackClips.forEach(lc => {
                            const lOrigTrimStart = lc.trimStart || 0;
                            lc.trimStart = lOrigTrimStart + delta;
                            lc.trackStart = curTime;
                        });

                        this.recalculateProjectDuration();
                        this.renderClipsTimeline();
                        this.renderCanvasFrame();
                        this.showEditorNotification(`Início do clipe aparado para ${this.formatTime(curTime)}`);
                        return;
                    }
                } else {
                    // Marcar fim: se o cursor estiver antes do fim do clipe e após o início
                    // O clipe termina no cursor: nova duração = curTime - tStart
                    if (curTime > tStart + 0.1 && curTime < tEnd) {
                        this.pushHistoryState('Aparar fim do clipe selecionado');
                        const newClipDur = curTime - tStart;
                        const newTrimEnd = origTrimStart + newClipDur;
                        clip.trimEnd = newTrimEnd;

                        linkedTrackClips.forEach(lc => {
                            const lOrigTrimStart = lc.trimStart || 0;
                            lc.trimEnd = lOrigTrimStart + newClipDur;
                        });

                        this.recalculateProjectDuration();
                        this.renderClipsTimeline();
                        this.renderCanvasFrame();
                        this.showEditorNotification(`Fim do clipe aparado para ${this.formatTime(curTime)}`);
                        return;
                    }
                }
            }
        }

        // Caso geral: atualiza o intervalo de seleção do projeto (start / end)
        this.applyBoundary(type, curTime);
        this.showEditorNotification(
            type === 'start'
                ? `Início da seleção marcado em ${this.formatTime(curTime)}`
                : `Fim da seleção marcado em ${this.formatTime(curTime)}`
        );
    },

    resetSelection() {
        if (!this.state.videoPath) return;
        const totalDur = this.state.videoDuration || 0;
        if (totalDur <= 0) return;

        this.pushHistoryState('Resetar seleção');
        this.state.start = 0;
        this.state.end = totalDur;

        // Se houver clipe selecionado, restaura também os trims do clipe
        if (this.state.selectedClipId && this.state.clips && this.state.clips.length) {
            const clip = this.state.clips.find(c => c.id === this.state.selectedClipId);
            if (clip) {
                clip.trimStart = 0;
                clip.trimEnd = clip.duration || totalDur;
                const currentTrack = this.state.tracks.find(t => t.id === clip.trackId);
                if (currentTrack && currentTrack.linkGroup) {
                    const groupTrackIds = new Set(
                        this.state.tracks.filter(t => t.linkGroup === currentTrack.linkGroup).map(t => t.id)
                    );
                    this.state.clips.forEach(c => {
                        if (c.id !== clip.id && groupTrackIds.has(c.trackId) && Math.abs((c.trackStart || 0) - (clip.trackStart || 0)) < 0.05) {
                            c.trimStart = 0;
                            c.trimEnd = c.duration || totalDur;
                        }
                    });
                }
                this.recalculateProjectDuration();
                this.renderClipsTimeline();
                this.renderCanvasFrame();
            }
        }

        if (this.DOM.timelineSlider?.noUiSlider) {
            this.DOM.timelineSlider.noUiSlider.set([this.state.start, this.state.end]);
        }
        this.updateTimelineUI();
        this.showEditorNotification(`Seleção restaurada para a duração total (${this.formatTime(totalDur)})`);
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

    // Define proporção de aspecto do canvas e viewport
    setCanvasAspectRatio(ratio) {
        this.state.canvasAspectRatio = ratio;
        const canvas = this.DOM.editorCanvas;
        if (!canvas) return;

        let width = 1280;
        let height = 720;
        let cssRatio = '16 / 9';

        switch (ratio) {
            case '9:16':
                width = 720;
                height = 1280;
                cssRatio = '9 / 16';
                break;
            case '1:1':
                width = 1080;
                height = 1080;
                cssRatio = '1 / 1';
                break;
            case '4:5':
                width = 1080;
                height = 1350;
                cssRatio = '4 / 5';
                break;
            case '3:4':
                width = 1080;
                height = 1440;
                cssRatio = '3 / 4';
                break;
            case '16:9':
            default:
                width = 1280;
                height = 720;
                cssRatio = '16 / 9';
                break;
        }

        canvas.width = width;
        canvas.height = height;

        // Ajusta dimensões visuais calculadas do canvas para responder de imediato à proporção
        const container = this.DOM.videoContainer;
        const containerH = (container && container.clientHeight > 0) ? container.clientHeight : 440;
        const containerW = (container && container.clientWidth > 0) ? container.clientWidth : 800;
        const targetAspect = width / height;

        let targetW = containerH * targetAspect;
        let targetH = containerH;
        if (targetW > containerW - 20) {
            targetW = containerW - 20;
            targetH = targetW / targetAspect;
        }

        canvas.style.width = `${Math.round(targetW)}px`;
        canvas.style.height = `${Math.round(targetH)}px`;
        canvas.style.aspectRatio = cssRatio;

        const combinedKey = `${ratio}:${this.state.canvasFitMode || 'cover'}`;
        if (this.DOM.canvasAspectSelect && this.DOM.canvasAspectSelect.value !== combinedKey) {
            // Se encontrar a opção combinada, seleciona; senão tenta encontrar só o ratio
            const matchOpt = Array.from(this.DOM.canvasAspectSelect.options).find(o => o.value === combinedKey || o.value.startsWith(ratio));
            if (matchOpt) {
                this.DOM.canvasAspectSelect.value = matchOpt.value;
            }
        }

        this.renderCanvasFrame();
        const modeLabel = (this.state.canvasFitMode === 'contain') ? 'Ajustar (Fit)' : 'Cortar (Crop)';
        this.showEditorNotification(`Proporção ajustada para ${ratio} (${modeLabel})`);
    },

    toggleCanvasFitMode() {
        this.state.canvasFitMode = this.state.canvasFitMode === 'cover' ? 'contain' : 'cover';
        if (this.DOM.canvasAspectSelect) {
            const combinedKey = `${this.state.canvasAspectRatio || '16:9'}:${this.state.canvasFitMode}`;
            const matchOpt = Array.from(this.DOM.canvasAspectSelect.options).find(o => o.value === combinedKey);
            if (matchOpt) this.DOM.canvasAspectSelect.value = matchOpt.value;
        }
        if (this.DOM.canvasFitToggleBtn) {
            const badge = this.DOM.canvasFitToggleBtn.querySelector('.fit-mode-badge');
            if (badge) {
                badge.innerText = this.state.canvasFitMode === 'cover' ? 'CROP' : 'FIT';
            }
            this.DOM.canvasFitToggleBtn.title = this.state.canvasFitMode === 'cover'
                ? 'Modo: Preencher e cortar bordas (Cover) - Clique para alternar para Ajustar com barras pretas (Fit)'
                : 'Modo: Ajustar com barras pretas (Fit) - Clique para alternar para Preencher e cortar (Cover)';
        }
        this.renderCanvasFrame();
        this.showEditorNotification(
            this.state.canvasFitMode === 'cover'
                ? 'Enquadramento: Preencher tela e cortar bordas excedentes (Crop / Cover)'
                : 'Enquadramento: Ajustar vídeo inteiro com barras pretas (Fit / Letterbox)'
        );
    },

    // Motor Virtual de Reprodução (Canvas Compositor em Tempo Real)
    getOrCreateMediaElement(filename, role = 'video') {
        const poolKey = `${role}_${filename}`;
        if (!this.state.mediaPool[poolKey]) {
            const isAudio = role === 'audio';
            const el = document.createElement(isAudio ? 'audio' : 'video');
            el.src = `/videos/${encodeURIComponent(filename)}`;
            el.preload = 'auto';
            if (!isAudio) {
                el.playsInline = true;
                el.muted = true; // O vídeo fica mudo para o áudio ser controlado pela pista de áudio independente
            }
            el.crossOrigin = 'anonymous';
            el.style.position = 'absolute';
            el.style.width = '1px';
            el.style.height = '1px';
            el.style.top = '0';
            el.style.left = '0';
            el.style.opacity = '0.001';
            el.style.pointerEvents = 'none';
            el.style.zIndex = '-1';
            document.body.appendChild(el);
            this.state.mediaPool[poolKey] = el;
        }
        return this.state.mediaPool[poolKey];
    },

    togglePlayback() {
        if (this.state.isPlaying) {
            this.pausePlayback();
        } else {
            this.startPlayback();
        }
    },

    startPlayback() {
        this.state.isPlaying = true;
        if (this.DOM.canvasPlayBtn) {
            this.DOM.canvasPlayBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
            this.DOM.canvasPlayBtn.setAttribute('title', 'Pausar (Espaço)');
        }
        this.lastPlaybackTimestamp = performance.now();
        this.runPlaybackLoop();
    },

    pausePlayback() {
        this.state.isPlaying = false;
        if (this.DOM.canvasPlayBtn) {
            this.DOM.canvasPlayBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="6,4 20,12 6,20"/></svg>';
            this.DOM.canvasPlayBtn.setAttribute('title', 'Reproduzir (Espaço)');
        }
        cancelAnimationFrame(this.playbackRafId);
        // Pausa todos os vídeos do pool
        Object.values(this.state.mediaPool).forEach(v => {
            try { v.pause(); } catch (_) {}
        });
    },

    seekToTime(time) {
        this.state.currentTime = Math.max(0, Math.min(this.state.videoDuration || 1, time));
        this.updatePlayhead();
        this.renderCanvasFrame();
    },

    seekBy(delta) {
        this.seekToTime((this.state.currentTime || 0) + delta);
    },

    runPlaybackLoop() {
        if (!this.state.isPlaying) return;

        const now = performance.now();
        const delta = (now - this.lastPlaybackTimestamp) / 1000;
        this.lastPlaybackTimestamp = now;

        let nextTime = (this.state.currentTime || 0) + delta;

        // Suporte a repetição de seleção ou loop global
        const maxLimit = Math.max(this.state.videoDuration || 0, this.state.end || 0);
        if (this.state.loopSelection && nextTime >= this.state.end && this.state.end > this.state.start) {
            nextTime = this.state.start;
        } else if (nextTime >= maxLimit && maxLimit > 0) {
            nextTime = 0;
            this.pausePlayback();
        }

        this.state.currentTime = nextTime;
        this.updatePlayhead();
        this.renderCanvasFrame();

        if (this.state.isPlaying) {
            this.playbackRafId = requestAnimationFrame(() => this.runPlaybackLoop());
        }
    },

    renderCanvasFrame() {
        const canvas = this.DOM.editorCanvas;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const t = this.state.currentTime || 0;

        // Atualiza mostrador de tempo do overlay
        if (this.DOM.canvasTimeDisplay) {
            this.DOM.canvasTimeDisplay.innerText = `${this.formatTime(t)} / ${this.formatTime(this.state.videoDuration || 0)}`;
        }

        // Fundo preto padrão (para gaps / transições)
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Identifica trilhas visuais ordenadas por prioridade (V4, V3, V2, V1)
        const videoTracks = this.state.tracks
            .filter(tr => tr.type === 'video' && !tr.hidden)
            .sort((a, b) => b.id.localeCompare(a.id)); // Pista maior fica em cima

        const playingFilenames = new Set();

        for (const track of videoTracks) {
            const activeClip = this.state.clips.find(clip => {
                if (clip.trackId !== track.id) return false;
                const cStart = clip.trackStart || 0;
                const cDur = (clip.trimEnd || clip.duration) - (clip.trimStart || 0);
                return t >= cStart && t < cStart + cDur;
            });

            if (activeClip) {
                const vid = this.getOrCreateMediaElement(activeClip.filename, 'video');
                const offsetInClip = t - (activeClip.trackStart || 0);
                const localMediaTime = (activeClip.trimStart || 0) + offsetInClip;

                // Dessincronia corrigida somente se for relevante para evitar stuttering contínuo
                if (Math.abs(vid.currentTime - localMediaTime) > 0.25 || !this.state.isPlaying) {
                    vid.currentTime = Math.max(0, localMediaTime);
                }
                if (this.state.isPlaying && vid.paused) {
                    vid.play().catch(() => {});
                }
                playingFilenames.add(`video_${activeClip.filename}`);

                // Cálculo de Transições (Fade In / Fade Out)
                let alpha = 1;
                const clipDur = (activeClip.trimEnd || activeClip.duration) - (activeClip.trimStart || 0);

                if (activeClip.transitionIn && activeClip.transitionIn.type === 'fade') {
                    const dur = activeClip.transitionIn.duration || 0.5;
                    if (offsetInClip < dur) {
                        alpha = Math.max(0, Math.min(1, offsetInClip / dur));
                    }
                }
                if (activeClip.transitionOut && activeClip.transitionOut.type === 'fade') {
                    const dur = activeClip.transitionOut.duration || 0.5;
                    const timeLeft = clipDur - offsetInClip;
                    if (timeLeft < dur) {
                        alpha = Math.min(alpha, Math.max(0, timeLeft / dur));
                    }
                }

                ctx.save();
                ctx.globalAlpha = alpha;
                // Renderiza o frame: 'cover' (preenche cortando excedente) ou 'contain' (ajusta com barras pretas)
                if (vid.readyState >= 1) {
                    try {
                        const vw = vid.videoWidth || canvas.width;
                        const vh = vid.videoHeight || canvas.height;
                        const isCover = (this.state.canvasFitMode || 'cover') === 'cover';
                        const scale = isCover 
                            ? Math.max(canvas.width / vw, canvas.height / vh)
                            : Math.min(canvas.width / vw, canvas.height / vh);
                        const dw = vw * scale;
                        const dh = vh * scale;
                        const dx = (canvas.width - dw) / 2;
                        const dy = (canvas.height - dh) / 2;
                        ctx.drawImage(vid, dx, dy, dw, dh);
                    } catch (_) {}
                }
                ctx.restore();
                break; // A camada de maior prioridade já cobriu a tela
            }
        }

        // Sincroniza áudios das pistas ativas
        const audioTracks = this.state.tracks.filter(tr => tr.type === 'audio');
        audioTracks.forEach(track => {
            const activeClip = this.state.clips.find(clip => {
                if (clip.trackId !== track.id) return false;
                const cStart = clip.trackStart || 0;
                const cDur = (clip.trimEnd || clip.duration) - (clip.trimStart || 0);
                return t >= cStart && t < cStart + cDur;
            });

            if (activeClip) {
                const audioEl = this.getOrCreateMediaElement(activeClip.filename, 'audio');
                const offsetInClip = t - (activeClip.trackStart || 0);
                const localMediaTime = (activeClip.trimStart || 0) + offsetInClip;

                if (Math.abs(audioEl.currentTime - localMediaTime) > 0.25 || !this.state.isPlaying) {
                    audioEl.currentTime = Math.max(0, localMediaTime);
                }
                audioEl.muted = track.muted || this.state.audioMuted;

                if (this.state.isPlaying && audioEl.paused) {
                    audioEl.play().catch(() => {});
                }
                playingFilenames.add(`audio_${activeClip.filename}`);
            }
        });

        // Pausa qualquer elemento do pool que não esteja ativo agora
        if (this.state.isPlaying) {
            Object.entries(this.state.mediaPool).forEach(([fname, el]) => {
                if (!playingFilenames.has(fname) && !el.paused) {
                    el.pause();
                }
            });
        }
    },

    // Histórico e Undo/Redo
    pushHistoryState(actionLabel = '') {
        const snapshot = {
            label: actionLabel,
            clips: JSON.parse(JSON.stringify(this.state.clips)),
            selectedClipId: this.state.selectedClipId,
            start: this.state.start,
            end: this.state.end,
            includeAudio: this.state.includeAudio,
            audioMuted: this.state.audioMuted,
            outputMode: this.state.outputMode
        };
        this.state.history.push(snapshot);
        if (this.state.history.length > 40) {
            this.state.history.shift();
        }
        this.state.redoStack = [];
        this.updateHistoryButtons();
    },

    undo() {
        if (!this.state.history.length) return;
        const current = {
            clips: JSON.parse(JSON.stringify(this.state.clips)),
            selectedClipId: this.state.selectedClipId,
            start: this.state.start,
            end: this.state.end,
            includeAudio: this.state.includeAudio,
            audioMuted: this.state.audioMuted,
            outputMode: this.state.outputMode
        };
        this.state.redoStack.push(current);
        const previous = this.state.history.pop();
        this.restoreState(previous);
        this.updateHistoryButtons();
        this.showEditorNotification(`Desfeito: ${previous.label || 'Ação anterior'}`);
    },

    redo() {
        if (!this.state.redoStack.length) return;
        const current = {
            clips: JSON.parse(JSON.stringify(this.state.clips)),
            selectedClipId: this.state.selectedClipId,
            start: this.state.start,
            end: this.state.end,
            includeAudio: this.state.includeAudio,
            audioMuted: this.state.audioMuted,
            outputMode: this.state.outputMode
        };
        this.state.history.push(current);
        const next = this.state.redoStack.pop();
        this.restoreState(next);
        this.updateHistoryButtons();
        this.showEditorNotification('Refeito!');
    },

    restoreState(stateObj) {
        if (!stateObj) return;
        this.state.clips = JSON.parse(JSON.stringify(stateObj.clips || []));
        this.state.selectedClipId = stateObj.selectedClipId || null;
        this.state.start = stateObj.start;
        this.state.end = stateObj.end;
        this.state.includeAudio = stateObj.includeAudio;
        this.state.audioMuted = stateObj.audioMuted;
        this.state.outputMode = stateObj.outputMode;
        if (this.DOM.timelineSlider?.noUiSlider) {
            this.DOM.timelineSlider.noUiSlider.set([this.state.start, this.state.end]);
        }
        this.updateTimelineUI();
        this.renderClipsTimeline();
    },

    updateHistoryButtons() {
        if (this.DOM.undoBtn) {
            this.DOM.undoBtn.disabled = this.state.history.length === 0;
        }
        if (this.DOM.redoBtn) {
            this.DOM.redoBtn.disabled = this.state.redoStack.length === 0;
        }
    },

    showEditorNotification(message) {
        if (!this.DOM.editorStatusArea) return;
        this.DOM.editorStatusArea.innerText = message;
        this.DOM.editorStatusArea.style.display = 'block';
        clearTimeout(this.notificationTimer);
        this.notificationTimer = setTimeout(() => {
            this.DOM.editorStatusArea.style.display = 'none';
        }, 2800);
    },

    // Renderização do Conjunto de Pistas (V1..V4 e A1..A4)
    renderTracksUI() {
        const container = this.DOM.timelineTracks;
        if (!container) return;
        container.innerHTML = '';

        this.state.tracks.forEach((track, index) => {
            const isVideo = track.type === 'video';
            const row = document.createElement('div');
            row.className = `track-row ${isVideo ? 'video-track' : 'audio-track'} ${track.minimized ? 'is-minimized' : ''}`;
            row.dataset.trackId = track.id;
            row.dataset.trackIndex = index;
            row.draggable = true;

            // Drag and Drop para reordenar faixas
            row.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', track.id);
                e.dataTransfer.effectAllowed = 'move';
                row.classList.add('is-dragging');
            });
            row.addEventListener('dragend', () => {
                row.classList.remove('is-dragging');
                document.querySelectorAll('.track-row').forEach(r => r.classList.remove('drag-over'));
            });
            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                row.classList.add('drag-over');
            });
            row.addEventListener('dragleave', () => {
                row.classList.remove('drag-over');
            });
            row.addEventListener('drop', (e) => {
                e.preventDefault();
                row.classList.remove('drag-over');
                const draggedTrackId = e.dataTransfer.getData('text/plain');
                if (!draggedTrackId || draggedTrackId === track.id) return;

                const fromIdx = this.state.tracks.findIndex(t => t.id === draggedTrackId);
                const toIdx = this.state.tracks.findIndex(t => t.id === track.id);
                if (fromIdx !== -1 && toIdx !== -1) {
                    this.pushHistoryState('Reordenar faixas');
                    const [moved] = this.state.tracks.splice(fromIdx, 1);
                    this.state.tracks.splice(toIdx, 0, moved);
                    this.renderTracksUI();
                    this.renderCanvasFrame();
                }
            });

            // Encontra todas as faixas vinculadas ao mesmo grupo
            const linkedTracks = this.state.tracks.filter(t => t.linkGroup && t.linkGroup === track.linkGroup);
            const isLinked = linkedTracks.length > 1;
            const linkLabel = isLinked ? `🔗 ${linkedTracks.map(t => t.id.toUpperCase()).join(', ')}` : '⛓️‍💥 Isolada';

            // Rótulo da Pista com Alça de Arraste, Botão de Minimizar, Vínculo de Pistas e Toggle de Visibilidade/Mute
            const label = document.createElement('div');
            label.className = `track-label ${isVideo ? '' : 'audio-track-label'}`;
            label.innerHTML = `
                <div class="track-header-left-col">
                    <button type="button" class="track-minimize-btn" title="${track.minimized ? 'Restaurar faixa' : 'Minimizar faixa'}" aria-label="Minimizar ou restaurar faixa">
                        ${track.minimized ? '□' : '_'}
                    </button>
                    <div class="track-drag-handle" title="Arrastar para reordenar faixa" aria-label="Arrastar para reordenar faixa">
                        <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="8.5" cy="6" r="1.5"/><circle cx="15.5" cy="6" r="1.5"/><circle cx="8.5" cy="12" r="1.5"/><circle cx="15.5" cy="12" r="1.5"/><circle cx="8.5" cy="18" r="1.5"/><circle cx="15.5" cy="18" r="1.5"/></svg>
                    </div>
                </div>
                <span class="track-icon ${isVideo ? 'video-icon' : 'audio-icon'}">${isVideo ? '▣' : '♫'}</span>
                <span class="audio-track-copy">
                    <strong>${track.label}</strong>
                    <button type="button" class="track-link-btn ${isLinked ? 'is-linked' : ''}" title="${isLinked ? 'Pistas vinculadas (clique para isolar)' : 'Pista isolada (clique para vincular)'}">
                        ${linkLabel}
                    </button>
                </span>
                <div class="audio-track-actions">
                    ${isVideo ? `
                        <button class="track-action icon-button track-eye-btn ${track.hidden ? 'is-hidden' : ''}" type="button" title="${track.hidden ? 'Mostrar vídeo' : 'Ocultar vídeo'}">
                            ${track.hidden 
                                ? '<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
                                : '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
                            }
                        </button>
                    ` : `
                        <button class="track-action icon-button track-mute-btn ${track.muted ? 'is-muted' : ''}" type="button" title="${track.muted ? 'Desmutar' : 'Silenciar'} áudio">
                            <svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4zM15 9a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12"/></svg>
                            <span class="mute-slash">／</span>
                        </button>
                    `}
                </div>
            `;

            // Botão Minimizar / Restaurar faixa
            const minBtn = label.querySelector('.track-minimize-btn');
            minBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                track.minimized = !track.minimized;
                this.renderTracksUI();
            });

            // Opções da faixa no cabeçalho: clique com botão esquerdo ou hold (mobile) abre menu da faixa
            this.setupTrackHeaderMenu(label, track);

            // Botão Olho (Visibilidade de Vídeo)
            if (isVideo) {
                const eyeBtn = label.querySelector('.track-eye-btn');
                eyeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    track.hidden = !track.hidden;
                    this.showEditorNotification(`Pista ${track.label} ${track.hidden ? 'ocultada' : 'visível'}.`);
                    this.renderTracksUI();
                    this.renderCanvasFrame();
                });
            } else {
                // Botão Mute da Pista de Áudio
                const muteBtn = label.querySelector('.track-mute-btn');
                muteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    track.muted = !track.muted;
                    muteBtn.classList.toggle('is-muted', track.muted);
                    row.classList.toggle('muted-track', track.muted);
                    this.showEditorNotification(`Pista ${track.label} ${track.muted ? 'silenciada' : 'ativada'}.`);
                });
            }

            // Ação do Botão de Vínculo de Pistas
            const linkBtn = label.querySelector('.track-link-btn');
            linkBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleTrackGroupLink(track.id);
            });

            // Faixa da Timeline (Lane) com suporte a zoom vertical
            const lane = document.createElement('div');
            lane.className = `track-lane ${isVideo ? 'video-lane' : 'audio-lane'}`;
            lane.dataset.trackId = track.id;
            lane.style.height = track.minimized ? '22px' : `${this.state.trackHeight || 54}px`;

            // Suporte a Playhead na pista
            const playhead = document.createElement('div');
            playhead.className = 'timeline-playhead';
            lane.appendChild(playhead);

            // Clique na pista para mover agulha
            lane.addEventListener('click', (e) => {
                if (e.target.closest('.timeline-clip-segment')) return;
                const rect = lane.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                this.seekToTime(ratio * (this.state.videoDuration || 1));
            });

            row.appendChild(label);
            row.appendChild(lane);
            container.appendChild(row);
        });

        this.renderClipsTimeline();
        this.renderTimelineRuler();
    },

    toggleTrackGroupLink(trackId) {
        const track = this.state.tracks.find(t => t.id === trackId);
        if (!track) return;
        this.pushHistoryState('Alterar vínculo de pistas');

        if (track.linkGroup) {
            const oldGroup = track.linkGroup;
            // Remove vínculo desta pista
            track.linkGroup = null;

            // Se restar apenas uma pista no grupo antigo, isola ela também pois vínculo exige 2+ pistas
            const remainingInGroup = this.state.tracks.filter(t => t.linkGroup === oldGroup);
            if (remainingInGroup.length === 1) {
                remainingInGroup[0].linkGroup = null;
            }

            // Desvincula linkedClipId dos clipes desta trilha
            this.state.clips.forEach(clip => {
                if (clip.trackId === track.id) {
                    if (clip.linkedClipId) {
                        const linked = this.state.clips.find(c => c.id === clip.linkedClipId);
                        if (linked) linked.linkedClipId = null;
                        clip.linkedClipId = null;
                    }
                }
            });

            this.showEditorNotification(`Pista ${track.label} agora está isolada.`);
        } else {
            // Tenta vincular com pista de tipo oposto (V1 com A1, V2 com A2, etc)
            const num = track.id.replace(/[^\d]/g, '');
            const targetOppositeId = (track.type === 'video' ? 'a' : 'v') + num;
            const opposite = this.state.tracks.find(t => t.id === targetOppositeId) || this.state.tracks.find(t => t.id !== track.id);
            if (opposite) {
                const groupName = opposite.linkGroup || `g_${Date.now()}`;
                opposite.linkGroup = groupName;
                track.linkGroup = groupName;

                // Restabelece paridade entre clipes alinhados das pistas vinculadas
                this.state.clips.forEach(clip => {
                    if (clip.trackId === track.id && !clip.linkedClipId) {
                        const cand = this.state.clips.find(c => 
                            c.trackId === opposite.id && 
                            Math.abs((c.trackStart || 0) - (clip.trackStart || 0)) < 0.1
                        );
                        if (cand) {
                            clip.linkedClipId = cand.id;
                            cand.linkedClipId = clip.id;
                        }
                    }
                });

                this.showEditorNotification(`Pistas ${track.id.toUpperCase()} e ${opposite.id.toUpperCase()} vinculadas.`);
            }
        }
        this.renderTracksUI();
        this.renderClipsTimeline();
    },

    renderTimelineRuler() {
        const ruler = this.DOM.timelineRuler;
        const canvas = this.DOM.rulerCanvas;
        if (!ruler || !canvas) return;

        const rect = ruler.getBoundingClientRect();
        if (rect.width <= 0) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = 26 * dpr;

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, rect.width, 26);

        const totalDur = this.state.videoDuration || 1;
        // Intervalo de marcas baseado na duração
        let step = 1;
        if (totalDur > 120) step = 10;
        else if (totalDur > 60) step = 5;
        else if (totalDur > 20) step = 2;
        else if (totalDur <= 5) step = 0.5;

        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;

        for (let time = 0; time <= totalDur; time += step) {
            const x = (time / totalDur) * rect.width;
            ctx.beginPath();
            ctx.moveTo(x, 16);
            ctx.lineTo(x, 26);
            ctx.stroke();

            // Texto a cada marca maior
            const label = this.formatTime(time);
            ctx.fillText(label, x, 3);

            // Subdivisões menores
            const subStep = step / 5;
            for (let sub = 1; sub < 5; sub++) {
                const subTime = time + sub * subStep;
                if (subTime > totalDur) break;
                const subX = (subTime / totalDur) * rect.width;
                ctx.beginPath();
                ctx.moveTo(subX, 20);
                ctx.lineTo(subX, 26);
                ctx.stroke();
            }
        }
    },

    setupRulerInteractions() {
        const ruler = this.DOM.timelineRuler;
        if (!ruler) return;

        let isScrubbing = false;

        const seekFromRuler = (clientX) => {
            const rect = ruler.getBoundingClientRect();
            if (rect.width <= 0) return;
            const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            this.seekToTime(ratio * (this.state.videoDuration || 1));
        };

        ruler.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isScrubbing = true;
            seekFromRuler(e.clientX);

            const onMouseMove = (moveEvent) => {
                if (!isScrubbing) return;
                seekFromRuler(moveEvent.clientX);
            };

            const onMouseUp = () => {
                isScrubbing = false;
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });

        window.addEventListener('resize', () => {
            this.renderTimelineRuler();
        });
    },

    renderClipsTimeline() {
        const totalDuration = this.state.videoDuration || 1;

        // Limpa clipes antigos de todas as pistas
        document.querySelectorAll('.track-lane .timeline-clip-segment').forEach(el => el.remove());

        this.state.clips.forEach(clip => {
            const lane = document.querySelector(`.track-lane[data-track-id="${clip.trackId}"]`);
            if (!lane) return;

            const clipEl = document.createElement('div');
            const isAudio = clip.type === 'audio';
            const isSelected = clip.id === this.state.selectedClipId;
            const isLinkedToSelected = this.state.selectedClipId && (
                clip.linkedClipId === this.state.selectedClipId ||
                this.state.clips.find(c => c.id === this.state.selectedClipId)?.linkedClipId === clip.id
            );
            clipEl.className = `timeline-clip-segment ${isAudio ? 'audio-clip' : ''}` + 
                (isSelected ? ' selected' : '') + 
                (isLinkedToSelected && !isSelected ? ' linked-highlight' : '');
            clipEl.dataset.clipId = clip.id;

            const tStart = clip.trackStart || 0;
            const clipDur = (clip.trimEnd || clip.duration) - (clip.trimStart || 0);
            const leftPercent = (tStart / totalDuration) * 100;
            const widthPercent = (clipDur / totalDuration) * 100;

            clipEl.style.left = `${Math.max(0, leftPercent)}%`;
            clipEl.style.width = `${Math.max(1.5, widthPercent)}%`;

            // Alça esquerda de Trim (Encurtar início)
            const trimLeft = document.createElement('div');
            trimLeft.className = 'clip-trim-handle trim-left';
            trimLeft.title = 'Aparar início do clipe';
            this.setupTrimDrag(trimLeft, clip, 'start');

            // Alça direita de Trim (Encurtar fim)
            const trimRight = document.createElement('div');
            trimRight.className = 'clip-trim-handle trim-right';
            trimRight.title = 'Aparar fim do clipe';
            this.setupTrimDrag(trimRight, clip, 'end');

            // Overlay e Alça Triangular de Fade In
            const fadeInHandle = document.createElement('div');
            fadeInHandle.className = 'clip-fade-handle fade-in-handle' + (clip.transitionIn ? ' active' : '');
            fadeInHandle.title = clip.transitionIn ? `Fade In (${clip.transitionIn.duration}s)` : 'Adicionar Fade In';
            fadeInHandle.innerHTML = '◢';
            fadeInHandle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleClipTransition(clip.id, 'in');
            });

            if (clip.transitionIn) {
                const fadeInOverlay = document.createElement('div');
                fadeInOverlay.className = 'clip-fade-overlay clip-fade-in';
                const fDur = clip.transitionIn.duration || 0.5;
                const fWidth = Math.min(100, (fDur / Math.max(0.1, clipDur)) * 100);
                fadeInOverlay.style.width = `${fWidth}%`;
                clipEl.appendChild(fadeInOverlay);
            }

            // Overlay e Alça Triangular de Fade Out
            const fadeOutHandle = document.createElement('div');
            fadeOutHandle.className = 'clip-fade-handle fade-out-handle' + (clip.transitionOut ? ' active' : '');
            fadeOutHandle.title = clip.transitionOut ? `Fade Out (${clip.transitionOut.duration}s)` : 'Adicionar Fade Out';
            fadeOutHandle.innerHTML = '◣';
            fadeOutHandle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleClipTransition(clip.id, 'out');
            });

            if (clip.transitionOut) {
                const fadeOutOverlay = document.createElement('div');
                fadeOutOverlay.className = 'clip-fade-overlay clip-fade-out';
                const fDur = clip.transitionOut.duration || 0.5;
                const fWidth = Math.min(100, (fDur / Math.max(0.1, clipDur)) * 100);
                fadeOutOverlay.style.width = `${fWidth}%`;
                clipEl.appendChild(fadeOutOverlay);
            }

            // Miniaturas visuais para clips de vídeo
            if (!isAudio && clip.mediaInfo?.videoPreviews?.length) {
                const previewsWrap = document.createElement('div');
                previewsWrap.className = 'clip-previews-bg';
                clip.mediaInfo.videoPreviews.forEach(thumbFile => {
                    if (!thumbFile) return;
                    const img = document.createElement('img');
                    img.src = `/videos/${encodeURIComponent(thumbFile)}`;
                    img.alt = '';
                    img.draggable = false;
                    previewsWrap.appendChild(img);
                });
                clipEl.appendChild(previewsWrap);
            }

            // Forma de onda para clips de áudio
            if (isAudio && clip.mediaInfo?.audioWaveform) {
                const waveImg = document.createElement('img');
                waveImg.src = `/videos/${encodeURIComponent(clip.mediaInfo.audioWaveform)}`;
                waveImg.className = 'clip-waveform-bg';
                waveImg.alt = '';
                waveImg.draggable = false;
                clipEl.appendChild(waveImg);
            }

            // Nome e Duração
            const titleEl = document.createElement('span');
            titleEl.className = 'clip-segment-title';
            titleEl.innerText = `${clip.name} (${this.formatTime(clipDur)})`;

            clipEl.appendChild(trimLeft);
            clipEl.appendChild(fadeInHandle);
            clipEl.appendChild(titleEl);
            clipEl.appendChild(fadeOutHandle);
            clipEl.appendChild(trimRight);

            // Clique para seleção e destaque do par vinculado
            clipEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.state.selectedClipId = clip.id;
                this.renderClipsTimeline();
            });

            // Menu de Contexto (Desktop: Botão Direito / Mobile: Long Press)
            this.setupClipContextMenu(clipEl, clip);

            // Arraste livre horizontal do clipe
            this.setupClipDrag(clipEl, clip, lane);

            lane.appendChild(clipEl);
        });
    },

    setupClipDrag(clipEl, clip, lane) {
        let startX = 0;
        let origTrackStart = 0;
        let isDragging = false;
        let linkedTrackClips = [];

        const onMouseDown = (e) => {
            if (e.target.closest('.clip-trim-handle, .clip-fade-handle')) return;
            e.preventDefault();
            startX = e.clientX;
            origTrackStart = clip.trackStart || 0;
            isDragging = true;
            this.state.selectedClipId = clip.id;

            // Determina se a pista atual faz parte de um grupo vinculado
            const currentTrack = this.state.tracks.find(t => t.id === clip.trackId);
            linkedTrackClips = [];
            const isTrackLinked = Boolean(currentTrack && currentTrack.linkGroup);

            if (isTrackLinked) {
                const groupTrackIds = new Set(
                    this.state.tracks
                        .filter(t => t.linkGroup === currentTrack.linkGroup)
                        .map(t => t.id)
                );
                // Encontra clipes em pistas do mesmo linkGroup que estão sincronizados/alinhados
                linkedTrackClips = this.state.clips
                    .filter(c => c.id !== clip.id && groupTrackIds.has(c.trackId) && Math.abs((c.trackStart || 0) - origTrackStart) < 0.05)
                    .map(c => ({ clip: c, origStart: c.trackStart || 0 }));
            }

            const onMouseMove = (moveEvent) => {
                if (!isDragging) return;
                const laneRect = lane.getBoundingClientRect();
                const deltaX = moveEvent.clientX - startX;
                const totalDur = this.state.videoDuration || 1;
                const deltaSeconds = (deltaX / laneRect.width) * totalDur;

                const newStart = Math.max(0, origTrackStart + deltaSeconds);
                const actualDelta = newStart - origTrackStart;
                clip.trackStart = newStart;

                // Move clipe linkado direto (áudio/vídeo) apenas se as trilhas estiverem vinculadas
                if (isTrackLinked && clip.linkedClipId) {
                    const linked = this.state.clips.find(c => c.id === clip.linkedClipId);
                    if (linked) {
                        linked.trackStart = newStart;
                        const linkedEl = document.querySelector(`.timeline-clip-segment[data-clip-id="${linked.id}"]`);
                        if (linkedEl) {
                            linkedEl.style.left = `${(newStart / totalDur) * 100}%`;
                        }
                    }
                }

                // Move todos os clipes de pistas vinculadas por grupo
                linkedTrackClips.forEach(item => {
                    const s = Math.max(0, item.origStart + actualDelta);
                    item.clip.trackStart = s;
                    const el = document.querySelector(`.timeline-clip-segment[data-clip-id="${item.clip.id}"]`);
                    if (el) {
                        el.style.left = `${(s / totalDur) * 100}%`;
                    }
                });

                const leftPercent = (newStart / totalDur) * 100;
                clipEl.style.left = `${leftPercent}%`;
            };

            const onMouseUp = () => {
                if (isDragging) {
                    isDragging = false;
                    // Recalcula a duração total do projeto baseada no fim do último clipe
                    this.recalculateProjectDuration();
                    this.pushHistoryState('Mover clipe na timeline');
                    this.renderClipsTimeline();
                    this.renderCanvasFrame();
                }
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        };

        clipEl.addEventListener('mousedown', onMouseDown);
    },

    setupTrimDrag(handleEl, clip, edge) {
        handleEl.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const startX = e.clientX;
            const origTrimStart = clip.trimStart || 0;
            const origTrimEnd = clip.trimEnd || clip.duration;
            const origTrackStart = clip.trackStart || 0;
            const totalDur = this.state.videoDuration || 1;
            const lane = handleEl.closest('.track-lane');

            // Encontra itens de pistas vinculadas
            const currentTrack = this.state.tracks.find(t => t.id === clip.trackId);
            let linkedTrackClips = [];
            const isTrackLinked = Boolean(currentTrack && currentTrack.linkGroup);

            if (isTrackLinked) {
                const groupTrackIds = new Set(
                    this.state.tracks
                        .filter(t => t.linkGroup === currentTrack.linkGroup)
                        .map(t => t.id)
                );
                linkedTrackClips = this.state.clips
                    .filter(c => c.id !== clip.id && groupTrackIds.has(c.trackId) && Math.abs((c.trackStart || 0) - origTrackStart) < 0.05)
                    .map(c => ({
                        clip: c,
                        origTrackStart: c.trackStart || 0,
                        origTrimStart: c.trimStart || 0,
                        origTrimEnd: c.trimEnd || c.duration
                    }));
            }

            const onMouseMove = (moveEvent) => {
                const laneRect = lane.getBoundingClientRect();
                const deltaSec = ((moveEvent.clientX - startX) / laneRect.width) * totalDur;

                if (edge === 'start') {
                    // Ao diminuir da esquerda, a borda direita permanece fixa no tempo global:
                    // candidateTrimStart varia entre 0 e origTrimEnd - 0.2
                    const candidateTrimStart = Math.max(0, Math.min(origTrimEnd - 0.2, origTrimStart + deltaSec));
                    const actualTrimDelta = candidateTrimStart - origTrimStart;
                    const candidateTrackStart = Math.max(0, origTrackStart + actualTrimDelta);

                    clip.trimStart = candidateTrimStart;
                    clip.trackStart = candidateTrackStart;

                    if (isTrackLinked && clip.linkedClipId) {
                        const linked = this.state.clips.find(c => c.id === clip.linkedClipId);
                        if (linked) {
                            linked.trimStart = candidateTrimStart;
                            linked.trackStart = candidateTrackStart;
                        }
                    }

                    linkedTrackClips.forEach(item => {
                        const itemCandidateTrim = Math.max(0, Math.min(item.origTrimEnd - 0.2, item.origTrimStart + actualTrimDelta));
                        item.clip.trimStart = itemCandidateTrim;
                        item.clip.trackStart = Math.max(0, item.origTrackStart + actualTrimDelta);
                    });
                } else {
                    // Ao diminuir da direita, o trackStart permanece fixo e apenas trimEnd muda
                    const candidate = Math.max((clip.trimStart || 0) + 0.2, Math.min(clip.duration, origTrimEnd + deltaSec));
                    clip.trimEnd = candidate;
                    if (isTrackLinked && clip.linkedClipId) {
                        const linked = this.state.clips.find(c => c.id === clip.linkedClipId);
                        if (linked) linked.trimEnd = candidate;
                    }
                    linkedTrackClips.forEach(item => {
                        item.clip.trimEnd = Math.max((item.clip.trimStart || 0) + 0.2, Math.min(item.clip.duration, item.origTrimEnd + deltaSec));
                    });
                }
                this.renderClipsTimeline();
            };

            const onMouseUp = () => {
                this.recalculateProjectDuration();
                this.pushHistoryState('Aparar clipe');
                this.renderClipsTimeline();
                this.renderCanvasFrame();
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    },

    recalculateProjectDuration() {
        if (!this.state.clips || this.state.clips.length === 0) return;
        let maxEnd = 0;
        this.state.clips.forEach(c => {
            const cStart = c.trackStart || 0;
            const cDur = (c.trimEnd || c.duration) - (c.trimStart || 0);
            const cEnd = cStart + cDur;
            if (cEnd > maxEnd) maxEnd = cEnd;
        });

        if (maxEnd > 0) {
            this.state.videoDuration = maxEnd;
            if (this.state.end > maxEnd || this.state.end <= 0) {
                this.state.end = maxEnd;
            }
            if (this.state.start >= this.state.end) {
                this.state.start = 0;
            }
            if (this.DOM.timelineSlider?.noUiSlider) {
                this.DOM.timelineSlider.noUiSlider.updateOptions({
                    range: { 'min': 0, 'max': this.state.videoDuration }
                });
                this.DOM.timelineSlider.noUiSlider.set([this.state.start, this.state.end]);
            }
            this.updateTimelineUI();
            this.updatePlayhead();
            this.renderTimelineRuler();
        }
    },

    // Operações de Edição Multipista: Split (S) e Delete
    splitClipAtCursor() {
        const currentTime = this.state.currentTime || 0;
        if (!this.state.clips.length) return;

        let targetClip = null;
        let targetIndex = -1;

        if (this.state.selectedClipId) {
            targetIndex = this.state.clips.findIndex(c => c.id === this.state.selectedClipId);
            const sel = this.state.clips[targetIndex];
            const tStart = sel?.trackStart || 0;
            const tEnd = tStart + ((sel?.trimEnd || sel?.duration) - (sel?.trimStart || 0));
            if (sel && currentTime > tStart + 0.1 && currentTime < tEnd - 0.1) {
                targetClip = sel;
            }
        }

        if (!targetClip) {
            targetIndex = this.state.clips.findIndex(c => {
                const tStart = c.trackStart || 0;
                const tEnd = tStart + ((c.trimEnd || c.duration) - (c.trimStart || 0));
                return currentTime > tStart + 0.1 && currentTime < tEnd - 0.1;
            });
            if (targetIndex !== -1) targetClip = this.state.clips[targetIndex];
        }

        if (!targetClip || targetIndex === -1) {
            this.showEditorNotification('O cursor deve estar sobre o clipe selecionado para dividir.');
            return;
        }

        this.pushHistoryState('Dividir clipe (Split)');
        const tStart = targetClip.trackStart || 0;
        const offsetInClip = currentTime - tStart;
        const originalTrimStart = targetClip.trimStart || 0;
        const originalTrimEnd = targetClip.trimEnd || targetClip.duration;
        const splitOffset = originalTrimStart + offsetInClip;

        // Identifica clipe irmão vinculado (áudio ou vídeo)
        let linkedClip = null;
        let linkedIndex = -1;
        if (targetClip.linkedClipId) {
            linkedIndex = this.state.clips.findIndex(c => c.id === targetClip.linkedClipId);
            if (linkedIndex !== -1) linkedClip = this.state.clips[linkedIndex];
        }

        const idSuffix = Date.now();
        const leftClipId = 'clip_' + idSuffix + '_a';
        const rightClipId = 'clip_' + idSuffix + '_b';
        const leftLinkId = linkedClip ? 'clip_link_' + idSuffix + '_a' : null;
        const rightLinkId = linkedClip ? 'clip_link_' + idSuffix + '_b' : null;

        const leftClip = {
            ...targetClip,
            id: leftClipId,
            trimEnd: splitOffset,
            transitionOut: null,
            linkedClipId: leftLinkId
        };

        const rightClip = {
            ...targetClip,
            id: rightClipId,
            trackStart: currentTime,
            trimStart: splitOffset,
            trimEnd: originalTrimEnd,
            transitionIn: null,
            linkedClipId: rightLinkId
        };

        this.state.clips.splice(targetIndex, 1, leftClip, rightClip);
        this.state.selectedClipId = rightClip.id;

        // Se houver clipe vinculado (seja áudio ou vídeo), divide exatamente no mesmo ponto e mantém os pares vinculados
        if (linkedClip && linkedIndex !== -1) {
            // Reencontra o índice do linkedClip (caso tenha mudado pelo splice anterior)
            const currentLinkedIndex = this.state.clips.findIndex(c => c.id === linkedClip.id);
            if (currentLinkedIndex !== -1) {
                const lOrigTrimStart = linkedClip.trimStart || 0;
                const lOrigTrimEnd = linkedClip.trimEnd || linkedClip.duration;
                const lSplitOffset = lOrigTrimStart + offsetInClip;

                const leftLinkedClip = {
                    ...linkedClip,
                    id: leftLinkId,
                    trimEnd: lSplitOffset,
                    transitionOut: null,
                    linkedClipId: leftClipId
                };
                const rightLinkedClip = {
                    ...linkedClip,
                    id: rightLinkId,
                    trackStart: currentTime,
                    trimStart: lSplitOffset,
                    trimEnd: lOrigTrimEnd,
                    transitionIn: null,
                    linkedClipId: rightClipId
                };
                this.state.clips.splice(currentLinkedIndex, 1, leftLinkedClip, rightLinkedClip);
            }
        }

        this.recalculateProjectDuration();
        this.renderClipsTimeline();
        this.renderCanvasFrame();
        this.showEditorNotification(`Clipe dividido em ${this.formatTime(currentTime)}`);
    },

    deleteSelectedClip() {
        if (!this.state.selectedClipId || this.state.clips.length <= 1) {
            this.showEditorNotification(this.state.clips.length <= 1 ? 'A timeline deve ter ao menos um clipe.' : 'Nenhum clipe selecionado para excluir.');
            return;
        }
        const index = this.state.clips.findIndex(c => c.id === this.state.selectedClipId);
        if (index === -1) return;

        this.pushHistoryState('Excluir clipe');
        const deleted = this.state.clips.splice(index, 1)[0];
        // Se tinha clipe linkado, desvincula
        if (deleted.linkedClipId) {
            const linked = this.state.clips.find(c => c.id === deleted.linkedClipId);
            if (linked) linked.linkedClipId = null;
        }
        this.state.selectedClipId = this.state.clips[Math.max(0, index - 1)].id;
        this.recalculateProjectDuration();
        this.renderClipsTimeline();
        this.renderCanvasFrame();
        this.showEditorNotification(`Clipe excluído.`);
    },

    duplicateSelectedClip() {
        if (!this.state.selectedClipId) {
            this.showEditorNotification('Selecione um clipe para duplicar sua faixa.');
            return;
        }

        const clip = this.state.clips.find(c => c.id === this.state.selectedClipId);
        if (!clip) return;

        this.pushHistoryState(`Duplicar faixa de ${clip.type === 'video' ? 'vídeo' : 'áudio'}`);

        // Encontra o próximo ID disponível para criar uma nova faixa independente do mesmo tipo
        const isVideo = clip.type === 'video';
        const typePrefix = isVideo ? 'v' : 'a';
        let nextIndex = 1;
        while (this.state.tracks.some(t => t.id === `${typePrefix}${nextIndex}`)) {
            nextIndex++;
        }
        const newTrackId = `${typePrefix}${nextIndex}`;
        const newTrackLabel = `${isVideo ? 'Vídeo' : 'Áudio'} ${nextIndex} (${newTrackId.toUpperCase()})`;

        // Cria a nova faixa independente (sem vínculo ativo por padrão)
        this.state.tracks.push({
            id: newTrackId,
            type: clip.type,
            label: newTrackLabel,
            muted: false,
            hidden: false,
            linkGroup: null
        });

        const idSuffix = Date.now();
        const newClipId = 'clip_dup_' + idSuffix;

        // Clona apenas este clipe (só vídeo ou só áudio) na nova faixa dedicada
        const clonedClip = {
            ...clip,
            id: newClipId,
            trackId: newTrackId,
            name: `${clip.name} (cópia)`,
            trackStart: clip.trackStart || 0,
            linkedClipId: null
        };

        this.state.clips.push(clonedClip);
        this.state.selectedClipId = newClipId;

        this.recalculateProjectDuration();
        this.renderTracksUI();
        this.renderClipsTimeline();
        this.renderCanvasFrame();
        this.showEditorNotification(`Faixa duplicada em nova pista: ${newTrackId.toUpperCase()}.`);
    },

    toggleClipLink(clipId) {
        const clip = this.state.clips.find(c => c.id === clipId);
        if (!clip) return;
        this.pushHistoryState(clip.linkedClipId ? 'Desvincular áudio e vídeo' : 'Vincular áudio e vídeo');

        if (clip.linkedClipId) {
            // Desvincula ambos
            const linked = this.state.clips.find(c => c.id === clip.linkedClipId);
            clip.linkedClipId = null;
            if (linked) linked.linkedClipId = null;
            this.showEditorNotification('Áudio e vídeo desvinculados para edição separada.');
        } else {
            // Tenta reencontrar par na mesma posição de outra trilha
            const oppositeType = clip.type === 'video' ? 'audio' : 'video';
            const candidate = this.state.clips.find(c => 
                c.type === oppositeType && 
                c.filename === clip.filename &&
                Math.abs((c.trackStart || 0) - (clip.trackStart || 0)) < 0.1
            );
            if (candidate) {
                clip.linkedClipId = candidate.id;
                candidate.linkedClipId = clip.id;
                this.showEditorNotification('Áudio e vídeo vinculados.');
            } else {
                this.showEditorNotification('Nenhum clipe correspondente alinhado nesta posição para vincular.');
            }
        }
        this.renderClipsTimeline();
    },

    toggleClipTransition(clipId, direction) {
        const clip = this.state.clips.find(c => c.id === clipId);
        if (!clip) return;
        this.pushHistoryState('Alterar transição do clipe');
        const key = direction === 'in' ? 'transitionIn' : 'transitionOut';
        if (clip[key]) {
            clip[key] = null;
            this.showEditorNotification(`Transição removida.`);
        } else {
            clip[key] = { type: 'fade', duration: 0.5 };
            this.showEditorNotification(`Transição de fade (${direction}) ativada.`);
        }
        this.renderClipsTimeline();
    },

    // Menu de Contexto e Ações Rápidas (Desktop: Botão Direito / Mobile: Long Press)
    setupClipContextMenu(clipEl, clip) {
        // Desktop: Right Click
        clipEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.state.selectedClipId = clip.id;
            this.renderClipsTimeline();
            this.openContextMenu(e.clientX, e.clientY, clip);
        });

        // Mobile: Long-press (Hold de 500ms)
        let touchTimer = null;
        let startTouchX = 0;
        let startTouchY = 0;

        clipEl.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const touch = e.touches[0];
            startTouchX = touch.clientX;
            startTouchY = touch.clientY;
            touchTimer = setTimeout(() => {
                this.state.selectedClipId = clip.id;
                this.renderClipsTimeline();
                this.openContextMenu(touch.clientX, touch.clientY, clip);
            }, 500);
        }, { passive: true });

        clipEl.addEventListener('touchmove', (e) => {
            if (!touchTimer || !e.touches[0]) return;
            const deltaX = Math.abs(e.touches[0].clientX - startTouchX);
            const deltaY = Math.abs(e.touches[0].clientY - startTouchY);
            if (deltaX > 10 || deltaY > 10) {
                clearTimeout(touchTimer);
                touchTimer = null;
            }
        }, { passive: true });

        clipEl.addEventListener('touchend', () => {
            if (touchTimer) {
                clearTimeout(touchTimer);
                touchTimer = null;
            }
        });
        clipEl.addEventListener('touchcancel', () => {
            if (touchTimer) {
                clearTimeout(touchTimer);
                touchTimer = null;
            }
        });
    },

    setupTrackHeaderMenu(labelEl, track) {
        // Menu de contexto com botão esquerdo ou hold no mobile
        labelEl.addEventListener('click', (e) => {
            if (e.target.closest('.track-minimize-btn, .track-link-btn, .track-action, .track-drag-handle')) return;
            this.state.contextMenuTrackId = track.id;
            this.openTrackContextMenu(e.clientX, e.clientY, track);
        });

        // Mobile: Long-press / Hold
        let holdTimer = null;
        let startX = 0;
        let startY = 0;

        labelEl.addEventListener('touchstart', (e) => {
            if (e.target.closest('.track-minimize-btn, .track-link-btn, .track-action, .track-drag-handle')) return;
            if (e.touches.length !== 1) return;
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            holdTimer = setTimeout(() => {
                this.state.contextMenuTrackId = track.id;
                this.openTrackContextMenu(touch.clientX, touch.clientY, track);
            }, 450);
        }, { passive: true });

        labelEl.addEventListener('touchmove', (e) => {
            if (!holdTimer || !e.touches[0]) return;
            const dx = Math.abs(e.touches[0].clientX - startX);
            const dy = Math.abs(e.touches[0].clientY - startY);
            if (dx > 10 || dy > 10) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
        }, { passive: true });

        labelEl.addEventListener('touchend', () => {
            if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        });
        labelEl.addEventListener('touchcancel', () => {
            if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        });
    },

    openTrackContextMenu(x, y, track) {
        const menu = this.DOM.trackContextMenu;
        if (!menu) return;

        menu.style.display = 'flex';
        const rect = menu.getBoundingClientRect();
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        const posX = (x + rect.width > winWidth) ? Math.max(10, winWidth - rect.width - 10) : x;
        const posY = (y + rect.height > winHeight) ? Math.max(10, winHeight - rect.height - 10) : y;

        menu.style.left = `${posX}px`;
        menu.style.top = `${posY}px`;
    },

    closeTrackContextMenu() {
        if (this.DOM.trackContextMenu) {
            this.DOM.trackContextMenu.style.display = 'none';
        }
    },

    duplicateTrack(trackId) {
        const track = this.state.tracks.find(t => t.id === trackId);
        if (!track) return;
        this.pushHistoryState(`Duplicar faixa ${track.label}`);

        const isVideo = track.type === 'video';
        const typePrefix = isVideo ? 'v' : 'a';
        let nextIndex = 1;
        while (this.state.tracks.some(t => t.id === `${typePrefix}${nextIndex}`)) {
            nextIndex++;
        }
        const newTrackId = `${typePrefix}${nextIndex}`;
        const newTrackLabel = `${isVideo ? 'Vídeo' : 'Áudio'} ${nextIndex} (${newTrackId.toUpperCase()})`;

        this.state.tracks.push({
            id: newTrackId,
            type: track.type,
            label: newTrackLabel,
            muted: track.muted || false,
            hidden: track.hidden || false,
            minimized: track.minimized || false,
            linkGroup: null
        });

        // Clona todos os clipes da faixa original para a nova faixa
        const sourceClips = this.state.clips.filter(c => c.trackId === track.id);
        sourceClips.forEach(c => {
            this.state.clips.push({
                ...c,
                id: `clip_${newTrackId}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                trackId: newTrackId,
                linkedClipId: null
            });
        });

        this.recalculateProjectDuration();
        this.renderTracksUI();
        this.renderCanvasFrame();
        this.showEditorNotification(`Faixa ${newTrackLabel} duplicada.`);
    },

    copyTrackClips(trackId) {
        const trackClips = this.state.clips.filter(c => c.trackId === trackId);
        if (trackClips.length === 0) {
            this.showEditorNotification('Esta faixa não contém clipes para copiar.');
            return;
        }
        this.state.clipboardClip = JSON.parse(JSON.stringify(trackClips[0]));
        this.showEditorNotification(`${trackClips.length} clipe(s) da faixa copiado(s).`);
    },

    removeTrack(trackId) {
        if (this.state.tracks.length <= 1) {
            this.showEditorNotification('O projeto deve ter ao menos uma faixa.');
            return;
        }
        const trackIndex = this.state.tracks.findIndex(t => t.id === trackId);
        if (trackIndex === -1) return;

        this.pushHistoryState(`Remover faixa ${this.state.tracks[trackIndex].label}`);
        const [removed] = this.state.tracks.splice(trackIndex, 1);

        // Remove clipes da faixa e desvincula se necessário
        this.state.clips = this.state.clips.filter(c => {
            if (c.trackId === trackId) {
                if (c.linkedClipId) {
                    const linked = this.state.clips.find(other => other.id === c.linkedClipId);
                    if (linked) linked.linkedClipId = null;
                }
                return false;
            }
            return true;
        });

        this.recalculateProjectDuration();
        this.renderTracksUI();
        this.renderCanvasFrame();
        this.showEditorNotification(`Faixa ${removed.label} removida.`);
    },

    setupContextMenu() {
        const menu = this.DOM.contextMenu;
        if (!menu) return;

        // Clique nas ações do menu
        menu.addEventListener('click', (e) => {
            const btn = e.target.closest('.ctx-item');
            if (!btn) return;
            const action = btn.dataset.action;
            this.handleContextMenuAction(action);
            this.closeContextMenu();
        });

        // Fecha menu ao clicar fora ou rolar
        window.addEventListener('click', (e) => {
            if (!e.target.closest('#timelineContextMenu')) {
                this.closeContextMenu();
            }
            if (!e.target.closest('#trackContextMenu')) {
                this.closeTrackContextMenu();
            }
        });

        window.addEventListener('scroll', () => {
            this.closeContextMenu();
            this.closeTrackContextMenu();
        }, true);

        // Menu de contexto da faixa
        const trackMenu = this.DOM.trackContextMenu;
        if (trackMenu) {
            trackMenu.addEventListener('click', (e) => {
                const btn = e.target.closest('.ctx-item');
                if (!btn) return;
                const action = btn.dataset.action;
                const trackId = this.state.contextMenuTrackId;
                if (action === 'duplicate-track') {
                    this.duplicateTrack(trackId);
                } else if (action === 'copy-track') {
                    this.copyTrackClips(trackId);
                } else if (action === 'delete-track') {
                    this.removeTrack(trackId);
                }
                this.closeTrackContextMenu();
            });
        }
    },

    openContextMenu(x, y, clip) {
        const menu = this.DOM.contextMenu;
        if (!menu) return;

        menu.style.display = 'flex';
        // Ajusta posição respeitando bordas da janela
        const rect = menu.getBoundingClientRect();
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        const posX = (x + rect.width > winWidth) ? Math.max(10, winWidth - rect.width - 10) : x;
        const posY = (y + rect.height > winHeight) ? Math.max(10, winHeight - rect.height - 10) : y;

        menu.style.left = `${posX}px`;
        menu.style.top = `${posY}px`;
    },

    closeContextMenu() {
        if (this.DOM.contextMenu) {
            this.DOM.contextMenu.style.display = 'none';
        }
    },

    handleContextMenuAction(action) {
        if (!action) return;
        const selClip = this.state.clips.find(c => c.id === this.state.selectedClipId);

        switch (action) {
            case 'split':
                this.splitClipAtCursor();
                break;
            case 'duplicate':
                this.duplicateSelectedClip();
                break;
            case 'copy':
                if (selClip) {
                    this.state.clipboardClip = JSON.parse(JSON.stringify(selClip));
                    this.showEditorNotification(`Clipe "${selClip.name}" copiado para a área de transferência.`);
                }
                break;
            case 'paste':
                this.pasteClipAtCursor();
                break;
            case 'fade-in':
                if (selClip) this.toggleClipTransition(selClip.id, 'in');
                break;
            case 'fade-out':
                if (selClip) this.toggleClipTransition(selClip.id, 'out');
                break;
            case 'delete':
                this.deleteSelectedClip();
                break;
        }
    },

    pasteClipAtCursor() {
        if (!this.state.clipboardClip) {
            this.showEditorNotification('Nenhum clipe na área de transferência para colar.');
            return;
        }
        this.pushHistoryState('Colar clipe');

        const baseClip = this.state.clipboardClip;
        const idSuffix = Date.now();
        const newTrackStart = this.state.currentTime || 0;
        const pastedClip = {
            ...baseClip,
            id: 'clip_pasted_' + idSuffix,
            name: `${baseClip.name} (colado)`,
            trackStart: newTrackStart,
            linkedClipId: null
        };

        this.state.clips.push(pastedClip);
        this.state.selectedClipId = pastedClip.id;
        this.recalculateProjectDuration();
        this.renderClipsTimeline();
        this.renderCanvasFrame();
        this.showEditorNotification(`Clipe colado em ${this.formatTime(newTrackStart)}.`);
    },

    // Zoom Horizontal (Tempo) e Vertical (Altura das faixas)
    setupZoomAndScrollInteractions() {
        const tracksContainer = this.DOM.timelineTracks;
        const rulerContainer = this.DOM.timelineRuler;

        const handleWheel = (e) => {
            const hasCtrl = e.ctrlKey || e.metaKey;
            const hasAlt = e.altKey;

            if (!hasCtrl && !hasAlt) return;
            e.preventDefault();

            if (hasAlt) {
                // Zoom Horizontal (Escala de tempo)
                const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
                const newZoom = Math.max(0.5, Math.min(5.0, (this.state.zoomLevel || 1.0) * zoomFactor));
                this.state.zoomLevel = newZoom;
                
                // Aplica escala às lanes e régua
                const zoomPercent = (this.state.zoomLevel * 100).toFixed(0);
                document.querySelectorAll('.track-lane').forEach(el => {
                    el.style.width = `${zoomPercent}%`;
                });
                if (rulerContainer) {
                    rulerContainer.style.width = `${zoomPercent}%`;
                }
                this.renderClipsTimeline();
                this.renderTimelineRuler();
                this.updatePlayhead();
                this.showEditorNotification(`Zoom horizontal: ${(this.state.zoomLevel * 100).toFixed(0)}%`);
            } else if (hasCtrl) {
                // Zoom Vertical (Altura das faixas)
                const heightDelta = e.deltaY < 0 ? 6 : -6;
                const newHeight = Math.max(36, Math.min(120, (this.state.trackHeight || 54) + heightDelta));
                this.state.trackHeight = newHeight;
                document.querySelectorAll('.track-lane').forEach(el => {
                    el.style.height = `${newHeight}px`;
                });
                this.showEditorNotification(`Altura da faixa: ${newHeight}px`);
            }
        };

        if (tracksContainer) {
            tracksContainer.addEventListener('wheel', handleWheel, { passive: false });
        }
        if (rulerContainer) {
            rulerContainer.addEventListener('wheel', handleWheel, { passive: false });
        }

        // Pinch-to-zoom em dispositivos móveis
        let initialPinchDistance = null;
        let pinchMode = null; // 'time' ou 'height'

        const onTouchStart = (e) => {
            if (e.touches.length === 2) {
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                initialPinchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                const isOverHeader = Boolean(e.target.closest('.track-label, .ruler-corner'));
                pinchMode = isOverHeader ? 'height' : 'time';
            }
        };

        const onTouchMove = (e) => {
            if (e.touches.length === 2 && initialPinchDistance) {
                e.preventDefault();
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                const ratio = currentDist / initialPinchDistance;

                if (pinchMode === 'time') {
                    const newZoom = Math.max(0.5, Math.min(5.0, (this.state.zoomLevel || 1.0) * (ratio > 1 ? 1.05 : 0.95)));
                    this.state.zoomLevel = newZoom;
                    const zoomPercent = (this.state.zoomLevel * 100).toFixed(0);
                    document.querySelectorAll('.track-lane').forEach(el => {
                        el.style.width = `${zoomPercent}%`;
                    });
                    if (rulerContainer) rulerContainer.style.width = `${zoomPercent}%`;
                    this.renderClipsTimeline();
                    this.renderTimelineRuler();
                } else if (pinchMode === 'height') {
                    const delta = ratio > 1 ? 2 : -2;
                    const newHeight = Math.max(36, Math.min(120, (this.state.trackHeight || 54) + delta));
                    this.state.trackHeight = newHeight;
                    document.querySelectorAll('.track-lane').forEach(el => {
                        el.style.height = `${newHeight}px`;
                    });
                }
                initialPinchDistance = currentDist;
            }
        };

        const onTouchEnd = () => {
            initialPinchDistance = null;
            pinchMode = null;
        };

        if (tracksContainer) {
            tracksContainer.addEventListener('touchstart', onTouchStart, { passive: false });
            tracksContainer.addEventListener('touchmove', onTouchMove, { passive: false });
            tracksContainer.addEventListener('touchend', onTouchEnd);
        }
    },

    handleShortcut(event) {
        // Atalhos de Undo / Redo
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            if (event.shiftKey) {
                this.redo();
            } else {
                this.undo();
            }
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
            event.preventDefault();
            this.redo();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            if (window.VidCutUI && window.VidCutUI.openSearchModal) {
                window.VidCutUI.openSearchModal();
            }
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
            event.preventDefault();
            this.duplicateSelectedClip();
            return;
        }

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
            s: () => this.splitClipAtCursor(),
            Delete: () => this.deleteSelectedClip(),
            Backspace: () => this.deleteSelectedClip(),
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
        if (this.DOM.startTimeInput) this.DOM.startTimeInput.value = this.formatTime(this.state.start);
        if (this.DOM.endTimeInput) this.DOM.endTimeInput.value = this.formatTime(this.state.end);
        if (this.DOM.selectionDuration) {
            this.DOM.selectionDuration.innerText = `${this.formatTime(this.state.end - this.state.start).replace('.', ',')} selecionados`;
        }
        const duration = this.state.videoDuration || 1;
        const leftPercent = Math.max(0, Math.min(100, (this.state.start / duration) * 100));
        const widthPercent = Math.max(0, Math.min(100 - leftPercent, ((this.state.end - this.state.start) / duration) * 100));

        if (this.DOM.rulerSelectionHighlight) {
            this.DOM.rulerSelectionHighlight.style.left = `${leftPercent}%`;
            this.DOM.rulerSelectionHighlight.style.width = `${widthPercent}%`;
        }
        if (this.DOM.videoSelectionOverlay) {
            this.DOM.videoSelectionOverlay.style.left = `${leftPercent}%`;
            this.DOM.videoSelectionOverlay.style.width = `${widthPercent}%`;
        }
        if (this.DOM.audioSelectionOverlay) {
            this.DOM.audioSelectionOverlay.style.left = `${leftPercent}%`;
            this.DOM.audioSelectionOverlay.style.width = `${widthPercent}%`;
        }
        this.generateCommand();
    },

    updatePlayhead() {
        const duration = this.state.videoDuration;
        if (!Number.isFinite(duration) || duration <= 0) return;
        const currentT = this.state.currentTime || 0;
        const ratio = Math.max(0, Math.min(1, currentT / duration));
        const position = `${ratio * 100}%`;
        document.querySelectorAll('.track-lane .timeline-playhead').forEach(el => {
            el.style.left = position;
        });
        if (this.DOM.rulerPlayhead) this.DOM.rulerPlayhead.style.left = position;
        if (this.DOM.videoPlayhead) this.DOM.videoPlayhead.style.left = position;
        if (this.DOM.audioPlayhead) this.DOM.audioPlayhead.style.left = position;
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
        const isMuted = this.state.audioMuted || !this.state.includeAudio;
        if (this.state.outputMode === 'audio') {
            cmd = `ffmpeg -y -ss ${this.state.start.toFixed(3)} -i "${this.state.videoPath}" -t ${duration.toFixed(3)} -vn -map 0:a:0 -c:a libmp3lame -q:a 2 "${outputFilename}"`;
        } else if (this.state.outputMode === 'original' && !isMuted) {
            cmd = `ffmpeg -y -ss ${this.state.start.toFixed(3)} -i "${this.state.videoPath}" -t ${duration.toFixed(3)} -c copy -map 0 "${outputFilename}"`;
        } else if (this.state.outputMode === 'original' && isMuted) {
            cmd = `ffmpeg -y -ss ${this.state.start.toFixed(3)} -i "${this.state.videoPath}" -t ${duration.toFixed(3)} -map 0:v:0 -c:v copy -an "${outputFilename}"`;
        } else {
            cmd = `ffmpeg -y -ss ${this.state.start.toFixed(3)} -i "${this.state.videoPath}" -t ${duration.toFixed(3)} -map 0:v:0 ${isMuted ? '-an' : '-map 0:a:0? -c:a aac -b:a 192k'} -c:v libx264 -preset veryfast -crf 18 -movflags +faststart "${outputFilename}"`;
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
        downloadLink.innerText = this.state.outputMode === 'audio' ? 'Baixar MP3' : 'Baixar vídeo';
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
        const hasNleClips = (this.state.clips && this.state.clips.length > 1) ||
            (this.state.clips && this.state.clips.some(c => c.transitionIn || c.transitionOut)) ||
            (this.state.canvasAspectRatio && this.state.canvasAspectRatio !== 'original');

        const description = this.state.outputMode === 'audio'
            ? 'Somente a faixa de áudio selecionada será exportada em MP3.'
            : this.state.outputMode === 'original'
                ? (hasNleClips 
                    ? 'Edições multipistas, transições ou proporções requerem renderização precisa frame a frame (H.264 + AAC).'
                    : 'O trecho selecionado será extraído instantaneamente no formato original sem perda de qualidade (-c copy).')
                : 'O vídeo será recodificado em formato MP4 padrão (H.264 + AAC) para compatibilidade universal.';
        document.getElementById('resultDescription').innerText = description;
    },

    updateAudioTrackActions() {
        const unavailable = !this.state.hasAudioTrack;
        const audioOnly = this.state.outputMode === 'audio';
        const removed = !this.state.includeAudio;
        const visuallyMuted = removed || this.state.audioMuted || unavailable;
        if (this.DOM.audioTrackRow) {
            this.DOM.audioTrackRow.classList.toggle('muted-track', visuallyMuted);
            this.DOM.audioTrackRow.classList.toggle('removed-track', removed || unavailable);
            this.DOM.audioTrackRow.classList.toggle('audio-only-focus', audioOnly);
        }
        if (this.DOM.audioMuteToggle) {
            this.DOM.audioMuteToggle.classList.toggle('is-muted', visuallyMuted);
            this.DOM.audioMuteToggle.disabled = unavailable || removed || audioOnly;
            this.DOM.audioMuteToggle.title = this.state.audioMuted ? 'Ativar áudio' : 'Silenciar áudio';
            this.DOM.audioMuteToggle.setAttribute('aria-label', this.DOM.audioMuteToggle.title);
        }
        if (this.DOM.audioRemoveToggle) {
            this.DOM.audioRemoveToggle.disabled = unavailable || audioOnly;
            this.DOM.audioRemoveToggle.innerText = removed ? '+' : '×';
            this.DOM.audioRemoveToggle.title = removed ? 'Restaurar faixa de áudio' : 'Remover faixa de áudio';
            this.DOM.audioRemoveToggle.setAttribute('aria-label', this.DOM.audioRemoveToggle.title);
        }
        if (!this.DOM.audioTrackInfo) return;
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
        const overlay = document.getElementById('importOverlay');
        const overlayTitle = document.getElementById('importTitle');
        const overlaySub = document.getElementById('importSubtitle');
        const overlayBar = document.getElementById('importProgressBar');
        const overlayText = document.getElementById('importProgressText');

        if (isLoading) {
            if (message) {
                this.DOM.uploadStatus.innerHTML = `<span>${this.escapeHtml(message)}</span><span class="loading-dots"></span>`;
                this.DOM.uploadStatus.className = 'status-text loading';
            }
            if (overlay) {
                overlay.style.display = 'flex';
                if (overlayTitle) overlayTitle.textContent = message || 'Importando vídeo…';
                if (overlaySub) overlaySub.textContent = 'Processando faixas e miniaturas no servidor…';
                if (overlayBar) overlayBar.className = 'import-progress-bar animated';
                if (overlayText) overlayText.textContent = 'Por favor, aguarde enquanto o vídeo é preparado…';
            }
            document.querySelectorAll('#youtube-link-area button, #file-upload-area label, #search-video-area button').forEach(el => el.style.pointerEvents = 'none');
        } else {
            this.DOM.uploadStatus.innerText = message;
            this.DOM.uploadStatus.className = 'status-text';
            this.DOM.uploadStatus.style.color = color;
            if (overlay) {
                overlay.style.display = 'none';
            }
            document.querySelectorAll('#youtube-link-area button, #file-upload-area label, #search-video-area button').forEach(el => el.style.pointerEvents = 'auto');
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
        if (this.state.end > this.state.videoDuration + 0.5) {
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
            this.DOM.editorStatusArea.textContent = `${message}`;
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
        this.DOM.statusArea.innerText = `${message}`;
        this.DOM.statusArea.className = 'status-text error';
        this.DOM.statusArea.style.color = 'var(--error-color, #dc2626)';
        this.DOM.downloadArea.style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => VidCutApp.init());
