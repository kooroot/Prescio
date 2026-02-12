// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/PrescioStaking.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract MockPrescioToken is ERC20 {
    constructor() ERC20("Prescio", "PRESCIO") {
        _mint(msg.sender, 1_000_000_000 * 1e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title PrescioStakingV6Test
 * @dev Tests for V6 - simplified weight (actual tier always, no anti-gaming)
 */
contract PrescioStakingV6Test is Test {
    PrescioStaking public staking;
    MockPrescioToken public token;

    address public treasury = address(0x1111);
    address public autoBetController = address(0x2222);
    address public mockVault = address(0x9999);
    
    address public noneTierUser = address(0x3333);
    address public bronzeTierUser = address(0x4444);
    address public silverTierUser = address(0x5555);
    address public goldTierUser = address(0x6666);

    uint256 constant NONE_AMOUNT = 1_000_000 * 1e18;
    uint256 constant BRONZE_AMOUNT = 5_000_000 * 1e18;
    uint256 constant SILVER_AMOUNT = 20_000_000 * 1e18;
    uint256 constant GOLD_AMOUNT = 50_000_000 * 1e18;

    function setUp() public {
        token = new MockPrescioToken();
        
        PrescioStaking impl = new PrescioStaking();
        bytes memory initData = abi.encodeWithSelector(
            PrescioStaking.initialize.selector,
            address(token),
            treasury,
            autoBetController
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        staking = PrescioStaking(payable(address(proxy)));
        
        staking.initializeV3();
        staking.initializeV4(mockVault);
        staking.initializeV5();
        staking.initializeV6();
        staking.setVaultContract(mockVault);
        
        token.transfer(noneTierUser, NONE_AMOUNT);
        token.transfer(bronzeTierUser, BRONZE_AMOUNT);
        token.transfer(silverTierUser, SILVER_AMOUNT);
        token.transfer(goldTierUser, GOLD_AMOUNT);
    }

    function test_Version() public view {
        assertEq(staking.VERSION(), 6);
    }

    function test_NoneTier_WeightConsistency() public {
        vm.startPrank(noneTierUser);
        token.approve(address(staking), NONE_AMOUNT);
        staking.stake(NONE_AMOUNT, PrescioStaking.LockType.FLEXIBLE);
        
        uint256 userWeight = staking.getUserWeight(noneTierUser);
        assertEq(userWeight, NONE_AMOUNT, "NONE tier weight should be 1.0x");
        assertEq(staking.totalWeight(), NONE_AMOUNT);
        
        staking.unstake();
        assertEq(staking.totalWeight(), 0, "totalWeight should be 0 after unstake");
        vm.stopPrank();
    }

    function test_BronzeTier_WeightConsistency() public {
        vm.startPrank(bronzeTierUser);
        token.approve(address(staking), BRONZE_AMOUNT);
        staking.stake(BRONZE_AMOUNT, PrescioStaking.LockType.FLEXIBLE);
        
        uint256 expectedWeight = BRONZE_AMOUNT * 110 / 100; // 1.1x
        assertEq(staking.getUserWeight(bronzeTierUser), expectedWeight, "Bronze weight 1.1x");
        assertEq(staking.totalWeight(), expectedWeight);
        
        staking.unstake();
        assertEq(staking.totalWeight(), 0);
        vm.stopPrank();
    }

    function test_SilverTier_WeightConsistency() public {
        vm.startPrank(silverTierUser);
        token.approve(address(staking), SILVER_AMOUNT);
        staking.stake(SILVER_AMOUNT, PrescioStaking.LockType.FLEXIBLE);
        
        uint256 expectedWeight = SILVER_AMOUNT * 125 / 100; // 1.25x
        assertEq(staking.getUserWeight(silverTierUser), expectedWeight, "Silver weight 1.25x");
        assertEq(staking.totalWeight(), expectedWeight);
        
        staking.unstake();
        assertEq(staking.totalWeight(), 0);
        vm.stopPrank();
    }

    function test_GoldTier_WeightConsistency() public {
        vm.startPrank(goldTierUser);
        token.approve(address(staking), GOLD_AMOUNT);
        staking.stake(GOLD_AMOUNT, PrescioStaking.LockType.FLEXIBLE);
        
        uint256 expectedWeight = GOLD_AMOUNT * 150 / 100; // 1.5x
        assertEq(staking.getUserWeight(goldTierUser), expectedWeight, "Gold weight 1.5x");
        assertEq(staking.totalWeight(), expectedWeight);
        
        staking.unstake();
        assertEq(staking.totalWeight(), 0);
        vm.stopPrank();
    }

    function test_SyncTotalWeight() public {
        vm.startPrank(bronzeTierUser);
        token.approve(address(staking), BRONZE_AMOUNT);
        staking.stake(BRONZE_AMOUNT, PrescioStaking.LockType.FLEXIBLE);
        vm.stopPrank();
        
        uint256 expected = staking.getUserWeight(bronzeTierUser);
        staking.syncTotalWeight();
        assertEq(staking.totalWeight(), expected);
    }

    function test_SyncTotalWeight_OnlyOwner() public {
        vm.prank(noneTierUser);
        vm.expectRevert();
        staking.syncTotalWeight();
    }

    function test_MultipleStakers() public {
        vm.startPrank(bronzeTierUser);
        token.approve(address(staking), BRONZE_AMOUNT);
        staking.stake(BRONZE_AMOUNT, PrescioStaking.LockType.FLEXIBLE);
        vm.stopPrank();
        
        vm.startPrank(silverTierUser);
        token.approve(address(staking), SILVER_AMOUNT);
        staking.stake(SILVER_AMOUNT, PrescioStaking.LockType.FLEXIBLE);
        vm.stopPrank();
        
        uint256 bronzeW = staking.getUserWeight(bronzeTierUser);
        uint256 silverW = staking.getUserWeight(silverTierUser);
        assertEq(staking.totalWeight(), bronzeW + silverW);
        
        vm.prank(bronzeTierUser);
        staking.unstake();
        assertEq(staking.totalWeight(), silverW);
        
        vm.prank(silverTierUser);
        staking.unstake();
        assertEq(staking.totalWeight(), 0);
    }

    function test_NoWeightLeak_MultipleCycles() public {
        for (uint i = 0; i < 3; i++) {
            vm.startPrank(silverTierUser);
            token.approve(address(staking), SILVER_AMOUNT);
            staking.stake(SILVER_AMOUNT, PrescioStaking.LockType.FLEXIBLE);
            staking.unstake();
            vm.stopPrank();
            token.transfer(silverTierUser, SILVER_AMOUNT);
        }
        assertEq(staking.totalWeight(), 0);
    }

    function test_AddStake_WeightConsistency() public {
        token.transfer(bronzeTierUser, SILVER_AMOUNT);
        
        vm.startPrank(bronzeTierUser);
        token.approve(address(staking), BRONZE_AMOUNT + SILVER_AMOUNT);
        
        staking.stake(BRONZE_AMOUNT, PrescioStaking.LockType.FLEXIBLE);
        staking.addStake(SILVER_AMOUNT - BRONZE_AMOUNT, false);
        
        uint256 newAmount = SILVER_AMOUNT;
        uint256 expectedWeight = newAmount * 125 / 100;
        
        assertEq(staking.getUserWeight(bronzeTierUser), expectedWeight);
        assertEq(staking.totalWeight(), expectedWeight);
        
        staking.unstake();
        assertEq(staking.totalWeight(), 0);
        vm.stopPrank();
    }
}
