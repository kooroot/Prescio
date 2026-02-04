/**
 * Cloudflare Workers entry — reverse proxy /api/* and /ws to backend
 */
export interface Env {
  API_BACKEND: string;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade → proxy to backend
    if (request.headers.get("Upgrade") === "websocket") {
      const backendUrl = env.API_BACKEND.replace("https://", "wss://") + url.pathname + url.search;
      return fetch(backendUrl, request);
    }

    // API requests → proxy to backend
    if (url.pathname.startsWith("/api")) {
      const backendUrl = env.API_BACKEND + url.pathname + url.search;
      const headers = new Headers(request.headers);
      headers.set("Host", new URL(env.API_BACKEND).host);

      const resp = await fetch(backendUrl, {
        method: request.method,
        headers,
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      });

      // Add CORS + no-cache headers
      const response = new Response(resp.body, resp);
      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      response.headers.set("Pragma", "no-cache");
      response.headers.delete("ETag");
      response.headers.delete("Last-Modified");
      return response;
    }

    // Everything else → static assets (SPA)
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
