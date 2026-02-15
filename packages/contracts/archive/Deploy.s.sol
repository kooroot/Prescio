// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PrescioMarket.sol";
import "../src/PrescioVault.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployScript
 * @notice Deploys PrescioVault and PrescioMarket (UUPS proxy)
 */
contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 feeRate = 100; // 1%

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Vault (non-upgradeable)
        PrescioVault vault = new PrescioVault();
        console.log("PrescioVault deployed at:", address(vault));

        // 2. Deploy Market implementation
        PrescioMarket marketImpl = new PrescioMarket();
        console.log("PrescioMarket implementation:", address(marketImpl));

        // 3. Deploy Market proxy
        bytes memory initData = abi.encodeWithSelector(
            PrescioMarket.initialize.selector,
            feeRate,
            address(vault)
        );
        
        ERC1967Proxy marketProxy = new ERC1967Proxy(
            address(marketImpl),
            initData
        );
        console.log("PrescioMarket proxy:", address(marketProxy));

        // 4. Verify
        PrescioMarket market = PrescioMarket(payable(address(marketProxy)));
        console.log("Fee rate:", market.feeRate());
        console.log("Vault:", market.vault());

        vm.stopBroadcast();
    }
}
