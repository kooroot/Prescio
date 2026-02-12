// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/PrescioVault.sol";

/**
 * @title MockStaking
 * @dev Mock staking contract for testing depositRewardsFromVault
 */
contract MockStaking {
    uint256 public totalReceived;
    uint256 public lastDeposit;

    function depositRewardsFromVault() external payable {
        totalReceived += msg.value;
        lastDeposit = msg.value;
    }

    receive() external payable {}
}

/**
 * @title ReentrantAttacker
 * @dev Attempts reentrancy attack on distributeAll
 */
contract ReentrantAttacker {
    PrescioVault public vault;
    uint256 public attackCount;

    constructor(PrescioVault _vault) {
        vault = _vault;
    }

    function depositRewardsFromVault() external payable {
        attackCount++;
        if (attackCount < 3 && address(vault).balance > 0) {
            vault.distributeAll();
        }
    }

    receive() external payable {
        attackCount++;
        if (attackCount < 3 && address(vault).balance > 0) {
            vault.distributeAll();
        }
    }
}

/**
 * @title RejectingReceiver
 * @dev Contract that rejects ETH transfers
 */
contract RejectingReceiver {
    receive() external payable {
        revert("No thanks");
    }

    function depositRewardsFromVault() external payable {
        revert("No thanks");
    }
}

