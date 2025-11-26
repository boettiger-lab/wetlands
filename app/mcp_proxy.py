from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import httpx
from httpx_sse import aconnect_sse
import os
import json
import asyncio

# Support both stream and SSE transports
MCP_SERVER_BASE_URL = os.environ.get("MCP_SERVER_BASE_URL", "http://localhost:8001")
MCP_TRANSPORT = os.environ.get("MCP_TRANSPORT", "sse")  # "sse" or "stream"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

async def send_sse_message(message: dict) -> dict:
    """
    Send a message to SSE server using proper SSE protocol:
    1. GET /sse to establish connection and get session_id  
    2. POST /messages/?session_id=<uuid> to send the message (using separate client)
    3. For requests (with id), read response from SSE stream
    4. For notifications (without id), just return after 202 Accepted
    
    This implements the SSE client pattern from the MCP Python SDK.
    """
    is_notification = "id" not in message
    
    # Use one client for SSE and another for POSTing
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, read=60.0)) as sse_client, \
               httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as post_client:
        # Step 1: Connect to SSE endpoint
        async with aconnect_sse(sse_client, "GET", f"{MCP_SERVER_BASE_URL}/sse") as event_source:
            event_source.response.raise_for_status()
            
            # Step 2: Read events from SSE stream (single iteration)
            endpoint_url = None
            response_data = None
            post_task = None
            
            async for event in event_source.aiter_sse():
                # First event: get the endpoint with session_id
                if event.event == "endpoint" and endpoint_url is None:
                    # data will be like: /messages/?session_id=<uuid>
                    endpoint_url = f"{MCP_SERVER_BASE_URL}{event.data}"
                    
                    # Now POST the message using the separate client
                    async def post_message():
                        resp = await post_client.post(
                            endpoint_url,
                            json=message,
                            headers={"Content-Type": "application/json"}
                        )
                        resp.raise_for_status()
                        return resp.status_code
                    
                    # For notifications, just post and return immediately
                    if is_notification:
                        await post_message()
                        return {"status": "accepted"}
                    
                    # For requests, start POST task and continue reading SSE
                    post_task = asyncio.create_task(post_message())
                
                # Subsequent events: look for the response message
                elif event.event == "message":
                    # Parse the JSON-RPC response from the event data
                    response_data = json.loads(event.data)
                    break
            
            # Wait for POST to complete if it was started
            if post_task:
                await post_task
            
            if endpoint_url is None:
                raise Exception("Did not receive endpoint from SSE server")
            
            if not is_notification and response_data is None:
                raise Exception("Did not receive response from SSE server")
            
            return response_data

@app.post("/mcp")
async def proxy_mcp(request: Request):
    body = await request.json()
    
    if MCP_TRANSPORT == "stream":
        # Stream mode - direct POST to /mcp
        stream_url = f"{MCP_SERVER_BASE_URL}/mcp"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                stream_url,
                json=body,
                headers={"Content-Type": "application/json"}
            )
        return Response(
            content=resp.content,
            status_code=resp.status_code,
            media_type=resp.headers.get("content-type", "application/json")
        )
    else:
        # SSE mode - establish session and send message
        try:
            result = await send_sse_message(body)
            return Response(
                content=json.dumps(result),
                status_code=200,
                media_type="application/json"
            )
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                content=json.dumps({"error": str(e)}),
                status_code=500,
                media_type="application/json"
            )

@app.options("/mcp")
async def options_mcp():
    return Response(status_code=204)
