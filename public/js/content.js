window.onload = () => {
    fetchContent();
};

function fetchContent() {
    fetch('/api/content')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => renderContent(data))
        .catch(error => console.error('Error fetching content:', error));
}

function renderContent(content) {
    const container = document.getElementById('contentContainer');
    if (!container) {
        console.error('Content container not found');
        return;
    }

    container.innerHTML = ''; 

    content.forEach(item => {
        const contentItem = document.createElement('div');
        contentItem.classList.add('content-item'); 

        contentItem.innerHTML = `
            <h3>${escapeHTML(item.title)}</h3>
            <p>${escapeHTML(item.description)}</p>
            <audio controls>
                <source src="${item.fileUrl}" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
        `;

        container.appendChild(contentItem);
    });
}

function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}