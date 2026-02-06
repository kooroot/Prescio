// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

interface IPrescioStaking {
    enum Tier { NONE, BRONZE, SILVER, GOLD, DIAMOND, LEGENDARY }
    
    function getTier(address user) external view returns (Tier);
    function isAutoBetEligible(address user) external view returns (bool);
    function getAutoBetConfig(address user) external view returns (
        uint256 dailyLimit,
        uint8 maxConcurrent,
        bool enabled
    );
}

interface IPrescioMarket {
    function placeBet(bytes32 gameId, uint8 suspectIndex) external payable;
    function isBettingOpen(bytes32 gameId) external view returns (bool);
}

/**
 * @title AutoBetController
 * @author Prescio Team
 * @notice UUPS upgradeable auto-betting controller for Prescio
 * @dev Executes auto-bets for stakers based on their tier and strategy
 * 
 * Features:
 * - Strategy-based auto-betting (Conservative, Balanced, Aggressive, Contrarian, Custom)
 * - Daily spending limits per tier
 * - Concurrent bet limits
 * - User balance tracking
 * - Keeper/operator execution model
 * 
 * Security Fixes (v1.1):
 * - [C-01] Added userBalances mapping with proper deposit/withdraw
 * - [H-04] User funds properly separated
 * - [H-05] Event logging for operator actions
 * - [M-05] Fixed canExecuteBet daily reset logic
 * - [L-01] Added missing events
 * - [L-03] Zero address validation
 * - [M-02] Storage gap for upgradeability
 */
