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

## Environment Variables

The deployment injects these environment variables into the runtime config:

- `LLM_ENDPOINT` - LLM proxy base URL (https://llm-proxy.nrp-nautilus.io/v1)
- `LLM_MODEL` - Model to use (kimi)
- `MCP_SERVER_URL` - MCP server SSE endpoint (https://biodiversity-mcp.nrp-nautilus.io/sse)
- `PROXY_KEY` - Authentication key for accessing the LLM proxy (from `llm-proxy-secrets`)

**Note:** The LLM proxy requires two keys:
1. `PROXY_KEY` - Client authentication (from app to proxy)
2. `NRP_API_KEY` - LLM endpoint authentication (from proxy to actual LLM)

Both keys are stored in the `llm-proxy-secrets` Kubernetes secret. The `config.json` is generated at container startup by substituting environment variables into a template.

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
