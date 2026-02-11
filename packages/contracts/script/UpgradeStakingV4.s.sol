// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PrescioStaking.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title UpgradeStakingV4
 * @notice Upgrade PrescioStaking to V4 with Vault integration
 */
contract UpgradeStakingV4 is Script {
    address constant STAKING_PROXY = 0xa0742ffb1762FF3EA001793aCBA202f82244D983;
    address constant NEW_VAULT = 0xc8671dFD067F31e6CD08B42dd0Fe7Ba565901A96;
    
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
            abi.encodeCall(PrescioStaking.initializeV4, (NEW_VAULT))
        );
        
        console.log("=== PrescioStaking Upgraded to V4 ===");
        console.log("Proxy:", STAKING_PROXY);
        console.log("New Impl:", address(newImpl));
        console.log("Version:", proxy.getVersion());
        console.log("Vault:", proxy.vaultContract());
        
        vm.stopBroadcast();
    }
}
