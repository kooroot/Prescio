import { useState, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, ChevronDown, Circle } from "lucide-react";

interface Network {
  id: string;
  name: string;
  chainId: number;
  status: "live" | "soon";
}

const NETWORKS: Network[] = [
  { id: "monad-mainnet", name: "Monad Mainnet", chainId: 143, status: "live" },
  { id: "monad-testnet", name: "Monad Testnet", chainId: 10143, status: "live" },
];

const STORAGE_KEY = "prescio-network";

export function NetworkSelector() {
  const [networkId, setNetworkId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) ?? "monad-mainnet";
  });

  const current = NETWORKS.find((n) => n.id === networkId) ?? NETWORKS[0];

  const handleSelect = useCallback((network: Network) => {
    if (network.status === "soon") return;
    setNetworkId(network.id);
    localStorage.setItem(STORAGE_KEY, network.id);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="border-gray-700 bg-gray-900 hover:bg-gray-800 gap-1.5 px-3">
          <Circle className="h-2 w-2 fill-green-400 text-green-400" />
          <Zap className="h-3.5 w-3.5 text-purple-400" />
          <span className="text-sm">{current.name}</span>
          <ChevronDown className="h-3 w-3 text-gray-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 border-gray-700 bg-gray-900">
        {NETWORKS.map((network) => (
          <DropdownMenuItem
            key={network.id}
            onClick={() => handleSelect(network)}
            disabled={network.status === "soon"}
            className={`cursor-pointer ${
              network.id === networkId
                ? "bg-purple-500/10 text-purple-300"
                : network.status === "soon"
                ? "opacity-50"
                : ""
            }`}
          >
            <Circle
              className={`mr-2 h-2 w-2 ${
                network.status === "live" ? "fill-green-400 text-green-400" : "fill-gray-500 text-gray-500"
              }`}
            />
            {network.name}
            {network.status === "soon" && (
              <Badge className="ml-auto bg-gray-700 text-gray-400 text-[10px] px-1.5 py-0">Soon</Badge>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
