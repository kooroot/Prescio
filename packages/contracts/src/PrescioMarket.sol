// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PrescioMarket
 * @notice Parimutuel prediction market for Prescio impostor-detection game on Monad
 * @dev Players bet on who the impostor is. Pool is split proportionally among winners.
 */
contract PrescioMarket is Ownable, ReentrancyGuard {
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
        uint8 impostorIndex; // set on resolve
        MarketState state;
        uint256 totalPool;
        uint256 protocolFee; // fee amount deducted on resolve
    }

    struct UserBet {
        uint8 suspectIndex;
        uint256 amount;
        bool claimed;
    }

    // ============================================
    // Constants
    // ============================================

    uint256 public constant MIN_BET = 0.001 ether;
    uint256 public constant MAX_FEE_RATE = 1000; // 10% max

    // ============================================
    // State
    // ============================================

    address public vault;
    uint256 public feeRate; // basis points, e.g. 200 = 2%

    mapping(bytes32 => MarketInfo) public markets;
    mapping(bytes32 => mapping(uint8 => uint256)) public outcomePools; // gameId => suspectIndex => total
    mapping(bytes32 => mapping(address => UserBet)) public userBets;

    // ============================================
    // Events
    // ============================================

    event MarketCreated(bytes32 indexed gameId, uint8 playerCount);
    event BetPlaced(bytes32 indexed gameId, address indexed user, uint8 suspectIndex, uint256 amount);
    event MarketClosed(bytes32 indexed gameId);
    event MarketResolved(bytes32 indexed gameId, uint8 impostorIndex, uint256 totalPool, uint256 fee);
    event Claimed(bytes32 indexed gameId, address indexed user, uint256 payout);
    event FeeRateUpdated(uint256 newFeeRate);
    event VaultUpdated(address newVault);

    // ============================================
    // Errors
    // ============================================

    error MarketAlreadyExists();
    error MarketNotFound();
    error MarketNotOpen();
    error MarketNotClosed();
    error MarketNotResolved();
    error InvalidPlayerCount();
    error InvalidSuspectIndex();
    error BetTooSmall();
    error AlreadyBet();
    error NothingToClaim();
    error AlreadyClaimed();
    error TransferFailed();
    error InvalidFeeRate();

    // ============================================
    // Constructor
    // ============================================

    constructor(uint256 _feeRate, address _vault) Ownable(msg.sender) {
        if (_feeRate > MAX_FEE_RATE) revert InvalidFeeRate();
        feeRate = _feeRate;
        vault = _vault;
    }

    // ============================================
    // Owner Functions
    // ============================================

    /**
     * @notice Create a market for a game
     * @param gameId Unique game identifier
     * @param playerCount Number of players (suspects) in the game
     */
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

    /**
     * @notice Close betting for a market (called when discussion phase ends)
     */
    function closeMarket(bytes32 gameId) external onlyOwner {
        MarketInfo storage market = markets[gameId];
        if (market.playerCount == 0) revert MarketNotFound();
        if (market.state != MarketState.OPEN) revert MarketNotOpen();

        market.state = MarketState.CLOSED;
        emit MarketClosed(gameId);
    }

    /**
     * @notice Resolve market with the actual impostor
     * @param gameId Game identifier
     * @param impostorIndex Index of the impostor player
     */
    function resolve(bytes32 gameId, uint8 impostorIndex) external onlyOwner {
        MarketInfo storage market = markets[gameId];
        if (market.playerCount == 0) revert MarketNotFound();
        if (market.state != MarketState.CLOSED) revert MarketNotClosed();
        if (impostorIndex >= market.playerCount) revert InvalidSuspectIndex();

        market.state = MarketState.RESOLVED;
        market.impostorIndex = impostorIndex;

        // Calculate and store fee
        uint256 fee = (market.totalPool * feeRate) / 10000;
        market.protocolFee = fee;

        // Transfer fee to vault
        if (fee > 0 && vault != address(0)) {
            (bool success,) = payable(vault).call{value: fee}("");
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

    // ============================================
    // User Functions
    // ============================================

    /**
     * @notice Place a bet on who the impostor is
     * @param gameId Game identifier
     * @param suspectIndex Index of the suspected impostor
     */
    function placeBet(bytes32 gameId, uint8 suspectIndex) external payable nonReentrant {
        MarketInfo storage market = markets[gameId];
        if (market.playerCount == 0) revert MarketNotFound();
        if (market.state != MarketState.OPEN) revert MarketNotOpen();
        if (suspectIndex >= market.playerCount) revert InvalidSuspectIndex();
        if (msg.value < MIN_BET) revert BetTooSmall();
        if (userBets[gameId][msg.sender].amount > 0) revert AlreadyBet();

        userBets[gameId][msg.sender] = UserBet({
            suspectIndex: suspectIndex,
            amount: msg.value,
            claimed: false
        });

        outcomePools[gameId][suspectIndex] += msg.value;
        market.totalPool += msg.value;

        emit BetPlaced(gameId, msg.sender, suspectIndex, msg.value);
    }

    /**
     * @notice Claim winnings from a resolved market
     * @param gameId Game identifier
     */
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

    /**
     * @notice Get market info
     */
    function getMarketInfo(bytes32 gameId)
        external
        view
        returns (
            uint8 playerCount,
            MarketState state,
            uint256 totalPool,
            uint8 impostorIndex,
            uint256 protocolFee,
            uint256[] memory outcomeTotals
        )
    {
        MarketInfo storage market = markets[gameId];
        playerCount = market.playerCount;
        state = market.state;
        totalPool = market.totalPool;
        impostorIndex = market.impostorIndex;
        protocolFee = market.protocolFee;

        outcomeTotals = new uint256[](playerCount);
        for (uint8 i = 0; i < playerCount; i++) {
            outcomeTotals[i] = outcomePools[gameId][i];
        }
    }

    /**
     * @notice Get a user's bet for a game
     */
    function getUserBets(bytes32 gameId, address user)
        external
        view
        returns (uint8 suspectIndex, uint256 amount, bool claimed)
    {
        UserBet storage bet = userBets[gameId][user];
        return (bet.suspectIndex, bet.amount, bet.claimed);
    }

    /**
     * @notice Get current odds for each outcome (returns multiplied by 10000 for precision)
     * @dev Returns 0 for outcomes with no bets. Odds = totalPool / outcomePool (x10000)
     */
    function getOdds(bytes32 gameId) external view returns (uint256[] memory odds) {
        MarketInfo storage market = markets[gameId];
        odds = new uint256[](market.playerCount);

        if (market.totalPool == 0) return odds;

        uint256 distributable = market.totalPool - ((market.totalPool * feeRate) / 10000);
        for (uint8 i = 0; i < market.playerCount; i++) {
            uint256 pool = outcomePools[gameId][i];
            if (pool > 0) {
                odds[i] = (distributable * 10000) / pool;
            }
        }
    }
}
