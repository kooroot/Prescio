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
 * v1.3 Security Fixes:
 * - [H-01] Strict PRESCIO balance check - revert instead of silent cap
 * - [H-02] Minimum stake duration for tier rewards (anti-gaming)
 * - [M-01] Improved epoch weight snapshot timing
 * - Custom errors for gas optimization
 * - VERSION constant for upgrade tracking
 * 
 * v1.4 - Tier Requirements Update:
 * - Updated tier minimums: Bronze 5M, Silver 20M, Gold 50M, Diamond 150M
 * - Removed Legendary tier (Diamond is now highest)
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
    // Version
    // ============================================
    
    uint256 public constant VERSION = 5;

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
    
    // [H-02 FIX] Minimum stake duration for full tier benefits
    uint256 public constant MIN_STAKE_DURATION_FOR_TIER = 1 days;
    
    // Tier minimum stakes (18 decimals) - v1.4 updated
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

    // Early unstaking penalty thresholds
    uint256 public constant PENALTY_TIER1_THRESHOLD = 2 days;
    uint256 public constant PENALTY_TIER2_THRESHOLD = 4 days;
    uint256 public constant PENALTY_TIER3_THRESHOLD = 6 days;
    
    // Early unstaking penalties (1000 = 100%)
    uint256 public constant PENALTY_DAY_1_2 = 150;   // 15%
    uint256 public constant PENALTY_DAY_3_4 = 100;   // 10%
    uint256 public constant PENALTY_DAY_5_6 = 50;    // 5%
    uint256 public constant EMERGENCY_PENALTY = 500; // 50%

    // Penalty distribution (1000 = 100%)
    uint256 public constant PENALTY_BURN_SHARE = 400;     // 40%
    uint256 public constant PENALTY_STAKER_SHARE = 400;   // 40%
    uint256 public constant PENALTY_TREASURY_SHARE = 200; // 20%

    // [I-02 FIX] Unlimited concurrent bets constant
    uint8 public constant UNLIMITED_CONCURRENT_BETS = 255;

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
    uint256 public totalWeight;
    
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
    uint256 public pendingPrescioRewardsPool;
    uint256 public pendingTreasuryAmount;

    // PRESCIO epoch rewards (separate from MON)
    mapping(uint256 => uint256) public epochPrescioRewards;
    
    // [M-01 FIX] Weight snapshot at epoch start for finalization
    uint256 public weightAtEpochStart;

    // v1.4 - Vault integration for automated reward distribution
    address public vaultContract;

    // ============================================
    // Storage Gap (for future upgrades)
    // ============================================
    
    uint256[45] private __gap; // Reduced from 46 to account for vaultContract

    // ============================================
    // Events
    // ============================================

    event Staked(address indexed user, uint256 amount, LockType lockType, Tier tier);
    event StakeAdded(
        address indexed user, 
        uint256 addedAmount, 
        uint256 newTotal, 
        Tier newTier,
        uint256 newWeight,
        bool lockExtended
    );
    event Unstaked(address indexed user, uint256 amount, uint256 penalty);
    event EmergencyUnstaked(address indexed user, uint256 amount, uint256 penalty, uint256 forfeitedRewards);
    event MonRewardsClaimed(address indexed user, uint256 fromEpoch, uint256 toEpoch, uint256 amount);
    event PrescioRewardsClaimed(address indexed user, uint256 fromEpoch, uint256 toEpoch, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 fromEpoch, uint256 toEpoch, uint256 monReward, uint256 prescioReward);
    event EpochFinalized(uint256 indexed epoch, uint256 totalMonRewards, uint256 totalPrescioRewards, uint256 totalWeight);
    event RewardsDeposited(uint256 amount, uint256 epoch);
    event TierConfigUpdated(Tier indexed tier, uint256 minStake, uint256 rewardBoost);
    event PenaltiesDistributed(uint256 burned, uint256 toStakers, uint256 toTreasury);
    event PenaltyAccumulated(address indexed from, uint256 burn, uint256 stakers, uint256 treasury); // [L-01 FIX]
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event AutoBetControllerUpdated(address indexed oldController, address indexed newController);
    event VaultContractUpdated(address indexed oldVault, address indexed newVault);
    event RewardsDepositedFromVault(address indexed vault, uint256 amount, uint256 epoch);

    // ============================================
    // Errors
    // ============================================

    error ZeroAmount();
    error ZeroAddress();
    error InvalidImplementation();
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
    error DirectTransferNotAllowed(); // [I-03 FIX]
    error NotVaultContract();

    // ============================================
    // Modifiers
    // ============================================

    modifier onlyAutoBetController() {
        if (msg.sender != autoBetController) revert NotAutoBetController();
        _;
    }

    modifier onlyVault() {
        if (msg.sender != vaultContract) revert NotVaultContract();
        _;
    }

    // ============================================
    // Initializer
    // ============================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

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
     * @notice Reinitializer for v1.3 upgrade
     */
    function initializeV3() public reinitializer(3) {
        // Initialize weightAtEpochStart with current totalWeight
        weightAtEpochStart = totalWeight;
    }

    /**
     * @notice Reinitializer for v1.4 upgrade - Vault integration
     * @param _vault Address of the PrescioVault contract
     */
    function initializeV4(address _vault) public reinitializer(4) {
        if (_vault == address(0)) revert ZeroAddress();
        vaultContract = _vault;
    }

    /**
     * @notice Reinitializer for v5 upgrade - addStake feature
     * @dev No state changes needed, just version bump
     */
    function initializeV5() public reinitializer(5) {
        // V5: addStake feature added
        // No additional state initialization required
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
            maxConcurrentBets: UNLIMITED_CONCURRENT_BETS,
            autoBetEnabled: true
        });
    }

    // ============================================
    // UUPS Authorization
    // ============================================

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // [Coder FIX] Validate implementation address
        if (newImplementation == address(0)) revert InvalidImplementation();
        if (newImplementation.code.length == 0) revert InvalidImplementation();
    }

    // ============================================
    // Core Staking Functions
    // ============================================

    function stake(uint256 amount, LockType lockType) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (stakes[msg.sender].exists) revert AlreadyStaked();

        prescioToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 lockDuration = _getLockDuration(lockType);
        uint256 lockEnd = block.timestamp + lockDuration;

        stakes[msg.sender] = Stake({
            amount: amount,
            lockEnd: lockEnd,
            lockType: lockType,
            startTime: block.timestamp,
            lastClaimEpoch: currentEpoch,
            lastPrescioClaimEpoch: currentEpoch,
            firstEligibleEpoch: currentEpoch + 1,
            exists: true
        });

        totalStaked += amount;
        
        uint256 userWeight = _calculateWeight(amount, getTierForAmount(amount), lockType);
        totalWeight += userWeight;
        
        if (!isStaker[msg.sender]) {
            stakerIndex[msg.sender] = stakers.length;
            stakers.push(msg.sender);
            isStaker[msg.sender] = true;
        }

        emit Staked(msg.sender, amount, lockType, getTier(msg.sender));
    }

    /**
     * @notice Add tokens to existing stake
     * @dev Tier and weight are recalculated automatically. CEI pattern enforced.
     * @param amount Amount of PRESCIO tokens to add (must be > 0)
     * @param extendLock If true, reset lockEnd based on lockType.
     *                   If false, keep existing lockEnd (with minimum 7d if expired)
     */
    function addStake(uint256 amount, bool extendLock) external nonReentrant {
        // ===== CHECKS =====
        if (amount == 0) revert ZeroAmount();
        
        Stake storage userStake = stakes[msg.sender];
        if (!userStake.exists) revert NoStakeFound();
        
        // ===== EFFECTS =====
        // 1. Remove old weight from total
        // [H-01 FIX] Use getUserWeight() to apply MIN_STAKE_DURATION_FOR_TIER anti-gaming logic
        uint256 oldWeight = getUserWeight(msg.sender);
        totalWeight -= oldWeight;
        
        // 2. Update amount
        uint256 newAmount = userStake.amount + amount;
        userStake.amount = newAmount;
        totalStaked += amount;
        
        // 3. Handle lockEnd
        if (extendLock) {
            uint256 lockDuration = _getLockDuration(userStake.lockType);
            userStake.lockEnd = block.timestamp + lockDuration;
        } else if (block.timestamp >= userStake.lockEnd) {
            // Lock expired → apply minimum lock (FLEXIBLE = 7 days)
            userStake.lockEnd = block.timestamp + 7 days;
        }
        // else: keep existing lockEnd
        
        // 4. Calculate new tier and weight
        Tier newTier = getTierForAmount(newAmount);
        uint256 newWeight = _calculateWeight(newAmount, newTier, userStake.lockType);
        totalWeight += newWeight;
        
        // ===== INTERACTIONS =====
        prescioToken.safeTransferFrom(msg.sender, address(this), amount);
        
        emit StakeAdded(msg.sender, amount, newAmount, newTier, newWeight, extendLock);
    }

    function unstake() external nonReentrant {
        Stake storage userStake = stakes[msg.sender];
        if (!userStake.exists) revert NoStakeFound();

        uint256 amount = userStake.amount;
        uint256 penalty = 0;

        if (block.timestamp < userStake.lockEnd) {
            if (userStake.lockType != LockType.FLEXIBLE) {
                revert FixedLockNoEarlyExit();
            }
            penalty = _calculateFlexiblePenalty(userStake.startTime, amount);
        }

        // Calculate rewards
        (uint256 monRewards, uint256 prescioRewards,,) = _calculatePendingRewardsBoth(msg.sender);
        
        // [H-01 FIX] Strict PRESCIO balance check - revert if insufficient
        if (prescioRewards > 0) {
            uint256 availablePrescio = prescioToken.balanceOf(address(this)) - totalStaked;
            if (prescioRewards > availablePrescio) {
                revert InsufficientPrescioBalance();
            }
        }
        
        uint256 userWeight = getUserWeight(msg.sender);
        totalWeight -= userWeight;
        
        uint256 lastMonClaimed = userStake.lastClaimEpoch;
        uint256 lastPrescioClaimed = userStake.lastPrescioClaimEpoch;
        _removeStaker(msg.sender);
        delete stakes[msg.sender];
        totalStaked -= amount;

        uint256 returnAmount = amount;
        if (penalty > 0) {
            _distributePenalty(penalty);
            returnAmount = amount - penalty;
        }

        if (monRewards > 0) {
            (bool rewardSuccess,) = payable(msg.sender).call{value: monRewards}("");
            if (!rewardSuccess) revert TransferFailed();
        }
        
        if (prescioRewards > 0) {
            prescioToken.safeTransfer(msg.sender, prescioRewards);
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
     * @dev [L-05 FIX] Attempts to claim MON rewards, but forfeits PRESCIO rewards
     */
    function emergencyUnstake() external nonReentrant {
        Stake storage userStake = stakes[msg.sender];
        if (!userStake.exists) revert NoStakeFound();

        uint256 amount = userStake.amount;
        uint256 penalty = (amount * EMERGENCY_PENALTY) / PENALTY_PRECISION;

        // Try to calculate MON rewards (PRESCIO forfeited in emergency)
        (uint256 monRewards,,,) = _calculatePendingRewardsBoth(msg.sender);
        uint256 forfeitedPrescioRewards;
        (,forfeitedPrescioRewards,,) = _calculatePendingRewardsBoth(msg.sender);

        uint256 userWeight = getUserWeight(msg.sender);
        totalWeight -= userWeight;

        _removeStaker(msg.sender);
        delete stakes[msg.sender];
        totalStaked -= amount;

        _distributePenalty(penalty);

        // Transfer MON rewards if any (best effort)
        if (monRewards > 0) {
            (bool success,) = payable(msg.sender).call{value: monRewards}("");
            // Don't revert on failure - this is emergency
            if (!success) {
                monRewards = 0;
            }
        }

        prescioToken.safeTransfer(msg.sender, amount - penalty);

        emit EmergencyUnstaked(msg.sender, amount - penalty, penalty, forfeitedPrescioRewards);
    }

    // ============================================
    // Reward Claim Functions
    // ============================================

    function claimMonRewards(uint256 maxEpochs) external nonReentrant {
        if (maxEpochs == 0) maxEpochs = MAX_CLAIM_EPOCHS;
        if (maxEpochs > MAX_CLAIM_EPOCHS) revert MaxEpochsExceeded();
        
        _claimMonRewards(msg.sender, maxEpochs);
    }

    function claimPrescioRewards(uint256 maxEpochs) external nonReentrant {
        if (maxEpochs == 0) maxEpochs = MAX_CLAIM_EPOCHS;
        if (maxEpochs > MAX_CLAIM_EPOCHS) revert MaxEpochsExceeded();
        
        _claimPrescioRewards(msg.sender, maxEpochs);
    }

    function claimAllRewards(uint256 maxEpochs) external nonReentrant {
        if (maxEpochs == 0) maxEpochs = MAX_CLAIM_EPOCHS;
        if (maxEpochs > MAX_CLAIM_EPOCHS) revert MaxEpochsExceeded();
        
        _claimAllRewardsOptimized(msg.sender, maxEpochs);
    }

    function claimRewards(uint256 maxEpochs) external nonReentrant {
        if (maxEpochs == 0) maxEpochs = MAX_CLAIM_EPOCHS;
        if (maxEpochs > MAX_CLAIM_EPOCHS) revert MaxEpochsExceeded();
        
        _claimAllRewardsOptimized(msg.sender, maxEpochs);
    }

    // ============================================
    // Epoch Management
    // ============================================

    /**
     * @notice Deposit MON rewards (owner only)
     */
    function depositRewards() external payable onlyOwner {
        epochs[currentEpoch].totalRewards += msg.value;
        emit RewardsDeposited(msg.value, currentEpoch);
    }

    /**
     * @notice Deposit MON rewards from vault contract
     * @dev Called by PrescioVault.distributeToStaking()
     */
    function depositRewardsFromVault() external payable onlyVault nonReentrant {
        epochs[currentEpoch].totalRewards += msg.value;
        emit RewardsDepositedFromVault(msg.sender, msg.value, currentEpoch);
    }

    /**
     * @notice Finalize current epoch and start new one
     * @dev [M-01 FIX] Uses weight snapshot from epoch start to prevent manipulation
     */
    function finalizeEpoch() external {
        bool isOwner = msg.sender == owner();
        bool gracePeriodPassed = block.timestamp >= epochStartTime + EPOCH_DURATION + EPOCH_GRACE_PERIOD;
        
        if (!isOwner && !gracePeriodPassed) {
            revert EpochNotReady();
        }
        
        if (block.timestamp < epochStartTime + EPOCH_DURATION) {
            revert EpochNotReady();
        }

        Epoch storage epoch = epochs[currentEpoch];
        
        // [M-01 FIX] Use weight snapshot from epoch start instead of current
        // This prevents manipulation during finalization window
        epoch.totalWeight = weightAtEpochStart > 0 ? weightAtEpochStart : totalWeight;
        epoch.snapshotTime = block.timestamp;
        epoch.finalized = true;

        emit EpochFinalized(currentEpoch, epoch.totalRewards, epochPrescioRewards[currentEpoch], epoch.totalWeight);

        currentEpoch++;
        epochStartTime = block.timestamp;
        
        // Snapshot current weight for next epoch
        weightAtEpochStart = totalWeight;
    }

    function distributePenalties() external nonReentrant {
        uint256 burnAmount = pendingBurnAmount;
        uint256 stakerAmount = pendingPrescioRewardsPool;
        uint256 treasuryAmount = pendingTreasuryAmount;
        
        if (burnAmount + stakerAmount + treasuryAmount == 0) return;

        pendingBurnAmount = 0;
        pendingPrescioRewardsPool = 0;
        pendingTreasuryAmount = 0;

        epochPrescioRewards[currentEpoch] += stakerAmount;

        if (burnAmount > 0) {
            prescioToken.safeTransfer(DEAD_ADDRESS, burnAmount);
        }

        if (treasuryAmount > 0) {
            prescioToken.safeTransfer(treasury, treasuryAmount);
        }

        emit PenaltiesDistributed(burnAmount, stakerAmount, treasuryAmount);
    }

    // ============================================
    // Auto-Bet Integration
    // ============================================

    function isAutoBetEligible(address user) external view returns (bool) {
        Stake storage userStake = stakes[user];
        if (!userStake.exists) return false;
        
        // [H-02 FIX] Require minimum stake duration for tier benefits
        if (block.timestamp < userStake.startTime + MIN_STAKE_DURATION_FOR_TIER) {
            return false;
        }
        
        Tier tier = getTier(user);
        return tier >= Tier.SILVER && tierConfigs[tier].autoBetEnabled;
    }

    function getAutoBetConfig(address user) external view returns (
        uint256 dailyLimit,
        uint8 maxConcurrent,
        bool enabled
    ) {
        Tier tier = getTier(user);
        TierConfig storage config = tierConfigs[tier];
        return (config.autoBetDailyLimit, config.maxConcurrentBets, config.autoBetEnabled);
    }

    function validateAutoBet(address user, uint256 betAmount) external view returns (bool) {
        Stake storage userStake = stakes[user];
        if (!userStake.exists) return false;
        
        // [H-02 FIX] Check minimum stake duration
        if (block.timestamp < userStake.startTime + MIN_STAKE_DURATION_FOR_TIER) {
            return false;
        }
        
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

    function getVersion() external pure returns (uint256) {
        return VERSION;
    }

    function getTier(address user) public view returns (Tier) {
        return getTierForAmount(stakes[user].amount);
    }

    function getTierForAmount(uint256 amount) public pure returns (Tier) {
        if (amount >= TIER_DIAMOND_MIN) return Tier.DIAMOND;
        if (amount >= TIER_GOLD_MIN) return Tier.GOLD;
        if (amount >= TIER_SILVER_MIN) return Tier.SILVER;
        if (amount >= TIER_BRONZE_MIN) return Tier.BRONZE;
        return Tier.NONE;
    }

    /**
     * @notice Calculate user's staking weight
     * @dev [H-02 FIX] Returns base weight (1x) if stake duration < MIN_STAKE_DURATION_FOR_TIER
     */
    function getUserWeight(address user) public view returns (uint256) {
        Stake storage userStake = stakes[user];
        if (!userStake.exists) return 0;

        // [H-02 FIX] Anti-gaming: New stakes get base tier weight until duration met
        Tier effectiveTier;
        if (block.timestamp < userStake.startTime + MIN_STAKE_DURATION_FOR_TIER) {
            effectiveTier = Tier.BRONZE; // Base tier for new stakes
        } else {
            effectiveTier = getTier(user);
        }

        return _calculateWeight(userStake.amount, effectiveTier, userStake.lockType);
    }

    function getPendingMonRewards(address user) external view returns (uint256) {
        (uint256 rewards,) = _calculatePendingMonRewards(user);
        return rewards;
    }

    function getPendingPrescioRewards(address user) external view returns (uint256) {
        (uint256 rewards,) = _calculatePendingPrescioRewards(user);
        return rewards;
    }

    function getPendingRewards(address user) external view returns (uint256 monRewards, uint256 prescioRewards) {
        (monRewards, prescioRewards,,) = _calculatePendingRewardsBoth(user);
        return (monRewards, prescioRewards);
    }

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

    function getStakerCount() external view returns (uint256) {
        return stakers.length;
    }

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

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    function setAutoBetController(address _controller) external onlyOwner {
        emit AutoBetControllerUpdated(autoBetController, _controller);
        autoBetController = _controller;
    }

    /**
     * @notice Set the vault contract address for reward deposits
     * @param _vault Address of the vault contract
     */
    function setVaultContract(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        emit VaultContractUpdated(vaultContract, _vault);
        vaultContract = _vault;
    }

    /**
     * @notice Update tier configuration
     * @dev [L-03 FIX] Validates tier ordering
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
        
        // [L-03 FIX] Validate tier ordering
        if (tier > Tier.BRONZE) {
            Tier lowerTier = Tier(uint8(tier) - 1);
            if (minStake < tierConfigs[lowerTier].minStake) revert InvalidTierOrder();
        }
        if (tier < Tier.DIAMOND) {
            Tier higherTier = Tier(uint8(tier) + 1);
            if (tierConfigs[higherTier].minStake > 0 && minStake > tierConfigs[higherTier].minStake) {
                revert InvalidTierOrder();
            }
        }
        
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

    function _calculateWeight(uint256 amount, Tier tier, LockType lockType) internal view returns (uint256) {
        if (amount == 0) return 0;
        
        uint256 tierBoost = tierConfigs[tier].rewardBoost;
        if (tierBoost == 0) tierBoost = BOOST_PRECISION;
        
        uint256 lockMult = _getLockMultiplier(lockType);

        return (amount * tierBoost * lockMult) / (BOOST_PRECISION * BOOST_PRECISION);
    }

    function _calculatePendingMonRewards(address user) internal view returns (uint256 totalReward, uint256 epochsCounted) {
        Stake storage userStake = stakes[user];
        if (!userStake.exists) return (0, 0);

        uint256 userWeight = getUserWeight(user);
        if (userWeight == 0) return (0, 0);

        uint256 startEpoch = userStake.lastClaimEpoch;
        if (startEpoch < userStake.firstEligibleEpoch) {
            startEpoch = userStake.firstEligibleEpoch;
        }

        for (uint256 e = startEpoch; e < currentEpoch; e++) {
            Epoch memory epoch = epochs[e]; // Memory copy for gas optimization
            if (!epoch.finalized || epoch.totalWeight == 0) continue;

            uint256 epochReward = (epoch.totalRewards * userWeight) / epoch.totalWeight;
            totalReward += epochReward;
            epochsCounted++;
        }

        return (totalReward, epochsCounted);
    }

    function _calculatePendingPrescioRewards(address user) internal view returns (uint256 totalReward, uint256 epochsCounted) {
        Stake storage userStake = stakes[user];
        if (!userStake.exists) return (0, 0);

        uint256 userWeight = getUserWeight(user);
        if (userWeight == 0) return (0, 0);

        uint256 startEpoch = userStake.lastPrescioClaimEpoch;
        if (startEpoch == 0) {
            startEpoch = userStake.lastClaimEpoch;
        }
        if (startEpoch < userStake.firstEligibleEpoch) {
            startEpoch = userStake.firstEligibleEpoch;
        }

        for (uint256 e = startEpoch; e < currentEpoch; e++) {
            Epoch memory epoch = epochs[e];
            uint256 prescioPool = epochPrescioRewards[e];
            
            if (!epoch.finalized || epoch.totalWeight == 0 || prescioPool == 0) continue;

            uint256 epochReward = (prescioPool * userWeight) / epoch.totalWeight;
            totalReward += epochReward;
            epochsCounted++;
        }

        return (totalReward, epochsCounted);
    }

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

        uint256 monStartEpoch = userStake.lastClaimEpoch;
        uint256 prescioStartEpoch = userStake.lastPrescioClaimEpoch;
        
        if (prescioStartEpoch == 0) {
            prescioStartEpoch = userStake.lastClaimEpoch;
        }
        
        if (monStartEpoch < userStake.firstEligibleEpoch) {
            monStartEpoch = userStake.firstEligibleEpoch;
        }
        if (prescioStartEpoch < userStake.firstEligibleEpoch) {
            prescioStartEpoch = userStake.firstEligibleEpoch;
        }

        uint256 startEpoch = monStartEpoch < prescioStartEpoch ? monStartEpoch : prescioStartEpoch;

        for (uint256 e = startEpoch; e < currentEpoch; e++) {
            Epoch memory epoch = epochs[e];
            if (!epoch.finalized || epoch.totalWeight == 0) continue;

            if (e >= monStartEpoch && epoch.totalRewards > 0) {
                totalMonReward += (epoch.totalRewards * userWeight) / epoch.totalWeight;
                monEpochsCounted++;
            }

            uint256 prescioPool = epochPrescioRewards[e];
            if (e >= prescioStartEpoch && prescioPool > 0) {
                totalPrescioReward += (prescioPool * userWeight) / epoch.totalWeight;
                prescioEpochsCounted++;
            }
        }

        return (totalMonReward, totalPrescioReward, monEpochsCounted, prescioEpochsCounted);
    }

    function _claimMonRewards(address user, uint256 maxEpochs) internal {
        Stake storage userStake = stakes[user];
        if (!userStake.exists) revert NoStakeFound();

        uint256 userWeight = getUserWeight(user);
        if (userWeight == 0) revert NothingToClaim();

        uint256 startEpoch = userStake.lastClaimEpoch;
        if (startEpoch < userStake.firstEligibleEpoch) {
            startEpoch = userStake.firstEligibleEpoch;
        }

        uint256 endEpoch = startEpoch + maxEpochs;
        if (endEpoch > currentEpoch) endEpoch = currentEpoch;

        uint256 totalReward = 0;

        for (uint256 e = startEpoch; e < endEpoch;) {
            Epoch memory epoch = epochs[e];
            if (epoch.finalized && epoch.totalWeight > 0 && epoch.totalRewards > 0) {
                uint256 epochReward = (epoch.totalRewards * userWeight) / epoch.totalWeight;
                totalReward += epochReward;
            }
            unchecked { ++e; }
        }

        if (totalReward == 0) revert NothingToClaim();

        userStake.lastClaimEpoch = endEpoch;

        (bool success,) = payable(user).call{value: totalReward}("");
        if (!success) revert TransferFailed();

        emit MonRewardsClaimed(user, startEpoch, endEpoch - 1, totalReward);
    }

    /**
     * @dev Internal PRESCIO claim with pagination
     * @dev [H-01 FIX] Strict balance check - reverts if insufficient
     */
    function _claimPrescioRewards(address user, uint256 maxEpochs) internal {
        Stake storage userStake = stakes[user];
        if (!userStake.exists) revert NoStakeFound();

        uint256 userWeight = getUserWeight(user);
        if (userWeight == 0) revert NothingToClaim();

        uint256 startEpoch = userStake.lastPrescioClaimEpoch;
        if (startEpoch == 0) {
            startEpoch = userStake.lastClaimEpoch;
        }
        if (startEpoch < userStake.firstEligibleEpoch) {
            startEpoch = userStake.firstEligibleEpoch;
        }

        uint256 endEpoch = startEpoch + maxEpochs;
        if (endEpoch > currentEpoch) endEpoch = currentEpoch;

        uint256 totalReward = 0;

        for (uint256 e = startEpoch; e < endEpoch;) {
            Epoch memory epoch = epochs[e];
            uint256 prescioPool = epochPrescioRewards[e];
            
            if (epoch.finalized && epoch.totalWeight > 0 && prescioPool > 0) {
                uint256 epochReward = (prescioPool * userWeight) / epoch.totalWeight;
                totalReward += epochReward;
            }
            unchecked { ++e; }
        }

        if (totalReward == 0) revert NothingToClaim();

        // [H-01 FIX] Strict balance check - revert instead of silent cap
        uint256 availablePrescio = prescioToken.balanceOf(address(this)) - totalStaked;
        if (totalReward > availablePrescio) revert InsufficientPrescioBalance();

        userStake.lastPrescioClaimEpoch = endEpoch;

        prescioToken.safeTransfer(user, totalReward);

        emit PrescioRewardsClaimed(user, startEpoch, endEpoch - 1, totalReward);
    }

    /**
     * @dev Internal claim both rewards
     * @dev [H-01 FIX] Strict balance check for PRESCIO
     */
    function _claimAllRewardsOptimized(address user, uint256 maxEpochs) internal {
        Stake storage userStake = stakes[user];
        if (!userStake.exists) revert NoStakeFound();

        uint256 userWeight = getUserWeight(user);
        if (userWeight == 0) revert NothingToClaim();

        uint256 monStartEpoch = userStake.lastClaimEpoch;
        uint256 prescioStartEpoch = userStake.lastPrescioClaimEpoch;
        
        if (prescioStartEpoch == 0) {
            prescioStartEpoch = userStake.lastClaimEpoch;
        }
        
        if (monStartEpoch < userStake.firstEligibleEpoch) {
            monStartEpoch = userStake.firstEligibleEpoch;
        }
        if (prescioStartEpoch < userStake.firstEligibleEpoch) {
            prescioStartEpoch = userStake.firstEligibleEpoch;
        }

        uint256 startEpoch = monStartEpoch < prescioStartEpoch ? monStartEpoch : prescioStartEpoch;
        
        uint256 endEpoch = startEpoch + maxEpochs;
        if (endEpoch > currentEpoch) endEpoch = currentEpoch;

        uint256 totalMonReward = 0;
        uint256 totalPrescioReward = 0;

        for (uint256 e = startEpoch; e < endEpoch;) {
            Epoch memory epoch = epochs[e];
            
            if (epoch.finalized && epoch.totalWeight > 0) {
                if (e >= monStartEpoch && epoch.totalRewards > 0) {
                    totalMonReward += (epoch.totalRewards * userWeight) / epoch.totalWeight;
                }

                uint256 prescioPool = epochPrescioRewards[e];
                if (e >= prescioStartEpoch && prescioPool > 0) {
                    totalPrescioReward += (prescioPool * userWeight) / epoch.totalWeight;
                }
            }
            unchecked { ++e; }
        }

        if (totalMonReward == 0 && totalPrescioReward == 0) revert NothingToClaim();

        // [H-01 FIX] Strict balance check - revert if PRESCIO insufficient
        if (totalPrescioReward > 0) {
            uint256 availablePrescio = prescioToken.balanceOf(address(this)) - totalStaked;
            if (totalPrescioReward > availablePrescio) {
                revert InsufficientPrescioBalance();
            }
        }

        userStake.lastClaimEpoch = endEpoch;
        userStake.lastPrescioClaimEpoch = endEpoch;

        if (totalMonReward > 0) {
            (bool success,) = payable(user).call{value: totalMonReward}("");
            if (!success) revert TransferFailed();
        }

        if (totalPrescioReward > 0) {
            prescioToken.safeTransfer(user, totalPrescioReward);
        }

        emit RewardsClaimed(user, startEpoch, endEpoch - 1, totalMonReward, totalPrescioReward);
    }

    function _calculateFlexiblePenalty(uint256 startTime, uint256 amount) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - startTime;
        
        if (elapsed < PENALTY_TIER1_THRESHOLD) {
            return (amount * PENALTY_DAY_1_2) / PENALTY_PRECISION;
        } else if (elapsed < PENALTY_TIER2_THRESHOLD) {
            return (amount * PENALTY_DAY_3_4) / PENALTY_PRECISION;
        } else if (elapsed < PENALTY_TIER3_THRESHOLD) {
            return (amount * PENALTY_DAY_5_6) / PENALTY_PRECISION;
        }
        
        return 0;
    }

    /**
     * @dev Distribute penalty with event emission
     * @dev [L-01 FIX] Added PenaltyAccumulated event
     */
    function _distributePenalty(uint256 penalty) internal {
        uint256 burnAmount = (penalty * PENALTY_BURN_SHARE) / PENALTY_PRECISION;
        uint256 treasuryAmount = (penalty * PENALTY_TREASURY_SHARE) / PENALTY_PRECISION;
        uint256 stakerAmount = penalty - burnAmount - treasuryAmount;
        
        pendingBurnAmount += burnAmount;
        pendingPrescioRewardsPool += stakerAmount;
        pendingTreasuryAmount += treasuryAmount;
        
        emit PenaltyAccumulated(msg.sender, burnAmount, stakerAmount, treasuryAmount);
    }

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
     * @dev [I-03 FIX] Custom error for consistency
     */
    receive() external payable {
        revert DirectTransferNotAllowed();
    }
}
