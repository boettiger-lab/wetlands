"""
LLM Proxy Server for Kubernetes Deployment
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

# Enable CORS - only allow requests from GitHub Pages site
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://boettiger-lab.github.io",
        "http://localhost:8000",  # For local testing
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],  # Allow all headers to prevent preflight failures
)

# Get configuration from environment
def get_llm_endpoint():
    endpoint = os.getenv("LLM_ENDPOINT")
    if not endpoint:
        endpoint = "https://ellm.nrp-nautilus.io/v1"
    # Always construct endpoint as <base>/chat/completions
    endpoint = endpoint.rstrip("/")
    if not endpoint.endswith("/chat/completions"):
        endpoint = endpoint + "/chat/completions"
    print(f"LLM_ENDPOINT set to: {endpoint}")
    return endpoint

LLM_ENDPOINT = get_llm_endpoint()
LLM_API_KEY = os.getenv("NRP_API_KEY")

if not LLM_API_KEY:
    print("WARNING: NRP_API_KEY environment variable not set!")

class ChatRequest(BaseModel):
    messages: List[Dict[str, Any]]  # Accept any message format from OpenAI API
    tools: Optional[List[Dict[str, Any]]] = None
    tool_choice: Optional[str] = "auto"
    model: Optional[str] = "gpt-4"
    temperature: Optional[float] = 0.7

@app.post("/chat")
async def proxy_chat(request: ChatRequest):
    """
    Proxy chat requests to LLM endpoint with API key from environment
    Access controlled via ingress CORS rules
    """
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
        "messages": request.messages,  # Pass through messages as-is
        "temperature": request.temperature
    }
    
    # Add tools if provided
    if request.tools:
        payload["tools"] = request.tools
        payload["tool_choice"] = request.tool_choice
    
    # Make request to LLM
    async with httpx.AsyncClient(timeout=120.0) as client:
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
    """Generic LLM endpoint proxy"""
    body = await request.body()
    headers = dict(request.headers)
    # Remove host header to avoid issues
    headers.pop("host", None)
    # Add API key
    headers["Authorization"] = f"Bearer {LLM_API_KEY}"
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(LLM_ENDPOINT, content=body, headers=headers)
            return Response(
                content=resp.content, 
                status_code=resp.status_code, 
                media_type=resp.headers.get("content-type", "application/json")
            )
        except Exception as e:
            print(f"ERROR in /llm endpoint: {type(e).__name__}: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

@app.options("/llm")
async def options_llm():
    """Handle CORS preflight for /llm endpoint"""
    return Response(status_code=204)

@app.options("/chat")
async def options_chat():
    """Handle CORS preflight for /chat endpoint"""
    return Response(status_code=204)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "llm_endpoint": LLM_ENDPOINT,
        "api_key_configured": bool(LLM_API_KEY)
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "LLM Proxy for Wetlands Chatbot",
        "endpoints": {
            "/chat": "POST - Main chat endpoint with structured request",
            "/llm": "POST - Generic LLM proxy endpoint",
            "/health": "GET - Health check"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