contract AutoBetController is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable 
{
    // ============================================
    // Types
    // ============================================

    enum StrategyType { 
        NONE,
        CONSERVATIVE,   // Silver+: Low risk, 1.2x-2.0x odds
        BALANCED,       // Gold+: Medium risk, 1.5x-4.0x odds
        AGGRESSIVE,     // Diamond+: High risk, 3.0x-10.0x odds
        CONTRARIAN,     // Diamond+: Bet against majority
        CUSTOM          // Legendary: User-defined params
    }

    struct UserConfig {
        StrategyType strategy;
        bool isActive;
        uint256 dailySpent;
        uint256 lastResetDay;
        uint8 activeBets;
        // Custom strategy params (Legendary only)
        uint256 customMinOdds;      // Min odds * 100 (e.g., 150 = 1.5x)
        uint256 customMaxOdds;      // Max odds * 100
        uint256 customBetPercent;   // Bet size as % of daily limit (100 = 1%)
    }

    struct StrategyParams {
        uint256 minOdds;           // * 100
        uint256 maxOdds;           // * 100
        uint256 betSizePercent;    // Of daily limit
        uint256 stopLossPercent;   // Daily stop loss
        IPrescioStaking.Tier minTier;
    }

    // ============================================
    // Constants
    // ============================================

    uint256 public constant ODDS_PRECISION = 100;
    uint256 public constant PERCENT_PRECISION = 100;

    // ============================================
    // State Variables
    // ============================================

    IPrescioStaking public staking;
    IPrescioMarket public market;
    
    // [C-01 FIX] User balance tracking
    mapping(address => uint256) public userBalances;
    
    mapping(address => UserConfig) public userConfigs;
    mapping(StrategyType => StrategyParams) public strategyParams;
    mapping(address => bool) public operators;
    
    // Active bets tracking
    mapping(address => mapping(bytes32 => bool)) public userActiveBets;
    mapping(address => mapping(bytes32 => uint256)) public userBetAmounts;

    // ============================================
    // Storage Gap
    // ============================================
    
    uint256[50] private __gap;

    // ============================================
    // Events
    // ============================================

    event AutoBetActivated(address indexed user, StrategyType strategy);
    event AutoBetDeactivated(address indexed user);
    event AutoBetExecuted(
        address indexed user, 
        bytes32 indexed gameId, 
        uint8 suspectIndex, 
        uint256 amount,
        address indexed operator
    );
    event BetSettled(address indexed user, bytes32 indexed gameId);
    event StrategyUpdated(address indexed user, StrategyType strategy);
    event CustomParamsSet(address indexed user, uint256 minOdds, uint256 maxOdds, uint256 betPercent);
    event OperatorUpdated(address indexed operator, bool status);
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event StakingUpdated(address indexed oldStaking, address indexed newStaking);
    event MarketUpdated(address indexed oldMarket, address indexed newMarket);
    event StrategyParamsUpdated(StrategyType indexed strategy);

    // ============================================
    // Errors
    // ============================================

    error ZeroAddress();
    error ZeroAmount();
    error NotEligible();
    error StrategyNotAvailable();
    error AutoBetNotActive();
    error DailyLimitExceeded();
    error MaxBetsExceeded();
    error BettingNotOpen();
    error NotOperator();
    error InvalidParams();
    error AlreadyBetOnGame();
    error InsufficientBalance();
    error TransferFailed();
    error InvalidStrategy();

    // ============================================
    // Modifiers
    // ============================================

    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner()) revert NotOperator();
        _;
    }

    // ============================================
    // Initializer
    // ============================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the auto-bet controller
     * @param _staking Address of staking contract
     * @param _market Address of market contract
     */
    function initialize(
        address _staking,
        address _market
    ) public initializer {
        if (_staking == address(0)) revert ZeroAddress();
        if (_market == address(0)) revert ZeroAddress();
        
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        staking = IPrescioStaking(_staking);
        market = IPrescioMarket(_market);

        _initializeStrategies();
    }

    function _initializeStrategies() internal {
        // Conservative: Silver+, low risk
        strategyParams[StrategyType.CONSERVATIVE] = StrategyParams({
            minOdds: 120,      // 1.2x
            maxOdds: 200,      // 2.0x
            betSizePercent: 10, // 10% of daily limit per bet
            stopLossPercent: 10,
            minTier: IPrescioStaking.Tier.SILVER
        });

        // Balanced: Gold+, medium risk
        strategyParams[StrategyType.BALANCED] = StrategyParams({
            minOdds: 150,      // 1.5x
            maxOdds: 400,      // 4.0x
            betSizePercent: 20,
            stopLossPercent: 25,
            minTier: IPrescioStaking.Tier.GOLD
        });

        // Aggressive: Diamond+, high risk
        strategyParams[StrategyType.AGGRESSIVE] = StrategyParams({
            minOdds: 300,      // 3.0x
            maxOdds: 1000,     // 10.0x
            betSizePercent: 50,
            stopLossPercent: 50,
            minTier: IPrescioStaking.Tier.DIAMOND
        });

        // Contrarian: Diamond+, bet against majority
        strategyParams[StrategyType.CONTRARIAN] = StrategyParams({
            minOdds: 250,      // 2.5x minimum
            maxOdds: 1500,     // 15.0x
            betSizePercent: 15,
            stopLossPercent: 30,
            minTier: IPrescioStaking.Tier.DIAMOND
        });

        // Custom: Legendary only (params set by user)
        strategyParams[StrategyType.CUSTOM] = StrategyParams({
            minOdds: 100,
            maxOdds: 2000,
            betSizePercent: 100,
            stopLossPercent: 100,
            minTier: IPrescioStaking.Tier.LEGENDARY
        });
    }

    // ============================================
    // UUPS Authorization
    // ============================================

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============================================
    // User Deposit/Withdraw Functions
    // ============================================

    /**
     * @notice Deposit funds for auto-betting
     * @dev [C-01 FIX] Proper balance tracking
     */
    function deposit() external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        
        userBalances[msg.sender] += msg.value;
        
        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw unused funds
     * @param amount Amount to withdraw
     * @dev [C-01 FIX] Added balance check
     */
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (userBalances[msg.sender] < amount) revert InsufficientBalance();
        
        // Update state before transfer (CEI)
        userBalances[msg.sender] -= amount;
        
        (bool success,) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Withdraw all funds
     */
    function withdrawAll() external nonReentrant {
        uint256 balance = userBalances[msg.sender];
        if (balance == 0) revert InsufficientBalance();
        
        userBalances[msg.sender] = 0;
        
        (bool success,) = payable(msg.sender).call{value: balance}("");
        if (!success) revert TransferFailed();
        
        emit Withdrawn(msg.sender, balance);
    }

    // ============================================
    // User Configuration Functions
    // ============================================

    /**
     * @notice Activate auto-bet with chosen strategy
     * @param strategy Strategy type to use
     */
    function activateAutoBet(StrategyType strategy) external {
        if (strategy == StrategyType.NONE) revert InvalidStrategy();
        if (!staking.isAutoBetEligible(msg.sender)) revert NotEligible();
        
        IPrescioStaking.Tier userTier = staking.getTier(msg.sender);
        StrategyParams storage params = strategyParams[strategy];
        
        if (uint8(userTier) < uint8(params.minTier)) revert StrategyNotAvailable();

        UserConfig storage config = userConfigs[msg.sender];
        config.strategy = strategy;
        config.isActive = true;
        
        // Reset daily if new day
        _checkDailyReset(msg.sender);

        emit AutoBetActivated(msg.sender, strategy);
    }

    /**
     * @notice Deactivate auto-bet
     */
    function deactivateAutoBet() external {
        userConfigs[msg.sender].isActive = false;
        emit AutoBetDeactivated(msg.sender);
    }

    /**
     * @notice Set custom strategy params (Legendary only)
     * @param minOdds Minimum odds * 100
     * @param maxOdds Maximum odds * 100
     * @param betPercent Bet size percentage
     */
    function setCustomParams(
        uint256 minOdds,
        uint256 maxOdds,
        uint256 betPercent
    ) external {
        IPrescioStaking.Tier tier = staking.getTier(msg.sender);
        if (tier != IPrescioStaking.Tier.LEGENDARY) revert NotEligible();
        if (minOdds < ODDS_PRECISION || maxOdds > 2000 || betPercent > PERCENT_PRECISION) {
            revert InvalidParams();
        }
        if (minOdds > maxOdds) revert InvalidParams();

        UserConfig storage config = userConfigs[msg.sender];
        config.customMinOdds = minOdds;
        config.customMaxOdds = maxOdds;
        config.customBetPercent = betPercent;
        
        emit CustomParamsSet(msg.sender, minOdds, maxOdds, betPercent);
    }

    // ============================================
    // Operator Functions
    // ============================================

    /**
     * @notice Execute auto-bet for a user (called by keeper/operator)
     * @param user User address
     * @param gameId Game to bet on
     * @param suspectIndex Chosen suspect
     * @param amount Bet amount
     * @dev [H-04 FIX] Uses user's deposited balance
     */
    function executeAutoBet(
        address user,
        bytes32 gameId,
        uint8 suspectIndex,
        uint256 amount
    ) external onlyOperator nonReentrant {
        UserConfig storage config = userConfigs[user];
        
        // Validations
        if (!config.isActive) revert AutoBetNotActive();
        if (!staking.isAutoBetEligible(user)) revert NotEligible();
        if (!market.isBettingOpen(gameId)) revert BettingNotOpen();
        if (userActiveBets[user][gameId]) revert AlreadyBetOnGame();
        
        // [C-01 FIX] Check user balance
        if (userBalances[user] < amount) revert InsufficientBalance();
        
        // Check daily limit
        _checkDailyReset(user);
        (uint256 dailyLimit, uint8 maxConcurrent,) = staking.getAutoBetConfig(user);
        
        if (config.dailySpent + amount > dailyLimit) revert DailyLimitExceeded();
        if (config.activeBets >= maxConcurrent) revert MaxBetsExceeded();

        // [H-04 FIX] Deduct from user balance
        userBalances[user] -= amount;
        
        // Update state
        config.dailySpent += amount;
        config.activeBets++;
        userActiveBets[user][gameId] = true;
        userBetAmounts[user][gameId] = amount;

        // Execute bet
        market.placeBet{value: amount}(gameId, suspectIndex);

        emit AutoBetExecuted(user, gameId, suspectIndex, amount, msg.sender);
    }

    /**
     * @notice Mark bet as settled (called after game resolution)
     * @param user User address
     * @param gameId Game ID
     */
    function settleBet(address user, bytes32 gameId) external onlyOperator {
        if (userActiveBets[user][gameId]) {
            userActiveBets[user][gameId] = false;
            delete userBetAmounts[user][gameId];
            
            if (userConfigs[user].activeBets > 0) {
                userConfigs[user].activeBets--;
            }
            
            emit BetSettled(user, gameId);
        }
    }

    /**
     * @notice Return funds to user if bet was cancelled/refunded
     * @param user User address
     * @param gameId Game ID
     * @param refundAmount Amount to refund
     */
    function refundBet(address user, bytes32 gameId, uint256 refundAmount) external onlyOperator nonReentrant {
        if (userActiveBets[user][gameId]) {
            userActiveBets[user][gameId] = false;
            
            // Refund to user balance
            userBalances[user] += refundAmount;
            
            // Reduce daily spent
            if (userConfigs[user].dailySpent >= refundAmount) {
                userConfigs[user].dailySpent -= refundAmount;
            }
            
            if (userConfigs[user].activeBets > 0) {
                userConfigs[user].activeBets--;
            }
            
            delete userBetAmounts[user][gameId];
            
            emit BetSettled(user, gameId);
        }
    }

    // ============================================
    // Admin Functions
    // ============================================

    /**
     * @notice Set operator status
     * @param operator Operator address
     * @param status Active status
     */
    function setOperator(address operator, bool status) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        operators[operator] = status;
        emit OperatorUpdated(operator, status);
    }

    /**
     * @notice Update staking contract address
     * @param _staking New staking address
     */
    function setStaking(address _staking) external onlyOwner {
        if (_staking == address(0)) revert ZeroAddress();
        emit StakingUpdated(address(staking), _staking);
        staking = IPrescioStaking(_staking);
    }

    /**
     * @notice Update market contract address
     * @param _market New market address
     */
    function setMarket(address _market) external onlyOwner {
        if (_market == address(0)) revert ZeroAddress();
        emit MarketUpdated(address(market), _market);
        market = IPrescioMarket(_market);
    }

    /**
     * @notice Update strategy parameters
     */
    function updateStrategy(
        StrategyType strategy,
        uint256 minOdds,
        uint256 maxOdds,
        uint256 betSizePercent,
        uint256 stopLossPercent,
        IPrescioStaking.Tier minTier
    ) external onlyOwner {
        if (strategy == StrategyType.NONE) revert InvalidStrategy();
        if (minOdds > maxOdds) revert InvalidParams();
        
        strategyParams[strategy] = StrategyParams({
            minOdds: minOdds,
            maxOdds: maxOdds,
            betSizePercent: betSizePercent,
            stopLossPercent: stopLossPercent,
            minTier: minTier
        });
        
        emit StrategyParamsUpdated(strategy);
    }

    // ============================================
    // View Functions
    // ============================================

    /**
     * @notice Get user configuration and status
     * @param user User address
     */
    function getUserConfig(address user) external view returns (
        StrategyType strategy,
        bool isActive,
        uint256 dailySpent,
        uint256 dailyRemaining,
        uint8 activeBets,
        uint256 balance
    ) {
        UserConfig storage config = userConfigs[user];
        (uint256 dailyLimit,,) = staking.getAutoBetConfig(user);
        
        // [M-05 FIX] Account for potential daily reset in view
        uint256 effectiveDailySpent = config.dailySpent;
        uint256 today = block.timestamp / 1 days;
        if (config.lastResetDay < today) {
            effectiveDailySpent = 0;
        }
        
        uint256 remaining = effectiveDailySpent >= dailyLimit ? 0 : dailyLimit - effectiveDailySpent;
        
        return (
            config.strategy,
            config.isActive,
            effectiveDailySpent,
            remaining,
            config.activeBets,
            userBalances[user]
        );
    }

    /**
     * @notice Check if a bet can be executed
     * @param user User address
     * @param amount Bet amount
     * @return canExecute True if bet can be executed
     * @return reason Failure reason (empty if can execute)
     */
    function canExecuteBet(address user, uint256 amount) external view returns (bool canExecute, string memory reason) {
        UserConfig storage config = userConfigs[user];
        
        if (!config.isActive) return (false, "Auto-bet not active");
        if (!staking.isAutoBetEligible(user)) return (false, "Not eligible for auto-bet");
        if (userBalances[user] < amount) return (false, "Insufficient balance");
        
        (uint256 dailyLimit, uint8 maxConcurrent,) = staking.getAutoBetConfig(user);
        
        // [M-05 FIX] Account for potential daily reset
        uint256 effectiveDailySpent = config.dailySpent;
        uint256 today = block.timestamp / 1 days;
        if (config.lastResetDay < today) {
            effectiveDailySpent = 0;
        }
        
        if (effectiveDailySpent + amount > dailyLimit) return (false, "Daily limit exceeded");
        if (config.activeBets >= maxConcurrent) return (false, "Max concurrent bets reached");
        
        return (true, "");
    }

    /**
     * @notice Get user's balance
     * @param user User address
     */
    function getBalance(address user) external view returns (uint256) {
        return userBalances[user];
    }

    /**
     * @notice Get strategy params
     * @param strategy Strategy type
     */
    function getStrategyParams(StrategyType strategy) external view returns (
        uint256 minOdds,
        uint256 maxOdds,
        uint256 betSizePercent,
        uint256 stopLossPercent,
        IPrescioStaking.Tier minTier
    ) {
        StrategyParams storage p = strategyParams[strategy];
        return (p.minOdds, p.maxOdds, p.betSizePercent, p.stopLossPercent, p.minTier);
    }

    // ============================================
    // Internal Functions
    // ============================================

    /**
     * @dev Check and reset daily limit if new day
     */
    function _checkDailyReset(address user) internal {
        uint256 today = block.timestamp / 1 days;
        UserConfig storage config = userConfigs[user];
        
        if (config.lastResetDay < today) {
            config.dailySpent = 0;
            config.lastResetDay = today;
        }
    }

    // ============================================
    // Receive
    // ============================================

    /**
     * @dev Accept ETH for winnings distribution from market
     */
    receive() external payable {}
}
