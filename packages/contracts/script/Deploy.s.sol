// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PrescioMarket.sol";
import "../src/PrescioVault.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 feeRate = 200; // 2%

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Vault first
        PrescioVault vault = new PrescioVault();
        console.log("PrescioVault deployed at:", address(vault));

        // Deploy Market with vault address
        PrescioMarket market = new PrescioMarket(feeRate, address(vault));
        console.log("PrescioMarket deployed at:", address(market));
        console.log("Fee rate:", feeRate, "basis points");

        vm.stopBroadcast();
    }
}
