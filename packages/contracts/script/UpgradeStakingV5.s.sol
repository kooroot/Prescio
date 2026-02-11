// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PrescioStaking.sol";

/**
 * @title UpgradeStakingV5
 * @notice Upgrade PrescioStaking to V5 with addStake function
 */
contract UpgradeStakingV5 is Script {
    address constant STAKING_PROXY = 0xa0742ffb1762FF3EA001793aCBA202f82244D983;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("SERVER_PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy new implementation
        PrescioStaking newImpl = new PrescioStaking();
        console.log("New Implementation:", address(newImpl));
        
        // Upgrade proxy to new implementation
        PrescioStaking proxy = PrescioStaking(payable(STAKING_PROXY));
        proxy.upgradeToAndCall(
            address(newImpl),
            abi.encodeCall(PrescioStaking.initializeV5, ())
        );
        
        console.log("=== PrescioStaking Upgraded to V5 ===");
        console.log("Proxy:", STAKING_PROXY);
        console.log("New Impl:", address(newImpl));
        console.log("Version:", proxy.getVersion());
        
        vm.stopBroadcast();
    }
}
