// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PrescioStaking
 * @author Prescio Team
 * @notice UUPS upgradeable staking contract for Prescio
 * @dev Stake $PRESCIO tokens to unlock Auto-bet features and earn treasury rewards
 * 
 * Features:
 * - 5-tier staking system (Bronze → Legendary)
 * - Flexible (7d) and Fixed (14d/30d/60d/90d) lock periods
 * - Auto-bet eligibility gating (Silver+ required)
 * - Weekly epoch-based reward distribution with pagination
 * - Early unstaking penalties
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

    enum Tier { NONE, BRONZE, SILVER, GOLD, DIAMOND, LEGENDARY }
    
    enum LockType { 
        FLEXIBLE,    // 7 days, early exit with penalty
        FIXED_14D,   // 14 days, no early exit
        FIXED_30D,   // 30 days
        FIXED_60D,   // 60 days
        FIXED_90D    // 90 days
    }

    struct Stake {
        uint256 amount;           // Staked PRESCIO amount
        uint256 lockEnd;          // Lock end timestamp
        LockType lockType;        // Lock period type
        uint256 startTime;        // Stake start timestamp
        uint256 lastClaimEpoch;   // Last claimed epoch number
        uint256 firstEligibleEpoch; // First epoch eligible for rewards (front-run protection)
        bool exists;              // Stake exists flag
    }

    struct TierConfig {
        uint256 minStake;         // Minimum stake for tier
        uint256 rewardBoost;      // Reward multiplier (100 = 1.0x, 150 = 1.5x)
        uint256 autoBetDailyLimit; // Daily auto-bet limit in MON (18 decimals)
        uint8 maxConcurrentBets;  // Max simultaneous auto-bets
        bool autoBetEnabled;      // Auto-bet feature access
    }

    struct Epoch {
        uint256 totalRewards;     // Total rewards for this epoch
        uint256 totalWeight;      // Total staking weight snapshot
        uint256 snapshotTime;     // Snapshot timestamp
        bool finalized;           // Epoch finalized flag
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
    
    // Tier minimum stakes
    uint256 public constant TIER_BRONZE_MIN = 1_000 * 1e18;
    uint256 public constant TIER_SILVER_MIN = 10_000 * 1e18;
    uint256 public constant TIER_GOLD_MIN = 50_000 * 1e18;
    uint256 public constant TIER_DIAMOND_MIN = 200_000 * 1e18;
    uint256 public constant TIER_LEGENDARY_MIN = 500_000 * 1e18;
    
    // Lock multipliers (100 = 1.0x)
    uint256 public constant LOCK_MULT_7D = 100;
    uint256 public constant LOCK_MULT_14D = 110;
    uint256 public constant LOCK_MULT_30D = 125;
    uint256 public constant LOCK_MULT_60D = 150;
    uint256 public constant LOCK_MULT_90D = 200;

    // Early unstaking penalties (1000 = 100%)
    uint256 public constant PENALTY_DAY_1_2 = 150;  // 15%
    uint256 public constant PENALTY_DAY_3_4 = 100;  // 10%
    uint256 public constant PENALTY_DAY_5_6 = 50;   // 5%
    uint256 public constant EMERGENCY_PENALTY = 500; // 50%

    // Penalty distribution (1000 = 100%)
    uint256 public constant PENALTY_BURN_SHARE = 400;    // 40%
    uint256 public constant PENALTY_STAKER_SHARE = 400;  // 40%
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
    
    // Epoch data
    mapping(uint256 => Epoch) public epochs;
    
    // Penalty accumulation
    uint256 public pendingBurnAmount;
    uint256 public pendingStakerRewards;
    uint256 public pendingTreasuryAmount;

    // ============================================
    // Storage Gap (for future upgrades)
    // ============================================
    
    uint256[50] private __gap;

    // ============================================
    // Events
    // ============================================

    event Staked(address indexed user, uint256 amount, LockType lockType, Tier tier);
    event Unstaked(address indexed user, uint256 amount, uint256 penalty);
    event EmergencyUnstaked(address indexed user, uint256 amount, uint256 penalty);
    event RewardsClaimed(address indexed user, uint256 fromEpoch, uint256 toEpoch, uint256 totalReward);
    event EpochFinalized(uint256 indexed epoch, uint256 totalRewards, uint256 totalWeight);
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
        
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        prescioToken = IERC20(_prescioToken);
        treasury = _treasury;
        autoBetController = _autoBetController;
        
        epochStartTime = block.timestamp;
        currentEpoch = 1;

        _initializeTiers();
    }

    function _initializeTiers() internal {
        // Bronze: 1,000 PRESCIO, no auto-bet
        tierConfigs[Tier.BRONZE] = TierConfig({
            minStake: TIER_BRONZE_MIN,
            rewardBoost: 100,  // 1.0x
            autoBetDailyLimit: 0,
            maxConcurrentBets: 0,
            autoBetEnabled: false
        });

        // Silver: 10,000 PRESCIO, basic auto-bet
        tierConfigs[Tier.SILVER] = TierConfig({
            minStake: TIER_SILVER_MIN,
            rewardBoost: 120,  // 1.2x
            autoBetDailyLimit: 100 * 1e18,  // 100 MON
            maxConcurrentBets: 3,
            autoBetEnabled: true
        });

        // Gold: 50,000 PRESCIO, standard auto-bet
        tierConfigs[Tier.GOLD] = TierConfig({
            minStake: TIER_GOLD_MIN,
            rewardBoost: 150,  // 1.5x
            autoBetDailyLimit: 500 * 1e18,  // 500 MON
            maxConcurrentBets: 10,
            autoBetEnabled: true
        });

        // Diamond: 200,000 PRESCIO, premium auto-bet
        tierConfigs[Tier.DIAMOND] = TierConfig({
            minStake: TIER_DIAMOND_MIN,
            rewardBoost: 200,  // 2.0x
            autoBetDailyLimit: 2_000 * 1e18,  // 2000 MON
            maxConcurrentBets: 255,  // Unlimited
            autoBetEnabled: true
        });

        // Legendary: 500,000 PRESCIO, ultimate auto-bet
        tierConfigs[Tier.LEGENDARY] = TierConfig({
            minStake: TIER_LEGENDARY_MIN,
            rewardBoost: 300,  // 3.0x
            autoBetDailyLimit: 10_000 * 1e18,  // 10000 MON
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
        (uint256 rewards, uint256 claimedEpochs) = _calculatePendingRewards(msg.sender);
        
        // [C-02 FIX] Update running total weight before state changes
        uint256 userWeight = getUserWeight(msg.sender);
        totalWeight -= userWeight;
        
        // Effects - Update state before external calls
        uint256 lastClaimed = userStake.lastClaimEpoch;
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
        if (rewards > 0) {
            (bool rewardSuccess,) = payable(msg.sender).call{value: rewards}("");
            if (!rewardSuccess) revert TransferFailed();
            emit RewardsClaimed(msg.sender, lastClaimed, currentEpoch - 1, rewards);
        }
        
        prescioToken.safeTransfer(msg.sender, returnAmount);

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

    /**
     * @notice Claim accumulated rewards with pagination
     * @param maxEpochs Maximum epochs to process (0 = use default MAX_CLAIM_EPOCHS)
     */
    function claimRewards(uint256 maxEpochs) external nonReentrant {
        if (maxEpochs == 0) maxEpochs = MAX_CLAIM_EPOCHS;
        if (maxEpochs > MAX_CLAIM_EPOCHS) revert MaxEpochsExceeded();
        
        _claimRewards(msg.sender, maxEpochs);
    }

    /**
     * @notice Claim all available rewards (up to MAX_CLAIM_EPOCHS)
     */
    function claimAllRewards() external nonReentrant {
        _claimRewards(msg.sender, MAX_CLAIM_EPOCHS);
    }

    // ============================================
    // Epoch Management
    // ============================================

    /**
     * @notice Deposit rewards for current epoch (owner only)
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

        emit EpochFinalized(currentEpoch, epoch.totalRewards, epoch.totalWeight);

        // Start new epoch
        currentEpoch++;
        epochStartTime = block.timestamp;
    }

    /**
     * @notice Distribute accumulated penalties
     */
    function distributePenalties() external nonReentrant {
        uint256 burnAmount = pendingBurnAmount;
        uint256 stakerAmount = pendingStakerRewards;
        uint256 treasuryAmount = pendingTreasuryAmount;
        
        if (burnAmount + stakerAmount + treasuryAmount == 0) return;

        // Reset before transfers (CEI)
        pendingBurnAmount = 0;
        pendingStakerRewards = 0;
        pendingTreasuryAmount = 0;

        // Add to epoch rewards
        epochs[currentEpoch].totalRewards += stakerAmount;

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
        if (amount >= TIER_LEGENDARY_MIN) return Tier.LEGENDARY;
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
     * @notice Get pending rewards for user
     * @param user User address
     * @return totalReward Pending reward amount
     */
    function getPendingRewards(address user) external view returns (uint256) {
        (uint256 rewards,) = _calculatePendingRewards(user);
        return rewards;
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
        uint256 pendingRewards
    ) {
        Stake storage s = stakes[user];
        (uint256 rewards,) = _calculatePendingRewards(user);
        return (
            s.amount,
            s.lockEnd,
            s.lockType,
            getTier(user),
            getUserWeight(user),
            rewards
        );
    }

    /**
     * @notice Get current epoch info
     */
    function getCurrentEpochInfo() external view returns (
        uint256 epochNumber,
        uint256 rewards,
        uint256 weight,
        uint256 startTime,
        bool finalized
    ) {
        Epoch storage e = epochs[currentEpoch];
        return (
            currentEpoch,
            e.totalRewards,
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
     * @dev Calculate pending rewards (view helper)
     */
    function _calculatePendingRewards(address user) internal view returns (uint256 totalReward, uint256 epochsCounted) {
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
     * @dev Internal claim with pagination
     */
    function _claimRewards(address user, uint256 maxEpochs) internal {
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
            if (epoch.finalized && epoch.totalWeight > 0) {
                uint256 epochReward = (epoch.totalRewards * userWeight) / epoch.totalWeight;
                totalReward += epochReward;
            }
            unchecked { ++e; }
        }

        if (totalReward == 0) revert NothingToClaim();

        // Update state before transfer (CEI)
        userStake.lastClaimEpoch = endEpoch;

        // Transfer rewards
        (bool success,) = payable(user).call{value: totalReward}("");
        if (!success) revert TransferFailed();

        emit RewardsClaimed(user, startEpoch, endEpoch - 1, totalReward);
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
     * @dev [H-02 FIX] Distribute penalty with correct arithmetic
     */
    function _distributePenalty(uint256 penalty) internal {
        pendingBurnAmount += (penalty * PENALTY_BURN_SHARE) / PENALTY_PRECISION;
        pendingStakerRewards += (penalty * PENALTY_STAKER_SHARE) / PENALTY_PRECISION;
        pendingTreasuryAmount += (penalty * PENALTY_TREASURY_SHARE) / PENALTY_PRECISION;
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
