// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MockPrescio.sol";
import "../src/PrescioStaking.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployTestnet
 * @notice Deploys MockPrescio + PrescioStaking for testnet testing
 * @dev Run with: forge script script/DeployTestnet.s.sol --rpc-url $TESTNET_RPC --broadcast
 */
contract DeployTestnet is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // ========== Deploy Mock PRESCIO Token ==========
        MockPrescio prescioToken = new MockPrescio();
        console.log("MockPrescio Token:", address(prescioToken));
        console.log("Deployer Token Balance:", prescioToken.balanceOf(deployer));
        
        // ========== Deploy PrescioStaking ==========
        
        // 1. Deploy staking implementation
        PrescioStaking stakingImpl = new PrescioStaking();
        console.log("Staking Implementation:", address(stakingImpl));
        
        // 2. Deploy staking proxy
        // treasury = deployer for testing, autoBetController = address(0)
        bytes memory stakingInitData = abi.encodeWithSelector(
            PrescioStaking.initialize.selector,
            address(prescioToken),
            deployer,  // treasury = deployer for testing
            address(0) // autoBetController - not needed for staking test
        );
        
        ERC1967Proxy stakingProxy = new ERC1967Proxy(
            address(stakingImpl),
            stakingInitData
        );
        console.log("Staking Proxy:", address(stakingProxy));
        
        // ========== Verify ==========
        PrescioStaking staking = PrescioStaking(payable(address(stakingProxy)));
        
        console.log("");
        console.log("=== Verification ===");
        console.log("Staking Owner:", staking.owner());
        console.log("Staking Treasury:", staking.treasury());
        console.log("Staking Token:", address(staking.prescioToken()));
        console.log("Current Epoch:", staking.currentEpoch());
        console.log("Total Staked:", staking.totalStaked());
        
        // ========== Approve staking contract for testing ==========
        prescioToken.approve(address(stakingProxy), type(uint256).max);
        console.log("Approved staking contract for max tokens");
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("========================================");
        console.log("=== TESTNET DEPLOYMENT COMPLETE ===");
        console.log("========================================");
        console.log("MockPrescio Token:", address(prescioToken));
        console.log("Staking Proxy:", address(stakingProxy));
        console.log("");
        console.log("Next steps:");
        console.log("1. stake(amount, lockType) - lockType: 0=Flex7d, 1=14d, 2=30d, 3=60d, 4=90d");
        console.log("2. getTier(address) - check tier (1=Bronze, 2=Silver, 3=Gold, 4=Diamond, 5=Legendary)");
        console.log("3. unstake() - after lock period");
    }
}
