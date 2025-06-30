// Configuration file for frontend settings
const CONFIG = {
    API_BASE_URL: 'http://localhost:8000',
    APP_NAME: 'AI Chatbot',
    MODEL_NAME: 'Gemma 3:1B',
    
    // UI Settings
    MAX_MESSAGE_LENGTH: 1000,
    TYPING_DELAY: 500,
    AUTO_SCROLL: true,
    
    // Session Settings
    SESSION_STORAGE_KEY: 'chatSessionId',
    PERSIST_SESSIONS: true,
    
    // API Endpoints
    ENDPOINTS: {
        CHAT: '/chat',
        HISTORY: '/chat/history',
        SESSIONS: '/chat/sessions',
        HEALTH: '/health'
    },
    
    // Error Messages
    ERROR_MESSAGES: {
        NETWORK_ERROR: 'Network error. Please check your connection.',
        SERVER_ERROR: 'Server error. Please try again later.',
        GENERIC_ERROR: 'Sorry, I encountered an error. Please try again.'
    }
};

// Export for use in other files (if using modules)
// export default CONFIG;