// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PrescioStaking
 * @author Prescio Team
 * @notice UUPS upgradeable staking contract for Prescio with Dual Rewards
 * @dev Stake $PRESCIO tokens to unlock Auto-bet features and earn dual rewards (MON + PRESCIO)
 * 
 * Features:
 * - 5-tier staking system (Bronze → Diamond)
 * - Flexible (7d) and Fixed (14d/30d/60d/90d) lock periods
 * - Auto-bet eligibility gating (Silver+ required)
 * - Weekly epoch-based reward distribution with pagination
 * - Early unstaking penalties
 * - Dual Rewards: MON (from betting fees) + PRESCIO (from penalties)
 * 
 * Security Fixes (v1.1):
 * - [C-02] Proper totalWeight calculation with running total
 * - [C-03] Paginated reward claiming to prevent DoS
 * - [H-01] CEI pattern for reentrancy prevention
 * - [H-02] Fixed penalty distribution arithmetic
 * - [H-03] Permissionless epoch finalization after grace period
 * - [M-01] Front-running protection with first-epoch exclusion
 * - [M-02] Storage gap for upgradeability
 * - [M-03] Explicit receive() rejection
 * - [L-01~L-04] Events, zero-address checks, constants
 * 
 * v1.2 - Dual Reward System:
 * - Separate MON and PRESCIO reward tracking
 * - Penalty distribution: 40% burn, 40% stakers (PRESCIO), 20% treasury
 * - Independent claim functions for each reward type
 * - Gas-optimized single-loop calculation for both rewards
 * 
 * v1.3 - Tier Requirements Update:
 * - Updated tier minimums: Bronze 5M, Silver 20M, Gold 50M, Diamond 150M
 * - Added explicit BET_MULT constants for each tier
 * - Bronze boost: 1.1x, Silver: 1.25x, Gold: 1.5x, Diamond: 2.0x
 */
