// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/PrescioMarketV2.sol";

contract DeployV2Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 feeRate = 500; // 5%
        address existingVault = 0xbCAad29d9a2Dd64a8b8F1B9fD2e1C59D2b6a3E43;

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy implementation
        PrescioMarketV2 implementation = new PrescioMarketV2();
        console.log("Implementation deployed at:", address(implementation));

        // 2. Deploy proxy with initialization
        bytes memory initData = abi.encodeWithSelector(
            PrescioMarketV2.initialize.selector,
            feeRate,
            existingVault
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        console.log("Proxy deployed at:", address(proxy));
        console.log("Vault:", existingVault);
        console.log("Fee rate:", feeRate, "basis points (5%)");

        vm.stopBroadcast();
    }
}
