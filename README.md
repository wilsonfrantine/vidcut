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

- [Node.js](https://nodejs.org/) installed
- [FFmpeg](https://ffmpeg.org/) available in your system `PATH`

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
│   └── ui.js         # UI helper functions
├── server.js         # Node.js backend that runs FFmpeg
├── package.json      # Project dependencies
```

---

## ⚠️ Notes

- The input video must be available locally on the user's system.
- FFmpeg must be properly installed and accessible via terminal (`ffmpeg -version`).

---

## 📄 License

This project is free to use for personal purposes. Contributions are welcome.

