// deps.js - Resolução e verificação das dependências externas (ffmpeg, ffprobe, yt-dlp)

const { execFile } = require('child_process');

// No Windows os binários são executados dentro do WSL; nos demais sistemas, direto.
const USE_WSL = process.platform === 'win32';

// Caminhos podem ser sobrescritos por variáveis de ambiente.
const bin = {
    ffmpeg: process.env.FFMPEG_PATH || 'ffmpeg',
    ffprobe: process.env.FFPROBE_PATH || 'ffprobe',
    ytdlp: process.env.YTDLP_PATH || 'yt-dlp'
};

const MIN_FFMPEG_MAJOR = 4;
const YTDLP_LATEST_URL = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest'; // apenas a última release estável
const LATEST_CACHE_MS = 6 * 60 * 60 * 1000;
let latestCache = { value: null, at: 0 };

const HINTS = {
    ffmpeg: {
        linux: ['sudo apt install ffmpeg        # Debian/Ubuntu', 'sudo dnf install ffmpeg        # Fedora', 'sudo pacman -S ffmpeg         # Arch'],
        macos: ['brew install ffmpeg'],
        windows: ['wsl sudo apt install ffmpeg   # o app usa o FFmpeg dentro do WSL']
    },
    ytdlp: {
        linux: ['pipx install yt-dlp            # ou: sudo apt install yt-dlp', 'pipx upgrade yt-dlp            # para atualizar'],
        macos: ['brew install yt-dlp', 'brew upgrade yt-dlp           # para atualizar'],
        windows: ['wsl pipx install yt-dlp       # o app usa o yt-dlp dentro do WSL', 'wsl pipx upgrade yt-dlp       # para atualizar']
    }
};

function run(command, args, callback) {
    const cmd = USE_WSL ? 'wsl' : command;
    const cmdArgs = USE_WSL ? [command, ...args] : args;
    execFile(cmd, cmdArgs, { timeout: 10000, maxBuffer: 1024 * 1024 }, (error, stdout) => {
        callback(error, String(stdout || ''));
    });
}

function checkOne(id, label, command, args, evaluate, callback) {
    run(command, args, (error, stdout) => {
        const base = { id, label, command, hints: HINTS[id === 'ytdlp' ? 'ytdlp' : 'ffmpeg'] };
        if (error) return callback({ ...base, status: 'missing', version: null, message: `${label} não encontrado.` });
        const { status, version, message } = evaluate(stdout);
        callback({ ...base, status, version, message });
    });
}

function evaluateFfmpeg(stdout) {
    const match = stdout.match(/version\s+n?(\d+)\.(\d+)?[^\s]*/i);
    if (!match) return { status: 'ok', version: stdout.split('\n')[0].trim() || null }; // build de desenvolvimento
    const version = match[0].replace(/^version\s+/i, '');
    if (Number(match[1]) < MIN_FFMPEG_MAJOR) {
        return { status: 'outdated', version, message: `FFmpeg ${version} é antigo (mínimo recomendado: ${MIN_FFMPEG_MAJOR}.x).` };
    }
    return { status: 'ok', version };
}

function evaluateYtdlp(stdout) {
    return { status: 'ok', version: stdout.trim() };
}

// Compara versões do tipo 2026.10.21 (ou 2026.10.21.123456 em builds nightly). Retorna <0, 0 ou >0.
function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

// Busca a última versão estável do yt-dlp (o endpoint "latest" ignora pré-releases e rascunhos).
// Em caso de falha (offline, limite de requisições) devolve null e nenhum aviso de versão é gerado.
async function fetchLatestYtdlp() {
    if (latestCache.value && Date.now() - latestCache.at < LATEST_CACHE_MS) return latestCache.value;
    try {
        const response = await fetch(YTDLP_LATEST_URL, {
            headers: { 'User-Agent': 'vidcut', Accept: 'application/vnd.github+json' },
            signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) return null;
        const { tag_name: tag } = await response.json();
        if (!/^\d{4}\.\d{2}\.\d{2}/.test(tag || '')) return null;
        latestCache = { value: tag, at: Date.now() };
        return tag;
    } catch (error) {
        return null;
    }
}

async function applyYtdlpLatest(result) {
    if (result.status !== 'ok' || !/^\d{4}\./.test(result.version || '')) return result;
    const latest = await fetchLatestYtdlp();
    if (latest && compareVersions(result.version, latest) < 0) {
        return { ...result, status: 'outdated', latest, message: `yt-dlp ${result.version} está desatualizado (última versão estável: ${latest}); downloads podem falhar.` };
    }
    return { ...result, latest };
}

function checkDependencies(callback) {
    const jobs = [
        cb => checkOne('ffmpeg', 'FFmpeg', bin.ffmpeg, ['-version'], evaluateFfmpeg, cb),
        cb => checkOne('ffprobe', 'FFprobe', bin.ffprobe, ['-version'], evaluateFfmpeg, cb),
        cb => checkOne('ytdlp', 'yt-dlp', bin.ytdlp, ['--version'], evaluateYtdlp, cb)
    ];
    const results = new Array(jobs.length);
    let remaining = jobs.length;
    jobs.forEach((job, index) => job(result => {
        results[index] = result;
        if (--remaining === 0) {
            const ytdlpIndex = results.findIndex(item => item.id === 'ytdlp');
            applyYtdlpLatest(results[ytdlpIndex]).then(updated => {
                results[ytdlpIndex] = updated;
                finish();
            });
        }
    }));
    function finish() {
        callback({
            platform: process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux',
            ok: results.every(item => item.status === 'ok'),
            dependencies: results
        });
    }
}

module.exports = { USE_WSL, bin, checkDependencies };
