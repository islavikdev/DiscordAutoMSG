document.getElementById('saveToken').addEventListener('click', () => {
    const token = document.getElementById('userToken').value.trim();

    if (!token) {
        alert('Please enter a Discord token');
        return;
    }

    chrome.storage.local.set({ userToken: token }, () => {
        const status = document.getElementById('status');
        status.textContent = 'Token saved!';
        status.className = 'status connected';

        setTimeout(() => {
            window.close();
        }, 1000);
    });
});

chrome.storage.local.get(['userToken'], (data) => {
    if (data.userToken) {
        document.getElementById('userToken').value = data.userToken;
        document.getElementById('status').textContent = 'Token loaded';
        document.getElementById('status').className = 'status connected';
    }
});