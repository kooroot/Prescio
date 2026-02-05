// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PrescioMarketV3.sol";

/**
 * @title UpgradeV3
 * @notice Upgrades existing PrescioMarket proxy to V3 implementation
 * @dev Run with: forge script script/UpgradeV3.s.sol --rpc-url $RPC_URL --broadcast
 */
contract UpgradeV3 is Script {
    // Proxy address on Monad testnet
    address constant PROXY = 0x8Ba812709A23D3c35e328a4F13D09C6Cd3A7CD8F;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy new V3 implementation
        PrescioMarketV3 v3Implementation = new PrescioMarketV3();
        console.log("V3 Implementation deployed at:", address(v3Implementation));
        
        // Upgrade proxy to V3
        PrescioMarketV3 proxy = PrescioMarketV3(payable(PROXY));
        proxy.upgradeToAndCall(address(v3Implementation), "");
        console.log("Proxy upgraded to V3");
        
        vm.stopBroadcast();
        
        console.log("Upgrade complete!");
        console.log("Proxy address (unchanged):", PROXY);
    }
}
