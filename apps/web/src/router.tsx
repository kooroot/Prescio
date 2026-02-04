import { createRouter, createRootRoute, createRoute } from "@tanstack/react-router";
import { RootLayout } from "./routes/__root";
import { LobbyPage } from "./routes/index";
import { GamePage } from "./routes/game/$gameId";

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

// Game spectator route
const gameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/game/$gameId",
  component: GamePage,
});

// Route tree
const routeTree = rootRoute.addChildren([indexRoute, gameRoute]);

// Create router
export const router = createRouter({ routeTree });

// Type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
