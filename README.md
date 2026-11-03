# 📼 VidCut – Simple Video Cutter

**VidCut** is a local and minimalist tool for cutting simple segments from video files.  
The application runs locally using a Node.js server and provides a web-based interface accessible through your browser.

---

## ✨ Features

- Cut video segments based on start and end time.
- Simple and intuitive web interface.
- Local processing using FFmpeg.

---

## 🧰 Requirements

- [Node.js](https://nodejs.org/) 18+
- [FFmpeg](https://ffmpeg.org/) (includes `ffprobe`), version 4 or newer
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (only needed for web links), kept up to date

VidCut does **not** install these automatically. On startup the server checks them and the web UI shows a warning with install commands if something is missing or outdated.

| System | Install |
|---|---|
| Debian/Ubuntu | `sudo apt install ffmpeg` · `pipx install yt-dlp` |
| Fedora | `sudo dnf install ffmpeg` · `pipx install yt-dlp` |
| Arch | `sudo pacman -S ffmpeg yt-dlp` |
| macOS | `brew install ffmpeg yt-dlp` |
| Windows | The app runs the tools **inside WSL**: `wsl sudo apt install ffmpeg` · `wsl pipx install yt-dlp` |

Update yt-dlp regularly (`pipx upgrade yt-dlp` / `brew upgrade yt-dlp`), as site changes often break old versions.

Check your setup with `ffmpeg -version` and `yt-dlp --version`.

If the binaries are outside your `PATH`, set `FFMPEG_PATH`, `FFPROBE_PATH` and/or `YTDLP_PATH`:

```bash
FFMPEG_PATH=/opt/ffmpeg/bin/ffmpeg npm start
```

---

## 🚀 Installation & Usage

```bash
# Clone this repository
git clone https://github.com/your-username/vidcut.git
cd vidcut

# Install dependencies
npm install

# Start the server
npm start
```

Then open your browser and go to:

```
http://localhost:3000
```

---

## 📂 Project Structure

```
vidcut/
├── public/           # Static files served to the browser
│   ├── index.html    # Main interface
│   ├── style.css     # UI styles
│   ├── script.js     # Frontend logic
│   ├── deps-banner.js # Missing/outdated dependency warning
│   └── ui.js         # UI helper functions
├── server.js         # Node.js backend that runs FFmpeg
├── deps.js           # Dependency detection (ffmpeg, ffprobe, yt-dlp)
├── package.json      # Project dependencies
```

---

## ⚠️ Notes

- The input video must be available locally on the user's system.
- FFmpeg must be properly installed and accessible via terminal (`ffmpeg -version`).

---

## 📄 License

This project is free to use for personal purposes. Contributions are welcome.

