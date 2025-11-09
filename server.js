// server.js - VidCut (A simple tool to cut youtube video)

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const multer = require('multer');
const http = require('http');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// ========================================
// DIRECTORIES
// ========================================
const UPLOAD_DIR = path.join(__dirname, 'videos');
const OUTPUT_DIR = path.join(__dirname, 'output');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// ========================================
// FILE UPLOAD (MULTER)
// ========================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ========================================
// MIDDLEWARE
// ========================================
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
app.use('/videos', express.static(UPLOAD_DIR));
app.use('/output', express.static(OUTPUT_DIR));

// ========================================
// AUTO-UPDATE yt-dlp (SILENT, NO UI)
// ========================================
let updateChecked = false;

function getCurrentVersion() {
  return new Promise(resolve => {
    exec('yt-dlp --version', (err, stdout) => {
      resolve(err ? null : stdout.trim());
    });
  });
}

async function getLatestVersion() {
  try {
    const res = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest');
    const data = await res.json();
    return data.tag_name;
  } catch (err) {
    console.error('Failed to fetch latest version:', err.message);
    return null;
  }
}

async function checkForUpdate() {
  if (updateChecked) return;
  updateChecked = true;

  const current = await getCurrentVersion();
  const latest = await getLatestVersion();

  console.log(`[UPDATE] Current: ${current} | Latest: ${latest}`);

  if (current && latest && current !== latest) {
    console.log(`UPDATING yt-dlp: ${current} → ${latest}`);
    exec('pipx upgrade yt-dlp', (err, stdout, stderr) => {
      if (err) {
        console.error('Update failed:', stderr);
        return;
      }
      console.log('yt-dlp updated. Restarting in 1s...');
      setTimeout(() => process.exit(0), 1000);
    });
  } else {
    console.log('yt-dlp is up to date.');
  }
}

// ========================================
// ROUTES
// ========================================

// Upload local video
app.post('/upload', upload.single('videoFile'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  res.json({ message: 'Upload successful!', filename: req.file.filename });
});

// Download from YouTube
app.post('/download-from-youtube', (req, res) => {
  const { youtubeUrl } = req.body;
  if (!youtubeUrl) return res.status(400).json({ message: 'YouTube URL required.' });

  const baseName = `yt_${Date.now()}`;
  const outputPath = path.join(UPLOAD_DIR, `${baseName}.%(ext)s`);
  const isWSL = process.platform === 'linux';

  const command = isWSL
    ? `yt-dlp -o "${outputPath}" -f "bv*+ba/b" "${youtubeUrl}"`
    : `wsl yt-dlp -o "/mnt/${outputPath[0].toLowerCase()}${outputPath.slice(2).replace(/\\/g, '/')}" -f "bv*+ba/b" "${youtubeUrl}"`;

  exec(command, (err, stdout, stderr) => {
    if (err) {
      console.error('yt-dlp error:', err.message);
      return res.status(500).json({ message: 'Download failed.', error: stderr });
    }

    const files = fs.readdirSync(UPLOAD_DIR);
    const finalFile = files.find(f => f.startsWith(baseName));
    if (!finalFile) return res.status(500).json({ message: 'File not found after download.' });

    res.json({ message: 'Download complete!', filename: finalFile });
  });
});

// Cut video
app.post('/processar-video', (req, res) => {
  const { videoPath, start, end } = req.body;
  const inputPath = path.join(UPLOAD_DIR, videoPath);
  const outputPath = path.join(OUTPUT_DIR, `cut_${videoPath}`);

  if (!fs.existsSync(inputPath)) {
    return res.status(404).json({ message: `File not found: ${videoPath}` });
  }

  const isWSL = process.platform === 'linux';
  const command = isWSL
    ? `ffmpeg -y -i "${inputPath}" -ss ${start.toFixed(3)} -to ${end.toFixed(3)} -c copy "${outputPath}"`
    : `wsl ffmpeg -y -i "/mnt/${inputPath[0].toLowerCase()}${inputPath.slice(2).replace(/\\/g, '/')}" -ss ${start.toFixed(3)} -to ${end.toFixed(3)} -c copy "/mnt/${outputPath[0].toLowerCase()}${outputPath.slice(2).replace(/\\/g, '/')}"`;

  exec(command, (err, stdout, stderr) => {
    if (err) {
      console.error('FFmpeg error:', err.message);
      return res.status(500).json({ message: 'Cut failed.', error: stderr });
    }
    res.json({ message: 'Video cut successfully!', outputFile: `cut_${videoPath}` });
  });
});

// ========================================
// CLEANUP ON EXIT
// ========================================
function cleanup() {
  console.log('Cleaning up directories...');
  [UPLOAD_DIR, OUTPUT_DIR].forEach(dir => {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir);
  });
  process.exit();
}
process.on('SIGINT', cleanup);

// ========================================
// START SERVER
// ========================================
server.listen(PORT, () => {
  console.log(`VidCut running at http://localhost:${PORT}`);
  setTimeout(checkForUpdate, 2000);
});
