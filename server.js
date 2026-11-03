// server.js - Versão Corrigida com a flag -y do FFmpeg

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const multer = require('multer');
const { USE_WSL, bin, checkDependencies } = require('./deps');

const app = express();
const PORT = 3000;

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
app.use('/videos', express.static(UPLOAD_DIR));
app.use('/output', express.static(OUTPUT_DIR));

// Verificação das dependências externas
app.get('/api/dependencies', (req, res) => checkDependencies(report => res.json(report)));

// Rota de Upload
app.post('/upload', upload.single('videoFile'), (req, res) => {
    if (!req.file) return res.status(400).send('Nenhum arquivo enviado.');
    probeMedia(req.file.path, (error, mediaInfo) => {
        if (error) return res.status(422).json({ message: 'Não foi possível ler as trilhas deste arquivo. Verifique se o FFprobe está instalado e tente outro vídeo.' });
        if (!mediaInfo.hasVideo) return res.status(422).json({ message: 'Este arquivo não contém uma trilha de vídeo.' });
        createTrackAssets(req.file.path, mediaInfo, enrichedMediaInfo => {
            res.status(200).json({ message: 'Upload bem-sucedido!', filename: req.file.filename, mediaInfo: enrichedMediaInfo });
        });
    });
});

// Rota de Processamento
// server.js -> ROTA CORRIGIDA

app.post('/download-from-youtube', (req, res) => {
    const { youtubeUrl } = req.body;
    if (!youtubeUrl) {
        return res.status(400).json({ message: 'URL do YouTube não fornecida.' });
    }
    const baseFilename = `yt_${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const outputPathTemplate = path.join(UPLOAD_DIR, `${baseFilename}.%(ext)s`);
    const downloadArgs = ['-f', 'bv*+ba/b', '-o', outputPathTemplate, youtubeUrl];

    const IS_RUNNING_IN_WSL = !USE_WSL;
    let command;
    let args;

    if (IS_RUNNING_IN_WSL) {
        command = bin.ytdlp;
        args = downloadArgs;
    } else {
        const wslOutputPath = `/mnt/${outputPathTemplate.substring(0, 1).toLowerCase()}${outputPathTemplate.substring(2).replace(/\\/g, '/')}`;
        command = 'wsl';
        args = [bin.ytdlp, ...downloadArgs.map(arg => arg === outputPathTemplate ? wslOutputPath : arg)];
    }

    console.log('Executando comando de download:', command);

    execFile(command, args, (error, stdout, stderr) => {
        if (error) {
            console.error(`Erro ao baixar com yt-dlp: ${error.message}`);
            return res.status(500).json({ message: 'Falha ao baixar vídeo deste link. Verifique se a URL é compatível e acessível.', error: stderr });
        }

        // 3. Descobre o nome COMPLETO do arquivo que foi criado
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
    });
});

app.post('/processar-video', (req, res) => {
    const { videoPath, start, end, includeAudio = true, muteAudio = false, outputMode = 'video' } = req.body;
    if (typeof videoPath !== 'string' || path.basename(videoPath) !== videoPath || !videoPath) {
        return res.status(400).json({ message: 'Selecione um arquivo de vídeo válido.' });
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
        return res.status(400).json({ message: 'O intervalo de corte informado é inválido.' });
    }
    if (!['video', 'audio'].includes(outputMode)) {
        return res.status(400).json({ message: 'Formato de renderização inválido.' });
    }
    if (outputMode === 'audio' && includeAudio === false) {
        return res.status(400).json({ message: 'Selecione uma faixa de áudio para exportar somente o áudio.' });
    }
    const inputFilePath = path.join(UPLOAD_DIR, videoPath);
    const outputFilename = `corte_${path.parse(videoPath).name}.${outputMode === 'audio' ? 'mp3' : 'mp4'}`;
    const outputFilePath = path.join(OUTPUT_DIR, outputFilename);

    if (!fs.existsSync(inputFilePath)) {
        return res.status(404).json({ message: `Arquivo não encontrado no servidor: ${videoPath}` });
    }

    const duration = end - start;
    const IS_RUNNING_IN_WSL = !USE_WSL;
    const preserveAudio = includeAudio !== false;
    const wslInputPath = `/mnt/${inputFilePath.substring(0, 1).toLowerCase()}${inputFilePath.substring(2).replace(/\\/g, '/')}`;
    const wslOutputPath = `/mnt/${outputFilePath.substring(0, 1).toLowerCase()}${outputFilePath.substring(2).replace(/\\/g, '/')}`;
    const inputPath = IS_RUNNING_IN_WSL ? inputFilePath : wslInputPath;
    const outputPath = IS_RUNNING_IN_WSL ? outputFilePath : wslOutputPath;
    const ffmpegArgs = ['-y', '-ss', start.toFixed(3), '-i', inputPath, '-t', duration.toFixed(3)];
    if (outputMode === 'audio') {
        ffmpegArgs.push('-vn', '-map', '0:a:0', '-c:a', 'libmp3lame', '-q:a', '2');
    } else {
        ffmpegArgs.push('-map', '0:v:0');
        if (preserveAudio) {
            ffmpegArgs.push('-map', '0:a?');
            if (muteAudio === true) ffmpegArgs.push('-af', 'volume=0');
            ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
        } else {
            ffmpegArgs.push('-an');
        }
        ffmpegArgs.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-movflags', '+faststart');
    }
    ffmpegArgs.push(outputPath);
    const command = IS_RUNNING_IN_WSL ? bin.ffmpeg : 'wsl';
    const args = IS_RUNNING_IN_WSL ? ffmpegArgs : [bin.ffmpeg, ...ffmpegArgs];

    console.log('Executando comando:', command);

    execFile(command, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Erro ao executar comando: ${error.message}`);
            console.error(`Stderr: ${stderr}`);
            return res.status(500).json({ message: 'Falha ao processar o vídeo.', error: stderr });
        }
        res.status(200).json({ message: 'Corte processado com sucesso!', outputFile: outputFilename, outputMode, audioIncluded: outputMode === 'audio' || preserveAudio, audioMuted: outputMode === 'video' && preserveAudio && muteAudio === true });
    });
});

// Rotina de Limpeza
function cleanup() {
    console.log('\nEncerrando servidor. Limpando pastas...');
    try {
        fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
        console.log('Pastas limpas com sucesso.');
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
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
