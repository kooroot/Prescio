import { useState, useEffect, useCallback } from "react";
import {
  CONTRACT_ADDRESSES,
  TESTNET_CONTRACT_ADDRESSES,
  MONAD_MAINNET_CHAIN_ID,
  MONAD_TESTNET_CHAIN_ID,
} from "@prescio/common";

const STORAGE_KEY = "prescio-network";

export type NetworkId = "monad-mainnet" | "monad-testnet";

interface NetworkConfig {
  id: NetworkId;
  name: string;
  chainId: number;
  contracts: typeof CONTRACT_ADDRESSES;
}

const NETWORKS: Record<NetworkId, NetworkConfig> = {
  "monad-mainnet": {
    id: "monad-mainnet",
    name: "Monad Mainnet",
    chainId: MONAD_MAINNET_CHAIN_ID,
    contracts: CONTRACT_ADDRESSES,
  },
  "monad-testnet": {
    id: "monad-testnet",
    name: "Monad Testnet",
    chainId: MONAD_TESTNET_CHAIN_ID,
    contracts: TESTNET_CONTRACT_ADDRESSES,
  },
};

export function useNetwork() {
  const [networkId, setNetworkId] = useState<NetworkId>(() => {
    if (typeof window === "undefined") return "monad-mainnet";
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as NetworkId) || "monad-mainnet";
  });

  const network = NETWORKS[networkId];

  const switchNetwork = useCallback((id: NetworkId) => {
    setNetworkId(id);
    localStorage.setItem(STORAGE_KEY, id);
    // Trigger page reload to refresh all data
    window.location.reload();
  }, []);

  return {
    networkId,
    network,
    chainId: network.chainId,
    contracts: network.contracts,
    isMainnet: networkId === "monad-mainnet",
    isTestnet: networkId === "monad-testnet",
    switchNetwork,
  };
}

// For use outside of React components
export function getNetworkConfig(): NetworkConfig {
  if (typeof window === "undefined") return NETWORKS["monad-mainnet"];
  const stored = localStorage.getItem(STORAGE_KEY) as NetworkId;
  return NETWORKS[stored] || NETWORKS["monad-mainnet"];
}

export function getChainId(): number {
  return getNetworkConfig().chainId;
}

export function getContracts() {
  return getNetworkConfig().contracts;
}
