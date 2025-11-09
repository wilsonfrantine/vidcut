#!/bin/bash
# install.sh - Install all dependencies of VidCut

set -e  # Stop if anything fail

echo "Installing VidCut..."

# 1. Verifica se é WSL
if grep -q "Microsoft" /proc/version || grep -q "WSL" /proc/version; then
    echo "Detectado: WSL2"
    IS_WSL=true
else
    IS_WSL=false
fi

# 2. Atualiza sistema
echo "Updating packages..."
sudo apt update -qq

# 3. Instala Node.js (se não tiver)
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# 4. Instala pipx
if ! command -v pipx &> /dev/null; then
    echo "Installing pipx..."
    sudo apt install -y pipx
    pipx ensurepath
    export PATH="$PATH:/home/$USER/.local/bin"
fi

# 5. Installing yt-dlp
echo "Installing yt-dlp..."
pipx install yt-dlp --force

# 6. Installing FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "Installing FFmpeg..."
    sudo apt install -y ffmpeg
fi

# 7. Instala dependencies Node
echo "Installnig Node packages..."
npm install

# 8. Cria .env (se necessário)
if [ ! -f .env ]; then
    cp .env.example .env 2>/dev/null || echo "PORT=3000" > .env
fi

echo
echo "Installing finished!"
echo "Start npm: npm start"
echo "Access: http://localhost:3000"
