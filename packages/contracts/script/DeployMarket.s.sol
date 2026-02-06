// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PrescioMarket.sol";
import "../src/PrescioVault.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployMarket
 * @notice Deploy PrescioMarket (UUPS proxy) and PrescioVault for mainnet
 * @dev Run with: forge script script/DeployMarket.s.sol --rpc-url $RPC_URL --broadcast --verify
 */
contract DeployMarket is Script {
    uint256 constant FEE_RATE = 200; // 2%

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy Vault
        PrescioVault vault = new PrescioVault();
        console.log("Vault deployed at:", address(vault));
        
        // 2. Deploy Market implementation
        PrescioMarket implementation = new PrescioMarket();
        console.log("Market implementation deployed at:", address(implementation));
        
        // 3. Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            PrescioMarket.initialize.selector,
            FEE_RATE,
            address(vault)
        );
        
        // 4. Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        console.log("Market proxy deployed at:", address(proxy));
        
        // 5. Verify deployment
        PrescioMarket market = PrescioMarket(payable(address(proxy)));
        console.log("Owner:", market.owner());
        console.log("Vault:", market.vault());
        console.log("Fee Rate:", market.feeRate());
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("Vault:", address(vault));
        console.log("Market (proxy):", address(proxy));
        console.log("Market (implementation):", address(implementation));
    }
}

/**
 * @title UpgradeMarket
 * @notice Upgrade existing PrescioMarket proxy to new implementation
 * @dev Run with: forge script script/DeployMarket.s.sol:UpgradeMarket --rpc-url $RPC_URL --broadcast
 */
contract UpgradeMarket is Script {
    // Update this to your proxy address
    address constant PROXY = 0x8Ba812709A23D3c35e328a4F13D09C6Cd3A7CD8F;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy new implementation
        PrescioMarket newImplementation = new PrescioMarket();
        console.log("New implementation deployed at:", address(newImplementation));
        
        // 2. Upgrade proxy
        PrescioMarket proxy = PrescioMarket(payable(PROXY));
        proxy.upgradeToAndCall(address(newImplementation), "");
        console.log("Proxy upgraded");
        
        // 3. Verify upgrade
        console.log("Vault:", proxy.vault());
        console.log("Fee Rate:", proxy.feeRate());
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== Upgrade Complete ===");
        console.log("Proxy address (unchanged):", PROXY);
        console.log("New implementation:", address(newImplementation));
    }
}

/**
 * @title DeployVault
 * @notice Deploy standalone PrescioVault
 * @dev Run with: forge script script/DeployMarket.s.sol:DeployVault --rpc-url $RPC_URL --broadcast
 */
contract DeployVault is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        PrescioVault vault = new PrescioVault();
        console.log("Vault deployed at:", address(vault));
        console.log("Owner:", vault.owner());
        
        vm.stopBroadcast();
    }
}
