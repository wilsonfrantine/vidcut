// server.js - Versão Corrigida com a flag -y do FFmpeg

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const multer = require('multer');
const { USE_WSL, bin, checkDependencies } = require('./deps');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuração das Pastas ---
const UPLOAD_DIR = path.join(__dirname, 'videos');
const OUTPUT_DIR = path.join(__dirname, 'output');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Resume o stderr de uma ferramenta externa em poucas palavras úteis para o usuário.
function summarizeStderr(stderr) {
    const raw = String(stderr || '');
    if (/Sign in to confirm you’re not a bot|confirm you.?re not a bot/i.test(raw)) {
        return 'O YouTube bloqueou o download exigindo verificação de bot ou login (cookies). Coloque um arquivo cookies.txt na pasta do projeto ou use o upload de arquivo local.';
    }
    if (/Video unavailable|This video is unavailable/i.test(raw)) {
        return 'Este vídeo não está disponível publicamente ou foi removido do YouTube.';
    }
    const lines = raw.trim().split(/\r?\n/).filter(Boolean);
    const errors = lines.filter(line => /error/i.test(line));
    return (errors.length ? errors : lines).slice(-2).join(' ').slice(0, 300);
}

// Mensagem específica quando o executável não existe; caso contrário devolve o resumo do stderr.
function toolFailure(error, stderr, toolName) {
    if (error && error.code === 'ENOENT') {
        return { message: `${toolName} não está instalado ou não foi encontrado. Consulte o aviso de dependências no topo da página.` };
    }
    return { detail: summarizeStderr(stderr) };
}

// Retorna argumentos adicionais para o yt-dlp (cookies se existirem, JS runtime node e remote-components ejs)
function getYtDlpExtraArgs(customArgs = {}) {
    const nodePath = process.execPath || '/home/linuxbrew/.linuxbrew/bin/node';
    const extra = [
        '--js-runtimes', `node:${nodePath}`,
        '--remote-components', 'ejs:github'
    ];
    
    // Suporte a cliente específico caso solicitado (ex: fallback android/mweb)
    if (customArgs.client) {
        extra.push('--extractor-args', `youtube:player_client=${customArgs.client}`);
    }

    // Procura por cookies.txt na pasta do projeto ou caminho configurado por COOKIES_PATH
    const cookiesEnv = process.env.COOKIES_PATH;
    const localCookies = path.join(__dirname, 'cookies.txt');
    if (cookiesEnv && fs.existsSync(cookiesEnv)) {
        extra.push('--cookies', cookiesEnv);
    } else if (fs.existsSync(localCookies)) {
        extra.push('--cookies', localCookies);
    }

    return extra;
}

function probeMedia(filePath, callback) {
    const isWindows = USE_WSL;
    const probePath = isWindows
        ? `/mnt/${filePath.substring(0, 1).toLowerCase()}${filePath.substring(2).replace(/\\/g, '/')}`
        : filePath;
    const command = isWindows ? 'wsl' : bin.ffprobe;
    const args = isWindows
        ? [bin.ffprobe, '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', probePath]
        : ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', probePath];

    execFile(command, args, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
        if (error) return callback(error);
        try {
            const metadata = JSON.parse(stdout);
            const streams = metadata.streams || [];
            const videoStream = streams.find(stream => stream.codec_type === 'video');
            const audioStream = streams.find(stream => stream.codec_type === 'audio');
            callback(null, {
                hasVideo: Boolean(videoStream),
                hasAudio: Boolean(audioStream),
                width: videoStream?.width || null,
                height: videoStream?.height || null,
                videoCodec: videoStream?.codec_name || null,
                audioCodec: audioStream?.codec_name || null,
                sampleRate: Number(audioStream?.sample_rate) || null,
                channels: audioStream?.channels || null,
                duration: Number(metadata.format?.duration) || 0
            });
        } catch (parseError) {
            callback(parseError);
        }
    });
}

