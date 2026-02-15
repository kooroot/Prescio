// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PrescioVault.sol";

/**
 * @title UpgradeVault
 * @notice Deploy new PrescioVault V2 with Staking integration
 * 
 * After deployment:
 * 1. Update Market contract to point to new Vault
 * 2. Set staking contract in new Vault
 * 3. Initialize Staking contract with new Vault address
 */
contract UpgradeVault is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("SERVER_PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy new Vault V2
        PrescioVault newVault = new PrescioVault();
        
        console.log("=== PrescioVault V2 Deployed ===");
        console.log("New Vault:", address(newVault));
        console.log("Version:", newVault.getVersion());
        console.log("Owner:", newVault.owner());
        
        vm.stopBroadcast();
    }
}
