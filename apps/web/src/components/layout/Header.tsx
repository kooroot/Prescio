import { ExternalLink, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WalletButton } from "./WalletButton";

const FAUCET_LINKS = [
  { name: "Monad Official Faucet", url: "https://faucet.monad.xyz" },
  { name: "DevNads Faucet", url: "https://agents.devnads.com" },
  { name: "Monad Testnet Explorer", url: "https://testnet.monadexplorer.com" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-monad-border bg-monad-dark/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <span className="text-2xl">🔮</span>
          <h1 className="text-xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-monad-purple to-[#9B87FF] bg-clip-text text-transparent">
              Prescio
            </span>
          </h1>
        </a>

        {/* Right side */}
        <nav className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-monad-text-secondary transition-colors hover:bg-monad-card hover:text-monad-text">
              Resources
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-monad-border bg-monad-dark">
              <DropdownMenuLabel className="text-monad-text-secondary">
                Monad Testnet
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-monad-border" />
              {FAUCET_LINKS.map((link) => (
                <DropdownMenuItem key={link.url} asChild>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex cursor-pointer items-center justify-between text-monad-text hover:text-monad-purple"
                  >
                    {link.name}
                    <ExternalLink className="h-3.5 w-3.5 text-monad-text-secondary" />
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <WalletButton />
        </nav>
      </div>
    </header>
  );
}
