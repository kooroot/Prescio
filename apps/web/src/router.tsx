import { createRouter, createRootRoute, createRoute } from "@tanstack/react-router";
import { RootLayout } from "./routes/__root";
import { LobbyPage } from "./routes/index";

// Root route
const rootRoute = createRootRoute({
  component: RootLayout,
});

// Index route — Lobby
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LobbyPage,
});

// Route tree
const routeTree = rootRoute.addChildren([indexRoute]);

// Create router
export const router = createRouter({ routeTree });

// Type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
