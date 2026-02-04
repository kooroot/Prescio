// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/PrescioMarket.sol";
import "../src/PrescioVault.sol";

contract PrescioMarketTest is Test {
    PrescioMarket public market;
    PrescioVault public vault;

    address public owner = address(this);
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");

    bytes32 public gameId = keccak256("game-1");
    uint256 public constant FEE_RATE = 200; // 2%

    function setUp() public {
        vault = new PrescioVault();
        market = new PrescioMarket(FEE_RATE, address(vault));

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(charlie, 10 ether);
    }

    // ============================================
    // Market Creation Tests
    // ============================================

    function test_createMarket() public {
        market.createMarket(gameId, 5);

        (uint8 playerCount, PrescioMarket.MarketState state, uint256 totalPool,,,) = market.getMarketInfo(gameId);
        assertEq(playerCount, 5);
        assertEq(uint8(state), uint8(PrescioMarket.MarketState.OPEN));
        assertEq(totalPool, 0);
    }

    function test_createMarket_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit PrescioMarket.MarketCreated(gameId, 5);
        market.createMarket(gameId, 5);
    }

    function test_createMarket_revertInvalidPlayerCount() public {
        vm.expectRevert(PrescioMarket.InvalidPlayerCount.selector);
        market.createMarket(gameId, 1);
    }

    function test_createMarket_revertAlreadyExists() public {
        market.createMarket(gameId, 5);
        vm.expectRevert(PrescioMarket.MarketAlreadyExists.selector);
        market.createMarket(gameId, 5);
    }

    function test_createMarket_revertNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice));
        market.createMarket(gameId, 5);
    }

    // ============================================
    // Betting Tests
    // ============================================

    function test_placeBet() public {
        market.createMarket(gameId, 5);

        vm.prank(alice);
        market.placeBet{value: 1 ether}(gameId, 2);

        (uint8 suspectIndex, uint256 amount, bool claimed) = market.getUserBets(gameId, alice);
        assertEq(suspectIndex, 2);
        assertEq(amount, 1 ether);
        assertFalse(claimed);
    }

    function test_placeBet_emitsEvent() public {
        market.createMarket(gameId, 5);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit PrescioMarket.BetPlaced(gameId, alice, 2, 1 ether);
        market.placeBet{value: 1 ether}(gameId, 2);
    }

    function test_placeBet_updatesOutcomePool() public {
        market.createMarket(gameId, 5);

        vm.prank(alice);
        market.placeBet{value: 1 ether}(gameId, 2);

        vm.prank(bob);
        market.placeBet{value: 2 ether}(gameId, 2);

        (,,uint256 totalPool,,, uint256[] memory outcomeTotals) = market.getMarketInfo(gameId);
        assertEq(totalPool, 3 ether);
        assertEq(outcomeTotals[2], 3 ether);
    }

    function test_placeBet_revertMarketNotOpen() public {
        market.createMarket(gameId, 5);
        market.closeMarket(gameId);

        vm.prank(alice);
        vm.expectRevert(PrescioMarket.MarketNotOpen.selector);
        market.placeBet{value: 1 ether}(gameId, 2);
    }

    function test_placeBet_revertBetTooSmall() public {
        market.createMarket(gameId, 5);

        vm.prank(alice);
        vm.expectRevert(PrescioMarket.BetTooSmall.selector);
        market.placeBet{value: 0.0001 ether}(gameId, 2);
    }

    function test_placeBet_revertAlreadyBet() public {
        market.createMarket(gameId, 5);

        vm.prank(alice);
        market.placeBet{value: 1 ether}(gameId, 2);

        vm.prank(alice);
        vm.expectRevert(PrescioMarket.AlreadyBet.selector);
        market.placeBet{value: 1 ether}(gameId, 3);
    }

    function test_placeBet_revertInvalidSuspect() public {
        market.createMarket(gameId, 5);

        vm.prank(alice);
        vm.expectRevert(PrescioMarket.InvalidSuspectIndex.selector);
        market.placeBet{value: 1 ether}(gameId, 5);
    }

    function test_placeBet_revertMarketNotFound() public {
        vm.prank(alice);
        vm.expectRevert(PrescioMarket.MarketNotFound.selector);
        market.placeBet{value: 1 ether}(keccak256("nonexistent"), 0);
    }

    // ============================================
    // Close Market Tests
    // ============================================

    function test_closeMarket() public {
        market.createMarket(gameId, 5);
        market.closeMarket(gameId);

        (, PrescioMarket.MarketState state,,,,) = market.getMarketInfo(gameId);
        assertEq(uint8(state), uint8(PrescioMarket.MarketState.CLOSED));
    }

    function test_closeMarket_revertNotOwner() public {
        market.createMarket(gameId, 5);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice));
        market.closeMarket(gameId);
    }

    function test_closeMarket_revertNotOpen() public {
        market.createMarket(gameId, 5);
        market.closeMarket(gameId);

        vm.expectRevert(PrescioMarket.MarketNotOpen.selector);
        market.closeMarket(gameId);
    }

    // ============================================
    // Resolve Tests
    // ============================================

    function test_resolve() public {
        market.createMarket(gameId, 5);

        vm.prank(alice);
        market.placeBet{value: 1 ether}(gameId, 2);

        market.closeMarket(gameId);
        market.resolve(gameId, 2);

        (, PrescioMarket.MarketState state,, uint8 impostorIndex,,) = market.getMarketInfo(gameId);
        assertEq(uint8(state), uint8(PrescioMarket.MarketState.RESOLVED));
        assertEq(impostorIndex, 2);
    }

    function test_resolve_sendsFeesToVault() public {
        market.createMarket(gameId, 5);

        vm.prank(alice);
        market.placeBet{value: 1 ether}(gameId, 2);

        vm.prank(bob);
        market.placeBet{value: 1 ether}(gameId, 3);

        market.closeMarket(gameId);
        market.resolve(gameId, 2);

        // 2% of 2 ether = 0.04 ether
        assertEq(address(vault).balance, 0.04 ether);
    }

    function test_resolve_revertNotOwner() public {
        market.createMarket(gameId, 5);
        market.closeMarket(gameId);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice));
        market.resolve(gameId, 2);
    }

    function test_resolve_revertNotClosed() public {
        market.createMarket(gameId, 5);

        vm.expectRevert(PrescioMarket.MarketNotClosed.selector);
        market.resolve(gameId, 2);
    }

    function test_resolve_revertInvalidImpostor() public {
        market.createMarket(gameId, 5);
        market.closeMarket(gameId);

        vm.expectRevert(PrescioMarket.InvalidSuspectIndex.selector);
        market.resolve(gameId, 5);
    }

    // ============================================
    // Claim Tests
    // ============================================

    function test_claim_winner() public {
        market.createMarket(gameId, 5);

        vm.prank(alice);
        market.placeBet{value: 1 ether}(gameId, 2);

        vm.prank(bob);
        market.placeBet{value: 1 ether}(gameId, 3);

        market.closeMarket(gameId);
        market.resolve(gameId, 2);

        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        market.claim(gameId);

        // Alice gets 2 ether - 2% fee = 1.96 ether
        assertEq(alice.balance - aliceBefore, 1.96 ether);
    }

    function test_claim_multipleWinners() public {
        market.createMarket(gameId, 5);

        vm.prank(alice);
        market.placeBet{value: 1 ether}(gameId, 2); // winner

        vm.prank(bob);
        market.placeBet{value: 3 ether}(gameId, 2); // winner

        vm.prank(charlie);
        market.placeBet{value: 2 ether}(gameId, 3); // loser

        market.closeMarket(gameId);
        market.resolve(gameId, 2);

        // Total pool: 6 ether, fee: 0.12 ether, distributable: 5.88 ether
        // Winning pool: 4 ether (alice 1 + bob 3)
        // Alice payout: 5.88 * 1 / 4 = 1.47 ether
        // Bob payout: 5.88 * 3 / 4 = 4.41 ether

        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        market.claim(gameId);
        assertEq(alice.balance - aliceBefore, 1.47 ether);

        uint256 bobBefore = bob.balance;
        vm.prank(bob);
        market.claim(gameId);
        assertEq(bob.balance - bobBefore, 4.41 ether);
    }

    function test_claim_revertNotResolved() public {
        market.createMarket(gameId, 5);

        vm.prank(alice);
        market.placeBet{value: 1 ether}(gameId, 2);

        market.closeMarket(gameId);

        vm.prank(alice);
        vm.expectRevert(PrescioMarket.MarketNotResolved.selector);
        market.claim(gameId);
    }

    function test_claim_revertAlreadyClaimed() public {
        market.createMarket(gameId, 5);

        vm.prank(alice);
        market.placeBet{value: 1 ether}(gameId, 2);

        market.closeMarket(gameId);
        market.resolve(gameId, 2);

        vm.prank(alice);
        market.claim(gameId);

        vm.prank(alice);
        vm.expectRevert(PrescioMarket.AlreadyClaimed.selector);
        market.claim(gameId);
    }

    function test_claim_revertLoser() public {
        market.createMarket(gameId, 5);

        vm.prank(alice);
        market.placeBet{value: 1 ether}(gameId, 2);

        vm.prank(bob);
        market.placeBet{value: 1 ether}(gameId, 3);

        market.closeMarket(gameId);
        market.resolve(gameId, 3);

        vm.prank(alice);
        vm.expectRevert(PrescioMarket.NothingToClaim.selector);
        market.claim(gameId);
    }

    function test_claim_revertNoBet() public {
        market.createMarket(gameId, 5);

        vm.prank(alice);
        market.placeBet{value: 1 ether}(gameId, 2);

        market.closeMarket(gameId);
        market.resolve(gameId, 2);

        vm.prank(charlie); // never bet
        vm.expectRevert(PrescioMarket.NothingToClaim.selector);
        market.claim(gameId);
    }

    // ============================================
    // No Winners Scenario
    // ============================================

    function test_resolve_noWinners_feesStillCollected() public {
        market.createMarket(gameId, 5);

        vm.prank(alice);
        market.placeBet{value: 1 ether}(gameId, 2);

        vm.prank(bob);
        market.placeBet{value: 1 ether}(gameId, 3);

        market.closeMarket(gameId);
        market.resolve(gameId, 4); // nobody bet on 4

        // Fees still go to vault
        assertEq(address(vault).balance, 0.04 ether);
        // Remaining funds locked in contract (no winners to claim)
    }

    // ============================================
    // Fee Tests
    // ============================================

    function test_feeRate_configurable() public {
        market.setFeeRate(500); // 5%
        assertEq(market.feeRate(), 500);
    }

    function test_feeRate_revertTooHigh() public {
        vm.expectRevert(PrescioMarket.InvalidFeeRate.selector);
        market.setFeeRate(1001);
    }

    function test_feeRate_zeroFee() public {
        PrescioMarket zeroFeeMarket = new PrescioMarket(0, address(vault));

        bytes32 gid = keccak256("game-zero-fee");
        zeroFeeMarket.createMarket(gid, 5);

        vm.prank(alice);
        zeroFeeMarket.placeBet{value: 1 ether}(gid, 2);

        vm.prank(bob);
        zeroFeeMarket.placeBet{value: 1 ether}(gid, 3);

        zeroFeeMarket.closeMarket(gid);
        zeroFeeMarket.resolve(gid, 2);

        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        zeroFeeMarket.claim(gid);
        assertEq(alice.balance - aliceBefore, 2 ether);
    }

    // ============================================
    // Vault Withdrawal Tests
    // ============================================

    function test_vault_withdrawFees() public {
        market.createMarket(gameId, 5);

        vm.prank(alice);
        market.placeBet{value: 5 ether}(gameId, 2);

        market.closeMarket(gameId);
        market.resolve(gameId, 2);

        // 2% of 5 ether = 0.1 ether
        assertEq(vault.feeBalance(), 0.1 ether);

        uint256 ownerBefore = owner.balance;
        vault.withdrawFees();
        assertEq(owner.balance - ownerBefore, 0.1 ether);
    }

    function test_vault_revertNoFees() public {
        vm.expectRevert(PrescioVault.NoFees.selector);
        vault.withdrawFees();
    }

    // ============================================
    // Odds View Tests
    // ============================================

    function test_getOdds() public {
        market.createMarket(gameId, 3);

        vm.prank(alice);
        market.placeBet{value: 1 ether}(gameId, 0);

        vm.prank(bob);
        market.placeBet{value: 3 ether}(gameId, 1);

        uint256[] memory odds = market.getOdds(gameId);
        // Total: 4 ether, distributable after 2% = 3.92 ether
        // Odds[0] = 3.92/1 * 10000 = 39200
        // Odds[1] = 3.92/3 * 10000 ≈ 13066
        // Odds[2] = 0 (no bets)
        assertEq(odds[0], 39200);
        assertEq(odds[1], 13066); // truncated
        assertEq(odds[2], 0);
    }

    function test_getOdds_emptyMarket() public {
        market.createMarket(gameId, 3);
        uint256[] memory odds = market.getOdds(gameId);
        assertEq(odds[0], 0);
        assertEq(odds[1], 0);
        assertEq(odds[2], 0);
    }

    // ============================================
    // Edge Cases
    // ============================================

    function test_multipleSeparateGames() public {
        bytes32 gameId2 = keccak256("game-2");

        market.createMarket(gameId, 3);
        market.createMarket(gameId2, 4);

        vm.prank(alice);
        market.placeBet{value: 1 ether}(gameId, 0);

        vm.prank(alice);
        market.placeBet{value: 2 ether}(gameId2, 1);

        (,,uint256 pool1,,,) = market.getMarketInfo(gameId);
        (,,uint256 pool2,,,) = market.getMarketInfo(gameId2);

        assertEq(pool1, 1 ether);
        assertEq(pool2, 2 ether);
    }

    receive() external payable {}
}
