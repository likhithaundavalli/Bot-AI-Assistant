class BoltChatBot {
    constructor() {
        this.messages = [];
        this.isTyping = false;
        this.messageCounter = 0;
        this.sessionId = null;
        this.apiBase = "http://localhost:8000";

        this.initializeElements();
        this.addEventListeners();
        this.setupTextareaAutoResize();
        this.loadSessionsList();
        this.loadOrCreateSession();
    }

    initializeElements() {
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.sessionsList = document.getElementById('chatSessionsList');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.attachAudioBtn = document.getElementById('attachAudioBtn');
        this.audioInput = document.getElementById('audioInput');
        this.audioFileName = document.getElementById('audioFileName');
    }

    addEventListeners() {
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.messageInput.addEventListener('input', () => {
            this.updateSendButton();
            this.autoResizeTextarea();
        });

        this.sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        if (this.newChatBtn) {
            this.newChatBtn.addEventListener('click', () => this.startNewChat());
        }

        const closeBtn = document.getElementById('closeSidebarBtn');
        const openBtn = document.getElementById('openSidebarBtn');
        const sidebar = document.querySelector('.sidebar');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                sidebar.classList.remove('open');
            });
        }
        if (openBtn) {
            openBtn.addEventListener('click', () => {
                sidebar.classList.add('open');
            });
        }

        this.micBtn = document.getElementById('micBtn');
        if (this.micBtn) {
            this.micBtn.addEventListener('click', () => this.toggleVoiceInput());
        }

        if (this.attachAudioBtn && this.audioInput) {
            this.attachAudioBtn.addEventListener('click', () => this.audioInput.click());
            this.audioInput.addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    this.audioFileName.textContent = e.target.files[0].name;
                    this.audioFileName.style.display = 'inline-block';
                } else {
                    this.audioFileName.textContent = '';
                    this.audioFileName.style.display = 'none';
                }
                this.handleAudioUpload(e);
            });
        }
    }

    setupTextareaAutoResize() {
        this.messageInput.addEventListener('input', () => this.autoResizeTextarea());
    }

    autoResizeTextarea() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    }

    generateId() {
        return `msg_${++this.messageCounter}_${Date.now()}`;
    }

    updateSendButton() {
        const hasText = this.messageInput.value.trim().length > 0;
        this.sendBtn.disabled = !hasText || this.isTyping;
    }

    createWelcomeMessage() {
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'welcome-message';
        welcomeDiv.innerHTML = `
            <div class="welcome-icon">
                <i class="fas fa-bolt" aria-hidden="true"></i>
            </div>
            <h2>Welcome to Bolt AI</h2>
            <p>I'm here to help you with coding, development, and technical questions. What would you like to work on today?</p>
        `;
        return welcomeDiv;
    }

    async loadOrCreateSession() {
        // Always start with no session and show welcome message
        localStorage.removeItem('bolt_session_id');
        this.sessionId = null;
        this.messages = [];
        this.messagesContainer.innerHTML = '';
        const welcomeMessage = this.createWelcomeMessage();
        this.messagesContainer.appendChild(welcomeMessage);
        // Do NOT call loadChatHistory here
    }

    async sendMessage() {
        const text = this.messageInput.value.trim();
        if (!text || this.isTyping) return;

        const welcomeMessage = this.messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }

        const userMessage = {
            id: this.generateId(),
            text: text,
            sender: 'user',
            timestamp: new Date()
        };
        this.messages.push(userMessage);
        this.addMessageToDOM(userMessage);

        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        this.updateSendButton();

        this.showTypingIndicator();

        try {
            const response = await this.fetchBotResponse(text);
            this.sessionId = response.session_id;
            localStorage.setItem('bolt_session_id', this.sessionId);

            const botMessage = {
                id: this.generateId(),
                text: response.response,
                sender: 'bot',
                timestamp: new Date(response.timestamp)
            };
            this.messages.push(botMessage);
            this.hideTypingIndicator();
            this.addMessageToDOM(botMessage);
            this.updateSendButton();
        } catch (err) {
            this.hideTypingIndicator();
            const errorMsg = {
                id: this.generateId(),
                text: "Sorry, I couldn't reach the AI backend.",
                sender: 'bot',
                timestamp: new Date()
            };
            this.messages.push(errorMsg);
            this.addMessageToDOM(errorMsg);
            this.updateSendButton();
        }
    }

    async fetchBotResponse(userInput) {
        const apiUrl = `${this.apiBase}/chat`;
        const payload = {
            message: userInput,
            session_id: this.sessionId
        };
        const res = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("API error");
        return await res.json();
    }

    async loadChatHistory() {
        if (!this.sessionId) return;
        try {
            const res = await fetch(`${this.apiBase}/chat/history/${this.sessionId}`);
            if (!res.ok) {
                if (res.status === 404) {
                    // Session not found, clear and start new chat
                    localStorage.removeItem('bolt_session_id');
                    this.sessionId = null;
                    await this.startNewChat();
                }
                throw new Error("No history");
            }
            const data = await res.json();
            this.messages = [];
            this.messagesContainer.innerHTML = '';
            for (const msg of data.messages) {
                const message = {
                    id: this.generateId(),
                    text: msg.content,
                    sender: msg.type === 'user' ? 'user' : 'bot',
                    timestamp: new Date(msg.timestamp)
                };
                this.messages.push(message);
                this.addMessageToDOM(message);
            }
        } catch (e) {
            // No history or error, ignore
        }
    }

    async loadSessionsList() {
        try {
            const res = await fetch(`${this.apiBase}/chat/sessions`);
            const data = await res.json();
            this.sessionsList.innerHTML = '';
            data.active_sessions.forEach(sessionId => {
                const item = document.createElement('div');
                item.className = 'chat-item';
                item.innerHTML = `
                    <i class="fas fa-comment" aria-hidden="true"></i>
                    <span>${sessionId === this.sessionId ? 'Current Chat' : `Chat: ${sessionId.slice(0, 8)}...`}</span>
                `;
                item.onclick = () => this.switchSession(sessionId);
                if (sessionId === this.sessionId) item.classList.add('active');
                this.sessionsList.appendChild(item);
            });
        } catch (e) {
            this.sessionsList.innerHTML = '<div class="chat-item"><i class="fas fa-comment" aria-hidden="true"></i><span>No chats</span></div>';
        }
    }

    async startNewChat() {
        const res = await fetch(`${this.apiBase}/chat/new`, { method: "POST" });
        const data = await res.json();
        this.sessionId = data.session_id;
        localStorage.setItem('bolt_session_id', this.sessionId);
        this.messages = [];
        this.messagesContainer.innerHTML = '';
        this.loadSessionsList();
        const welcomeMessage = this.createWelcomeMessage();
        this.messagesContainer.appendChild(welcomeMessage);
    }

    async switchSession(sessionId) {
        this.sessionId = sessionId;
        localStorage.setItem('bolt_session_id', this.sessionId);
        this.messages = [];
        this.messagesContainer.innerHTML = '';
        await this.loadChatHistory();
        this.loadSessionsList();
    }

    addMessageToDOM(message) {
        const messageElement = this.createMessageElement(message);
        this.messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.sender}-message`;
        messageDiv.setAttribute('data-message-id', message.id);

        const avatarIcon = message.sender === 'bot' ? 'fa-bolt' : 'fa-user';

        const copyButton = `
            <button class="copy-btn" onclick="copyMessage(this)" title="Copy message">
                <i class="fas fa-copy" aria-hidden="true"></i>
            </button>
        `;

        messageDiv.innerHTML = `
            <div class="message-avatar ${message.sender}-avatar">
                <i class="fas ${avatarIcon}" aria-hidden="true"></i>
            </div>
            <div class="message-content">
                <div class="message-text">${this.escapeHtml(message.text)}</div>
                <div class="message-footer">
                    <span class="timestamp">${this.formatTime(message.timestamp)}</span>
                    ${copyButton}
                </div>
            </div>
        `;

        return messageDiv;
    }

    showTypingIndicator() {
        this.isTyping = true;
        this.typingIndicator.style.display = '';
        this.updateSendButton();
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.isTyping = false;
        this.typingIndicator.style.display = 'none';
        this.updateSendButton();
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    formatTime(date) {
        if (!(date instanceof Date)) date = new Date(date);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    escapeHtml(text) {
        return text.replace(/[&<>"']/g, function (m) {
            return ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[m];
        });
    }

    toggleVoiceInput() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("Sorry, your browser does not support speech recognition.");
            return;
        }
        if (this.isListening) {
            this.stopVoiceInput();
            return;
        }
        this.startVoiceInput();
    }

    playMicSound(type = 'start') {
        // Simple beep using Web Audio API
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = type === 'start' ? 880 : 440;
        g.gain.value = 0.1;
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.15);
        o.onended = () => ctx.close();
    }

    startVoiceInput() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'en-US';
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 1;

        this.isListening = true;
        this.micBtn.classList.add('active');
        this.playMicSound('start');
        this.recognition.start();

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            this.messageInput.value = transcript;
            this.updateSendButton();
            this.isListening = false;
            this.micBtn.classList.remove('active');
        };

        this.recognition.onerror = (event) => {
            this.isListening = false;
            this.micBtn.classList.remove('active');
            alert('Voice recognition error: ' + event.error);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.micBtn.classList.remove('active');
        };
    }

    stopVoiceInput() {
        if (this.recognition) {
            this.recognition.stop();
        }
        this.isListening = false;
        this.micBtn.classList.remove('active');
        this.playMicSound('stop');
    }

    async handleAudioUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const prompt = this.messageInput.value.trim();
        if (!prompt) {
            alert("Please enter your question or prompt about the audio.");
            return;
        }
        // Show typing indicator
        this.showTypingIndicator();
        const formData = new FormData();
        formData.append('audio', file);
        formData.append('prompt', prompt);
        try {
            const res = await fetch(`${this.apiBase}/audio/query`, {
                method: 'POST',
                body: formData
            });
            if (!res.ok) throw new Error('Failed to process audio');
            const data = await res.json();
            // Show bot response
            const botMessage = {
                id: this.generateId(),
                text: data.response,
                sender: 'bot',
                timestamp: new Date()
            };
            this.messages.push(botMessage);
            this.hideTypingIndicator();
            this.addMessageToDOM(botMessage);
        } catch (err) {
            this.hideTypingIndicator();
            alert('Audio processing failed.');
        }
        this.audioFileName.textContent = '';
        this.audioFileName.style.display = 'none';
    }
}

function copyMessage(button) {
    const messageContent = button.closest('.message-content');
    const messageText = messageContent.querySelector('.message-text').textContent;

    navigator.clipboard.writeText(messageText).then(() => {
        button.classList.add('copied');
        setTimeout(() => button.classList.remove('copied'), 1000);
    }).catch(() => {
        alert("Failed to copy message.");
    });
}

function sendMessage() {
    if (window.boltChatBot) {
        window.boltChatBot.sendMessage();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.boltChatBot = new BoltChatBot();

    const sidebar = document.querySelector('.sidebar');
    const closeBtn = document.getElementById('closeSidebarBtn');
    const openBtn = document.getElementById('openSidebarBtn');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            sidebar.classList.remove('open');
        });
    }
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            sidebar.classList.add('open');
        });
    }

    // Always show the open button
    openBtn.style.display = 'inline-block';
});