function createTrackAssets(filePath, mediaInfo, callback) {
    const isWindows = USE_WSL;
    const toFfmpegPath = value => isWindows
        ? `/mnt/${value.substring(0, 1).toLowerCase()}${value.substring(2).replace(/\\/g, '/')}`
        : value;
    const inputPath = toFfmpegPath(filePath);
    const runFfmpeg = (args, done) => {
        const command = isWindows ? 'wsl' : bin.ffmpeg;
        const commandArgs = isWindows ? [bin.ffmpeg, ...args] : args;
        execFile(command, commandArgs, { maxBuffer: 1024 * 1024 }, error => done(error));
    };
    const stem = path.parse(filePath).name;
    const previewTimes = [0.04, 0.28, 0.5, 0.72, 0.9].map(fraction => Math.max(0, (mediaInfo.duration || 1) * fraction));
    const previewFiles = previewTimes.map((_, index) => `${stem}_preview_${index}.jpg`);
    const results = new Array(previewFiles.length + (mediaInfo.hasAudio ? 1 : 0));
    let remaining = results.length;
    const finish = () => {
        remaining -= 1;
        if (remaining === 0) {
            callback({
                ...mediaInfo,
                videoPreviews: previewFiles.map((filename, index) => results[index] ? filename : null),
                audioWaveform: mediaInfo.hasAudio && results[previewFiles.length] ? `${stem}_waveform.png` : null
            });
        }
    };

    previewFiles.forEach((filename, index) => {
        const outputPath = path.join(UPLOAD_DIR, filename);
        const seekTime = previewTimes[index].toFixed(3);
        runFfmpeg(['-y', '-ss', seekTime, '-i', inputPath, '-frames:v', '1', '-vf', 'scale=160:90:force_original_aspect_ratio=increase,crop=160:90', '-q:v', '4', toFfmpegPath(outputPath)], error => {
            if (error) console.warn(`Não foi possível criar a miniatura ${filename}: ${error.message}`);
            results[index] = !error;
            finish();
        });
    });

    if (mediaInfo.hasAudio) {
        const waveformPath = path.join(UPLOAD_DIR, `${stem}_waveform.png`);
        runFfmpeg(['-y', '-i', inputPath, '-filter_complex', 'aformat=channel_layouts=mono,showwavespic=s=1200x64:colors=0x6758e8:scale=sqrt', '-frames:v', '1', '-an', toFfmpegPath(waveformPath)], error => {
            if (error) console.warn(`Não foi possível criar a forma de onda: ${error.message}`);
            results[previewFiles.length] = !error;
            finish();
        });
    }
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/nouislider', express.static(path.join(__dirname, 'node_modules', 'nouislider', 'dist')));
app.use('/videos', express.static(UPLOAD_DIR));
app.use('/output', express.static(OUTPUT_DIR));

// Verificação das dependências externas
app.get('/api/dependencies', (req, res) => checkDependencies(report => res.json(report)));

// Rota de Upload
app.post('/upload', upload.single('videoFile'), (req, res) => {
    if (!req.file) return res.status(400).send('Nenhum arquivo enviado.');
    probeMedia(req.file.path, (error, mediaInfo) => {
        if (error) return res.status(422).json({ message: 'Não foi possível ler as trilhas deste arquivo. Verifique se o FFprobe está instalado e tente outro vídeo.', ...toolFailure(error, error.message, 'FFprobe') });
        if (!mediaInfo.hasVideo) return res.status(422).json({ message: 'Este arquivo não contém uma trilha de vídeo.' });
        createTrackAssets(req.file.path, mediaInfo, enrichedMediaInfo => {
            res.status(200).json({ message: 'Upload bem-sucedido!', filename: req.file.filename, mediaInfo: enrichedMediaInfo });
        });
    });
});


app.post('/limpar-sessao', (req, res) => {
    try {
        [UPLOAD_DIR, OUTPUT_DIR].forEach(dir => {
            if (fs.existsSync(dir)) {
                fs.readdirSync(dir).filter(name => name !== '.gitkeep').forEach(name => {
                    fs.rmSync(path.join(dir, name), { recursive: true, force: true });
                });
            }
        });
        res.status(200).json({ message: 'Sessão e arquivos temporários limpos com sucesso.' });
    } catch (err) {
        console.error('Erro ao limpar sessão:', err);
        res.status(500).json({ message: 'Falha ao limpar pastas temporárias.' });
    }
});

// Rota de Processamento
// server.js -> ROTA CORRIGIDA

// Rota de Busca de Vídeos via yt-dlp com suporte a filtros e ordenação
app.get('/buscar-videos', (req, res) => {
    let query = String(req.query.q || '').trim();
    if (!query) {
        return res.status(400).json({ message: 'Informe um termo de busca.' });
    }

    const filter = String(req.query.filter || 'all').toLowerCase();
    if (filter === 'shorts') {
        query += ' shorts';
    } else if (filter === 'long') {
        query += ' completo full';
    } else if (filter === 'music') {
        query += ' audio podcast';
    }

    const sort = String(req.query.sort || 'relevance').toLowerCase();

    const maxResults = Math.min(Math.max(Number(req.query.limit) || 12, 1), 20);
    const searchTarget = `ytsearch${maxResults}:${query}`;
    const searchArgs = [...getYtDlpExtraArgs(), '--flat-playlist', '--dump-json', searchTarget];

    const IS_RUNNING_IN_WSL = !USE_WSL;
    const command = IS_RUNNING_IN_WSL ? bin.ytdlp : 'wsl';
    const args = IS_RUNNING_IN_WSL ? searchArgs : [bin.ytdlp, ...searchArgs];

    execFile(command, args, { timeout: 12000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Erro ao buscar vídeos com yt-dlp: ${error.message}`);
            return res.status(500).json({ 
                message: 'Não foi possível realizar a busca de vídeos.', 
                ...toolFailure(error, stderr, 'yt-dlp') 
            });
        }

        let results = [];
        const lines = String(stdout || '').split('\n');
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const item = JSON.parse(line);
                const id = item.id;
                if (!id) continue;
                const duration = Number(item.duration) || 0;
                const viewCount = Number(item.view_count) || 0;
                results.push({
                    id,
                    title: item.title || 'Sem título',
                    url: item.url || `https://www.youtube.com/watch?v=${id}`,
                    duration,
                    viewCount,
                    channel: item.channel || item.uploader || 'Canal desconhecido',
                    thumbnail: item.thumbnail || (item.thumbnails && item.thumbnails[0]?.url) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
                });
            } catch (_) {}
        }

        // Filtro em memória pós-busca para precisão de duração quando disponível
        if (filter === 'shorts') {
            results = results.filter(v => v.duration === 0 || v.duration <= 90);
        } else if (filter === 'long') {
            results = results.filter(v => v.duration === 0 || v.duration >= 600);
        }

        // Ordenação por relevância, views ou duração
        if (sort === 'views') {
            results.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        } else if (sort === 'duration_desc') {
            results.sort((a, b) => (b.duration || 0) - (a.duration || 0));
        } else if (sort === 'duration_asc') {
            results.sort((a, b) => (a.duration || 0) - (b.duration || 0));
        }

        res.status(200).json({ results });
    });
});

