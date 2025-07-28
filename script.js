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
    },

    // DOM Element References
    DOM: {},

    // Constants
    FRAME_RATE: 30,

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
            frameButtons: document.querySelectorAll('.frame-btn'),
        };

        this.addEventListeners();
    },

    // Event Listeners
    addEventListeners() {
        this.DOM.videoFile.addEventListener('change', (e) => this.handleFileUpload(e));
        this.DOM.videoPlayer.addEventListener('loadedmetadata', () => this.setupTimelineSlider());
        this.DOM.startTimeInput.addEventListener('change', () => this.handleTimeInputChange('start'));
        this.DOM.endTimeInput.addEventListener('change', () => this.handleTimeInputChange('end'));
        this.DOM.processButton.addEventListener('click', () => this.processVideo());
        
        this.DOM.frameButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                const frames = parseInt(e.currentTarget.dataset.frames, 10);
                this.adjustTime(type, frames);
            });
        });
    },

    // API Logic
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('videoFile', file);
        
        this.setLoadingState(true, 'Uploading file...');

        try {
            const response = await fetch('http://localhost:3000/upload', {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Upload failed.');
            
            this.handleSuccessfulLoad(result);
        } catch (error) {
            this.setLoadingState(false, `Upload error: ${error.message}`, 'red');
        }
    },

    async downloadFromYouTube(url) {
        this.setLoadingState(true);

        try {
            const response = await fetch('http://localhost:3000/download-from-youtube', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youtubeUrl: url })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Download failed.');

            this.handleSuccessfulLoad(result);
        } catch (error) {
            this.setLoadingState(false, `Download error: ${error.message}`, 'red');
        }
    },
    
    async processVideo() {
        if (!this.state.videoPath || this.state.isProcessing) return;

        this.state.isProcessing = true;
        this.DOM.processButton.disabled = true;
        //this.DOM.processButton.innerText = 'Processing...';
        this.DOM.statusArea.innerHTML = `<span>Processing</span><span class="loading-dots"></span>`;
        this.DOM.statusArea.className = 'status-text loading';
        this.DOM.downloadArea.style.display = 'none';

        try {
            const response = await fetch('http://localhost:3000/processar-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    videoPath: this.state.videoPath, 
                    start: this.state.start, 
                    end: this.state.end 
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'An error occurred on the server.');
            
            this.displayResults(result);

        } catch (error) {
            this.DOM.statusArea.innerText = `Error: ${error.message}`;
            this.DOM.statusArea.style.color = 'red';
        } finally {
            this.state.isProcessing = false;
            this.DOM.processButton.disabled = false;
            this.DOM.processButton.innerText = 'Confirm and Process';
        }
    },

    // UI Update Functions
    handleSuccessfulLoad(result) {
        this.setLoadingState(false, 'Success! Loading video...', 'var(--success-color)');
        this.state.videoPath = result.filename;
        this.DOM.videoPlayer.src = `/videos/${this.state.videoPath}`;
        this.DOM.videoContainer.style.display = 'block';
        this.DOM.controls.style.display = 'block';
        document.dispatchEvent(new CustomEvent('videoUploaded'));
    },
    
    setupTimelineSlider() {
        this.state.videoDuration = this.DOM.videoPlayer.duration;
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
    },

    handleTimeInputChange(type) {
        if (!this.state.videoPath) return;
        if (type === 'start') {
            this.state.start = parseFloat(this.DOM.startTimeInput.value);
        } else {
            this.state.end = parseFloat(this.DOM.endTimeInput.value);
        }
        this.DOM.timelineSlider.noUiSlider.set([this.state.start, this.state.end]);
        this.updateTimelineUI();
    },

    updateTimelineUI() {
        this.DOM.startTimeInput.value = this.state.start.toFixed(2);
        this.DOM.endTimeInput.value = this.state.end.toFixed(2);
        this.generateCommand();
    },

    generateCommand() {
        if (!this.state.videoPath) {
            this.DOM.commandArea.style.display = 'none';
            return;
        }
        this.DOM.commandArea.style.display = 'block';
        if (this.state.start >= this.state.end) {
            this.DOM.outputCommand.innerText = "Error: Start time must be less than end time.";
            return;
        }
        const outputFilename = `cut_${this.state.videoPath}`;
        const cmd = `ffmpeg -y -i "${this.state.videoPath}" -ss ${this.state.start.toFixed(3)} -to ${this.state.end.toFixed(3)} -c copy "${outputFilename}"`;
        this.DOM.outputCommand.innerText = cmd;
    },
    
    displayResults(result) {
        this.DOM.statusArea.innerText = 'Processing complete!';
        this.DOM.statusArea.style.color = 'var(--success-color)';
        this.DOM.downloadArea.innerHTML = '';
        const downloadLink = document.createElement('a');
        downloadLink.href = `/output/${result.outputFile}`;
        downloadLink.innerText = `Save the Clip`;
        downloadLink.setAttribute('download', result.outputFile);
        downloadLink.className = 'download-button';
        this.DOM.downloadArea.appendChild(downloadLink);
        this.DOM.downloadArea.style.display = 'block';
    },
    
    adjustTime(type, frames) {
        if (!this.state.videoPath) return;

        clearTimeout(this.state.previewTimeout);
        
        const FRAME_DURATION = 1 / this.FRAME_RATE;
        const adjustment = frames * FRAME_DURATION;
        let previewTime = 0;

        if (type === 'start') {
            this.state.start = Math.max(0, this.state.start + adjustment);
            this.state.start = Math.min(this.state.start, this.state.end);
            previewTime = this.state.start;
        } else if (type === 'end') {
            this.state.end = Math.min(this.state.videoDuration, this.state.end + adjustment);
            this.state.end = Math.max(this.state.end, this.state.start);
            previewTime = this.state.end;
        }

        this.DOM.timelineSlider.noUiSlider.set([this.state.start, this.state.end]);
        this.updateTimelineUI();
        this.DOM.videoPlayer.currentTime = previewTime;

        this.state.previewTimeout = setTimeout(() => {
            if (this.state.videoPath) {
                this.DOM.videoPlayer.currentTime = this.state.start;
            }
        }, 5000);
    },

    setLoadingState(isLoading, message = '', color = 'orange') {
        if (isLoading) {
            if (message) {
                this.DOM.uploadStatus.innerHTML = `<span>${message}</span><span class="loading-dots"></span>`;
                this.DOM.uploadStatus.className = 'status-text loading';
            }
            document.querySelectorAll('#youtube-link-area button, #file-upload-area label').forEach(el => el.style.pointerEvents = 'none');
        } else {
            this.DOM.uploadStatus.innerText = message;
            this.DOM.uploadStatus.className = 'status-text';
            this.DOM.uploadStatus.style.color = color;
            document.querySelectorAll('#youtube-link-area button, #file-upload-area label').forEach(el => el.style.pointerEvents = 'auto');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => ClipCraftApp.init());