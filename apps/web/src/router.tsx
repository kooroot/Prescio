import { createRouter, createRootRoute, createRoute } from "@tanstack/react-router";
import { RootLayout } from "./routes/__root";
import { LobbyPage } from "./routes/index";
import { GamePage } from "./routes/game/$gameId";
import { StakingPage } from "./pages/StakingPage";

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

// Staking route
const stakingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/staking",
  component: StakingPage,
});

// Route tree
const routeTree = rootRoute.addChildren([indexRoute, gameRoute, stakingRoute]);

// Create router
export const router = createRouter({ routeTree });

// Type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
