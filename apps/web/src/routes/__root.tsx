import { Outlet } from "@tanstack/react-router";

export function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔮</span>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Prescio
              </span>
            </h1>
          </div>

          <nav className="flex items-center gap-4">
            {/* Wallet connect button placeholder */}
            <button
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500"
              onClick={() => {
                // TODO: Connect wallet via wagmi
                console.log("Connect wallet");
              }}
            >
              Connect Wallet
            </button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-4">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500">
          Prescio — Predict. Bet. Win. Built on{" "}
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
    </div>
  );
}
