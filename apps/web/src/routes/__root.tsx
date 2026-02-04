import { Outlet } from "@tanstack/react-router";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { Header } from "@/components/layout/Header";
import { Toaster } from "@/components/ui/sonner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export function RootLayout() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-screen flex-col bg-background text-foreground">
          <Header />

          {/* Main content */}
          <main className="flex-1">
            <Outlet />
          </main>

          {/* Footer */}
          <footer className="border-t border-gray-800 py-4">
            <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500">
              Prescio — Predict. Bet. Win. Built by{" "}
              <a
                href="https://github.com/kooroot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:underline"
              >
                kooroot
              </a>
              {" "}on{" "}
              <a
                href="https://monad.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:underline"
              >
                Monad
              </a>
            </div>
          </footer>

          <Toaster />
        </div>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
