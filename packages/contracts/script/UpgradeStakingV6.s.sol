// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PrescioStaking.sol";

/**
 * @title UpgradeStakingV6
 * @notice Upgrade PrescioStaking to V6 - fix totalWeight desync bug
 * 
 * Changes in V6:
 * - Removed anti-gaming logic from getUserWeight()
 * - stake/unstake now use consistent weight calculation
 * - Added syncTotalWeight() to fix existing desync
 */
contract UpgradeStakingV6 is Script {
    address constant STAKING_PROXY = 0xa0742ffb1762FF3EA001793aCBA202f82244D983;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy new implementation
        PrescioStaking newImpl = new PrescioStaking();
        console.log("New Implementation:", address(newImpl));
        
        // Upgrade proxy to new implementation
        PrescioStaking proxy = PrescioStaking(payable(STAKING_PROXY));
        proxy.upgradeToAndCall(
            address(newImpl),
            abi.encodeCall(PrescioStaking.initializeV6, ())
        );
        
        console.log("=== PrescioStaking Upgraded to V6 ===");
        console.log("Proxy:", STAKING_PROXY);
        console.log("New Impl:", address(newImpl));
        console.log("Version:", proxy.getVersion());
        
        // Check current totalWeight before sync
        console.log("Current totalWeight:", proxy.totalWeight());
        
        vm.stopBroadcast();
    }
}
