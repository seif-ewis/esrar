document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('userInput');
    const chatContainer = document.getElementById('chat-container');
    const welcomeScreen = document.getElementById('welcome-screen');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatHistoryList = document.getElementById('chat-history-list');
    const usernameDisplay = document.getElementById('username-display');

    let conversations = {};
    let currentConversationId = null;

    // --- INITIALIZATION ---
    function initializeApp() {
        const user = JSON.parse(localStorage.getItem('user'));
        // Apply saved theme
if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-mode');
}

const micBtn = document.getElementById('mic-btn');
let recognition;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = false;
    recognition.interimResults = false;

    micBtn.addEventListener('click', () => {
        recognition.start();
        micBtn.classList.add('is-listening');
    });

    recognition.onresult = (event) => {
        const speechText = event.results[0][0].transcript;
        userInput.value += speechText;
        micBtn.classList.remove('is-listening');
    };

    recognition.onerror = () => micBtn.classList.remove('is-listening');
}


        
        if (user && user.name) {
usernameDisplay.textContent = user.name.replace(/[\u{1F600}-\u{1F6FF}]/gu, '').trim();
        }
        
        loadConversations();
        renderChatHistory();

        if (Object.keys(conversations).length === 0) {
            startNewConversation();
        } else {
            const latestConversationId = Object.keys(conversations).sort().pop();
            loadConversation(latestConversationId);
        }

        const exampleCards = document.querySelectorAll('.card');
        exampleCards.forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.getAttribute('data-prompt');
                userInput.value = prompt;
                chatForm.requestSubmit();
            });
        });

        document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
});

    }

    // --- EVENT LISTENERS ---
    newChatBtn.addEventListener('click', startNewConversation);
    chatForm.addEventListener('submit', handleFormSubmit);

    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = `${userInput.scrollHeight}px`;
    });

    // --- ADDED: 'Enter to Send' functionality ---
    userInput.addEventListener('keydown', (e) => {
        // Check if the key pressed is 'Enter' and the Shift key is NOT held down.
        if (e.key === 'Enter' && !e.shiftKey) {
            // Prevent the default action (which is to add a new line).
            e.preventDefault();
            
            // Trigger the form's submit event.
            chatForm.requestSubmit();
        }
    });
    // --- END OF ADDED CODE ---

    // --- CORE FUNCTIONS ---
    async function handleFormSubmit(e) {
        e.preventDefault();
        const userText = userInput.value.trim();
        if (!userText) return;

        if (welcomeScreen) welcomeScreen.style.display = 'none';
        
        addMessageToCurrentConversation(userText, 'user');
        userInput.value = '';
        userInput.style.height = 'auto';
        
        await getAiResponse(userText);
    }

    async function getAiResponse(userText) {
        addMessageToCurrentConversation('', 'ai', true); // Add loading indicator

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userText }),
            });
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            
            updateLastMessage(data.reply);
        } catch (error) {
            console.error('Error fetching AI response:', error);
            updateLastMessage('عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.');
        }
    }
    
    // --- CONVERSATION & MESSAGE MANAGEMENT ---
    function startNewConversation() {
        currentConversationId = `chat_${Date.now()}`;
        conversations[currentConversationId] = {
            title: "محادثة جديدة",
            messages: []
        };
        renderCurrentConversation();
        renderChatHistory();
        saveConversations();
    }

    function addMessageToCurrentConversation(text, sender, isLoading = false) {
        if (!currentConversationId) return;
        const message = { text, sender, isLoading };
        conversations[currentConversationId].messages.push(message);

        if (sender === 'user' && conversations[currentConversationId].messages.length === 1) {
            conversations[currentConversationId].title = text.substring(0, 30);
            renderChatHistory();
        }

        renderCurrentConversation();
        saveConversations();
    }

    function updateLastMessage(newText) {
        if (!currentConversationId) return;
        const currentMessages = conversations[currentConversationId].messages;
        if (currentMessages.length > 0) {
            const lastMessage = currentMessages[currentMessages.length - 1];
            lastMessage.text = newText;
            lastMessage.isLoading = false;
        }
        renderCurrentConversation();
        saveConversations();
    }

    // --- RENDERING ---
    function renderCurrentConversation() {
        chatContainer.innerHTML = '';
        if (!currentConversationId || !conversations[currentConversationId]) {
            welcomeScreen.style.display = 'block';
            return;
        }
        welcomeScreen.style.display = 'none';
        
        conversations[currentConversationId].messages.forEach(msg => {
            addMessageToDOM(msg.text, msg.sender, msg.isLoading);
        });
    }

    function addMessageToDOM(text, sender, isLoading = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        const iconClass = sender === 'user' ? 'fa-user-circle' : 'fa-robot';
        
        let textContent = text;
        if (isLoading) {
            textContent = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        } else if (sender === 'ai') {
textContent = text; // Already HTML from backend
        }

        messageDiv.innerHTML = `
            <i class="fas ${iconClass} icon"></i>
<div class="text">
    ${textContent}
    <div class="timestamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
</div>
        `;
        chatContainer.appendChild(messageDiv);
        
        messageDiv.querySelectorAll('pre code').forEach(addCopyButton);
        
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function renderChatHistory() {
        chatHistoryList.innerHTML = '';
        Object.keys(conversations).sort().reverse().forEach(id => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="far fa-comment-alt"></i><span>${conversations[id].title}</span>`;
            if (id === currentConversationId) {
                li.classList.add('active');
            }
            li.addEventListener('click', () => loadConversation(id));
            chatHistoryList.appendChild(li);
        });
    }

    // --- LOCAL STORAGE & HELPERS ---
    function saveConversations() {
        localStorage.setItem('chatConversations', JSON.stringify(conversations));
    }

    function loadConversations() {
        const saved = localStorage.getItem('chatConversations');
        conversations = saved ? JSON.parse(saved) : {};
    }

    function loadConversation(id) {
        if (conversations[id]) {
            currentConversationId = id;
            renderCurrentConversation();
            renderChatHistory();
        }
    }

    function addCopyButton(codeBlock) {
        const pre = codeBlock.parentElement;
        const btn = document.createElement('button');
        btn.className = 'copy-code-btn';
        btn.textContent = 'نسخ';
        btn.addEventListener('click', () => {
            navigator.clipboard.writeText(codeBlock.textContent).then(() => {
                btn.textContent = 'تم النسخ!';
                setTimeout(() => { btn.textContent = 'نسخ'; }, 2000);
            });
        });
        pre.appendChild(btn);
    }
    
    // --- Start the application ---
    initializeApp();
});