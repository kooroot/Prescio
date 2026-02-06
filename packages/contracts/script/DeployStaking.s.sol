// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PrescioStaking.sol";
import "../src/AutoBetController.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployStaking
 * @notice Deploys PrescioStaking and AutoBetController with UUPS proxies
 * @dev Run with: forge script script/DeployStaking.s.sol --rpc-url $RPC_URL --broadcast
 * 
 * Required env vars:
 * - PRIVATE_KEY: Deployer private key
 * - PRESCIO_TOKEN: Address of PRESCIO ERC20 token
 * - TREASURY: Address of treasury
 * - MARKET_PROXY: Address of PrescioMarket proxy
 */
contract DeployStaking is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address prescioToken = vm.envAddress("PRESCIO_TOKEN");
        address treasury = vm.envAddress("TREASURY");
        address marketProxy = vm.envAddress("MARKET_PROXY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // ========== Deploy PrescioStaking ==========
        
        // 1. Deploy staking implementation
        PrescioStaking stakingImpl = new PrescioStaking();
        console.log("Staking Implementation:", address(stakingImpl));
        
        // 2. Deploy staking proxy (autoBetController = address(0) initially)
        bytes memory stakingInitData = abi.encodeWithSelector(
            PrescioStaking.initialize.selector,
            prescioToken,
            treasury,
            address(0) // Will set after AutoBetController is deployed
        );
        
        ERC1967Proxy stakingProxy = new ERC1967Proxy(
            address(stakingImpl),
            stakingInitData
        );
        console.log("Staking Proxy:", address(stakingProxy));
        
        // ========== Deploy AutoBetController ==========
        
        // 3. Deploy auto-bet implementation
        AutoBetController autoBetImpl = new AutoBetController();
        console.log("AutoBet Implementation:", address(autoBetImpl));
        
        // 4. Deploy auto-bet proxy
        bytes memory autoBetInitData = abi.encodeWithSelector(
            AutoBetController.initialize.selector,
            address(stakingProxy),
            marketProxy
        );
        
        ERC1967Proxy autoBetProxy = new ERC1967Proxy(
            address(autoBetImpl),
            autoBetInitData
        );
        console.log("AutoBet Proxy:", address(autoBetProxy));
        
        // ========== Link Contracts ==========
        
        // 5. Set AutoBetController in Staking
        PrescioStaking(payable(address(stakingProxy))).setAutoBetController(address(autoBetProxy));
        console.log("AutoBetController linked to Staking");
        
        // ========== Verify ==========
        
        PrescioStaking staking = PrescioStaking(payable(address(stakingProxy)));
        AutoBetController autoBet = AutoBetController(payable(address(autoBetProxy)));
        
        console.log("");
        console.log("=== Verification ===");
        console.log("Staking Owner:", staking.owner());
        console.log("Staking Treasury:", staking.treasury());
        console.log("Staking AutoBetController:", staking.autoBetController());
        console.log("Staking Current Epoch:", staking.currentEpoch());
        console.log("AutoBet Owner:", autoBet.owner());
        console.log("AutoBet Staking:", address(autoBet.staking()));
        console.log("AutoBet Market:", address(autoBet.market()));
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("Staking Proxy (use this):", address(stakingProxy));
        console.log("AutoBet Proxy (use this):", address(autoBetProxy));
    }
}

/**
 * @title UpgradeStaking
 * @notice Upgrades PrescioStaking to new implementation
 * @dev Run with: STAKING_PROXY=0x... forge script script/DeployStaking.s.sol:UpgradeStaking --rpc-url $RPC_URL --broadcast
 */
contract UpgradeStaking is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("STAKING_PROXY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy new implementation
        PrescioStaking newImplementation = new PrescioStaking();
        console.log("New Staking Implementation:", address(newImplementation));
        
        // 2. Upgrade proxy
        PrescioStaking proxy = PrescioStaking(payable(proxyAddress));
        proxy.upgradeToAndCall(address(newImplementation), "");
        
        console.log("Staking Proxy upgraded successfully");
        
        vm.stopBroadcast();
    }
}

/**
 * @title UpgradeAutoBet
 * @notice Upgrades AutoBetController to new implementation
 * @dev Run with: AUTOBET_PROXY=0x... forge script script/DeployStaking.s.sol:UpgradeAutoBet --rpc-url $RPC_URL --broadcast
 */
contract UpgradeAutoBet is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("AUTOBET_PROXY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy new implementation
        AutoBetController newImplementation = new AutoBetController();
        console.log("New AutoBet Implementation:", address(newImplementation));
        
        // 2. Upgrade proxy
        AutoBetController proxy = AutoBetController(payable(proxyAddress));
        proxy.upgradeToAndCall(address(newImplementation), "");
        
        console.log("AutoBet Proxy upgraded successfully");
        
        vm.stopBroadcast();
    }
}
