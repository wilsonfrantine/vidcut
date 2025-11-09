#!/bin/bash
# update-ytdlp.sh

echo "Updating yt-dlp..."
pipx upgrade yt-dlp --quiet && echo "yt-dlp updated!"
