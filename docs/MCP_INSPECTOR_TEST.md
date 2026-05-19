# MCP Inspector Test

The bridge uses MCP Streamable HTTP at:

```text
http://localhost:8787/mcp
```

If you have MCP Inspector installed, point it at that URL. If the inspector command changes or is unavailable in your environment, use the JSON-RPC examples below.

## Start The Server

```bash
npm ci
npm run build
npm run dev
```

## Initialize

```bash
curl -i http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {},
      "clientInfo": {
        "name": "curl-smoke-test",
        "version": "0.0.1"
      }
    }
  }'
```

Copy the `mcp-session-id` response header into:

```bash
export MCP_SESSION_ID="<session-id>"
```

Send the initialized notification:

```bash
curl http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $MCP_SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "notifications/initialized",
    "params": {}
  }'
```

## List Tools

```bash
curl http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $MCP_SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

Expected tools include:

```text
start_mission
continue_mission
pause_mission
get_mission_status
list_missions
get_mission_report
get_manager_prompt
```

## Call get_manager_prompt

```bash
curl http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $MCP_SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_manager_prompt",
      "arguments": {}
    }
  }'
```

Expected structured content:

```json
{
  "prompt": "You are the web ChatGPT mission manager for gpt-codex-web-bridge..."
}
```

## Call list_missions

```bash
curl http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $MCP_SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "list_missions",
      "arguments": {
        "limit": 10
      }
    }
  }'
```

Expected structured content:

```json
{
  "missions": []
}
```
