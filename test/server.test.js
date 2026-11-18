const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

let serverProcess;
const PORT = 3099;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(`${BASE_URL}${path}`, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

test.before(async () => {
    // Inicia o servidor para a bateria de testes
    serverProcess = spawn(process.execPath, ['server.js'], { 
        cwd: process.cwd(),
        env: { ...process.env, PORT: String(PORT) },
        stdio: 'inherit'
    });
    
    // Aguarda o servidor estar pronto
    for (let i = 0; i < 30; i++) {
        try {
            await request('/');
            return;
        } catch (_) {
            await new Promise(r => setTimeout(r, 200));
        }
    }
    throw new Error('Servidor não iniciou a tempo para os testes');
});

test.after(() => {
    if (serverProcess) {
        serverProcess.kill('SIGINT');
    }
});

test('Segurança & Estáticos: Raiz responde 200 e serve o VidCut', async () => {
    const res = await request('/');
    assert.equal(res.status, 200);
    assert.match(res.body, /VidCut/);
    assert.match(res.body, /<title>VidCut/);
});

test('Segurança: Arquivos sensíveis do backend retornam 404', async () => {
    const blockedFiles = ['/server.js', '/package.json', '/package-lock.json', '/deps.js', '/.gitignore'];
    for (const file of blockedFiles) {
        const res = await request(file);
        assert.equal(res.status, 404, `Deveria bloquear acesso a ${file}`);
    }
});

test('Vendor: Assets locais do noUiSlider são servidos corretamente', async () => {
    const js = await request('/vendor/nouislider/nouislider.min.js');
    assert.equal(js.status, 200);
    const css = await request('/vendor/nouislider/nouislider.min.css');
    assert.equal(css.status, 200);
});

test('Health: Endpoint /api/dependencies reporta integridade das ferramentas', async () => {
    const res = await request('/api/dependencies');
    assert.equal(res.status, 200);
    const data = JSON.parse(res.body);
    assert.ok(data.platform);
    assert.ok(Array.isArray(data.dependencies));
    assert.ok(data.dependencies.some(d => d.id === 'ffmpeg'));
    assert.ok(data.dependencies.some(d => d.id === 'ytdlp'));
});

test('Validação: /processar-video recusa requisições sem arquivo ou com parâmetros inválidos', async () => {
    const res = await request('/processar-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath: '', start: 0, end: 10 })
    });
    assert.equal(res.status, 400);
    const data = JSON.parse(res.body);
    assert.match(data.message, /arquivo de vídeo válido/i);
});

test('Multipistas: /processar-video valida existência de arquivo para clips NLE', async () => {
    const res = await request('/processar-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            videoPath: 'inexistente.mp4',
            start: 0,
            end: 5,
            clips: [
                { id: 'c1', filename: 'inexistente.mp4', start: 0, end: 2 },
                { id: 'c2', filename: 'inexistente.mp4', start: 3, end: 5 }
            ]
        })
    });
    assert.equal(res.status, 404);
    const data = JSON.parse(res.body);
    assert.match(data.message, /arquivo não encontrado/i);
});

test('Exportação: WebM com efeitos/transição é exportado com sucesso em MP4 (H.264/AAC)', async () => {
    // Cria um vídeo de teste .webm sintético
    const testWebmName = 'test_fixture.webm';
    const testWebmPath = path.join(__dirname, '..', 'videos', testWebmName);
    const { execSync } = require('child_process');
    execSync(`ffmpeg -y -f lavfi -i testsrc=duration=2:size=160x120:rate=15 -f lavfi -i sine=frequency=800:duration=2 -c:v libvpx-vp9 -c:a libopus "${testWebmPath}"`);

    try {
        const res = await request('/processar-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: testWebmName,
                start: 0.2,
                end: 1.5,
                outputMode: 'original',
                clips: [
                    { id: 'c1', filename: testWebmName, start: 0.2, end: 1.5, transitionIn: { type: 'fade', duration: 0.3 } }
                ]
            })
        });
        assert.equal(res.status, 200);
        const data = JSON.parse(res.body);
        assert.ok(data.outputFile);
        assert.match(data.outputFile, /\.mp4$/i);
    } finally {
        if (fs.existsSync(testWebmPath)) fs.unlinkSync(testWebmPath);
    }
});

test('Exportação: WebM em corte puro sem conversão preserva .webm (-c copy)', async () => {
    const testWebmName = 'test_fixture_copy.webm';
    const testWebmPath = path.join(__dirname, '..', 'videos', testWebmName);
    const { execSync } = require('child_process');
    execSync(`ffmpeg -y -f lavfi -i testsrc=duration=2:size=160x120:rate=15 -f lavfi -i sine=frequency=800:duration=2 -c:v libvpx-vp9 -c:a libopus "${testWebmPath}"`);

    try {
        const res = await request('/processar-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: testWebmName,
                start: 0.2,
                end: 1.5,
                outputMode: 'original'
            })
        });
        assert.equal(res.status, 200);
        const data = JSON.parse(res.body);
        assert.ok(data.outputFile);
        assert.match(data.outputFile, /\.webm$/i);
    } finally {
        if (fs.existsSync(testWebmPath)) fs.unlinkSync(testWebmPath);
    }
});

test('Sessão: /limpar-sessao esvazia pastas temporárias com sucesso', async () => {
    const res = await request('/limpar-sessao', { method: 'POST' });
    assert.equal(res.status, 200);
    const data = JSON.parse(res.body);
    assert.match(data.message, /sucesso/i);
});
