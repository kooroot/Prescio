// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PrescioMarket.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployMarketOnly
 * @notice Deploys only PrescioMarket with existing vault
 */
contract DeployMarketOnly is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address existingVault = vm.envAddress("VAULT_ADDRESS");
        uint256 feeRate = vm.envOr("FEE_RATE", uint256(100)); // Default 1%

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Market implementation
        PrescioMarket marketImpl = new PrescioMarket();
        console.log("PrescioMarket implementation:", address(marketImpl));

        // 2. Deploy Market proxy
        bytes memory initData = abi.encodeWithSelector(
            PrescioMarket.initialize.selector,
            feeRate,
            existingVault
        );
        
        ERC1967Proxy marketProxy = new ERC1967Proxy(
            address(marketImpl),
            initData
        );
        console.log("PrescioMarket proxy:", address(marketProxy));

        // 3. Verify
        PrescioMarket market = PrescioMarket(payable(address(marketProxy)));
        console.log("Fee rate:", market.feeRate());
        console.log("Vault:", market.vault());

        vm.stopBroadcast();
    }
}