contract PrescioStaking is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable 
{
    using SafeERC20 for IERC20;

    // ============================================
    // Types
    // ============================================

    enum Tier { NONE, BRONZE, SILVER, GOLD, DIAMOND }
    
    enum LockType { 
        FLEXIBLE,    // 7 days, early exit with penalty
        FIXED_14D,   // 14 days, no early exit
        FIXED_30D,   // 30 days
        FIXED_60D,   // 60 days
        FIXED_90D    // 90 days
    }

    struct Stake {
        uint256 amount;              // Staked PRESCIO amount
        uint256 lockEnd;             // Lock end timestamp
        LockType lockType;           // Lock period type
        uint256 startTime;           // Stake start timestamp
        uint256 lastClaimEpoch;      // Last claimed MON epoch number
        uint256 lastPrescioClaimEpoch; // Last claimed PRESCIO epoch number
        uint256 firstEligibleEpoch;  // First epoch eligible for rewards (front-run protection)
        bool exists;                 // Stake exists flag
    }

    struct TierConfig {
        uint256 minStake;            // Minimum stake for tier
        uint256 rewardBoost;         // Reward multiplier (100 = 1.0x, 150 = 1.5x)
        uint256 autoBetDailyLimit;   // Daily auto-bet limit in MON (18 decimals)
        uint8 maxConcurrentBets;     // Max simultaneous auto-bets
        bool autoBetEnabled;         // Auto-bet feature access
    }

    struct Epoch {
        uint256 totalRewards;        // Total MON rewards for this epoch
        uint256 totalWeight;         // Total staking weight snapshot
        uint256 snapshotTime;        // Snapshot timestamp
        bool finalized;              // Epoch finalized flag
    }

    // ============================================
    // Constants
    // ============================================

    uint256 public constant EPOCH_DURATION = 7 days;
    uint256 public constant EPOCH_GRACE_PERIOD = 1 days;
    uint256 public constant MAX_CLAIM_EPOCHS = 52; // Max epochs per claim (1 year)
    uint256 public constant WEIGHT_PRECISION = 1e18;
    uint256 public constant BOOST_PRECISION = 100;
    uint256 public constant PENALTY_PRECISION = 1000;
    uint256 public constant FEE_PRECISION = 10000;
    
    // Tier minimum stakes (18 decimals)
    uint256 public constant TIER_BRONZE_MIN = 5_000_000 * 1e18;      // 5M
    uint256 public constant TIER_SILVER_MIN = 20_000_000 * 1e18;     // 20M
    uint256 public constant TIER_GOLD_MIN = 50_000_000 * 1e18;       // 50M
    uint256 public constant TIER_DIAMOND_MIN = 150_000_000 * 1e18;   // 150M

    // Bet multipliers (100 = 1.0x)
    uint256 public constant BRONZE_BET_MULT = 110;   // 1.1x
    uint256 public constant SILVER_BET_MULT = 125;   // 1.25x
    uint256 public constant GOLD_BET_MULT = 150;     // 1.5x
    uint256 public constant DIAMOND_BET_MULT = 200;  // 2.0x
    
    // Lock multipliers (100 = 1.0x)
    uint256 public constant LOCK_MULT_7D = 100;
    uint256 public constant LOCK_MULT_14D = 110;
    uint256 public constant LOCK_MULT_30D = 125;
    uint256 public constant LOCK_MULT_60D = 150;
    uint256 public constant LOCK_MULT_90D = 200;

    // Early unstaking penalties (1000 = 100%)
    uint256 public constant PENALTY_DAY_1_2 = 150;   // 15%
    uint256 public constant PENALTY_DAY_3_4 = 100;   // 10%
    uint256 public constant PENALTY_DAY_5_6 = 50;    // 5%
    uint256 public constant EMERGENCY_PENALTY = 500; // 50%

    // Penalty distribution (1000 = 100%)
    uint256 public constant PENALTY_BURN_SHARE = 400;     // 40%
    uint256 public constant PENALTY_STAKER_SHARE = 400;   // 40%
    uint256 public constant PENALTY_TREASURY_SHARE = 200; // 20%

    // Dead address for burns
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // ============================================
    // State Variables
    // ============================================

    IERC20 public prescioToken;
    address public treasury;
    address public autoBetController;
    
    uint256 public currentEpoch;
    uint256 public epochStartTime;
    uint256 public totalStaked;
    uint256 public totalWeight; // [C-02 FIX] Running total of all user weights
    
    // Tier configurations (dynamic, can be updated)
    mapping(Tier => TierConfig) public tierConfigs;
    
    // User stakes
    mapping(address => Stake) public stakes;
    
    // Staker tracking for weight calculation
    address[] public stakers;
    mapping(address => uint256) public stakerIndex;
    mapping(address => bool) public isStaker;
    
    // Epoch data (MON rewards)
    mapping(uint256 => Epoch) public epochs;
    
    // Penalty accumulation (PRESCIO)
    uint256 public pendingBurnAmount;
    uint256 public pendingPrescioRewardsPool;  // PRESCIO rewards for stakers (from penalties)
    uint256 public pendingTreasuryAmount;

    // PRESCIO epoch rewards (separate from MON)
    mapping(uint256 => uint256) public epochPrescioRewards;

    // ============================================
    // Storage Gap (for future upgrades)
    // ============================================
    
    uint256[47] private __gap; // Reduced from 50 to account for new state variables

    // ============================================
    // Events
    // ============================================

    event Staked(address indexed user, uint256 amount, LockType lockType, Tier tier);
    event Unstaked(address indexed user, uint256 amount, uint256 penalty);
    event EmergencyUnstaked(address indexed user, uint256 amount, uint256 penalty);
    event MonRewardsClaimed(address indexed user, uint256 fromEpoch, uint256 toEpoch, uint256 amount);
    event PrescioRewardsClaimed(address indexed user, uint256 fromEpoch, uint256 toEpoch, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 fromEpoch, uint256 toEpoch, uint256 monReward, uint256 prescioReward);
    event EpochFinalized(uint256 indexed epoch, uint256 totalMonRewards, uint256 totalPrescioRewards, uint256 totalWeight);
    event RewardsDeposited(uint256 amount, uint256 epoch);
    event TierConfigUpdated(Tier indexed tier, uint256 minStake, uint256 rewardBoost);
    event PenaltiesDistributed(uint256 burned, uint256 toStakers, uint256 toTreasury);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event AutoBetControllerUpdated(address indexed oldController, address indexed newController);

    // ============================================
    // Errors
    // ============================================

    error ZeroAmount();
    error ZeroAddress();
    error InsufficientStake();
    error AlreadyStaked();
    error NoStakeFound();
    error StillLocked();
    error FixedLockNoEarlyExit();
    error EpochNotFinalized();
    error NothingToClaim();
    error InvalidTier();
    error InvalidTierOrder();
    error NotAutoBetController();
    error AutoBetNotEligible();
    error DailyLimitExceeded();
    error TransferFailed();
    error EpochNotReady();
    error MaxEpochsExceeded();
    error InsufficientPrescioBalance();

    // ============================================
    // Modifiers
    // ============================================

    modifier onlyAutoBetController() {
        if (msg.sender != autoBetController) revert NotAutoBetController();
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
     * @notice Initialize the staking contract
     * @param _prescioToken Address of PRESCIO token
     * @param _treasury Address of treasury
     * @param _autoBetController Address of auto-bet controller (can be zero, set later)
     */
    function initialize(
        address _prescioToken,
        address _treasury,
        address _autoBetController
    ) public initializer {
        if (_prescioToken == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        prescioToken = IERC20(_prescioToken);
        treasury = _treasury;
        autoBetController = _autoBetController;
        
        epochStartTime = block.timestamp;
        currentEpoch = 1;

        _initializeTiers();
    }

    /**
     * @notice Reinitializer for v1.2 upgrade (Dual Rewards)
     * @dev Call this after upgrading from v1.1 to initialize new state variables
     */
    function initializeV2() public reinitializer(2) {
        // pendingPrescioRewardsPool is already 0 by default
        // epochPrescioRewards mapping is already empty by default
        // For existing stakers, lastPrescioClaimEpoch will be initialized to lastClaimEpoch
        // on their first interaction (handled in claim functions)
    }

    function _initializeTiers() internal {
        // Bronze: 5M PRESCIO, no auto-bet
        tierConfigs[Tier.BRONZE] = TierConfig({
            minStake: TIER_BRONZE_MIN,
            rewardBoost: BRONZE_BET_MULT,  // 1.1x
            autoBetDailyLimit: 0,
            maxConcurrentBets: 0,
            autoBetEnabled: false
        });

        // Silver: 20M PRESCIO, basic auto-bet
        tierConfigs[Tier.SILVER] = TierConfig({
            minStake: TIER_SILVER_MIN,
            rewardBoost: SILVER_BET_MULT,  // 1.25x
            autoBetDailyLimit: 100 * 1e18,  // 100 MON
            maxConcurrentBets: 3,
            autoBetEnabled: true
        });

        // Gold: 50M PRESCIO, standard auto-bet
        tierConfigs[Tier.GOLD] = TierConfig({
            minStake: TIER_GOLD_MIN,
            rewardBoost: GOLD_BET_MULT,  // 1.5x
            autoBetDailyLimit: 500 * 1e18,  // 500 MON
            maxConcurrentBets: 10,
            autoBetEnabled: true
        });

        // Diamond: 150M PRESCIO, premium auto-bet (highest tier)
        tierConfigs[Tier.DIAMOND] = TierConfig({
            minStake: TIER_DIAMOND_MIN,
            rewardBoost: DIAMOND_BET_MULT,  // 2.0x
            autoBetDailyLimit: 2_000 * 1e18,  // 2000 MON
            maxConcurrentBets: 255,  // Unlimited
            autoBetEnabled: true
        });
    }

    // ============================================
    // UUPS Authorization
    // ============================================

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============================================
    // Core Staking Functions
    // ============================================

    /**
     * @notice Stake PRESCIO tokens
     * @param amount Amount to stake
     * @param lockType Lock period type
     */
    function stake(uint256 amount, LockType lockType) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (stakes[msg.sender].exists) revert AlreadyStaked();

        // Transfer tokens first (CEI pattern - but this is safe as it's from user)
        prescioToken.safeTransferFrom(msg.sender, address(this), amount);

        // Calculate lock end
        uint256 lockDuration = _getLockDuration(lockType);
        uint256 lockEnd = block.timestamp + lockDuration;

        // Create stake
        stakes[msg.sender] = Stake({
            amount: amount,
            lockEnd: lockEnd,
            lockType: lockType,
            startTime: block.timestamp,
            lastClaimEpoch: currentEpoch,
            lastPrescioClaimEpoch: currentEpoch, // Initialize PRESCIO claim epoch
            firstEligibleEpoch: currentEpoch + 1, // [M-01 FIX] Front-run protection
            exists: true
        });

        // Update totals
        totalStaked += amount;
        
        // [C-02 FIX] Update running total weight
        uint256 userWeight = _calculateWeight(amount, getTierForAmount(amount), lockType);
        totalWeight += userWeight;
        
        // Track staker
        if (!isStaker[msg.sender]) {
            stakerIndex[msg.sender] = stakers.length;
            stakers.push(msg.sender);
            isStaker[msg.sender] = true;
        }

        emit Staked(msg.sender, amount, lockType, getTier(msg.sender));
    }

    /**
     * @notice Unstake tokens (after lock period or with penalty for flexible)
     */
    function unstake() external nonReentrant {
        Stake storage userStake = stakes[msg.sender];
        if (!userStake.exists) revert NoStakeFound();

        uint256 amount = userStake.amount;
        uint256 penalty = 0;

        if (block.timestamp < userStake.lockEnd) {
            // Early exit only for flexible
            if (userStake.lockType != LockType.FLEXIBLE) {
                revert FixedLockNoEarlyExit();
            }
            penalty = _calculateFlexiblePenalty(userStake.startTime, amount);
        }

        // [H-01 FIX] CEI Pattern - Calculate rewards first
        (uint256 monRewards, uint256 prescioRewards, uint256 claimedMonEpochs, uint256 claimedPrescioEpochs) = 
            _calculatePendingRewardsBoth(msg.sender);
        
        // [C-02 FIX] Update running total weight before state changes
        uint256 userWeight = getUserWeight(msg.sender);
        totalWeight -= userWeight;
        
        // Effects - Update state before external calls
        uint256 lastMonClaimed = userStake.lastClaimEpoch;
        uint256 lastPrescioClaimed = userStake.lastPrescioClaimEpoch;
        _removeStaker(msg.sender);
        delete stakes[msg.sender];
        totalStaked -= amount;

        // Handle penalty
        uint256 returnAmount = amount;
        if (penalty > 0) {
            _distributePenalty(penalty);
            returnAmount = amount - penalty;
        }

        // Interactions - External calls last
        if (monRewards > 0) {
            (bool rewardSuccess,) = payable(msg.sender).call{value: monRewards}("");
            if (!rewardSuccess) revert TransferFailed();
        }
        
        if (prescioRewards > 0) {
            // Safety check: ensure we have enough PRESCIO for rewards (excluding staked amounts)
            uint256 availablePrescio = prescioToken.balanceOf(address(this)) - totalStaked;
            if (prescioRewards > availablePrescio) {
                prescioRewards = availablePrescio;
            }
            if (prescioRewards > 0) {
                prescioToken.safeTransfer(msg.sender, prescioRewards);
            }
        }
        
        prescioToken.safeTransfer(msg.sender, returnAmount);

        if (monRewards > 0 || prescioRewards > 0) {
            emit RewardsClaimed(
                msg.sender, 
                lastMonClaimed < lastPrescioClaimed ? lastMonClaimed : lastPrescioClaimed,
                currentEpoch - 1, 
                monRewards, 
                prescioRewards
            );
        }

        emit Unstaked(msg.sender, returnAmount, penalty);
    }

    /**
     * @notice Emergency unstake with 50% penalty (for fixed locks)
     */
    function emergencyUnstake() external nonReentrant {
        Stake storage userStake = stakes[msg.sender];
        if (!userStake.exists) revert NoStakeFound();

        uint256 amount = userStake.amount;
        uint256 penalty = (amount * EMERGENCY_PENALTY) / PENALTY_PRECISION;

        // [C-02 FIX] Update weight
        uint256 userWeight = getUserWeight(msg.sender);
        totalWeight -= userWeight;

        // Effects first
        _removeStaker(msg.sender);
        delete stakes[msg.sender];
        totalStaked -= amount;

        // Distribute penalty
        _distributePenalty(penalty);

        // Interactions last
        prescioToken.safeTransfer(msg.sender, amount - penalty);

        emit EmergencyUnstaked(msg.sender, amount - penalty, penalty);
    }

    // ============================================
    // Reward Claim Functions (Dual Rewards)
    // ============================================

    /**
     * @notice Claim MON rewards only
     * @param maxEpochs Maximum epochs to process (0 = use default MAX_CLAIM_EPOCHS)
     */
    function claimMonRewards(uint256 maxEpochs) external nonReentrant {
        if (maxEpochs == 0) maxEpochs = MAX_CLAIM_EPOCHS;
        if (maxEpochs > MAX_CLAIM_EPOCHS) revert MaxEpochsExceeded();
        
        _claimMonRewards(msg.sender, maxEpochs);
    }

    /**
     * @notice Claim PRESCIO rewards only
     * @param maxEpochs Maximum epochs to process (0 = use default MAX_CLAIM_EPOCHS)
     */
    function claimPrescioRewards(uint256 maxEpochs) external nonReentrant {
        if (maxEpochs == 0) maxEpochs = MAX_CLAIM_EPOCHS;
        if (maxEpochs > MAX_CLAIM_EPOCHS) revert MaxEpochsExceeded();
        
        _claimPrescioRewards(msg.sender, maxEpochs);
    }

    /**
     * @notice Claim all rewards (MON + PRESCIO) with gas-optimized single loop
     * @param maxEpochs Maximum epochs to process (0 = use default MAX_CLAIM_EPOCHS)
     */
    function claimAllRewards(uint256 maxEpochs) external nonReentrant {
        if (maxEpochs == 0) maxEpochs = MAX_CLAIM_EPOCHS;
        if (maxEpochs > MAX_CLAIM_EPOCHS) revert MaxEpochsExceeded();
        
        _claimAllRewardsOptimized(msg.sender, maxEpochs);
    }

    /**
     * @notice Legacy function for backwards compatibility
     * @param maxEpochs Maximum epochs to process
     */
    function claimRewards(uint256 maxEpochs) external nonReentrant {
        if (maxEpochs == 0) maxEpochs = MAX_CLAIM_EPOCHS;
        if (maxEpochs > MAX_CLAIM_EPOCHS) revert MaxEpochsExceeded();
        
        _claimAllRewardsOptimized(msg.sender, maxEpochs);
    }

    // ============================================
    // Epoch Management
    // ============================================

    /**
     * @notice Deposit MON rewards for current epoch (owner only)
     */
    function depositRewards() external payable onlyOwner {
        epochs[currentEpoch].totalRewards += msg.value;
        emit RewardsDeposited(msg.value, currentEpoch);
    }

    /**
     * @notice Finalize current epoch and start new one
     * @dev [H-03 FIX] Anyone can call after grace period
     */
    function finalizeEpoch() external {
        // Check authorization
        bool isOwner = msg.sender == owner();
        bool gracePeriodPassed = block.timestamp >= epochStartTime + EPOCH_DURATION + EPOCH_GRACE_PERIOD;
        
        if (!isOwner && !gracePeriodPassed) {
            revert EpochNotReady();
        }
        
        // Check minimum duration passed
        if (block.timestamp < epochStartTime + EPOCH_DURATION) {
            revert EpochNotReady();
        }

        Epoch storage epoch = epochs[currentEpoch];
        
        // Snapshot total weight
        epoch.totalWeight = totalWeight;
        epoch.snapshotTime = block.timestamp;
        epoch.finalized = true;

        emit EpochFinalized(currentEpoch, epoch.totalRewards, epochPrescioRewards[currentEpoch], epoch.totalWeight);

        // Start new epoch
        currentEpoch++;
        epochStartTime = block.timestamp;
    }

    /**
     * @notice Distribute accumulated penalties
     * @dev Adds PRESCIO to epochPrescioRewards (separate from MON)
     */
    function distributePenalties() external nonReentrant {
        uint256 burnAmount = pendingBurnAmount;
        uint256 stakerAmount = pendingPrescioRewardsPool;
        uint256 treasuryAmount = pendingTreasuryAmount;
        
        if (burnAmount + stakerAmount + treasuryAmount == 0) return;

        // Reset before transfers (CEI)
        pendingBurnAmount = 0;
        pendingPrescioRewardsPool = 0;
        pendingTreasuryAmount = 0;

        // Add PRESCIO to epoch rewards (separate from MON)
        epochPrescioRewards[currentEpoch] += stakerAmount;

        // Burn tokens
        if (burnAmount > 0) {
            prescioToken.safeTransfer(DEAD_ADDRESS, burnAmount);
        }

        // Transfer to treasury
        if (treasuryAmount > 0) {
            prescioToken.safeTransfer(treasury, treasuryAmount);
        }

        emit PenaltiesDistributed(burnAmount, stakerAmount, treasuryAmount);
    }

    // ============================================
    // Auto-Bet Integration
    // ============================================

    /**
     * @notice Check if user is eligible for auto-bet
     * @param user User address
     * @return bool True if eligible
     */
    function isAutoBetEligible(address user) external view returns (bool) {
        Tier tier = getTier(user);
        return tier >= Tier.SILVER && tierConfigs[tier].autoBetEnabled;
    }

    /**
     * @notice Get user's auto-bet configuration
     * @param user User address
     * @return dailyLimit Daily betting limit
     * @return maxConcurrent Max concurrent bets
     * @return enabled Auto-bet enabled flag
     */
    function getAutoBetConfig(address user) external view returns (
        uint256 dailyLimit,
        uint8 maxConcurrent,
        bool enabled
    ) {
        Tier tier = getTier(user);
        TierConfig storage config = tierConfigs[tier];
        return (config.autoBetDailyLimit, config.maxConcurrentBets, config.autoBetEnabled);
    }

    /**
     * @notice Validate auto-bet execution
     * @param user User address
     * @param betAmount Bet amount in MON
     * @return bool True if valid
     */
    function validateAutoBet(address user, uint256 betAmount) external view returns (bool) {
        Tier tier = getTier(user);
        if (tier < Tier.SILVER) return false;
        
        TierConfig storage config = tierConfigs[tier];
        if (!config.autoBetEnabled) return false;
        if (betAmount > config.autoBetDailyLimit) return false;
        
        return true;
    }

    // ============================================
    // View Functions
    // ============================================

    /**
     * @notice Get user's current tier based on staked amount
     * @param user User address
     * @return Tier enum value
     */
    function getTier(address user) public view returns (Tier) {
        return getTierForAmount(stakes[user].amount);
    }

    /**
     * @notice Get tier for a given amount
     * @param amount Staked amount
     * @return Tier enum value
     */
    function getTierForAmount(uint256 amount) public pure returns (Tier) {
        if (amount >= TIER_DIAMOND_MIN) return Tier.DIAMOND;
        if (amount >= TIER_GOLD_MIN) return Tier.GOLD;
        if (amount >= TIER_SILVER_MIN) return Tier.SILVER;
        if (amount >= TIER_BRONZE_MIN) return Tier.BRONZE;
        return Tier.NONE;
    }

    /**
     * @notice Calculate user's staking weight
     * @param user User address
     * @return weight User's weight for reward calculation
     */
    function getUserWeight(address user) public view returns (uint256) {
        Stake storage userStake = stakes[user];
        if (!userStake.exists) return 0;

        return _calculateWeight(userStake.amount, getTier(user), userStake.lockType);
    }

    /**
     * @notice Get pending MON rewards for user
     * @param user User address
     * @return totalReward Pending MON reward amount
     */
    function getPendingMonRewards(address user) external view returns (uint256) {
        (uint256 rewards,) = _calculatePendingMonRewards(user);
        return rewards;
    }

    /**
     * @notice Get pending PRESCIO rewards for user
     * @param user User address
     * @return totalReward Pending PRESCIO reward amount
     */
    function getPendingPrescioRewards(address user) external view returns (uint256) {
        (uint256 rewards,) = _calculatePendingPrescioRewards(user);
        return rewards;
    }

    /**
     * @notice Get all pending rewards for user (MON + PRESCIO)
     * @param user User address
     * @return monRewards Pending MON reward amount
     * @return prescioRewards Pending PRESCIO reward amount
     */
    function getPendingRewards(address user) external view returns (uint256 monRewards, uint256 prescioRewards) {
        (monRewards, prescioRewards,,) = _calculatePendingRewardsBoth(user);
        return (monRewards, prescioRewards);
    }

    /**
     * @notice Get detailed stake info
     * @param user User address
     */
    function getStakeInfo(address user) external view returns (
        uint256 amount,
        uint256 lockEnd,
        LockType lockType,
        Tier tier,
        uint256 weight,
        uint256 pendingMonReward,
        uint256 pendingPrescioReward
    ) {
        Stake storage s = stakes[user];
        (uint256 monRewards, uint256 prescioRewards,,) = _calculatePendingRewardsBoth(user);
        return (
            s.amount,
            s.lockEnd,
            s.lockType,
            getTier(user),
            getUserWeight(user),
            monRewards,
            prescioRewards
        );
    }

    /**
     * @notice Get current epoch info
     */
    function getCurrentEpochInfo() external view returns (
        uint256 epochNumber,
        uint256 monRewards,
        uint256 prescioRewards,
        uint256 weight,
        uint256 startTime,
        bool finalized
    ) {
        Epoch storage e = epochs[currentEpoch];
        return (
            currentEpoch,
            e.totalRewards,
            epochPrescioRewards[currentEpoch],
            totalWeight,
            epochStartTime,
            e.finalized
        );
    }

    /**
     * @notice Get total staker count
     */
    function getStakerCount() external view returns (uint256) {
        return stakers.length;
    }

    /**
     * @notice Get epoch info for a specific epoch
     * @param epochNumber The epoch number to query
     */
    function getEpochInfo(uint256 epochNumber) external view returns (
        uint256 monRewards,
        uint256 prescioRewards,
        uint256 weight,
        uint256 snapshotTime,
        bool finalized
    ) {
        Epoch storage e = epochs[epochNumber];
        return (
            e.totalRewards,
            epochPrescioRewards[epochNumber],
            e.totalWeight,
            e.snapshotTime,
            e.finalized
        );
    }

    /**
     * @notice Get available PRESCIO for rewards (excludes staked amounts)
     */
    function getAvailablePrescioForRewards() external view returns (uint256) {
        uint256 balance = prescioToken.balanceOf(address(this));
        if (balance > totalStaked) {
            return balance - totalStaked;
        }
        return 0;
    }

    // ============================================
    // Admin Functions
    // ============================================

    /**
     * @notice Update treasury address
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    /**
     * @notice Update auto-bet controller address
     * @param _controller New controller address
     */
    function setAutoBetController(address _controller) external onlyOwner {
        emit AutoBetControllerUpdated(autoBetController, _controller);
        autoBetController = _controller;
    }

    /**
     * @notice Update tier configuration
     * @dev Does not validate tier ordering (owner responsibility)
     */
    function updateTierConfig(
        Tier tier,
        uint256 minStake,
        uint256 rewardBoost,
        uint256 autoBetDailyLimit,
        uint8 maxConcurrentBets,
        bool autoBetEnabled
    ) external onlyOwner {
        if (tier == Tier.NONE) revert InvalidTier();
        
        tierConfigs[tier] = TierConfig({
            minStake: minStake,
            rewardBoost: rewardBoost,
            autoBetDailyLimit: autoBetDailyLimit,
            maxConcurrentBets: maxConcurrentBets,
            autoBetEnabled: autoBetEnabled
        });

        emit TierConfigUpdated(tier, minStake, rewardBoost);
    }

    // ============================================
    // Internal Functions
    // ============================================

    /**
     * @dev Calculate weight for given parameters
     */
    function _calculateWeight(uint256 amount, Tier tier, LockType lockType) internal view returns (uint256) {
        if (amount == 0) return 0;
        
        uint256 tierBoost = tierConfigs[tier].rewardBoost;
        if (tierBoost == 0) tierBoost = BOOST_PRECISION; // Default 1x for NONE tier
        
        uint256 lockMult = _getLockMultiplier(lockType);

        // weight = amount * tierBoost * lockMult / (100 * 100)
        return (amount * tierBoost * lockMult) / (BOOST_PRECISION * BOOST_PRECISION);
    }

    /**
     * @dev Calculate pending MON rewards (view helper)
     */
    function _calculatePendingMonRewards(address user) internal view returns (uint256 totalReward, uint256 epochsCounted) {
        Stake storage userStake = stakes[user];
        if (!userStake.exists) return (0, 0);

        uint256 userWeight = getUserWeight(user);
        if (userWeight == 0) return (0, 0);

        // [M-01 FIX] Start from first eligible epoch
        uint256 startEpoch = userStake.lastClaimEpoch;
        if (startEpoch < userStake.firstEligibleEpoch) {
            startEpoch = userStake.firstEligibleEpoch;
        }

        for (uint256 e = startEpoch; e < currentEpoch; e++) {
            Epoch storage epoch = epochs[e];
            if (!epoch.finalized || epoch.totalWeight == 0) continue;

            uint256 epochReward = (epoch.totalRewards * userWeight) / epoch.totalWeight;
            totalReward += epochReward;
            epochsCounted++;
        }

        return (totalReward, epochsCounted);
    }

    /**
     * @dev Calculate pending PRESCIO rewards (view helper)
     */
    function _calculatePendingPrescioRewards(address user) internal view returns (uint256 totalReward, uint256 epochsCounted) {
        Stake storage userStake = stakes[user];
        if (!userStake.exists) return (0, 0);

        uint256 userWeight = getUserWeight(user);
        if (userWeight == 0) return (0, 0);

        // Start from first eligible epoch or last PRESCIO claim epoch
        uint256 startEpoch = userStake.lastPrescioClaimEpoch;
        // Handle migration: if lastPrescioClaimEpoch is 0, use lastClaimEpoch
        if (startEpoch == 0) {
            startEpoch = userStake.lastClaimEpoch;
        }
        if (startEpoch < userStake.firstEligibleEpoch) {
            startEpoch = userStake.firstEligibleEpoch;
        }

        for (uint256 e = startEpoch; e < currentEpoch; e++) {
            Epoch storage epoch = epochs[e];
            uint256 prescioPool = epochPrescioRewards[e];
            
            if (!epoch.finalized || epoch.totalWeight == 0 || prescioPool == 0) continue;

            uint256 epochReward = (prescioPool * userWeight) / epoch.totalWeight;
            totalReward += epochReward;
            epochsCounted++;
        }

        return (totalReward, epochsCounted);
    }

    /**
     * @dev Calculate both MON and PRESCIO rewards in a single loop (gas optimized)
     */
    function _calculatePendingRewardsBoth(address user) internal view returns (
        uint256 totalMonReward,
        uint256 totalPrescioReward,
        uint256 monEpochsCounted,
        uint256 prescioEpochsCounted
    ) {
        Stake storage userStake = stakes[user];
        if (!userStake.exists) return (0, 0, 0, 0);

        uint256 userWeight = getUserWeight(user);
        if (userWeight == 0) return (0, 0, 0, 0);

        // Determine start epochs
        uint256 monStartEpoch = userStake.lastClaimEpoch;
        uint256 prescioStartEpoch = userStake.lastPrescioClaimEpoch;
        
        // Handle migration for PRESCIO
        if (prescioStartEpoch == 0) {
            prescioStartEpoch = userStake.lastClaimEpoch;
        }
        
        if (monStartEpoch < userStake.firstEligibleEpoch) {
            monStartEpoch = userStake.firstEligibleEpoch;
        }
        if (prescioStartEpoch < userStake.firstEligibleEpoch) {
            prescioStartEpoch = userStake.firstEligibleEpoch;
        }

        // Find the earliest start epoch for single loop
        uint256 startEpoch = monStartEpoch < prescioStartEpoch ? monStartEpoch : prescioStartEpoch;

        for (uint256 e = startEpoch; e < currentEpoch; e++) {
            Epoch storage epoch = epochs[e];
            if (!epoch.finalized || epoch.totalWeight == 0) continue;

            // MON rewards
            if (e >= monStartEpoch && epoch.totalRewards > 0) {
                totalMonReward += (epoch.totalRewards * userWeight) / epoch.totalWeight;
                monEpochsCounted++;
            }

            // PRESCIO rewards
            uint256 prescioPool = epochPrescioRewards[e];
            if (e >= prescioStartEpoch && prescioPool > 0) {
                totalPrescioReward += (prescioPool * userWeight) / epoch.totalWeight;
                prescioEpochsCounted++;
            }
        }

        return (totalMonReward, totalPrescioReward, monEpochsCounted, prescioEpochsCounted);
    }

    /**
     * @dev Internal MON claim with pagination
     */
    function _claimMonRewards(address user, uint256 maxEpochs) internal {
        Stake storage userStake = stakes[user];
        if (!userStake.exists) revert NoStakeFound();

        uint256 userWeight = getUserWeight(user);
        if (userWeight == 0) revert NothingToClaim();

        // [M-01 FIX] Start from first eligible epoch
        uint256 startEpoch = userStake.lastClaimEpoch;
        if (startEpoch < userStake.firstEligibleEpoch) {
            startEpoch = userStake.firstEligibleEpoch;
        }

        // [C-03 FIX] Pagination
        uint256 endEpoch = startEpoch + maxEpochs;
        if (endEpoch > currentEpoch) endEpoch = currentEpoch;

        uint256 totalReward = 0;

        for (uint256 e = startEpoch; e < endEpoch;) {
            Epoch storage epoch = epochs[e];
            if (epoch.finalized && epoch.totalWeight > 0 && epoch.totalRewards > 0) {
                uint256 epochReward = (epoch.totalRewards * userWeight) / epoch.totalWeight;
                totalReward += epochReward;
            }
            unchecked { ++e; }
        }

        if (totalReward == 0) revert NothingToClaim();

        // Update state before transfer (CEI)
        userStake.lastClaimEpoch = endEpoch;

        // Transfer MON rewards
        (bool success,) = payable(user).call{value: totalReward}("");
        if (!success) revert TransferFailed();

        emit MonRewardsClaimed(user, startEpoch, endEpoch - 1, totalReward);
    }

    /**
     * @dev Internal PRESCIO claim with pagination
     */
    function _claimPrescioRewards(address user, uint256 maxEpochs) internal {
        Stake storage userStake = stakes[user];
        if (!userStake.exists) revert NoStakeFound();

        uint256 userWeight = getUserWeight(user);
        if (userWeight == 0) revert NothingToClaim();

        // Start from first eligible epoch or last PRESCIO claim
        uint256 startEpoch = userStake.lastPrescioClaimEpoch;
        // Handle migration
        if (startEpoch == 0) {
            startEpoch = userStake.lastClaimEpoch;
        }
        if (startEpoch < userStake.firstEligibleEpoch) {
            startEpoch = userStake.firstEligibleEpoch;
        }

        // Pagination
        uint256 endEpoch = startEpoch + maxEpochs;
        if (endEpoch > currentEpoch) endEpoch = currentEpoch;

        uint256 totalReward = 0;

        for (uint256 e = startEpoch; e < endEpoch;) {
            Epoch storage epoch = epochs[e];
            uint256 prescioPool = epochPrescioRewards[e];
            
            if (epoch.finalized && epoch.totalWeight > 0 && prescioPool > 0) {
                uint256 epochReward = (prescioPool * userWeight) / epoch.totalWeight;
                totalReward += epochReward;
            }
            unchecked { ++e; }
        }

        if (totalReward == 0) revert NothingToClaim();

        // Safety check: ensure we have enough PRESCIO for rewards
        uint256 availablePrescio = prescioToken.balanceOf(address(this)) - totalStaked;
        if (totalReward > availablePrescio) revert InsufficientPrescioBalance();

        // Update state before transfer (CEI)
        userStake.lastPrescioClaimEpoch = endEpoch;

        // Transfer PRESCIO rewards
        prescioToken.safeTransfer(user, totalReward);

        emit PrescioRewardsClaimed(user, startEpoch, endEpoch - 1, totalReward);
    }

    /**
     * @dev Internal claim both rewards with single optimized loop
     */
    function _claimAllRewardsOptimized(address user, uint256 maxEpochs) internal {
        Stake storage userStake = stakes[user];
        if (!userStake.exists) revert NoStakeFound();

        uint256 userWeight = getUserWeight(user);
        if (userWeight == 0) revert NothingToClaim();

        // Determine start epochs
        uint256 monStartEpoch = userStake.lastClaimEpoch;
        uint256 prescioStartEpoch = userStake.lastPrescioClaimEpoch;
        
        // Handle migration for PRESCIO
        if (prescioStartEpoch == 0) {
            prescioStartEpoch = userStake.lastClaimEpoch;
        }
        
        if (monStartEpoch < userStake.firstEligibleEpoch) {
            monStartEpoch = userStake.firstEligibleEpoch;
        }
        if (prescioStartEpoch < userStake.firstEligibleEpoch) {
            prescioStartEpoch = userStake.firstEligibleEpoch;
        }

        // Find the earliest start epoch
        uint256 startEpoch = monStartEpoch < prescioStartEpoch ? monStartEpoch : prescioStartEpoch;
        
        // Pagination
        uint256 endEpoch = startEpoch + maxEpochs;
        if (endEpoch > currentEpoch) endEpoch = currentEpoch;

        uint256 totalMonReward = 0;
        uint256 totalPrescioReward = 0;

        for (uint256 e = startEpoch; e < endEpoch;) {
            Epoch storage epoch = epochs[e];
            
            if (epoch.finalized && epoch.totalWeight > 0) {
                // MON rewards
                if (e >= monStartEpoch && epoch.totalRewards > 0) {
                    totalMonReward += (epoch.totalRewards * userWeight) / epoch.totalWeight;
                }

                // PRESCIO rewards
                uint256 prescioPool = epochPrescioRewards[e];
                if (e >= prescioStartEpoch && prescioPool > 0) {
                    totalPrescioReward += (prescioPool * userWeight) / epoch.totalWeight;
                }
            }
            unchecked { ++e; }
        }

        if (totalMonReward == 0 && totalPrescioReward == 0) revert NothingToClaim();

        // Safety check for PRESCIO
        if (totalPrescioReward > 0) {
            uint256 availablePrescio = prescioToken.balanceOf(address(this)) - totalStaked;
            if (totalPrescioReward > availablePrescio) {
                totalPrescioReward = availablePrescio; // Cap to available balance
            }
        }

        // Update state before transfers (CEI)
        userStake.lastClaimEpoch = endEpoch;
        userStake.lastPrescioClaimEpoch = endEpoch;

        // Transfer MON rewards
        if (totalMonReward > 0) {
            (bool success,) = payable(user).call{value: totalMonReward}("");
            if (!success) revert TransferFailed();
        }

        // Transfer PRESCIO rewards
        if (totalPrescioReward > 0) {
            prescioToken.safeTransfer(user, totalPrescioReward);
        }

        emit RewardsClaimed(user, startEpoch, endEpoch - 1, totalMonReward, totalPrescioReward);
    }

    /**
     * @dev Calculate flexible lock early exit penalty
     */
    function _calculateFlexiblePenalty(uint256 startTime, uint256 amount) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - startTime;
        
        if (elapsed < 2 days) {
            return (amount * PENALTY_DAY_1_2) / PENALTY_PRECISION;
        } else if (elapsed < 4 days) {
            return (amount * PENALTY_DAY_3_4) / PENALTY_PRECISION;
        } else if (elapsed < 6 days) {
            return (amount * PENALTY_DAY_5_6) / PENALTY_PRECISION;
        }
        
        return 0;
    }

    /**
     * @dev Distribute penalty: 40% burn, 40% stakers (PRESCIO), 20% treasury
     * @dev Dust prevention: remainder goes to stakers
     */
    function _distributePenalty(uint256 penalty) internal {
        uint256 burnAmount = (penalty * PENALTY_BURN_SHARE) / PENALTY_PRECISION;
        uint256 treasuryAmount = (penalty * PENALTY_TREASURY_SHARE) / PENALTY_PRECISION;
        
        // Dust prevention: all remaining goes to stakers
        uint256 stakerAmount = penalty - burnAmount - treasuryAmount;
        
        pendingBurnAmount += burnAmount;
        pendingPrescioRewardsPool += stakerAmount;
        pendingTreasuryAmount += treasuryAmount;
    }

    /**
     * @dev Remove staker from tracking array
     */
    function _removeStaker(address user) internal {
        if (!isStaker[user]) return;
        
        uint256 index = stakerIndex[user];
        uint256 lastIndex = stakers.length - 1;
        
        if (index != lastIndex) {
            address lastStaker = stakers[lastIndex];
            stakers[index] = lastStaker;
            stakerIndex[lastStaker] = index;
        }
        
        stakers.pop();
        delete stakerIndex[user];
        isStaker[user] = false;
    }

    function _getLockDuration(LockType lockType) internal pure returns (uint256) {
        if (lockType == LockType.FLEXIBLE) return 7 days;
        if (lockType == LockType.FIXED_14D) return 14 days;
        if (lockType == LockType.FIXED_30D) return 30 days;
        if (lockType == LockType.FIXED_60D) return 60 days;
        if (lockType == LockType.FIXED_90D) return 90 days;
        return 7 days;
    }

    function _getLockMultiplier(LockType lockType) internal pure returns (uint256) {
        if (lockType == LockType.FLEXIBLE) return LOCK_MULT_7D;
        if (lockType == LockType.FIXED_14D) return LOCK_MULT_14D;
        if (lockType == LockType.FIXED_30D) return LOCK_MULT_30D;
        if (lockType == LockType.FIXED_60D) return LOCK_MULT_60D;
        if (lockType == LockType.FIXED_90D) return LOCK_MULT_90D;
        return LOCK_MULT_7D;
    }

    // ============================================
    // Receive Function
    // ============================================

    /**
     * @dev [M-03 FIX] Reject direct ETH transfers
     */
    receive() external payable {
        revert("Use depositRewards()");
    }
}