contract PrescioVaultTest is Test {
    PrescioVault public vault;
    MockStaking public staking;

    address public owner = address(this);
    address public treasury = address(0x0094f42BF79B7ACC942624A9173fa0ED7554d300);
    address public development = address(0x001436D283C6eC27F555c25dD045a6A57B5A4BE2);
    address public user = address(0x1234);

    event FeesReceived(address indexed from, uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event FeesDistributed(uint256 toTreasury, uint256 toStaking, uint256 toDevelopment);
    event DistributionRatiosUpdated(uint256 treasuryRatio, uint256 stakingRatio, uint256 developmentRatio);
    event TreasuryAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event StakingContractUpdated(address indexed oldAddress, address indexed newAddress);
    event DevelopmentAddressUpdated(address indexed oldAddress, address indexed newAddress);

    function setUp() public {
        staking = new MockStaking();
        vault = new PrescioVault(
            treasury,
            address(staking),
            development
        );
    }

    // ============================================
    // Constructor Tests
    // ============================================

    function test_Constructor_InitializesCorrectly() public view {
        assertEq(vault.treasuryAddress(), treasury);
        assertEq(vault.stakingContract(), address(staking));
        assertEq(vault.developmentAddress(), development);
        assertEq(vault.treasuryRatio(), 5000);
        assertEq(vault.stakingRatio(), 3000);
        assertEq(vault.developmentRatio(), 2000);
        assertEq(vault.VERSION(), 3);
        assertEq(vault.RATIO_PRECISION(), 10000);
    }

    function test_Constructor_RevertsOnZeroTreasury() public {
        vm.expectRevert(PrescioVault.ZeroAddress.selector);
        new PrescioVault(address(0), address(staking), development);
    }

    function test_Constructor_RevertsOnZeroStaking() public {
        vm.expectRevert(PrescioVault.ZeroAddress.selector);
        new PrescioVault(treasury, address(0), development);
    }

    function test_Constructor_RevertsOnZeroDevelopment() public {
        vm.expectRevert(PrescioVault.ZeroAddress.selector);
        new PrescioVault(treasury, address(staking), address(0));
    }

    // ============================================
    // Receive Tests
    // ============================================

    function test_Receive_AcceptsFees() public {
        uint256 amount = 1 ether;
        
        vm.expectEmit(true, false, false, true);
        emit FeesReceived(address(this), amount);
        
        (bool success,) = address(vault).call{value: amount}("");
        assertTrue(success);
        assertEq(vault.feeBalance(), amount);
    }

    function test_Receive_MultipleFees() public {
        (bool s1,) = address(vault).call{value: 1 ether}("");
        (bool s2,) = address(vault).call{value: 2 ether}("");
        assertTrue(s1 && s2);
        assertEq(vault.feeBalance(), 3 ether);
    }

    // ============================================
    // Distribution Tests
    // ============================================

    function test_DistributeAll_DistributesCorrectly() public {
        // Send 10 ETH to vault
        (bool success,) = address(vault).call{value: 10 ether}("");
        assertTrue(success);

        uint256 treasuryBalanceBefore = treasury.balance;
        uint256 devBalanceBefore = development.balance;

        // Expected: 50% to treasury (5 ETH), 30% to staking (3 ETH), 20% to dev (2 ETH)
        vm.expectEmit(false, false, false, true);
        emit FeesDistributed(5 ether, 3 ether, 2 ether);

        vault.distributeAll();

        assertEq(treasury.balance - treasuryBalanceBefore, 5 ether);
        assertEq(staking.totalReceived(), 3 ether);
        assertEq(development.balance - devBalanceBefore, 2 ether);
        assertEq(vault.feeBalance(), 0);
    }

    function test_DistributeAll_HandlesSmallAmounts() public {
        // Send small amount (100 wei)
        (bool success,) = address(vault).call{value: 100}("");
        assertTrue(success);

        uint256 treasuryBalanceBefore = treasury.balance;
        uint256 devBalanceBefore = development.balance;

        vault.distributeAll();

        // 50% of 100 = 50
        // 30% of 100 = 30  
        // 20% of 100 = 20 (remainder)
        assertEq(treasury.balance - treasuryBalanceBefore, 50);
        assertEq(staking.totalReceived(), 30);
        assertEq(development.balance - devBalanceBefore, 20);
    }

    function test_DistributeAll_HandlesRoundingCorrectly() public {
        // Send 100 wei (will have rounding)
        (bool success,) = address(vault).call{value: 99}("");
        assertTrue(success);

        uint256 totalBefore = treasury.balance + development.balance + staking.totalReceived();
        vault.distributeAll();
        uint256 totalAfter = treasury.balance + development.balance + staking.totalReceived();

        // All funds should be distributed (no dust left)
        assertEq(vault.feeBalance(), 0);
        assertEq(totalAfter - totalBefore, 99);
    }

    function test_DistributeAll_RevertsOnNoFees() public {
        vm.expectRevert(PrescioVault.NoFees.selector);
        vault.distributeAll();
    }

    function test_DistributeAll_RevertsForNonOwner() public {
        (bool success,) = address(vault).call{value: 1 ether}("");
        assertTrue(success);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user));
        vault.distributeAll();
    }

    function test_DistributeAll_WithZeroRatios() public {
        // Set 100% to treasury, 0% to others
        vault.setDistributionRatios(10000, 0, 0);

        (bool success,) = address(vault).call{value: 1 ether}("");
        assertTrue(success);

        uint256 treasuryBalanceBefore = treasury.balance;
        vault.distributeAll();

        assertEq(treasury.balance - treasuryBalanceBefore, 1 ether);
        assertEq(staking.lastDeposit(), 0);
    }

    function test_DistributeAll_With100PercentStaking() public {
        vault.setDistributionRatios(0, 10000, 0);

        (bool success,) = address(vault).call{value: 5 ether}("");
        assertTrue(success);

        vault.distributeAll();

        assertEq(staking.totalReceived(), 5 ether);
    }

    // ============================================
    // Address Setter Tests
    // ============================================

    function test_SetTreasuryAddress_Works() public {
        address newTreasury = address(0x9999);
        
        vm.expectEmit(true, true, false, false);
        emit TreasuryAddressUpdated(treasury, newTreasury);
        
        vault.setTreasuryAddress(newTreasury);
        assertEq(vault.treasuryAddress(), newTreasury);
    }

    function test_SetTreasuryAddress_RevertsOnZero() public {
        vm.expectRevert(PrescioVault.ZeroAddress.selector);
        vault.setTreasuryAddress(address(0));
    }

    function test_SetTreasuryAddress_RevertsForNonOwner() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user));
        vault.setTreasuryAddress(address(0x9999));
    }

    function test_SetStakingContract_Works() public {
        address newStaking = address(0x8888);
        
        vm.expectEmit(true, true, false, false);
        emit StakingContractUpdated(address(staking), newStaking);
        
        vault.setStakingContract(newStaking);
        assertEq(vault.stakingContract(), newStaking);
    }

    function test_SetStakingContract_RevertsOnZero() public {
        vm.expectRevert(PrescioVault.ZeroAddress.selector);
        vault.setStakingContract(address(0));
    }

    function test_SetDevelopmentAddress_Works() public {
        address newDev = address(0x7777);
        
        vm.expectEmit(true, true, false, false);
        emit DevelopmentAddressUpdated(development, newDev);
        
        vault.setDevelopmentAddress(newDev);
        assertEq(vault.developmentAddress(), newDev);
    }

    function test_SetDevelopmentAddress_RevertsOnZero() public {
        vm.expectRevert(PrescioVault.ZeroAddress.selector);
        vault.setDevelopmentAddress(address(0));
    }

    // ============================================
    // Ratio Setter Tests
    // ============================================

    function test_SetDistributionRatios_Works() public {
        vm.expectEmit(false, false, false, true);
        emit DistributionRatiosUpdated(6000, 2000, 2000);

        vault.setDistributionRatios(6000, 2000, 2000);

        assertEq(vault.treasuryRatio(), 6000);
        assertEq(vault.stakingRatio(), 2000);
        assertEq(vault.developmentRatio(), 2000);
    }

    function test_SetDistributionRatios_RevertsOnInvalidSum() public {
        // Sum is 9000, not 10000
        vm.expectRevert(PrescioVault.InvalidRatioSum.selector);
        vault.setDistributionRatios(4000, 3000, 2000);
    }

    function test_SetDistributionRatios_RevertsOnOverflow() public {
        // Sum is 11000
        vm.expectRevert(PrescioVault.InvalidRatioSum.selector);
        vault.setDistributionRatios(5000, 4000, 2000);
    }

    function test_SetDistributionRatios_AllowsZeroRatios() public {
        // Valid: 100% treasury
        vault.setDistributionRatios(10000, 0, 0);
        assertEq(vault.treasuryRatio(), 10000);
        assertEq(vault.stakingRatio(), 0);
        assertEq(vault.developmentRatio(), 0);
    }

    function test_SetDistributionRatios_RevertsForNonOwner() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user));
        vault.setDistributionRatios(5000, 3000, 2000);
    }

    // ============================================
    // V2 Compatibility Tests
    // ============================================

    function test_WithdrawFees_Works() public {
        (bool success,) = address(vault).call{value: 1 ether}("");
        assertTrue(success);

        uint256 ownerBalanceBefore = owner.balance;
        
        vm.expectEmit(true, false, false, true);
        emit FeesWithdrawn(owner, 1 ether);
        
        vault.withdrawFees();

        assertEq(owner.balance - ownerBalanceBefore, 1 ether);
        assertEq(vault.feeBalance(), 0);
    }

    function test_WithdrawFees_RevertsOnNoFees() public {
        vm.expectRevert(PrescioVault.NoFees.selector);
        vault.withdrawFees();
    }

    function test_WithdrawFeesTo_Works() public {
        (bool success,) = address(vault).call{value: 2 ether}("");
        assertTrue(success);

        address recipient = address(0x5555);
        uint256 recipientBalanceBefore = recipient.balance;

        vault.withdrawFeesTo(recipient);

        assertEq(recipient.balance - recipientBalanceBefore, 2 ether);
    }

    function test_WithdrawFeesTo_RevertsOnZeroAddress() public {
        (bool success,) = address(vault).call{value: 1 ether}("");
        assertTrue(success);

        vm.expectRevert(PrescioVault.ZeroAddress.selector);
        vault.withdrawFeesTo(address(0));
    }

    // ============================================
    // View Functions Tests
    // ============================================

    function test_GetVersion() public view {
        assertEq(vault.getVersion(), 3);
    }

    function test_GetDistributionRatios() public view {
        (uint256 t, uint256 s, uint256 d) = vault.getDistributionRatios();
        assertEq(t, 5000);
        assertEq(s, 3000);
        assertEq(d, 2000);
    }

    function test_GetDistributionAddresses() public view {
        (address t, address s, address d) = vault.getDistributionAddresses();
        assertEq(t, treasury);
        assertEq(s, address(staking));
        assertEq(d, development);
    }

    function test_PreviewDistribution() public {
        (bool success,) = address(vault).call{value: 10 ether}("");
        assertTrue(success);

        (uint256 toTreasury, uint256 toStaking, uint256 toDev) = vault.previewDistribution();
        assertEq(toTreasury, 5 ether);
        assertEq(toStaking, 3 ether);
        assertEq(toDev, 2 ether);
    }

    function test_PreviewDistribution_EmptyBalance() public view {
        (uint256 toTreasury, uint256 toStaking, uint256 toDev) = vault.previewDistribution();
        assertEq(toTreasury, 0);
        assertEq(toStaking, 0);
        assertEq(toDev, 0);
    }

    // ============================================
    // Security Tests
    // ============================================

    function test_Reentrancy_DistributeAll() public {
        // Deploy attacker as staking contract
        ReentrantAttacker attacker = new ReentrantAttacker(vault);
        
        PrescioVault vulnerableVault = new PrescioVault(
            treasury,
            address(attacker),
            development
        );

        // Fund vault
        (bool success,) = address(vulnerableVault).call{value: 10 ether}("");
        assertTrue(success);

        // Should not allow reentrancy - ReentrancyGuard should prevent this
        // The attacker's receive/depositRewardsFromVault will try to call distributeAll again
        vulnerableVault.distributeAll();
        
        // Attack count should be 1 (initial call only, no reentrancy)
        assertEq(attacker.attackCount(), 1);
    }

    function test_TransferFailed_Treasury() public {
        RejectingReceiver rejector = new RejectingReceiver();
        
        PrescioVault testVault = new PrescioVault(
            address(rejector),
            address(staking),
            development
        );

        (bool success,) = address(testVault).call{value: 1 ether}("");
        assertTrue(success);

        vm.expectRevert(PrescioVault.TransferFailed.selector);
        testVault.distributeAll();
    }

    function test_TransferFailed_Development() public {
        RejectingReceiver rejector = new RejectingReceiver();
        
        PrescioVault testVault = new PrescioVault(
            treasury,
            address(staking),
            address(rejector)
        );

        (bool success,) = address(testVault).call{value: 1 ether}("");
        assertTrue(success);

        vm.expectRevert(PrescioVault.TransferFailed.selector);
        testVault.distributeAll();
    }

    function test_StakingCallFailed() public {
        RejectingReceiver rejector = new RejectingReceiver();
        
        PrescioVault testVault = new PrescioVault(
            treasury,
            address(rejector),
            development
        );

        (bool success,) = address(testVault).call{value: 1 ether}("");
        assertTrue(success);

        // Should revert when staking call fails
        vm.expectRevert();
        testVault.distributeAll();
    }

    // ============================================
    // Fuzz Tests
    // ============================================

    function testFuzz_DistributeAll_PreservesTotal(uint256 amount) public {
        vm.assume(amount > 0 && amount < 1000000 ether);

        deal(address(this), amount);
        (bool success,) = address(vault).call{value: amount}("");
        assertTrue(success);

        uint256 totalBefore = treasury.balance + development.balance + staking.totalReceived();
        
        vault.distributeAll();
        
        uint256 totalAfter = treasury.balance + development.balance + staking.totalReceived();
        
        // All funds distributed, nothing left
        assertEq(vault.feeBalance(), 0);
        assertEq(totalAfter - totalBefore, amount);
    }

    function testFuzz_SetDistributionRatios_ValidSums(uint256 t, uint256 s) public {
        vm.assume(t <= 10000);
        vm.assume(s <= 10000 - t);
        uint256 d = 10000 - t - s;

        vault.setDistributionRatios(t, s, d);
        
        assertEq(vault.treasuryRatio(), t);
        assertEq(vault.stakingRatio(), s);
        assertEq(vault.developmentRatio(), d);
    }

    // ============================================
    // Integration Test
    // ============================================

    function test_Integration_MultipleDistributions() public {
        // First distribution
        (bool s1,) = address(vault).call{value: 10 ether}("");
        assertTrue(s1);
        vault.distributeAll();

        assertEq(staking.totalReceived(), 3 ether);

        // Change ratios: 40/40/20
        vault.setDistributionRatios(4000, 4000, 2000);

        // Second distribution
        (bool s2,) = address(vault).call{value: 10 ether}("");
        assertTrue(s2);
        vault.distributeAll();

        // Staking should have 3 + 4 = 7 ETH
        assertEq(staking.totalReceived(), 7 ether);
    }

    receive() external payable {}
}
