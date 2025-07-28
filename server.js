// server.js - Versão Corrigida com a flag -y do FFmpeg

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const multer = require('multer');

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

app.use(cors());
app.use(express.json());
app.use(express.static('.'));
app.use('/videos', express.static(UPLOAD_DIR));
app.use('/output', express.static(OUTPUT_DIR));

// Rota de Upload
app.post('/upload', upload.single('videoFile'), (req, res) => {
    if (!req.file) return res.status(400).send('Nenhum arquivo enviado.');
    res.status(200).json({ message: 'Upload bem-sucedido!', filename: req.file.filename });
});

// Rota de Processamento
// server.js -> ROTA CORRIGIDA

app.post('/download-from-youtube', (req, res) => {
    const { youtubeUrl } = req.body;
    if (!youtubeUrl) {
        return res.status(400).json({ message: 'URL do YouTube não fornecida.' });
    }

    // 1. Gera um nome de arquivo base, SEM extensão
    const baseFilename = `yt_${Date.now()}`;
    // O template para o yt-dlp agora usa a variável %(ext)s para a extensão correta
    const outputPathTemplate = path.join(UPLOAD_DIR, `${baseFilename}.%(ext)s`);

    const IS_RUNNING_IN_WSL = process.platform === 'linux';
    let command;

    // 2. Remove a flag '--merge-output-format mp4' do comando
    if (IS_RUNNING_IN_WSL) {
        command = `yt-dlp -o "${outputPathTemplate}" -f "bv*+ba/b" "${youtubeUrl}"`;
    } else {
        const wslOutputPath = `/mnt/${outputPathTemplate.substring(0, 1).toLowerCase()}${outputPathTemplate.substring(2).replace(/\\/g, '/')}`;
        command = `wsl yt-dlp -o "${wslOutputPath}" -f "bv*+ba/b" "${youtubeUrl}"`;
    }
    
    console.log('Executando comando de download:', command);

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Erro ao baixar com yt-dlp: ${error.message}`);
            return res.status(500).json({ message: 'Falha ao baixar vídeo do YouTube.', error: stderr });
        }
        
        // 3. Descobre o nome COMPLETO do arquivo que foi criado
        const files = fs.readdirSync(UPLOAD_DIR);
        const finalFilename = files.find(f => f.startsWith(baseFilename));

        if (!finalFilename) {
            return res.status(500).json({ message: 'Erro: arquivo baixado não encontrado no servidor.' });
        }

        console.log(`Download concluído! Arquivo salvo como: ${finalFilename}`);
        res.status(200).json({ message: 'Download concluído!', filename: finalFilename });
    });
});

app.post('/processar-video', (req, res) => {
    const { videoPath, start, end } = req.body;
    const inputFilePath = path.join(UPLOAD_DIR, videoPath);
    const outputFilename = `corte_${videoPath}`;
    const outputFilePath = path.join(OUTPUT_DIR, outputFilename);

    if (!fs.existsSync(inputFilePath)) {
        return res.status(404).json({ message: `Arquivo não encontrado no servidor: ${videoPath}` });
    }

    const IS_RUNNING_IN_WSL = process.platform === 'linux';
    let command;

    if (IS_RUNNING_IN_WSL) {
        // CORREÇÃO: Adicionada a flag -y para sobrescrever sem perguntar
        command = `ffmpeg -y -i "${inputFilePath}" -ss ${start.toFixed(3)} -to ${end.toFixed(3)} -c copy "${outputFilePath}"`;
    } else {
        const wslInputPath = `/mnt/${inputFilePath.substring(0, 1).toLowerCase()}${inputFilePath.substring(2).replace(/\\/g, '/')}`;
        const wslOutputPath = `/mnt/${outputFilePath.substring(0, 1).toLowerCase()}${outputFilePath.substring(2).replace(/\\/g, '/')}`;
        // CORREÇÃO: Adicionada a flag -y para sobrescrever sem perguntar
        command = `wsl ffmpeg -y -i "${wslInputPath}" -ss ${start.toFixed(3)} -to ${end.toFixed(3)} -c copy "${wslOutputPath}"`;
    }
    
    console.log('Executando comando:', command);
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Erro ao executar comando: ${error.message}`);
            console.error(`Stderr: ${stderr}`);
            return res.status(500).json({ message: 'Falha ao processar o vídeo.', error: stderr });
        }
        res.status(200).json({ message: 'Vídeo processado com sucesso!', outputFile: outputFilename });
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
});