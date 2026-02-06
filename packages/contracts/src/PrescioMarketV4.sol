// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title PrescioMarketV4
 * @author Prescio Team
 * @notice UUPS upgradeable parimutuel prediction market for Prescio
 * @dev Players bet on who the impostor is. Pool is split proportionally among winners.
 * 
 * V4 Security Fixes:
 * - [C-1] ReentrancyGuard → ReentrancyGuardUpgradeable (storage collision fix)
 * - [H-1] emergencyWithdraw timelock (7 days delay)
 * - [H-2] resolve() now has nonReentrant modifier
 * - [M-1] Pull pattern for vault fees (DoS prevention)
 * - [M-3] Market-specific feeRate (immutable per market)
 * - [L-1] Zero address validation in setVault
 * - [L-3] EmergencyWithdraw event added
 * - Storage gap for future upgrades
 */
contract PrescioMarketV4 is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable 
{
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
        uint256 marketFeeRate; // [M-3] Fee rate locked at market creation
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
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant EMERGENCY_DELAY = 7 days; // [H-1] Timelock

    // ============================================
    // State Variables
    // ============================================

    address public vault;
    uint256 public feeRate;

    mapping(bytes32 => MarketInfo) public markets;
    mapping(bytes32 => mapping(address => UserBet)) public userBets;
    mapping(bytes32 => mapping(uint8 => uint256)) public outcomePools;
    
    // V3: Betting pause state per market
    mapping(bytes32 => bool) public bettingPaused;
    
    // [M-1] Pull pattern for vault fees
    uint256 public pendingVaultFees;
    
    // [H-1] Emergency withdraw timelock
    uint256 public emergencyWithdrawRequestTime;
    bool public emergencyWithdrawRequested;

    // ============================================
    // Storage Gap
    // ============================================
    
    uint256[50] private __gap;

    // ============================================
    // Events
    // ============================================

    event MarketCreated(bytes32 indexed gameId, uint8 playerCount, uint256 feeRate);
    event MarketClosed(bytes32 indexed gameId);
    event MarketResolved(bytes32 indexed gameId, uint8 impostorIndex, uint256 totalPool, uint256 fee);
    event BetPlaced(bytes32 indexed gameId, address indexed user, uint8 suspectIndex, uint256 amount);
    event Claimed(bytes32 indexed gameId, address indexed user, uint256 payout);
    event FeeRateUpdated(uint256 oldRate, uint256 newRate);
    event VaultUpdated(address indexed oldVault, address indexed newVault);
    event BettingPaused(bytes32 indexed gameId);
    event BettingResumed(bytes32 indexed gameId);
    event VaultFeesWithdrawn(address indexed vault, uint256 amount);
    event EmergencyWithdrawRequested(address indexed owner, uint256 unlockTime);
    event EmergencyWithdrawCancelled(address indexed owner);
    event EmergencyWithdraw(address indexed to, uint256 amount);

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
    error ZeroAddress();
    error EmergencyNotRequested();
    error EmergencyDelayNotPassed();
    error EmergencyAlreadyRequested();

    // ============================================
    // Initializer
    // ============================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the market contract
     * @param _feeRate Default fee rate (in basis points, max 1000 = 10%)
     * @param _vault Address of the vault to receive fees
     */
    function initialize(uint256 _feeRate, address _vault) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        if (_feeRate > MAX_FEE_RATE) revert InvalidFeeRate();
        if (_vault == address(0)) revert ZeroAddress();
        
        feeRate = _feeRate;
        vault = _vault;
    }

    /**
     * @notice Reinitializer for upgrading from V3 to V4
     * @dev Call this after upgrading to initialize new state variables
     */
    function initializeV4() public reinitializer(4) {
        __ReentrancyGuard_init();
        // pendingVaultFees and emergency variables are already 0 by default
    }

    // ============================================
    // UUPS Authorization
    // ============================================

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============================================
    // Owner Functions - Market Management
    // ============================================

    /**
     * @notice Create a new prediction market
     * @param gameId Unique identifier for the game
     * @param playerCount Number of players (suspects)
     */
    function createMarket(bytes32 gameId, uint8 playerCount) external onlyOwner {
        if (playerCount < 2) revert InvalidPlayerCount();
        if (markets[gameId].playerCount != 0) revert MarketAlreadyExists();

        markets[gameId] = MarketInfo({
            playerCount: playerCount,
            impostorIndex: 0,
            state: MarketState.OPEN,
            totalPool: 0,
            protocolFee: 0,
            marketFeeRate: feeRate // [M-3] Lock fee rate at creation
        });

        emit MarketCreated(gameId, playerCount, feeRate);
    }

    /**
     * @notice Close betting for a market
     * @param gameId Game identifier
     */
    function closeMarket(bytes32 gameId) external onlyOwner {
        MarketInfo storage market = markets[gameId];
        if (market.playerCount == 0) revert MarketNotFound();
        if (market.state != MarketState.OPEN) revert MarketNotOpen();

        market.state = MarketState.CLOSED;
        emit MarketClosed(gameId);
    }

    /**
     * @notice Resolve a market and determine the winner
     * @param gameId Game identifier
     * @param impostorIndex Index of the impostor (winner)
     */
    function resolve(bytes32 gameId, uint8 impostorIndex) external onlyOwner nonReentrant {
        MarketInfo storage market = markets[gameId];
        if (market.playerCount == 0) revert MarketNotFound();
        if (market.state != MarketState.CLOSED) revert MarketNotClosed();
        if (impostorIndex >= market.playerCount) revert InvalidSuspectIndex();

        market.state = MarketState.RESOLVED;
        market.impostorIndex = impostorIndex;

        // [M-3] Use market-specific fee rate
        uint256 fee = (market.totalPool * market.marketFeeRate) / FEE_DENOMINATOR;
        market.protocolFee = fee;

        // Check if anyone bet on the correct answer
        uint256 winningPool = outcomePools[gameId][impostorIndex];
        
        // [M-1] Pull pattern - accumulate fees instead of sending directly
        if (winningPool == 0) {
            // No winners: entire pool goes to vault
            pendingVaultFees += market.totalPool;
        } else {
            // Winners exist: only fee goes to vault
            pendingVaultFees += fee;
        }

        emit MarketResolved(gameId, impostorIndex, market.totalPool, fee);
    }

    // ============================================
    // Owner Functions - Configuration
    // ============================================

    /**
     * @notice Update the default fee rate for new markets
     * @param _feeRate New fee rate (max 10%)
     */
    function setFeeRate(uint256 _feeRate) external onlyOwner {
        if (_feeRate > MAX_FEE_RATE) revert InvalidFeeRate();
        emit FeeRateUpdated(feeRate, _feeRate);
        feeRate = _feeRate;
    }

    /**
     * @notice Update the vault address
     * @param _vault New vault address
     */
    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        emit VaultUpdated(vault, _vault);
        vault = _vault;
    }

    /**
     * @notice Pause betting for a market
     * @param gameId Game identifier
     */
    function pauseBetting(bytes32 gameId) external onlyOwner {
        MarketInfo storage market = markets[gameId];
        if (market.playerCount == 0) revert MarketNotFound();
        bettingPaused[gameId] = true;
        emit BettingPaused(gameId);
    }

    /**
     * @notice Resume betting for a market
     * @param gameId Game identifier
     */
    function resumeBetting(bytes32 gameId) external onlyOwner {
        MarketInfo storage market = markets[gameId];
        if (market.playerCount == 0) revert MarketNotFound();
        bettingPaused[gameId] = false;
        emit BettingResumed(gameId);
    }

    // ============================================
    // Owner Functions - Withdrawals
    // ============================================

    /**
     * @notice Withdraw accumulated vault fees (pull pattern)
     * @dev [M-1] Anyone can call this to push fees to vault
     */
    function withdrawVaultFees() external nonReentrant {
        uint256 amount = pendingVaultFees;
        if (amount == 0) revert NothingToClaim();
        
        pendingVaultFees = 0;
        
        (bool success,) = payable(vault).call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit VaultFeesWithdrawn(vault, amount);
    }

    /**
     * @notice Request emergency withdrawal (starts timelock)
     * @dev [H-1] 7 day delay for emergency withdrawals
     */
    function requestEmergencyWithdraw() external onlyOwner {
        if (emergencyWithdrawRequested) revert EmergencyAlreadyRequested();
        
        emergencyWithdrawRequested = true;
        emergencyWithdrawRequestTime = block.timestamp;
        
        emit EmergencyWithdrawRequested(owner(), block.timestamp + EMERGENCY_DELAY);
    }

    /**
     * @notice Cancel emergency withdrawal request
     */
    function cancelEmergencyWithdraw() external onlyOwner {
        if (!emergencyWithdrawRequested) revert EmergencyNotRequested();
        
        emergencyWithdrawRequested = false;
        emergencyWithdrawRequestTime = 0;
        
        emit EmergencyWithdrawCancelled(owner());
    }

    /**
     * @notice Execute emergency withdrawal after timelock
     * @dev [H-1] Can only execute after 7 day delay
     */
    function emergencyWithdraw() external onlyOwner nonReentrant {
        if (!emergencyWithdrawRequested) revert EmergencyNotRequested();
        if (block.timestamp < emergencyWithdrawRequestTime + EMERGENCY_DELAY) {
            revert EmergencyDelayNotPassed();
        }
        
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToClaim();
        
        // Reset state before transfer
        emergencyWithdrawRequested = false;
        emergencyWithdrawRequestTime = 0;
        
        (bool success,) = payable(owner()).call{value: balance}("");
        if (!success) revert TransferFailed();
        
        emit EmergencyWithdraw(owner(), balance);
    }

    // ============================================
    // User Functions
    // ============================================

    /**
     * @notice Place a bet on a suspect
     * @param gameId Game identifier
     * @param suspectIndex Index of the suspected impostor
     */
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
     * @notice Check if betting is currently open for a market
     * @param gameId Game identifier
     * @return bool True if betting is open
     */
    function isBettingOpen(bytes32 gameId) external view returns (bool) {
        MarketInfo storage market = markets[gameId];
        return market.playerCount > 0 && 
               market.state == MarketState.OPEN && 
               !bettingPaused[gameId];
    }

    /**
     * @notice Get market information
     * @param gameId Game identifier
     */
    function getMarketInfo(bytes32 gameId) external view returns (
        uint8 playerCount, 
        uint8 state, 
        uint256 totalPool, 
        uint8 impostorIndex, 
        uint256 protocolFee,
        uint256 marketFeeRate
    ) {
        MarketInfo storage m = markets[gameId];
        return (m.playerCount, uint8(m.state), m.totalPool, m.impostorIndex, m.protocolFee, m.marketFeeRate);
    }

    /**
     * @notice Get user's bet information
     * @param gameId Game identifier
     * @param user User address
     */
    function getUserBets(bytes32 gameId, address user) external view returns (
        uint8 suspectIndex, 
        uint256 amount, 
        bool claimed
    ) {
        UserBet storage b = userBets[gameId][user];
        return (b.suspectIndex, b.amount, b.claimed);
    }

    /**
     * @notice Get the betting pool for a specific outcome
     * @param gameId Game identifier
     * @param suspectIndex Suspect index
     */
    function getOutcomePool(bytes32 gameId, uint8 suspectIndex) external view returns (uint256) {
        return outcomePools[gameId][suspectIndex];
    }

    /**
     * @notice Get all outcome pools for a market
     * @param gameId Game identifier
     * @return odds Array of pool sizes for each outcome
     */
    function getOdds(bytes32 gameId) external view returns (uint256[] memory) {
        uint8 playerCount = markets[gameId].playerCount;
        uint256[] memory odds = new uint256[](playerCount);
        for (uint8 i = 0; i < playerCount;) {
            odds[i] = outcomePools[gameId][i];
            unchecked { ++i; }
        }
        return odds;
    }

    /**
     * @notice Get emergency withdraw status
     * @return requested Whether emergency is requested
     * @return requestTime Time of request
     * @return unlockTime When withdrawal will be available
     */
    function getEmergencyStatus() external view returns (
        bool requested,
        uint256 requestTime,
        uint256 unlockTime
    ) {
        return (
            emergencyWithdrawRequested,
            emergencyWithdrawRequestTime,
            emergencyWithdrawRequested ? emergencyWithdrawRequestTime + EMERGENCY_DELAY : 0
        );
    }
}
