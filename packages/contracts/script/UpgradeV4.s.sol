// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PrescioMarketV4.sol";
import "../src/PrescioVaultV2.sol";

/**
 * @title UpgradeV4
 * @notice Upgrades existing PrescioMarket proxy to V4 implementation
 * @dev Run with: forge script script/UpgradeV4.s.sol --rpc-url $RPC_URL --broadcast
 * 
 * IMPORTANT: This upgrade includes storage layout changes:
 * - ReentrancyGuard → ReentrancyGuardUpgradeable
 * - New state variables: pendingVaultFees, emergencyWithdrawRequestTime, emergencyWithdrawRequested
 * 
 * After upgrade, call initializeV4() to initialize new state variables.
 */
contract UpgradeV4 is Script {
    // Proxy address on Monad testnet
    address constant PROXY = 0x8Ba812709A23D3c35e328a4F13D09C6Cd3A7CD8F;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy new V4 implementation
        PrescioMarketV4 v4Implementation = new PrescioMarketV4();
        console.log("V4 Implementation deployed at:", address(v4Implementation));
        
        // 2. Prepare initializeV4 call data
        bytes memory initV4Data = abi.encodeWithSelector(PrescioMarketV4.initializeV4.selector);
        
        // 3. Upgrade proxy to V4 and call initializeV4
        PrescioMarketV4 proxy = PrescioMarketV4(payable(PROXY));
        proxy.upgradeToAndCall(address(v4Implementation), initV4Data);
        console.log("Proxy upgraded to V4 and initialized");
        
        // 4. Verify upgrade
        console.log("Vault:", proxy.vault());
        console.log("Fee Rate:", proxy.feeRate());
        console.log("Pending Vault Fees:", proxy.pendingVaultFees());
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== Upgrade Complete ===");
        console.log("Proxy address (unchanged):", PROXY);
        console.log("New implementation:", address(v4Implementation));
        console.log("");
        console.log("V4 Security Improvements:");
        console.log("- ReentrancyGuardUpgradeable (storage collision fix)");
        console.log("- 7-day timelock on emergencyWithdraw");
        console.log("- Pull pattern for vault fees");
        console.log("- Market-specific fee rates");
    }
}

/**
 * @title DeployVaultV2
 * @notice Deploys new PrescioVaultV2 contract
 * @dev Run with: forge script script/UpgradeV4.s.sol:DeployVaultV2 --rpc-url $RPC_URL --broadcast
 */
contract DeployVaultV2 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        PrescioVaultV2 vault = new PrescioVaultV2();
        console.log("VaultV2 deployed at:", address(vault));
        console.log("Owner:", vault.owner());
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("V2 Improvements:");
        console.log("- Zero address validation");
        console.log("- Code deduplication");
    }
}
