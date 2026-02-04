// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PrescioMarket
 * @notice Prediction market for Prescio game events on Monad
 * @dev Players can bet on game outcomes (winner, eliminations, etc.)
 */
contract PrescioMarket {
    // ============================================
    // Types
    // ============================================

    struct MarketInfo {
        bytes32 gameId;
        string question;
        uint8 outcomeCount;
        uint256 totalPool;
        bool resolved;
        uint8 winningOutcome;
        address creator;
    }

    struct UserBet {
        uint8 outcomeIndex;
        uint256 amount;
        bool claimed;
    }

    // ============================================
    // State
    // ============================================

    address public owner;
    uint256 public nextMarketId;
    uint256 public platformFeeRate; // basis points (e.g., 250 = 2.5%)

    mapping(uint256 => MarketInfo) public markets;
    mapping(uint256 => mapping(uint8 => uint256)) public outcomePools; // marketId => outcomeIndex => total staked
    mapping(uint256 => mapping(address => UserBet)) public userBets; // marketId => user => bet

    // ============================================
    // Events
    // ============================================

    event MarketCreated(uint256 indexed marketId, bytes32 indexed gameId, string question);
    event BetPlaced(uint256 indexed marketId, address indexed user, uint8 outcomeIndex, uint256 amount);
    event MarketResolved(uint256 indexed marketId, uint8 winningOutcome);
    event Claimed(uint256 indexed marketId, address indexed user, uint256 amount);

    // ============================================
    // Errors
    // ============================================

    error Unauthorized();
    error MarketNotFound();
    error MarketAlreadyResolved();
    error MarketNotResolved();
    error InvalidOutcome();
    error BetTooSmall();
    error AlreadyBet();
    error NothingToClaim();
    error AlreadyClaimed();
    error TransferFailed();

    // ============================================
    // Modifiers
    // ============================================

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ============================================
    // Constructor
    // ============================================

    constructor(uint256 _feeRate) {
        owner = msg.sender;
        platformFeeRate = _feeRate;
        nextMarketId = 1;
    }

    // ============================================
    // Core Functions
    // ============================================

    /**
     * @notice Create a new prediction market
     * @param gameId The game identifier
     * @param question The market question
     * @param outcomeCount Number of possible outcomes
     * @return marketId The ID of the created market
     */
    function createMarket(
        bytes32 gameId,
        string calldata question,
        uint8 outcomeCount
    ) external onlyOwner returns (uint256 marketId) {
        if (outcomeCount < 2) revert InvalidOutcome();

        marketId = nextMarketId++;

        markets[marketId] = MarketInfo({
            gameId: gameId,
            question: question,
            outcomeCount: outcomeCount,
            totalPool: 0,
            resolved: false,
            winningOutcome: 0,
            creator: msg.sender
        });

        emit MarketCreated(marketId, gameId, question);
    }

    /**
     * @notice Place a bet on a market outcome
     * @param marketId The market to bet on
     * @param outcomeIndex The outcome to bet on (0-indexed)
     */
    function placeBet(uint256 marketId, uint8 outcomeIndex) external payable {
        MarketInfo storage market = markets[marketId];
        if (market.creator == address(0)) revert MarketNotFound();
        if (market.resolved) revert MarketAlreadyResolved();
        if (outcomeIndex >= market.outcomeCount) revert InvalidOutcome();
        if (msg.value == 0) revert BetTooSmall();
        if (userBets[marketId][msg.sender].amount > 0) revert AlreadyBet();

        userBets[marketId][msg.sender] = UserBet({
            outcomeIndex: outcomeIndex,
            amount: msg.value,
            claimed: false
        });

        outcomePools[marketId][outcomeIndex] += msg.value;
        market.totalPool += msg.value;

        emit BetPlaced(marketId, msg.sender, outcomeIndex, msg.value);
    }

    /**
     * @notice Resolve a market with the winning outcome
     * @param marketId The market to resolve
     * @param winningOutcome The winning outcome index
     */
    function resolve(uint256 marketId, uint8 winningOutcome) external onlyOwner {
        MarketInfo storage market = markets[marketId];
        if (market.creator == address(0)) revert MarketNotFound();
        if (market.resolved) revert MarketAlreadyResolved();
        if (winningOutcome >= market.outcomeCount) revert InvalidOutcome();

        market.resolved = true;
        market.winningOutcome = winningOutcome;

        emit MarketResolved(marketId, winningOutcome);
    }

    /**
     * @notice Claim winnings from a resolved market
     * @param marketId The market to claim from
     */
    function claim(uint256 marketId) external {
        MarketInfo storage market = markets[marketId];
        if (!market.resolved) revert MarketNotResolved();

        UserBet storage bet = userBets[marketId][msg.sender];
        if (bet.amount == 0) revert NothingToClaim();
        if (bet.claimed) revert AlreadyClaimed();
        if (bet.outcomeIndex != market.winningOutcome) revert NothingToClaim();

        bet.claimed = true;

        uint256 winningPool = outcomePools[marketId][market.winningOutcome];
        if (winningPool == 0) revert NothingToClaim();

        // Calculate payout: user's share of total pool proportional to their bet in the winning pool
        uint256 fee = (market.totalPool * platformFeeRate) / 10000;
        uint256 distributable = market.totalPool - fee;
        uint256 payout = (distributable * bet.amount) / winningPool;

        (bool success, ) = payable(msg.sender).call{ value: payout }("");
        if (!success) revert TransferFailed();

        emit Claimed(marketId, msg.sender, payout);
    }

    // ============================================
    // View Functions
    // ============================================

    /**
     * @notice Get market information
     */
    function getMarket(uint256 marketId) external view returns (MarketInfo memory) {
        return markets[marketId];
    }

    /**
     * @notice Get a user's bet on a market
     */
    function getUserBet(uint256 marketId, address user)
        external
        view
        returns (uint8 outcomeIndex, uint256 amount, bool claimed)
    {
        UserBet memory bet = userBets[marketId][user];
        return (bet.outcomeIndex, bet.amount, bet.claimed);
    }

    /**
     * @notice Get the total staked on a specific outcome
     */
    function getOutcomePool(uint256 marketId, uint8 outcomeIndex) external view returns (uint256) {
        return outcomePools[marketId][outcomeIndex];
    }

    // ============================================
    // Admin Functions
    // ============================================

    function setFeeRate(uint256 _feeRate) external onlyOwner {
        platformFeeRate = _feeRate;
    }

    function withdrawFees() external onlyOwner {
        (bool success, ) = payable(owner).call{ value: address(this).balance }("");
        if (!success) revert TransferFailed();
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    receive() external payable {}
}
