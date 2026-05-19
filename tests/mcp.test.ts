import { describe, expect, it } from "vitest";
import { createGcbMcpServer } from "../src/mcp.js";
import type { MissionService } from "../src/missionService.js";

describe("MCP tool metadata", () => {
  it("advertises every bridge tool as noauth", async () => {
    const server = createGcbMcpServer({} as MissionService);
    const handlers = ((server.server as unknown as { _requestHandlers: Map<string, RequestHandler> })._requestHandlers);
    const listTools = handlers.get("tools/list");

    expect(listTools).toBeDefined();

    const result = await listTools?.(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list"
      },
      {}
    );
    const tools = (result as { tools: Array<Record<string, unknown>> }).tools;

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "continue_mission",
      "get_manager_prompt",
      "get_mission_report",
      "get_mission_status",
      "list_missions",
      "pause_mission",
      "start_mission"
    ]);

    for (const tool of tools) {
      expect(tool.securitySchemes).toEqual([{ type: "noauth" }]);
      expect((tool._meta as Record<string, unknown>).securitySchemes).toEqual([{ type: "noauth" }]);
      expect(JSON.stringify(tool)).not.toMatch(/oauth2|bearer|authorization|account-linking/i);
    }
  });
});

type RequestHandler = (request: unknown, extra: unknown) => unknown | Promise<unknown>;
