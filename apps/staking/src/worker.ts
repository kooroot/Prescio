// Cloudflare Workers entry point for SPA routing
interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Serve static assets
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.ok) {
      return assetResponse;
    }

    // SPA fallback - serve index.html for all routes
    const indexRequest = new Request(new URL("/index.html", request.url), request);
    return env.ASSETS.fetch(indexRequest);
  },
};
