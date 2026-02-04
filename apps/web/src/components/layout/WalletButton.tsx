import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wallet, LogOut, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { MONAD_TESTNET_EXPLORER } from "@prescio/common";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (!isConnected || !address) {
    return (
      <Button
        onClick={() => {
          const connector = connectors[0];
          if (connector) {
            connect({ connector });
          }
        }}
        disabled={isPending}
        className="bg-purple-600 hover:bg-purple-500"
      >
        <Wallet className="mr-2 h-4 w-4" />
        {isPending ? "Connecting…" : "Connect Wallet"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {chain && (
        <Badge variant="outline" className="border-purple-500/50 text-purple-300">
          {chain.name}
        </Badge>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="border-gray-700 bg-gray-900 hover:bg-gray-800">
            <Wallet className="mr-2 h-4 w-4 text-purple-400" />
            {truncateAddress(address)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-gray-900 border-gray-700">
          <DropdownMenuLabel className="text-gray-400">
            Connected Wallet
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-gray-700" />
          <DropdownMenuItem
            onClick={() => {
              navigator.clipboard.writeText(address);
              toast.success("Address copied to clipboard");
            }}
            className="cursor-pointer text-gray-200 focus:bg-gray-800 focus:text-white"
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy Address
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              window.open(`${MONAD_TESTNET_EXPLORER}/address/${address}`, "_blank");
            }}
            className="cursor-pointer text-gray-200 focus:bg-gray-800 focus:text-white"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View on Explorer
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-gray-700" />
          <DropdownMenuItem
            onClick={() => disconnect()}
            className="cursor-pointer text-red-400 focus:bg-gray-800 focus:text-red-300"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
