import http from "node:http";
import { pathToFileURL } from "node:url";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { createMcpRouteHandlers } from "./mcp.js";
import { MissionService } from "./missionService.js";

export interface ServerOptions {
  port?: number;
  host?: string;
  storageRoot?: string;
}

export async function startServer(options: ServerOptions = {}): Promise<http.Server> {
  const port = options.port ?? Number(process.env.PORT ?? process.env.GCB_PORT ?? 8787);
  const host = options.host ?? process.env.GCB_HOST ?? "127.0.0.1";
  const appHost = process.env.GCB_ALLOWED_HOSTS ? host : "0.0.0.0";
  const allowedHosts = process.env.GCB_ALLOWED_HOSTS?.split(",").map((item) => item.trim()).filter(Boolean);
  const app = createMcpExpressApp({ host: appHost, allowedHosts });
  const service = MissionService.create(options.storageRoot);
  const mcpHandlers = createMcpRouteHandlers(service);

  app.get("/", async (_req, res) => {
    const list = await service.listMissions(20).catch((error) => ({ error: (error as Error).message, missions: [] }));
    res.type("html").send(renderMissionListPage(list));
  });

  app.get("/status", async (req, res) => {
    const missionId = typeof req.query.missionId === "string" ? req.query.missionId : undefined;
    const payload = await service.getStatusWidgetData(missionId).catch((error) => ({ error: (error as Error).message }));
    res.type("html").send(renderStatusWidgetPage(payload));
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, name: "gpt-codex-web-bridge", mcp: "/mcp" });
  });

  app.post("/mcp", mcpHandlers.post);
  app.get("/mcp", mcpHandlers.get);
  app.delete("/mcp", mcpHandlers.delete);

  const server = app.listen(port, host, () => {
    console.log(`gpt-codex-web-bridge listening at http://${host}:${port}`);
    console.log(`MCP endpoint: http://${host}:${port}/mcp`);
  });

  const shutdown = async (): Promise<void> => {
    await mcpHandlers.closeAll();
    server.close();
  };

  process.once("SIGINT", () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void shutdown().finally(() => process.exit(0));
  });

  return server;
}

function renderMissionListPage(payload: Record<string, unknown>): string {
  const missions = Array.isArray(payload.missions) ? payload.missions : [];
  const rows = missions
    .map((mission) => {
      const item = mission as Record<string, unknown>;
      return `<tr><td>${escapeHtml(String(item.missionId ?? ""))}</td><td>${escapeHtml(String(item.status ?? ""))}</td><td>${escapeHtml(String(item.repoPath ?? ""))}</td><td>${escapeHtml(String(item.nextAction ?? ""))}</td></tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>gpt-codex-web-bridge</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; margin: 32px; color: #17202a; }
    code { background: #f2f4f7; padding: 2px 5px; border-radius: 4px; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border-bottom: 1px solid #d9dee7; padding: 10px; text-align: left; vertical-align: top; }
    th { background: #f7f9fc; }
  </style>
</head>
<body>
  <h1>gpt-codex-web-bridge</h1>
  <p>MCP endpoint: <code>http://localhost:8787/mcp</code></p>
  <p>Latest status widget: <a href="/status">/status</a></p>
  <table>
    <thead><tr><th>Mission</th><th>Status</th><th>Repo</th><th>Next Action</th></tr></thead>
    <tbody>${rows || "<tr><td colspan=\"4\">No missions yet.</td></tr>"}</tbody>
  </table>
</body>
</html>`;
}

function renderStatusWidgetPage(payload: Record<string, unknown>): string {
  if (payload.error) {
    return renderShell("Mission Status", `<h1>Mission Status</h1><p>${escapeHtml(String(payload.error))}</p><p><a href="/">Back to missions</a></p>`);
  }

  const riskFlags = Array.isArray(payload.riskFlags) ? payload.riskFlags.map((flag) => String(flag)) : [];
  const missionId = String(payload.missionId ?? "");
  const rows = [
    ["Mission ID", missionId],
    ["Status", String(payload.status ?? "")],
    ["Codex Mode", String(payload.codexMode ?? "unknown")],
    ["Loop Count", String(payload.loopCount ?? "")],
    ["Validation Result", String(payload.validationResult ?? "")],
    ["Validation Command", String(payload.validationCommand ?? "not set")],
    ["Pause Reason", String(payload.pauseReason ?? "none")],
    ["Block Reason", String(payload.blockReason ?? "none")],
    ["Next Action", String(payload.nextAction ?? "")],
    ["Changed Files", String(payload.changedFilesCount ?? 0)],
    ["Risk Flags", riskFlags.length > 0 ? riskFlags.join(" | ") : "none"],
    ["Report Path", String(payload.reportPath ?? "")]
  ]
    .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join("");

  return renderShell(
    `Mission Status ${missionId}`,
    `<h1>Mission Status</h1>
    <p><a href="/">All missions</a>${missionId ? ` | <a href="/status?missionId=${encodeURIComponent(missionId)}">Permalink</a>` : ""}</p>
    <table><tbody>${rows}</tbody></table>`
  );
}

function renderShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; margin: 32px; color: #17202a; }
    code { background: #f2f4f7; padding: 2px 5px; border-radius: 4px; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border-bottom: 1px solid #d9dee7; padding: 10px; text-align: left; vertical-align: top; }
    th { background: #f7f9fc; width: 220px; }
    a { color: #165dff; }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entry) {
  await startServer();
}
