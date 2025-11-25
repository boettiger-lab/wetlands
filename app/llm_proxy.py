"""
LLM Proxy Server
Securely proxies requests to OpenAI-compatible LLM endpoint
API key is stored in environment variable, never exposed to browser
Requires authentication token to prevent unauthorized use
"""

from fastapi import FastAPI, HTTPException, Header, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import os
from typing import List, Dict, Any, Optional

app = FastAPI(title="LLM Proxy for Wetlands Chatbot")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get configuration from environment
def get_llm_endpoint():
    env_endpoint = os.getenv("LLM_ENDPOINT")
    if env_endpoint:
        return env_endpoint
    # Try to read from mcp/config.json
    try:
        import json
        with open("mcp/config.json") as f:
            config = json.load(f)
        endpoint = config.get("llm_endpoint", "https://api.openai.com/v1")
        # Always construct endpoint as <base>/chat/completions
        if endpoint.endswith("/"):
            endpoint = endpoint[:-1]
        endpoint = endpoint + "/chat/completions"
        return endpoint
    except Exception:
        return "https://api.openai.com/v1/chat/completions"

LLM_ENDPOINT = get_llm_endpoint()
print(f"LLM_ENDPOINT set to: {LLM_ENDPOINT}")
LLM_API_KEY = os.getenv("NRP_API_KEY")
PROXY_AUTH_TOKEN = os.getenv("PROXY_AUTH_TOKEN")  # New: required auth token

if not LLM_API_KEY:
    print("WARNING: NRP_API_KEY environment variable not set!")
if not PROXY_AUTH_TOKEN:
    print("WARNING: PROXY_AUTH_TOKEN not set - proxy will accept requests from anyone!")

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    tools: Optional[List[Dict[str, Any]]] = None
    tool_choice: Optional[str] = "auto"
    model: Optional[str] = "gpt-4"
    temperature: Optional[float] = 0.7

@app.post("/chat")
async def proxy_chat(
    request: ChatRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Proxy chat requests to LLM endpoint with API key from environment
    Requires Authorization header with bearer token if PROXY_AUTH_TOKEN is set
    """
    # Check authentication if token is configured
    if PROXY_AUTH_TOKEN:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization header required")
        
        # Expect "Bearer <token>" format
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization format")
        
        token = authorization[7:]  # Remove "Bearer " prefix
        if token != PROXY_AUTH_TOKEN:
            raise HTTPException(status_code=403, detail="Invalid authorization token")
    
    if not LLM_API_KEY:
        raise HTTPException(status_code=500, detail="NRP_API_KEY not configured on server")
    
    print(f"Proxying request to: {LLM_ENDPOINT}")
    print(f"Model: {request.model}")
    print(f"Messages count: {len(request.messages)}")
    
    # Prepare request to LLM
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {LLM_API_KEY}"
    }
    
    payload = {
        "model": request.model,
        "messages": [{"role": msg.role, "content": msg.content} for msg in request.messages],
        "temperature": request.temperature
    }
    
    # Add tools if provided
    if request.tools:
        payload["tools"] = request.tools
        payload["tool_choice"] = request.tool_choice
    
    # Make request to LLM
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(LLM_ENDPOINT, json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            error_detail = f"LLM API returned {e.response.status_code}: {e.response.text}"
            print(f"ERROR: {error_detail}")
            raise HTTPException(status_code=500, detail=error_detail)
        except Exception as e:
            error_detail = f"LLM request failed: {type(e).__name__}: {str(e)}"
            print(f"ERROR: {error_detail}")
            raise HTTPException(status_code=500, detail=error_detail)

@app.post("/llm")
async def proxy_llm(request: Request):
    body = await request.body()
    headers = dict(request.headers)
    # Remove host header to avoid issues
    headers.pop("host", None)
    async with httpx.AsyncClient() as client:
        resp = await client.post(LLM_ENDPOINT, content=body, headers=headers)
    return Response(content=resp.content, status_code=resp.status_code, media_type=resp.headers.get("content-type", "application/json"))

@app.options("/llm")
async def options_llm():
    return Response(status_code=204)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "llm_endpoint": LLM_ENDPOINT,
        "api_key_configured": bool(LLM_API_KEY)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
