// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PrescioMarketV3
 * @notice UUPS upgradeable parimutuel prediction market for Prescio
 * @dev Players bet on who the impostor is. Pool is split proportionally among winners.
 * @dev V3: Added betting pause/resume functionality
 */
contract PrescioMarketV3 is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuard {
    // ============================================
    // Types
    // ============================================

    enum MarketState {
        OPEN,
        CLOSED,
        RESOLVED
    }

    struct MarketInfo {
        uint8 playerCount;
        uint8 impostorIndex;
        MarketState state;
        uint256 totalPool;
        uint256 protocolFee;
    }

    struct UserBet {
        uint8 suspectIndex;
        uint256 amount;
        bool claimed;
    }

    // ============================================
    // Constants
    // ============================================

    uint256 public constant MIN_BET = 0.1 ether;
    uint256 public constant MAX_FEE_RATE = 1000; // 10% max

    // ============================================
    // State
    // ============================================

    address public vault;
    uint256 public feeRate;

    mapping(bytes32 => MarketInfo) public markets;
    mapping(bytes32 => mapping(address => UserBet)) public userBets;
    mapping(bytes32 => mapping(uint8 => uint256)) public outcomePools;
    
    // V3: Betting pause state per market
    mapping(bytes32 => bool) public bettingPaused;

    // ============================================
    // Events
    // ============================================

    event MarketCreated(bytes32 indexed gameId, uint8 playerCount);
    event MarketClosed(bytes32 indexed gameId);
    event MarketResolved(bytes32 indexed gameId, uint8 impostorIndex, uint256 totalPool, uint256 fee);
    event BetPlaced(bytes32 indexed gameId, address indexed user, uint8 suspectIndex, uint256 amount);
    event Claimed(bytes32 indexed gameId, address indexed user, uint256 payout);
    event FeeRateUpdated(uint256 newRate);
    event VaultUpdated(address newVault);
    event BettingPaused(bytes32 indexed gameId);
    event BettingResumed(bytes32 indexed gameId);

    // ============================================
    // Errors
    // ============================================

    error InvalidFeeRate();
    error InvalidPlayerCount();
    error MarketAlreadyExists();
    error MarketNotFound();
    error MarketNotOpen();
    error MarketNotClosed();
    error MarketNotResolved();
    error InvalidSuspectIndex();
    error BetTooSmall();
    error AlreadyBet();
    error NothingToClaim();
    error AlreadyClaimed();
    error TransferFailed();
    error BettingIsPaused();

    // ============================================
    // Initializer (replaces constructor)
    // ============================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(uint256 _feeRate, address _vault) public initializer {
        __Ownable_init(msg.sender);

        if (_feeRate > MAX_FEE_RATE) revert InvalidFeeRate();
        feeRate = _feeRate;
        vault = _vault;
    }

    // ============================================
    // UUPS Authorization
    // ============================================

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============================================
    // Owner Functions
    // ============================================

    function createMarket(bytes32 gameId, uint8 playerCount) external onlyOwner {
        if (playerCount < 2) revert InvalidPlayerCount();
        if (markets[gameId].playerCount != 0) revert MarketAlreadyExists();

        markets[gameId] = MarketInfo({
            playerCount: playerCount,
            impostorIndex: 0,
            state: MarketState.OPEN,
            totalPool: 0,
            protocolFee: 0
        });

        emit MarketCreated(gameId, playerCount);
    }

    function closeMarket(bytes32 gameId) external onlyOwner {
        MarketInfo storage market = markets[gameId];
        if (market.playerCount == 0) revert MarketNotFound();
        if (market.state != MarketState.OPEN) revert MarketNotOpen();

        market.state = MarketState.CLOSED;
        emit MarketClosed(gameId);
    }

    function resolve(bytes32 gameId, uint8 impostorIndex) external onlyOwner {
        MarketInfo storage market = markets[gameId];
        if (market.playerCount == 0) revert MarketNotFound();
        if (market.state != MarketState.CLOSED) revert MarketNotClosed();
        if (impostorIndex >= market.playerCount) revert InvalidSuspectIndex();

        market.state = MarketState.RESOLVED;
        market.impostorIndex = impostorIndex;

        uint256 fee = (market.totalPool * feeRate) / 10000;
        market.protocolFee = fee;

        // Check if anyone bet on the correct answer
        uint256 winningPool = outcomePools[gameId][impostorIndex];
        
        uint256 toVault;
        if (winningPool == 0) {
            // No winners: entire pool goes to vault
            toVault = market.totalPool;
        } else {
            // Winners exist: only fee goes to vault
            toVault = fee;
        }

        if (toVault > 0 && vault != address(0)) {
            (bool success,) = payable(vault).call{value: toVault}("");
            if (!success) revert TransferFailed();
        }

        emit MarketResolved(gameId, impostorIndex, market.totalPool, fee);
    }

    function setFeeRate(uint256 _feeRate) external onlyOwner {
        if (_feeRate > MAX_FEE_RATE) revert InvalidFeeRate();
        feeRate = _feeRate;
        emit FeeRateUpdated(_feeRate);
    }

    function setVault(address _vault) external onlyOwner {
        vault = _vault;
        emit VaultUpdated(_vault);
    }

    // V3: Pause/resume betting
    function pauseBetting(bytes32 gameId) external onlyOwner {
        MarketInfo storage market = markets[gameId];
        if (market.playerCount == 0) revert MarketNotFound();
        bettingPaused[gameId] = true;
        emit BettingPaused(gameId);
    }

    function resumeBetting(bytes32 gameId) external onlyOwner {
        MarketInfo storage market = markets[gameId];
        if (market.playerCount == 0) revert MarketNotFound();
        bettingPaused[gameId] = false;
        emit BettingResumed(gameId);
    }

    function isBettingOpen(bytes32 gameId) external view returns (bool) {
        MarketInfo storage market = markets[gameId];
        return market.playerCount > 0 && 
               market.state == MarketState.OPEN && 
               !bettingPaused[gameId];
    }

    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToClaim();
        (bool success,) = payable(owner()).call{value: balance}("");
        if (!success) revert TransferFailed();
    }

    // ============================================
    // User Functions
    // ============================================

    function placeBet(bytes32 gameId, uint8 suspectIndex) external payable nonReentrant {
        MarketInfo storage market = markets[gameId];
        if (market.playerCount == 0) revert MarketNotFound();
        if (market.state != MarketState.OPEN) revert MarketNotOpen();
        if (bettingPaused[gameId]) revert BettingIsPaused();
        if (suspectIndex >= market.playerCount) revert InvalidSuspectIndex();
        if (msg.value < MIN_BET) revert BetTooSmall();
        if (userBets[gameId][msg.sender].amount > 0) revert AlreadyBet();

        userBets[gameId][msg.sender] = UserBet({
            suspectIndex: suspectIndex,
            amount: msg.value,
            claimed: false
        });

        market.totalPool += msg.value;
        outcomePools[gameId][suspectIndex] += msg.value;

        emit BetPlaced(gameId, msg.sender, suspectIndex, msg.value);
    }

    function claim(bytes32 gameId) external nonReentrant {
        MarketInfo storage market = markets[gameId];
        if (market.state != MarketState.RESOLVED) revert MarketNotResolved();

        UserBet storage bet = userBets[gameId][msg.sender];
        if (bet.amount == 0) revert NothingToClaim();
        if (bet.claimed) revert AlreadyClaimed();
        if (bet.suspectIndex != market.impostorIndex) revert NothingToClaim();

        bet.claimed = true;

        uint256 winningPool = outcomePools[gameId][market.impostorIndex];
        uint256 distributable = market.totalPool - market.protocolFee;
        uint256 payout = (distributable * bet.amount) / winningPool;

        (bool success,) = payable(msg.sender).call{value: payout}("");
        if (!success) revert TransferFailed();

        emit Claimed(gameId, msg.sender, payout);
    }

    // ============================================
    // View Functions
    // ============================================

    function getMarketInfo(bytes32 gameId)
        external
        view
        returns (uint8 playerCount, uint8 state, uint256 totalPool, uint8 impostorIndex, uint256 protocolFee)
    {
        MarketInfo storage m = markets[gameId];
        return (m.playerCount, uint8(m.state), m.totalPool, m.impostorIndex, m.protocolFee);
    }

    function getUserBets(bytes32 gameId, address user)
        external
        view
        returns (uint8 suspectIndex, uint256 amount, bool claimed)
    {
        UserBet storage b = userBets[gameId][user];
        return (b.suspectIndex, b.amount, b.claimed);
    }

    function getOutcomePool(bytes32 gameId, uint8 suspectIndex) external view returns (uint256) {
        return outcomePools[gameId][suspectIndex];
    }

    function getOdds(bytes32 gameId) external view returns (uint256[] memory) {
        MarketInfo storage m = markets[gameId];
        uint256[] memory odds = new uint256[](m.playerCount);
        for (uint8 i = 0; i < m.playerCount; i++) {
            odds[i] = outcomePools[gameId][i];
        }
        return odds;
    }
}
