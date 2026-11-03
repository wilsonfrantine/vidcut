// support.js - Exibe as opções de apoio somente se estiverem configuradas em config.js

document.addEventListener('DOMContentLoaded', () => {
    const { paypalUrl = '', pixKey = '' } = (window.VIDCUT_CONFIG || {}).support || {};
    const paypal = document.getElementById('paypalButton');
    const pix = document.getElementById('pixButton');

    paypal.closest('.support-option').hidden = !paypalUrl;
    pix.closest('.support-option').hidden = !pixKey;
    if (paypalUrl) paypal.href = paypalUrl;
    if (pixKey) {
        pix.addEventListener('click', async () => {
            const label = pix.lastChild;
            const original = label.textContent;
            try {
                await navigator.clipboard.writeText(pixKey);
                label.textContent = ' Chave Pix copiada!';
            } catch {
                label.textContent = ` Chave Pix: ${pixKey}`;
            }
            setTimeout(() => { label.textContent = original; }, 3000);
        });
    }

    if (!paypalUrl && !pixKey) {
        document.querySelectorAll('.support-tab, a[href="#credits-view"], #credits-view').forEach(el => el.remove());
    }
});
