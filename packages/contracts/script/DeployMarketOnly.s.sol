// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PrescioMarket.sol";

contract DeployMarketOnlyScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 feeRate = 500; // 5% fee
        address existingVault = 0xbCAad29d9a2Dd64a8b8F1B9fD2e1C59D2b6a3E43;

        vm.startBroadcast(deployerPrivateKey);

        PrescioMarket market = new PrescioMarket(feeRate, existingVault);
        console.log("PrescioMarket deployed at:", address(market));
        console.log("Using existing vault:", existingVault);
        console.log("Fee rate:", feeRate, "basis points (5%)");

        vm.stopBroadcast();
    }
}
