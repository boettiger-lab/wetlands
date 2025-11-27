I think we may have a related problem in the maplibre/chat.js implementation that also calls the same MCP server and hits errors. Can you take a look and see if you can figure out why we get Error SSE connection failed?

Can you also write a javascript test we can run locally, equivalent to the simple-mcp-server-test.py to confirm MCP is working correctly in javascript?

Can you then write  a second test, with version in both python and javascript, that test MCP use in combination with the LLM tool