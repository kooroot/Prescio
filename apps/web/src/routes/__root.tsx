import { Outlet } from "@tanstack/react-router";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { Header } from "@/components/layout/Header";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider, useI18n } from "@/i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function AppFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-gray-800 py-4">
      <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500">
        {t("footerText")}{" "}
        <a href="https://github.com/kooroot" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
          kooroot
        </a>
        {" "}{t("footerOn")}{" "}
        <a href="https://monad.xyz" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
          Monad
        </a>
        {" "}& {" "}
        <a href="https://moltiverse.dev" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
          Moltiverse
        </a>
      </div>
    </footer>
  );
}

export function RootLayout() {
  return (
    <I18nProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <div className="flex min-h-screen flex-col bg-background text-foreground">
            <Header />
            <main className="flex-1">
              <Outlet />
            </main>
            <AppFooter />
            <Toaster />
          </div>
        </QueryClientProvider>
      </WagmiProvider>
    </I18nProvider>
  );
}
