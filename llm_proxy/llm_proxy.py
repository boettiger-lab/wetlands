"""
LLM Proxy Server for Kubernetes Deployment
Multi-provider proxy supporting NRP, OpenRouter, and Nimbus endpoints
Provides unified logging for all LLM requests
API keys stored in environment variables, never exposed to browser
Requires authentication token to prevent unauthorized use
"""

from fastapi import FastAPI, HTTPException, Header, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import os
import json
import time
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path

app = FastAPI(title="Multi-Provider LLM Proxy for Wetlands Chatbot")

# Enable CORS - allow requests from GitHub Pages and k8s deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://cboettig.github.io",
        "https://boettiger-lab.github.io",
        "https://wetlands.nrp-nautilus.io",  # K8s deployment
        "https://nature.nrp-nautilus.io",  # K8s deployment
        "http://localhost:8000",  # For local testing
    ],
    allow_credentials=True,  # Required for Authorization header
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],  # Allow all headers to prevent preflight failures
)

# Load configuration from config.json
def load_config() -> dict:
    """Load provider configuration from config.json file"""
    config_path = Path(__file__).parent / "config.json"
    
    # Default configuration if config.json doesn't exist
    default_config = {
        "providers": {
            "nrp": {
                "endpoint": "https://ellm.nrp-nautilus.io/v1/chat/completions",
                "api_key_env": "NRP_API_KEY",
                "models": ["kimi", "qwen3", "glm-4.6"]
            },
            "openrouter": {
                "endpoint": "https://openrouter.ai/api/v1/chat/completions",
                "api_key_env": "OPENROUTER_KEY",
                "models": ["anthropic/", "mistralai/", "amazon/", "openai/", "qwen/"],
                "extra_headers": {
                    "HTTP-Referer": "https://wetlands.nrp-nautilus.io",
                    "X-Title": "Wetlands Chatbot"
                }
            },
            "nimbus": {
                "endpoint": "https://vllm-cirrus.carlboettiger.info/v1/chat/completions",
                "api_key_env": "NIMBUS_API_KEY",
                "models": ["cirrus"]
            }
        }
    }
    
    if config_path.exists():
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
            print(f"✓ Loaded configuration from {config_path}")
            return config
        except Exception as e:
            print(f"⚠️  Error loading {config_path}: {e}")
            print("   Using default configuration")
            return default_config
    else:
        print(f"ℹ️  No config.json found at {config_path}, using defaults")
        return default_config

# Load config and build providers
config = load_config()
PROXY_KEY = os.getenv("PROXY_KEY")  # Key required from clients

# Build PROVIDERS dictionary from config
PROVIDERS = {}
for provider_name, provider_config in config["providers"].items():
    api_key_env = provider_config.get("api_key_env")
    api_key = os.getenv(api_key_env) if api_key_env else None
    
    PROVIDERS[provider_name] = {
        "endpoint": provider_config["endpoint"],
        "api_key": api_key,
        "models": provider_config["models"],
        "extra_headers": provider_config.get("extra_headers", {})
    }

# Log configuration status
print("=" * 60)
print("🚀 Multi-Provider LLM Proxy Starting")
print("=" * 60)
for provider, config in PROVIDERS.items():
    has_key = bool(config["api_key"])
    status = "✓" if has_key else "✗"
    print(f"{status} {provider.upper()}: {config['endpoint']} (key: {'set' if has_key else 'MISSING'})")
if not PROXY_KEY:
    print("⚠️  WARNING: PROXY_KEY not set - proxy will reject all requests!")
print("=" * 60)

def get_provider_for_model(model: str) -> tuple[str, dict]:
    """Determine which provider to use based on model name"""
    # Check exact matches first (NRP and Nimbus)
    for provider_name, config in PROVIDERS.items():
        if model in config["models"]:
            return provider_name, config
    
    # Check prefix matches (OpenRouter)
    for provider_name, config in PROVIDERS.items():
        for model_prefix in config["models"]:
            if model.startswith(model_prefix):
                return provider_name, config
    
    # Default to NRP
    print(f"⚠️  Unknown model '{model}', defaulting to NRP")
    return "nrp", PROVIDERS["nrp"]

def log_request(provider: str, model: str, messages: List[Dict], tools_count: int = 0):
    """Log incoming request in structured JSON format"""
    log_entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "type": "request",
        "provider": provider,
        "model": model,
        "message_count": len(messages),
        "tools_count": tools_count,
        "user_message": messages[-1].get("content", "")[:200] if messages else ""  # Last message preview
    }
    print(f"📥 REQUEST: {json.dumps(log_entry)}", flush=True)

def log_response(provider: str, model: str, response_data: dict, latency_ms: int, error: str = None):
    """Log response in structured JSON format"""
    log_entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "type": "response",
        "provider": provider,
        "model": model,
        "latency_ms": latency_ms,
    }
    
    if error:
        log_entry["error"] = error
    else:
        # Extract response details
        if "choices" in response_data and len(response_data["choices"]) > 0:
            message = response_data["choices"][0].get("message", {})
            log_entry["has_content"] = bool(message.get("content"))
            log_entry["has_tool_calls"] = bool(message.get("tool_calls"))
            log_entry["content_preview"] = (message.get("content") or "")[:200]
            
            if message.get("tool_calls"):
                tool_names = [tc["function"]["name"] for tc in message["tool_calls"]]
                log_entry["tool_calls"] = tool_names
        
        # Extract token usage if available
        if "usage" in response_data:
            log_entry["tokens"] = response_data["usage"]
    
    status = "✗" if error else "✓"
    print(f"{status} RESPONSE: {json.dumps(log_entry)}", flush=True)