app.post('/download-from-youtube', (req, res) => {
    const { youtubeUrl } = req.body;
    if (!youtubeUrl) {
        return res.status(400).json({ message: 'URL do YouTube não fornecida.' });
    }
    const baseFilename = `yt_${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const outputPathTemplate = path.join(UPLOAD_DIR, `${baseFilename}.%(ext)s`);

    const IS_RUNNING_IN_WSL = !USE_WSL;
    const wslOutputPath = `/mnt/${outputPathTemplate.substring(0, 1).toLowerCase()}${outputPathTemplate.substring(2).replace(/\\/g, '/')}`;

    const executeDownload = (extraArgsOptions = {}, onComplete) => {
        const downloadArgs = [...getYtDlpExtraArgs(extraArgsOptions), '-f', 'bv*+ba/b', '-o', outputPathTemplate, youtubeUrl];
        let command;
        let args;

        if (IS_RUNNING_IN_WSL) {
            command = bin.ytdlp;
            args = downloadArgs;
        } else {
            command = 'wsl';
            args = [bin.ytdlp, ...downloadArgs.map(arg => arg === outputPathTemplate ? wslOutputPath : arg)];
        }

        console.log('Executando comando de download:', command);
        execFile(command, args, (error, stdout, stderr) => {
            onComplete(error, stdout, stderr);
        });
    };

    // Tentativa inicial padrão (Web/VisionOS/Samsung com solver JS e cookies se disponíveis)
    executeDownload({}, (error, stdout, stderr) => {
        const isBotChallenge = error && (/Sign in to confirm you’re not a bot|confirm you.?re not a bot/i.test(stderr || '') || /Requested format is not available/i.test(stderr || ''));

        // Se falhou por desafio de bot ou formato bloqueado, tenta fallback para cliente móvel (mweb, android)
        if (isBotChallenge) {
            console.warn('Tentativa primária bloqueada por desafio de bot. Executando fallback com cliente móvel (mweb,android)...');
            return executeDownload({ client: 'mweb,android,web' }, (fallbackError, fallbackStdout, fallbackStderr) => {
                if (fallbackError) {
                    console.error(`Erro ao baixar com yt-dlp (fallback): ${fallbackError.message}`);
                    return res.status(500).json({
                        message: 'Falha ao baixar vídeo deste link. O YouTube exigiu autenticação.',
                        ...toolFailure(fallbackError, fallbackStderr, 'yt-dlp')
                    });
                }
                handleDownloadSuccess();
            });
        }

        if (error) {
            console.error(`Erro ao baixar com yt-dlp: ${error.message}`);
            return res.status(500).json({ message: 'Falha ao baixar vídeo deste link. Verifique se a URL é compatível e acessível.', ...toolFailure(error, stderr, 'yt-dlp') });
        }

        handleDownloadSuccess();
    });

    function handleDownloadSuccess() {
        // Descobre o nome COMPLETO do arquivo que foi criado
        const files = fs.readdirSync(UPLOAD_DIR);
        const finalFilename = files.find(f => f.startsWith(baseFilename));

        if (!finalFilename) {
            return res.status(500).json({ message: 'Erro: arquivo baixado não encontrado no servidor.' });
        }

        console.log(`Download concluído! Arquivo salvo como: ${finalFilename}`);
        probeMedia(path.join(UPLOAD_DIR, finalFilename), (probeError, mediaInfo) => {
            if (probeError) return res.status(422).json({ message: 'O vídeo foi baixado, mas não foi possível ler suas trilhas.' });
            if (!mediaInfo.hasVideo) return res.status(422).json({ message: 'O arquivo baixado não contém uma trilha de vídeo.' });
            createTrackAssets(path.join(UPLOAD_DIR, finalFilename), mediaInfo, enrichedMediaInfo => {
                res.status(200).json({ message: 'Download concluído!', filename: finalFilename, mediaInfo: enrichedMediaInfo });
            });
        });
    }
});

app.post('/processar-video', (req, res) => {
    const { 
        videoPath, 
        start, 
        end, 
        includeAudio = true, 
        muteAudio = false, 
        outputMode = 'original', // 'original' (sem conversão), 'mp4' (h264) ou 'audio' (mp3)
        customName = '',
        clips = null,
        aspectRatio = 'original', // 'original', '16:9', '9:16', '1:1', '4:5', '3:4'
        fitMode = 'cover' // 'cover' (preenche cortando excedente) ou 'contain' (letterbox com barras pretas)
    } = req.body;
    if (typeof videoPath !== 'string' || path.basename(videoPath) !== videoPath || !videoPath) {
        return res.status(400).json({ message: 'Selecione um arquivo de vídeo válido.' });
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
        return res.status(400).json({ message: 'O intervalo de corte informado é inválido.' });
    }
    if (!['original', 'mp4', 'video', 'audio'].includes(outputMode)) {
        return res.status(400).json({ message: 'Formato de renderização inválido.' });
    }
    if (outputMode === 'audio' && includeAudio === false) {
        return res.status(400).json({ message: 'Selecione uma faixa de áudio para exportar somente o áudio.' });
    }
    const inputFilePath = path.join(UPLOAD_DIR, videoPath);
    if (!fs.existsSync(inputFilePath)) {
        return res.status(404).json({ message: `Arquivo não encontrado no servidor: ${videoPath}` });
    }

    const duration = end - start;
    const IS_RUNNING_IN_WSL = !USE_WSL;
    const preserveAudio = includeAudio !== false;
    const toWsl = p => `/mnt/${p.substring(0, 1).toLowerCase()}${p.substring(2).replace(/\\/g, '/')}`;

    // Se houver múltiplos clipes ou transições definidos no editor
    const hasNleClips = Array.isArray(clips) && clips.length > 0;

    // Normaliza objetos de clipe aceitando tanto start/end quanto trimStart/trimEnd
    const normalizedClips = hasNleClips ? clips.map(c => {
        const cStart = Number.isFinite(c.start) ? c.start : (Number.isFinite(c.trimStart) ? c.trimStart : 0);
        const cEnd = Number.isFinite(c.end) ? c.end : (Number.isFinite(c.trimEnd) ? c.trimEnd : (c.duration || 0));
        return {
            ...c,
            start: cStart,
            end: cEnd
        };
    }).filter(c => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start) : [];

    const shouldUseNle = normalizedClips.length > 1 || 
        normalizedClips.some(c => c.transitionIn || c.transitionOut) ||
        (normalizedClips.length === 1 && (normalizedClips[0].filename && normalizedClips[0].filename !== videoPath));

    const hasCustomAspect = aspectRatio && aspectRatio !== 'original';
    const isPureCopy = !shouldUseNle && !hasCustomAspect && (outputMode === 'original' || outputMode === 'video') && preserveAudio && !muteAudio;

    const origExt = (path.extname(videoPath).slice(1) || 'mp4').toLowerCase();
    // Se for áudio -> mp3; se for cópia direta de fluxo (-c copy) -> extensão original; se for reencodificação (H.264/AAC) -> mp4
    const ext = outputMode === 'audio' ? 'mp3' : (isPureCopy ? origExt : 'mp4');

    // Sanitiza nome personalizado (se fornecido) ou gera nome baseado no vídeo e intervalo
    let safeBaseName = '';
    if (typeof customName === 'string' && customName.trim()) {
        safeBaseName = customName.trim()
            .replace(/[\\/:*?"<>|\x00-\x1F]/g, '_')
            .replace(/\.[^.]+$/, '')
            .substring(0, 100);
    }
    const outputFilename = safeBaseName 
        ? `${safeBaseName}.${ext}` 
        : `corte_${path.parse(videoPath).name}_${Math.round(start * 1000)}-${Math.round(end * 1000)}.${ext}`;
    const outputFilePath = path.join(OUTPUT_DIR, outputFilename);

    const inputPath = IS_RUNNING_IN_WSL ? inputFilePath : toWsl(inputFilePath);
    const outputPath = IS_RUNNING_IN_WSL ? outputFilePath : toWsl(outputFilePath);

    let ffmpegArgs = [];

    if (shouldUseNle) {
        // Renderização Multipistas / NLE via -filter_complex
        const validClips = normalizedClips;
        
        // Mapeia inputs únicos para os arquivos necessários
        const inputFiles = [];
        const fileToIndex = new Map();
        validClips.forEach(c => {
            const file = c.filename || videoPath;
            if (!fileToIndex.has(file)) {
                fileToIndex.set(file, inputFiles.length);
                const fullP = path.join(UPLOAD_DIR, file);
                inputFiles.push(IS_RUNNING_IN_WSL ? fullP : toWsl(fullP));
            }
        });

        ffmpegArgs = ['-y'];
        inputFiles.forEach(f => {
            ffmpegArgs.push('-i', f);
        });

        const filterSegments = [];
        const vOutputs = [];
        const aOutputs = [];

        validClips.forEach((c, idx) => {
            const inIdx = fileToIndex.get(c.filename || videoPath);
            const clipDur = c.end - c.start;
            const aTag = `a${idx}`;

            let aFilter = `[${inIdx}:a]atrim=start=${c.start.toFixed(3)}:end=${c.end.toFixed(3)},asetpts=PTS-STARTPTS`;
            if (c.transitionIn && c.transitionIn.type === 'fade') {
                const transDur = Math.min(c.transitionIn.duration || 0.5, clipDur / 2);
                aFilter += `,afade=t=in:st=0:d=${transDur.toFixed(2)}`;
            }
            if (c.transitionOut && c.transitionOut.type === 'fade') {
                const transDur = Math.min(c.transitionOut.duration || 0.5, clipDur / 2);
                const fadeStart = Math.max(0, clipDur - transDur);
                aFilter += `,afade=t=out:st=${fadeStart.toFixed(2)}:d=${transDur.toFixed(2)}`;
            }
            filterSegments.push(`${aFilter}[${aTag}]`);
            aOutputs.push(`[${aTag}]`);

            // Constrói filtro de vídeo apenas se não for exportação somente áudio
            if (outputMode !== 'audio') {
                const vTag = `v${idx}`;
                let vFilter = `[${inIdx}:v]trim=start=${c.start.toFixed(3)}:end=${c.end.toFixed(3)},setpts=PTS-STARTPTS`;
                if (c.transitionIn && c.transitionIn.type === 'fade') {
                    const transDur = Math.min(c.transitionIn.duration || 0.5, clipDur / 2);
                    vFilter += `,fade=t=in:st=0:d=${transDur.toFixed(2)}`;
                }
                if (c.transitionOut && c.transitionOut.type === 'fade') {
                    const transDur = Math.min(c.transitionOut.duration || 0.5, clipDur / 2);
                    const fadeStart = Math.max(0, clipDur - transDur);
                    vFilter += `,fade=t=out:st=${fadeStart.toFixed(2)}:d=${transDur.toFixed(2)}`;
                }
                filterSegments.push(`${vFilter}[${vTag}]`);
                vOutputs.push(`[${vTag}]`);
            }
        });

        if (outputMode === 'audio') {
            filterSegments.push(`${aOutputs.join('')}concat=n=${validClips.length}:v=0:a=1[outa]`);
            ffmpegArgs.push('-filter_complex', filterSegments.join(';'), '-map', '[outa]', '-c:a', 'libmp3lame', '-q:a', '2');
        } else {
            // Em modo multipista com transições, cortes ou proporções personalizadas, reencodificamos com H.264
            // para garantir precisão de corte em qualquer frame (evitando congelamentos de GOP do -c copy)
            const includeAudioStream = preserveAudio && !muteAudio;
            if (includeAudioStream) {
                filterSegments.push(`${vOutputs.join('')}concat=n=${validClips.length}:v=1:a=0[rawv]`);
                filterSegments.push(`${aOutputs.join('')}concat=n=${validClips.length}:v=0:a=1[outa]`);
            } else {
                filterSegments.push(`${vOutputs.join('')}concat=n=${validClips.length}:v=1:a=0[rawv]`);
            }
            
            // Aplica filtro de proporção ('cover' = corta e preenche; 'contain' = letterbox) se especificado
            let finalVMap = '[rawv]';
            const aspectSizes = {
                '16:9': [1920, 1080],
                '9:16': [1080, 1920],
                '1:1': [1080, 1080],
                '4:5': [1080, 1350],
                '3:4': [1080, 1440]
            };
            if (aspectSizes[aspectRatio]) {
                const [targetW, targetH] = aspectSizes[aspectRatio];
                if (fitMode === 'cover') {
                    filterSegments.push(`[rawv]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH}[outv]`);
                } else {
                    filterSegments.push(`[rawv]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:black[outv]`);
                }
                finalVMap = '[outv]';
            }

            ffmpegArgs.push('-filter_complex', filterSegments.join(';'), '-map', finalVMap);
            if (includeAudioStream) {
                ffmpegArgs.push('-map', '[outa]', '-c:a', 'aac', '-b:a', '192k');
            } else {
                ffmpegArgs.push('-an');
            }
            ffmpegArgs.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-movflags', '+faststart');
        }
    } else {
        // Modo Clássico (Corte de Único Trecho)
        const hasCustomAspect = aspectRatio && aspectRatio !== 'original';
        const isOriginalCopy = (outputMode === 'original' || outputMode === 'video') && preserveAudio && !muteAudio && !hasCustomAspect;
        if (isOriginalCopy) {
            ffmpegArgs = ['-y', '-ss', start.toFixed(3), '-i', inputPath, '-t', duration.toFixed(3), '-c', 'copy', '-map', '0'];
        } else if (outputMode === 'audio') {
            ffmpegArgs = ['-y', '-ss', start.toFixed(3), '-i', inputPath, '-t', duration.toFixed(3), '-vn', '-map', '0:a:0', '-c:a', 'libmp3lame', '-q:a', '2'];
        } else {
            ffmpegArgs = ['-y', '-ss', start.toFixed(3), '-i', inputPath, '-t', duration.toFixed(3)];
            let vfFilter = '';
            const aspectSizes = {
                '16:9': [1920, 1080],
                '9:16': [1080, 1920],
                '1:1': [1080, 1080],
                '4:5': [1080, 1350],
                '3:4': [1080, 1440]
            };
            if (aspectSizes[aspectRatio]) {
                const [targetW, targetH] = aspectSizes[aspectRatio];
                if (fitMode === 'cover') {
                    vfFilter = `scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH}`;
                } else {
                    vfFilter = `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:black`;
                }
            }
            if (vfFilter) {
                ffmpegArgs.push('-vf', vfFilter);
            } else {
                ffmpegArgs.push('-map', '0:v:0');
            }
            if (preserveAudio) {
                ffmpegArgs.push('-map', '0:a?');
                if (muteAudio === true) ffmpegArgs.push('-af', 'volume=0');
                ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
            } else {
                ffmpegArgs.push('-an');
            }
            ffmpegArgs.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-movflags', '+faststart');
        }
    }
    ffmpegArgs.push(outputPath);
    const command = IS_RUNNING_IN_WSL ? bin.ffmpeg : 'wsl';
    const args = IS_RUNNING_IN_WSL ? ffmpegArgs : [bin.ffmpeg, ...ffmpegArgs];

    console.log('Executando comando:', command);

    execFile(command, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Erro ao executar comando: ${error.message}`);
            console.error(`Stderr: ${stderr}`);
            return res.status(500).json({ message: 'Falha ao processar o vídeo.', ...toolFailure(error, stderr, 'FFmpeg') });
        }
                let fileSize = null;
        try {
            fileSize = fs.statSync(outputFilePath).size;
        } catch (_) {}
        res.status(200).json({ 
            message: 'Corte processado com sucesso!', 
            outputFile: outputFilename, 
            outputMode, 
            duration,
            fileSize,
            audioIncluded: outputMode === 'audio' || preserveAudio, 
            audioMuted: outputMode === 'video' && preserveAudio && muteAudio === true 
        });
    });
});

// Rotina de Limpeza
function cleanup() {
    console.log('\nEncerrando servidor. Limpando pastas...');
    try {
        // Esvazia as pastas preservando a estrutura e o .gitkeep
        [UPLOAD_DIR, OUTPUT_DIR].forEach(dir => {
            fs.mkdirSync(dir, { recursive: true });
            fs.readdirSync(dir).filter(name => name !== '.gitkeep').forEach(name => fs.rmSync(path.join(dir, name), { recursive: true, force: true }));
        });
        console.log('Pastas limpas com sucesso.');
    } catch (err) {
        console.error('Erro ao limpar as pastas:', err);
    }
    process.exit();
}
process.on('SIGINT', cleanup);

// Iniciar Servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em: http://localhost:${PORT}`);
    checkDependencies(report => {
        report.dependencies.filter(dep => dep.status !== 'ok').forEach(dep => {
            console.warn(`[AVISO] ${dep.message}`);
            (dep.hints[report.platform] || []).forEach(line => console.warn(`        ${line}`));
        });
    });
});
