# Kubernetes Deployment for Wetlands Maplibre Website

This directory contains Kubernetes manifests for deploying the wetlands maplibre visualization website.

## Files

- `deployment.yaml` - Deployment with git clone init container and nginx web server
- `service.yaml` - ClusterIP service to expose the deployment
- `ingress.yaml` - Ingress configuration for external access
- `configmap-nginx.yaml` - Nginx server configuration

## Deployment

The deployment uses an init container to clone the repository and serve the maplibre directory contents.

### Deploy the Application

```bash
kubectl apply -f k8s/configmap-nginx.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

### Update the Deployment

To pull the latest code from the repository, simply restart the deployment:

```bash
kubectl rollout restart deployment/wetlands-maplibre
```

The init container will clone the latest version of the repository on each pod restart.

## Access

After deployment, the website will be available at:
- Internal: http://wetlands-maplibre.default.svc.cluster.local
- External: https://wetlands.nrp-nautilus.io

## Configuration

The application uses a two-layer configuration approach:

1. **ConfigMap** (`wetlands-maplibre-config`) - Contains the config template with placeholders
2. **Secrets** (`llm-proxy-secrets`) - Contains the shared API key for the LLM proxy

### Environment Variables

The deployment injects these environment variables into the runtime config:

- `MCP_SERVER_URL` - MCP server SSE endpoint (default: https://biodiversity-mcp.nrp-nautilus.io/sse)
- `LLM_ENDPOINT` - Shared LLM proxy base URL (default: https://llm-proxy.nrp-nautilus.io/v1)
- `DEFAULT_LLM_MODEL` - Default model to use (default: kimi)
- `PROXY_KEY` - Shared API key for all models using the same endpoint (from `llm-proxy-secrets`)

### Setting up Secrets

1. Copy the example secrets file:
   ```bash
   cp k8s/secrets.yaml.example k8s/secrets.yaml
   ```

2. Edit `k8s/secrets.yaml` and replace the placeholder value with your actual API key:
   ```yaml
   stringData:
     proxy-key: "your-actual-proxy-key-here"
   ```
   
   **Note:** Since all models in this example use the same endpoint, they share the same API key. Use `"EMPTY"` if no authentication is required.

3. Apply the secrets:
   ```bash
   kubectl apply -f k8s/secrets.yaml
   ```

### Per-Model Endpoints and Keys

If you need different endpoints or API keys for different models:

1. Edit the ConfigMap template in `configmap-nginx.yaml` to use different environment variables per model
2. Add corresponding environment variables and secrets in `deployment.yaml`
3. Update the secrets to include the additional keys

**Note:** The configuration template is injected at pod startup using `envsubst`, substituting environment variables from the ConfigMap and Secrets into the final `config.json` served to the browser.

## Deployment Order

To deploy everything in the correct order:

```bash
# 1. Create secrets first (edit secrets.yaml with your actual keys)
kubectl apply -f k8s/secrets.yaml

# 2. Apply ConfigMaps
kubectl apply -f k8s/configmap-nginx.yaml

# 3. Deploy the application
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

## Monitoring

Check deployment status:
```bash
kubectl get deployments wetlands-maplibre
kubectl get pods -l app=wetlands-maplibre
kubectl get service wetlands-maplibre
kubectl get ingress wetlands-maplibre-ingress
```

View logs:
```bash
# View nginx logs
kubectl logs -l app=wetlands-maplibre --tail=100 -f

# View init container logs (git clone)
kubectl logs -l app=wetlands-maplibre -c git-clone
```

## Configuration

- The ingress uses the `haproxy` ingress class
- CORS is enabled to allow cross-origin requests
- Static assets are cached for 7 days
- Health checks are configured on `/health` endpoint
- Content is cloned from GitHub on each pod start via init container

## Troubleshooting

If pods fail to start, check the init container logs:
```bash
kubectl logs <pod-name> -c git-clone
```

Common issues:
- Git clone failures: Check network connectivity and repository URL
- Empty content: Verify the maplibre directory exists in the repository
- Secret errors: Ensure secrets are created or set `optional: true` in deployment