class ChatRequest(BaseModel):
    messages: List[Dict[str, Any]]  # Accept any message format from OpenAI API
    tools: Optional[List[Dict[str, Any]]] = None
    tool_choice: Optional[str] = "auto"
    model: Optional[str] = "gpt-4"
    temperature: Optional[float] = 0.7

@app.post("/v1/chat/completions")
@app.post("/chat")  # Keep for backward compatibility
async def proxy_chat(request: ChatRequest, authorization: Optional[str] = Header(None)):
    """
    Multi-provider proxy for chat completions
    Routes requests to appropriate provider based on model name
    Logs all requests and responses for observability
    Requires client to provide PROXY_KEY via Authorization header
    """
    start_time = time.time()
    
    # Check client authorization
    if not PROXY_KEY:
        raise HTTPException(status_code=500, detail="PROXY_KEY not configured on server")
    
    client_key = None
    if authorization:
        client_key = authorization.replace('Bearer ', '').strip()
    
    if not client_key or client_key != PROXY_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid or missing proxy key")
    
    # Determine provider based on model
    provider_name, provider_config = get_provider_for_model(request.model)
    endpoint = provider_config["endpoint"]
    api_key = provider_config["api_key"]
    
    if not api_key:
        error_msg = f"{provider_name.upper()} API key not configured on server"
        log_response(provider_name, request.model, {}, 0, error=error_msg)
        raise HTTPException(status_code=500, detail=error_msg)
    
    # Log incoming request
    log_request(provider_name, request.model, request.messages, len(request.tools or []))
    
    # Prepare request to LLM provider
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    # Add provider-specific extra headers if configured
    if "extra_headers" in provider_config and provider_config["extra_headers"]:
        headers.update(provider_config["extra_headers"])
    
    payload = {
        "model": request.model,
        "messages": request.messages,
        "temperature": request.temperature
    }
    
    # Add tools if provided
    if request.tools:
        payload["tools"] = request.tools
        payload["tool_choice"] = request.tool_choice
    
    # Make request to LLM provider
    async with httpx.AsyncClient(timeout=600.0) as client:
        try:
            response = await client.post(endpoint, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            
            # Log successful response
            latency_ms = int((time.time() - start_time) * 1000)
            log_response(provider_name, request.model, result, latency_ms)
            
            return result
            
        except httpx.TimeoutException as e:
            latency_ms = int((time.time() - start_time) * 1000)
            error_detail = f"Request timed out after {latency_ms}ms"
            log_response(provider_name, request.model, {}, latency_ms, error=error_detail)
            raise HTTPException(status_code=504, detail=error_detail)
            
        except httpx.HTTPStatusError as e:
            latency_ms = int((time.time() - start_time) * 1000)
            error_detail = f"Provider returned {e.response.status_code}: {e.response.text[:200]}"
            log_response(provider_name, request.model, {}, latency_ms, error=error_detail)
            
            # Pass through certain status codes to client
            if e.response.status_code in [400, 401, 402, 403, 429]:
                # Client errors and rate limits - pass through the original status
                raise HTTPException(status_code=e.response.status_code, detail=error_detail)
            else:
                # Other errors become 502 Bad Gateway (more accurate than 500)
                raise HTTPException(status_code=502, detail=error_detail)
            
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            error_detail = f"{type(e).__name__}: {str(e)}"
            log_response(provider_name, request.model, {}, latency_ms, error=error_detail)
            
            # Use 502 Bad Gateway for connection errors (more accurate than 500)
            # 500 should only be for internal proxy errors
            raise HTTPException(status_code=502, detail=f"Connection error: {error_detail}")

@app.options("/v1/chat/completions")
@app.options("/chat")
async def options_chat():
    """Handle CORS preflight for chat endpoints"""
    return Response(status_code=204)

@app.get("/health")
async def health_check():
    """Health check endpoint (logging suppressed)"""
    providers_status = {
        name: {"configured": bool(config["api_key"]), "endpoint": config["endpoint"]}
        for name, config in PROVIDERS.items()
    }
    return {
        "status": "healthy",
        "providers": providers_status,
        "proxy_key_configured": bool(PROXY_KEY)
    }

# Configure logging to filter out /health endpoint
import logging
from uvicorn.config import LOGGING_CONFIG

class HealthCheckFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return '/health' not in record.getMessage()

# Apply filter to uvicorn access logger
logging.getLogger("uvicorn.access").addFilter(HealthCheckFilter())

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Multi-Provider LLM Proxy for Wetlands Chatbot",
        "version": "2.0",
        "providers": list(PROVIDERS.keys()),
        "endpoints": {
            "/v1/chat/completions": "POST - OpenAI-compatible chat completions",
            "/chat": "POST - Legacy chat endpoint",
            "/health": "GET - Health check with provider status"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
