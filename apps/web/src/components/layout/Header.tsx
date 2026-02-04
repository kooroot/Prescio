import { WalletButton } from "./WalletButton";

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
          <WalletButton />
        </nav>
      </div>
    </header>
  );
}
