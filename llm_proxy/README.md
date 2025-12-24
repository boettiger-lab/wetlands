# LLM Proxy

## Overview

The LLM proxy serves as a secure intermediary between the frontend chatbot application and the LLM API endpoint. It:

- Keeps API keys secure on the server side (never exposed to browsers)
- Handles CORS properly for cross-origin requests
- Restricts access via ingress rules (only allows requests from https://boettiger-lab.github.io)
- Supports OpenAI-compatible API endpoints

## Deployment Options

### Hosted (Default - Kubernetes)

The application uses the hosted LLM proxy by default:
- **URL**: `https://llm-proxy.nrp-nautilus.io/chat`
- **Deployment**: Kubernetes cluster (see deployment files in this directory)
- **CORS**: Configured to allow requests from `https://boettiger-lab.github.io`

### Local Development

For local testing, run:
```bash
./start.sh --local
```

This starts the LLM proxy locally at `http://localhost:8011/chat`.

## Kubernetes Deployment

This directory contains the Kubernetes deployment configuration for the hosted LLM proxy server.

## Files

- `llm_proxy.py` - FastAPI application that proxies LLM requests (also in configmap.yaml)
- `configmap.yaml` - ConfigMap containing the application code
- `deployment.yaml` - Kubernetes Deployment configuration
- `service.yaml` - Kubernetes Service configuration
- `ingress.yaml` - Kubernetes Ingress with CORS configuration
- `secrets.yaml.example` - Example secrets configuration (DO NOT commit actual secrets!)

## Configuration

### config.json

The LLM proxy now supports dynamic configuration via `config.json`. This file specifies:
- API endpoints for each provider
- Model names/prefixes supported by each provider
- Environment variable names for API keys (not the secrets themselves)
- Optional extra headers for specific providers

Example `config.json`:
```json
{
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
    }
  }
}
```

**Notes:**
- `api_key_env`: Name of the environment variable containing the API key
- `models`: Exact model names or prefixes (for OpenRouter-style routing)
- `extra_headers`: Optional provider-specific headers
- If `config.json` is not found, the proxy uses built-in defaults
- API keys are **never** stored in config.json - they come from environment variables

## Prerequisites

1. Kubernetes cluster access
2. kubectl configured
3. NRP API key (or other LLM provider API key)

## Deployment Steps

### 1. Create Secrets

Create the required secrets (DO NOT commit these to git!):

```bash
kubectl create secret generic llm-proxy-secrets \
  --from-literal=nrp-api-key='your-nrp-api-key-here'
```

Or use the example file:

```bash
cp llm_proxy/secrets.yaml.example llm_proxy/secrets.yaml
# Edit secrets.yaml with your actual values
kubectl apply -f llm_proxy/secrets.yaml
```

**Important:** Add `secrets.yaml` to your `.gitignore` if using the file approach!

### 2. Update Ingress Host

Edit `ingress.yaml` and update the host to match your domain:

```yaml
rules:
  - host: llm-proxy.your-domain.io  # Update this
```

### 3. Deploy to Kubernetes

```bash
# Apply all configurations
kubectl apply -f llm_proxy/configmap.yaml
kubectl apply -f llm_proxy/deployment.yaml
kubectl apply -f llm_proxy/service.yaml
kubectl apply -f llm_proxy/ingress.yaml

# Check deployment status
kubectl get pods -l app=llm-proxy
kubectl get svc llm-proxy
kubectl get ingress llm-proxy-ingress
```

### 4. Verify Deployment

```bash
# Check pod logs
kubectl logs -l app=llm-proxy

# Test health endpoint
curl https://llm-proxy.your-domain.io/health
```

## Usage

The proxy exposes the following endpoints:

### `/chat` (POST)
Structured chat completion endpoint with authentication.

**Request:**
```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "model": "gpt-4",
  "temperature": 0.7,
  "tools": [...],  // optional
  "tool_choice": "auto"  // optional
}
```

**Headers:**
```
Content-Type: application/json
```

### `/llm` (POST)
Generic proxy endpoint that forwards requests directly to the LLM API.

### `/health` (GET)
Health check endpoint that returns service status.

## Configuration

### Environment Variables

Set in `deployment.yaml`:

- `NRP_API_KEY` - API key for the LLM endpoint (from secret)
- `LLM_ENDPOINT` - LLM API endpoint URL (default: https://ellm.nrp-nautilus.io/v1)

### CORS Configuration

CORS is configured in `ingress.yaml` using HAProxy annotations to **only allow requests from your GitHub Pages site**:

- `haproxy.org/cors-allow-origin: "https://boettiger-lab.github.io"` - Only this origin allowed
- `haproxy.org/cors-allow-methods` - Allowed HTTP methods (GET, POST, OPTIONS)
- `haproxy.org/cors-allow-headers` - Allowed request headers
- `haproxy.org/cors-allow-credentials` - Enable credentials

This provides security by blocking requests from any other domain.

## Frontend Integration

Update your frontend code to use the proxy:

```javascript
const response = await fetch('https://llm-proxy.your-domain.io/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    messages: messages,
    model: 'gpt-4',
    temperature: 0.7
  })
});
```

## Security Considerations

1. **Secrets Management**: Never commit actual API keys to git
2. **CORS**: Access restricted to `https://boettiger-lab.github.io` via ingress rules
3. **HTTPS**: Ensure ingress uses TLS/HTTPS (configure cert-manager if needed)
4. **Rate Limiting**: Consider adding rate limiting at the ingress level for production
5. **Origin Validation**: Requests from any origin other than GitHub Pages will be blocked by CORS

## Troubleshooting

### Check pod status
```bash
kubectl describe pod -l app=llm-proxy
```

### View logs
```bash
kubectl logs -f -l app=llm-proxy
```

### Test connectivity
```bash
kubectl port-forward svc/llm-proxy 8002:8002
curl http://localhost:8002/health
```

### Check ingress
```bash
kubectl describe ingress llm-proxy-ingress
```

## Monitoring

The deployment includes:

- **Liveness probe**: Checks `/health` endpoint every 30 seconds
- **Readiness probe**: Checks `/health` endpoint every 10 seconds
- **Resource limits**: CPU and memory limits to prevent resource exhaustion

## Updating

To update the deployment after changing the code:

```bash
# Update the configmap with new code
kubectl apply -f llm_proxy/configmap.yaml

# Restart the deployment to pick up changes
kubectl rollout restart deployment/llm-proxy

# Watch the rollout status
kubectl rollout status deployment/llm-proxy
```

## Related Documentation

- See `../mcp/` for similar MCP server deployment examples
- See `../app/llm_proxy.py` for the local development version
- See `../start.sh` for local testing setup
