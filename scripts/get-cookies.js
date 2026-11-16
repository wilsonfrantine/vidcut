#!/usr/bin/env node

/**
 * Utilitário local para autenticação e extração segura de cookies do YouTube para o VidCut.
 * Execução: npm run auth [navegador]
 * Navegadores suportados: brave, chrome, firefox, edge, chromium
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const targetCookiesFile = path.join(__dirname, '..', 'cookies.txt');
const requestedBrowser = process.argv[2];

const browsers = requestedBrowser 
    ? [requestedBrowser] 
    : ['brave', 'chrome', 'firefox', 'edge', 'chromium'];

console.log(' VidCut Auth: Exportador local e seguro de cookies');
console.log('Procurando sessão do YouTube no seu navegador local...');

let success = false;

for (const browser of browsers) {
    try {
        console.log(` Tentando extrair cookies do navegador: ${browser}...`);
        execSync(`yt-dlp --cookies-from-browser ${browser} --cookies "${targetCookiesFile}" --print "%(title)s" "https://www.youtube.com/watch?v=dQw4w9WgXcQ"`, {
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 15000
        });

        if (fs.existsSync(targetCookiesFile) && fs.statSync(targetCookiesFile).size > 0) {
            console.log(` Sucesso! Cookies exportados para: ${targetCookiesFile}`);
            console.log('Agora você pode baixar vídeos protegidos ou restritos sem extensões de terceiros.');
            success = true;
            break;
        }
    } catch (err) {
        const stderr = String(err.stderr || err.message);
        if (/Permission denied/i.test(stderr)) {
            console.log(`   Aviso: Feche o ${browser} momentaneamente para liberar a leitura do banco de dados de cookies.`);
        }
    }
}

if (!success) {
    console.log('\n Não foi possível extrair cookies automaticamente.');
    console.log('Dica: Certifique-se de que está logado no YouTube no navegador e tente fechar a janela do navegador antes de rodar o comando.');
    console.log('Ou se preferir, passe o navegador específico: npm run auth firefox (ou chrome, brave, edge)');
    process.exit(1);
}
