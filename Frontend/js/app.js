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
        this.loadSessionsList(); // Load all sessions
        this.loadOrCreateSession();
    }

    initializeElements() {
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.sessionsList = document.getElementById('chatSessionsList');
        this.newChatBtn = document.getElementById('newChatBtn');
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

        // Optional: Clear chat button
        const clearBtn = document.querySelector('.action-btn[title="Clear chat"]');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearChatHistory());
        }

        if (this.newChatBtn) {
            this.newChatBtn.addEventListener('click', () => this.startNewChat());
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

    async loadOrCreateSession() {
        // Try to reuse session from localStorage
        this.sessionId = localStorage.getItem('bolt_session_id');
        if (!this.sessionId) {
            // Create a new session by sending a dummy message (or just generate a uuid)
            this.sessionId = null;
        }
        if (this.sessionId) {
            await this.loadChatHistory();
        }
    }

    async sendMessage() {
        const text = this.messageInput.value.trim();
        if (!text || this.isTyping) return;

        // Hide welcome message if it exists
        const welcomeMessage = this.messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }

        // Add user message to UI
        const userMessage = {
            id: this.generateId(),
            text: text,
            sender: 'user',
            timestamp: new Date()
        };
        this.messages.push(userMessage);
        this.addMessageToDOM(userMessage);

        // Clear input and reset height
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        this.updateSendButton();

        // Show typing indicator
        this.showTypingIndicator();

        // Send to backend
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
            if (!res.ok) throw new Error("No history");
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

    async clearChatHistory() {
        if (!this.sessionId) return;
        try {
            await fetch(`${this.apiBase}/chat/history/${this.sessionId}`, { method: "DELETE" });
            this.messages = [];
            this.messagesContainer.innerHTML = '';
            // Optionally show welcome message again
            const welcomeMessage = document.querySelector('.welcome-message');
            if (welcomeMessage) welcomeMessage.style.display = '';
        } catch (e) {
            alert("Failed to clear chat history.");
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
                item.textContent = sessionId === this.sessionId ? 'Current Chat' : `Chat: ${sessionId.slice(0, 8)}...`;
                item.onclick = () => this.switchSession(sessionId);
                if (sessionId === this.sessionId) item.classList.add('active');
                this.sessionsList.appendChild(item);
            });
        } catch (e) {
            this.sessionsList.innerHTML = '<div class="chat-item">No chats</div>';
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
        // Show welcome message
        const welcomeMessage = document.querySelector('.welcome-message');
        if (welcomeMessage) {
            this.messagesContainer.appendChild(welcomeMessage);
            welcomeMessage.style.display = '';
        }
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

        const avatarSVG = message.sender === 'bot'
            ? '<polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/>'
            : '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';

        const copyButton = `
            <button class="copy-btn" onclick="copyMessage(this)" title="Copy message">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                    <path d="m4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
            </button>
        `;

        messageDiv.innerHTML = `
            <div class="message-avatar ${message.sender}-avatar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    ${avatarSVG}
                </svg>
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
}

// Global functions
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

// Initialize the chatbot when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.boltChatBot = new BoltChatBot();
});

// Handle window resize for mobile optimization
window.addEventListener('resize', () => {
    if (window.boltChatBot) {
        // Optionally handle resize
    }
});