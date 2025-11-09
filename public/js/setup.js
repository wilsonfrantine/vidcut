const socket = io();

socket.on('update-available', (data) => {
  document.getElementById('current').textContent = data.current;
  document.getElementById('latest').textContent = data.latest;
  document.getElementById('updateModal').style.display = 'block';
});

document.getElementById('updateBtn').onclick = () => {
  fetch('/api/update-ytdlp', { method: 'POST' })
    .then(() => alert('Atualizado! Reiniciando...'))
    .then(() => location.reload());
};

document.getElementById('laterBtn').onclick = () => {
  document.getElementById('updateModal').style.display = 'none';
};
