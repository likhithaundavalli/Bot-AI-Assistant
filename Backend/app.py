from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from langchain_ollama import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate
import uvicorn
from datetime import datetime
import uuid

app = FastAPI(title="AI Chatbot API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the model
template = """ 
Answer the question below.

Here is the conversation history: {context}

Question: {question}

Answer:
"""

model = OllamaLLM(model="gemma3:1b")
prompt = ChatPromptTemplate.from_template(template)
chain = prompt | model

# Pydantic models
class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str
    timestamp: str

class ChatHistory(BaseModel):
    session_id: str
    messages: List[dict]

# In-memory storage for chat sessions
chat_sessions = {}

@app.get("/")
async def root():
    return {"message": "AI Chatbot API is running!"}

@app.post("/chat", response_model=ChatResponse)
async def chat(chat_message: ChatMessage):
    try:
        # Generate session ID if not provided
        session_id = chat_message.session_id or str(uuid.uuid4())
        
        # Get or create session context
        if session_id not in chat_sessions:
            chat_sessions[session_id] = {
                "context": "",
                "messages": []
            }
        
        session = chat_sessions[session_id]
        
        # Get response from the model
        response = chain.invoke({
            "context": session["context"], 
            "question": chat_message.message
        })
        
        # Update session context and messages
        session["context"] += f"\nUser: {chat_message.message}\nAI: {response}"
        session["messages"].append({
            "type": "user",
            "content": chat_message.message,
            "timestamp": datetime.now().isoformat()
        })
        session["messages"].append({
            "type": "assistant",
            "content": response,
            "timestamp": datetime.now().isoformat()
        })
        
        return ChatResponse(
            response=response,
            session_id=session_id,
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")

@app.get("/chat/history/{session_id}", response_model=ChatHistory)
async def get_chat_history(session_id: str):
    if session_id not in chat_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return ChatHistory(
        session_id=session_id,
        messages=chat_sessions[session_id]["messages"]
    )

@app.delete("/chat/history/{session_id}")
async def clear_chat_history(session_id: str):
    if session_id not in chat_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    chat_sessions[session_id] = {
        "context": "",
        "messages": []
    }
    
    return {"message": "Chat history cleared successfully"}

@app.get("/chat/sessions")
async def get_active_sessions():
    return {
        "active_sessions": list(chat_sessions.keys()),
        "total_sessions": len(chat_sessions)
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/chat/new")
async def create_new_session():
    session_id = str(uuid.uuid4())
    chat_sessions[session_id] = {
        "context": "",
        "messages": []
    }
    return {"session_id": session_id}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)