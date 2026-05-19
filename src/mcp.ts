import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { MissionService } from "./missionService.js";

type NoauthSecurityScheme = { type: "noauth" };
type RequestHandler = (request: unknown, extra: unknown) => unknown | Promise<unknown>;

export function createGcbMcpServer(service: MissionService): McpServer {
  const server = new McpServer(
    {
      name: "gpt-codex-web-bridge",
      version: "0.1.0",
      websiteUrl: "http://localhost:8787"
    },
    {
      capabilities: {
        logging: {}
      }
    }
  );

  server.registerTool(
    "start_mission",
    withNoauthToolMetadata({
      title: "Start Codex Mission",
      description: "Start a new Codex mission in a target repository.",
      inputSchema: {
        goal: z.string().min(1),
        repoPath: z.string().min(1),
        testCommand: z.string().optional(),
        lintCommand: z.string().optional(),
        maxLoops: z.number().int().positive().optional().default(12),
        autoContinue: z.boolean().optional().default(true),
        allowEnvRead: z.boolean().optional().default(false),
        requireRealCodex: z.boolean().optional().default(false)
      }
    }),
    async (args) => toolResponse(await service.startMission(args))
  );

  server.registerTool(
    "continue_mission",
    withNoauthToolMetadata({
      title: "Continue Codex Mission",
      description: "Resume a paused, blocked, failed, or incomplete mission.",
      inputSchema: {
        missionId: z.string().optional(),
        repoPath: z.string().optional()
      }
    }),
    async (args) => toolResponse(await service.continueMission(args))
  );

  server.registerTool(
    "pause_mission",
    withNoauthToolMetadata({
      title: "Pause Codex Mission",
      description: "Pause a mission and gracefully terminate its Codex process if one is running.",
      inputSchema: {
        missionId: z.string().min(1)
      }
    }),
    async (args) => toolResponse(await service.pauseMission(args.missionId))
  );

  server.registerTool(
    "get_mission_status",
    withNoauthToolMetadata({
      title: "Get Mission Status",
      description: "Return status, progress, validation, and next recommended action.",
      inputSchema: {
        missionId: z.string().optional()
      }
    }),
    async (args) => toolResponse(await service.getMissionStatus(args.missionId))
  );

  server.registerTool(
    "list_missions",
    withNoauthToolMetadata({
      title: "List Missions",
      description: "Return latest missions sorted by updated time.",
      inputSchema: {
        limit: z.number().int().positive().optional().default(10)
      }
    }),
    async (args) => toolResponse(await service.listMissions(args.limit))
  );

  server.registerTool(
    "get_mission_report",
    withNoauthToolMetadata({
      title: "Get Mission Report",
      description: "Return the markdown report and structured summary for a mission.",
      inputSchema: {
        missionId: z.string().optional()
      }
    }),
    async (args) => toolResponse(await service.getMissionReport(args.missionId))
  );

  server.registerTool(
    "get_manager_prompt",
    withNoauthToolMetadata({
      title: "Get ChatGPT Manager Prompt",
      description: "Return the ready-to-use ChatGPT-side instruction prompt.",
      inputSchema: {}
    }),
    async () => toolResponse(await service.getManagerPrompt())
  );

  installNoauthToolListMetadata(server);

  return server;
}

export function createMcpRouteHandlers(service: MissionService): {
  post: (req: Request, res: Response) => Promise<void>;
  get: (req: Request, res: Response) => Promise<void>;
  delete: (req: Request, res: Response) => Promise<void>;
  closeAll: () => Promise<void>;
} {
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  const post = async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    try {
      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            if (transport) {
              transports[newSessionId] = transport;
            }
          }
        });

        transport.onclose = () => {
          const closedSessionId = transport?.sessionId;
          if (closedSessionId) {
            delete transports[closedSessionId];
          }
        };

        const mcpServer = createGcbMcpServer(service);
        await mcpServer.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: missing MCP session id or initialize request."
          },
          id: null
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: (error as Error).message
          },
          id: null
        });
      }
    }
  };

  const get = async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing MCP session id.");
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  };

  const deleteHandler = async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing MCP session id.");
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  };

  const closeAll = async (): Promise<void> => {
    await Promise.all(Object.values(transports).map((transport) => transport.close()));
    for (const sessionId of Object.keys(transports)) {
      delete transports[sessionId];
    }
  };

  return { post, get, delete: deleteHandler, closeAll };
}

function toolResponse(value: unknown): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: Record<string, unknown>;
} {
  const structuredContent = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : { value };
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(structuredContent, null, 2)
      }
    ],
    structuredContent
  };
}

function withNoauthToolMetadata<Config extends Record<string, unknown>>(
  config: Config
): Config & {
  securitySchemes: NoauthSecurityScheme[];
  _meta: Record<string, unknown> & { securitySchemes: NoauthSecurityScheme[] };
} {
  const securitySchemes = createNoauthSecuritySchemes();
  const existingMeta = isRecord(config._meta) ? config._meta : {};
  return {
    ...config,
    securitySchemes,
    _meta: {
      ...existingMeta,
      securitySchemes
    }
  };
}

function installNoauthToolListMetadata(server: McpServer): void {
  const protocol = server.server as unknown as {
    _requestHandlers?: Map<string, RequestHandler>;
  };
  const defaultListToolsHandler = protocol._requestHandlers?.get("tools/list");
  if (!defaultListToolsHandler) {
    throw new Error("MCP tools/list handler was not registered.");
  }

  server.server.setRequestHandler(ListToolsRequestSchema, async (request, extra) => {
    const result = (await defaultListToolsHandler(request, extra)) as { tools?: Array<Record<string, unknown>> };
    return {
      ...result,
      tools: (result.tools ?? []).map((tool) => withNoauthListedTool(tool))
    };
  });
}

function withNoauthListedTool(tool: Record<string, unknown>): Record<string, unknown> {
  const securitySchemes = createNoauthSecuritySchemes();
  return {
    ...tool,
    securitySchemes,
    _meta: {
      ...(isRecord(tool._meta) ? tool._meta : {}),
      securitySchemes
    }
  };
}

function createNoauthSecuritySchemes(): NoauthSecurityScheme[] {
  return [{ type: "noauth" }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
