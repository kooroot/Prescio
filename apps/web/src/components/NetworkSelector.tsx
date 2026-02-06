import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Zap, ChevronDown, Circle } from "lucide-react";
import { useNetwork, type NetworkId } from "@/hooks/useNetwork";

interface NetworkOption {
  id: NetworkId;
  name: string;
}

const NETWORK_OPTIONS: NetworkOption[] = [
  { id: "monad-mainnet", name: "Monad Mainnet" },
  { id: "monad-testnet", name: "Monad Testnet" },
];

export function NetworkSelector() {
  const { networkId, network, switchNetwork } = useNetwork();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="border-gray-700 bg-gray-900 hover:bg-gray-800 gap-1.5 px-3">
          <Circle className="h-2 w-2 fill-green-400 text-green-400" />
          <Zap className="h-3.5 w-3.5 text-purple-400" />
          <span className="text-sm">{network.name}</span>
          <ChevronDown className="h-3 w-3 text-gray-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 border-gray-700 bg-gray-900">
        {NETWORK_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.id}
            onClick={() => switchNetwork(option.id)}
            className={`cursor-pointer ${
              option.id === networkId
                ? "bg-purple-500/10 text-purple-300"
                : ""
            }`}
          >
            <Circle
              className={`mr-2 h-2 w-2 ${
                option.id === networkId ? "fill-green-400 text-green-400" : "fill-gray-500 text-gray-500"
              }`}
            />
            {option.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
