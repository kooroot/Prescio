// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IPrescioStaking
 * @dev Interface for staking contract reward deposit
 */
interface IPrescioStaking {
    function depositRewardsFromVault() external payable;
}

/**
 * @title PrescioVault
 * @author Prescio Team
 * @notice Collects protocol fees from PrescioMarket and distributes to Treasury, Staking, and Development
 * @dev 3-way fee distribution with configurable ratios
 * 
 * Security Features:
 * - Zero address validation on all address setters
 * - ReentrancyGuard protection on all distribution functions
 * - Ratio sum validation (must equal 100%)
 * - Staking integration via depositRewardsFromVault
 * 
 * v3.0 - 3-Way Distribution:
 * - Treasury address for protocol reserve
 * - Staking contract for user rewards
 * - Development address for ongoing development
 * - Configurable ratios that must sum to 100%
 * - Backward compatible with V2 receive() and withdrawFees()
 */
contract PrescioVault is Ownable, ReentrancyGuard {
    // ============================================
    // Constants
    // ============================================

    uint256 public constant VERSION = 3;
    uint256 public constant RATIO_PRECISION = 10000; // 100% = 10000

    // ============================================
    // State Variables
    // ============================================

    /// @notice Treasury address for protocol reserve
    address public treasuryAddress;
    
    /// @notice Staking contract address for reward distribution
    address public stakingContract;
    
    /// @notice Development address for ongoing development funding
    address public developmentAddress;

    /// @notice Distribution ratio to treasury (5000 = 50%)
    uint256 public treasuryRatio;
    
    /// @notice Distribution ratio to staking (3000 = 30%)
    uint256 public stakingRatio;
    
    /// @notice Distribution ratio to development (2000 = 20%)
    uint256 public developmentRatio;

    // ============================================
    // Events
    // ============================================

    event FeesReceived(address indexed from, uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event FeesDistributed(uint256 toTreasury, uint256 toStaking, uint256 toDevelopment);
    event DistributionRatiosUpdated(uint256 treasuryRatio, uint256 stakingRatio, uint256 developmentRatio);
    event TreasuryAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event StakingContractUpdated(address indexed oldAddress, address indexed newAddress);
    event DevelopmentAddressUpdated(address indexed oldAddress, address indexed newAddress);

    // ============================================
    // Errors
    // ============================================

    error TransferFailed();
    error NoFees();
    error ZeroAddress();
    error InvalidRatioSum();
    error AddressNotSet();

    // ============================================
    // Constructor
    // ============================================

    /**
     * @notice Initialize the vault with default addresses and ratios
     * @param _treasury Treasury address (50%)
     * @param _staking Staking contract address (30%)
     * @param _development Development address (20%)
     */
    constructor(
        address _treasury,
        address _staking,
        address _development
    ) Ownable(msg.sender) {
        if (_treasury == address(0)) revert ZeroAddress();
        if (_staking == address(0)) revert ZeroAddress();
        if (_development == address(0)) revert ZeroAddress();

        treasuryAddress = _treasury;
        stakingContract = _staking;
        developmentAddress = _development;

        // Default ratios as per spec: 50/30/20
        treasuryRatio = 5000;
        stakingRatio = 3000;
        developmentRatio = 2000;

        emit TreasuryAddressUpdated(address(0), _treasury);
        emit StakingContractUpdated(address(0), _staking);
        emit DevelopmentAddressUpdated(address(0), _development);
        emit DistributionRatiosUpdated(5000, 3000, 2000);
    }

    // ============================================
    // Distribution Functions
    // ============================================

    /**
     * @notice Distribute all accumulated fees according to configured ratios
     * @dev Splits balance: Treasury -> Staking -> Development (remainder)
     */
    function distributeAll() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFees();
        if (treasuryAddress == address(0)) revert AddressNotSet();
        if (stakingContract == address(0)) revert AddressNotSet();
        if (developmentAddress == address(0)) revert AddressNotSet();

        uint256 toTreasury = (balance * treasuryRatio) / RATIO_PRECISION;
        uint256 toStaking = (balance * stakingRatio) / RATIO_PRECISION;
        uint256 toDevelopment = balance - toTreasury - toStaking; // Remainder to avoid rounding loss

        // Transfer to Treasury
        if (toTreasury > 0) {
            (bool success,) = payable(treasuryAddress).call{value: toTreasury}("");
            if (!success) revert TransferFailed();
        }

        // Transfer to Staking via depositRewardsFromVault
        if (toStaking > 0) {
            IPrescioStaking(stakingContract).depositRewardsFromVault{value: toStaking}();
        }

        // Transfer to Development
        if (toDevelopment > 0) {
            (bool success,) = payable(developmentAddress).call{value: toDevelopment}("");
            if (!success) revert TransferFailed();
        }

        emit FeesDistributed(toTreasury, toStaking, toDevelopment);
    }

    // ============================================
    // Address Setters
    // ============================================

    /**
     * @notice Set the treasury address
     * @param _treasury New treasury address
     */
    function setTreasuryAddress(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        emit TreasuryAddressUpdated(treasuryAddress, _treasury);
        treasuryAddress = _treasury;
    }

    /**
     * @notice Set the staking contract address
     * @param _staking New staking contract address
     */
    function setStakingContract(address _staking) external onlyOwner {
        if (_staking == address(0)) revert ZeroAddress();
        emit StakingContractUpdated(stakingContract, _staking);
        stakingContract = _staking;
    }

    /**
     * @notice Set the development address
     * @param _development New development address
     */
    function setDevelopmentAddress(address _development) external onlyOwner {
        if (_development == address(0)) revert ZeroAddress();
        emit DevelopmentAddressUpdated(developmentAddress, _development);
        developmentAddress = _development;
    }

    // ============================================
    // Ratio Setters
    // ============================================

    /**
     * @notice Set all distribution ratios at once
     * @param _treasuryRatio Treasury ratio (basis points)
     * @param _stakingRatio Staking ratio (basis points)
     * @param _developmentRatio Development ratio (basis points)
     * @dev Sum of all ratios must equal RATIO_PRECISION (10000)
     */
    function setDistributionRatios(
        uint256 _treasuryRatio,
        uint256 _stakingRatio,
        uint256 _developmentRatio
    ) external onlyOwner {
        if (_treasuryRatio + _stakingRatio + _developmentRatio != RATIO_PRECISION) {
            revert InvalidRatioSum();
        }

        treasuryRatio = _treasuryRatio;
        stakingRatio = _stakingRatio;
        developmentRatio = _developmentRatio;

        emit DistributionRatiosUpdated(_treasuryRatio, _stakingRatio, _developmentRatio);
    }

    // ============================================
    // V2 Compatibility Functions
    // ============================================

    /**
     * @notice Withdraw all accumulated fees to owner (V2 compatibility)
     * @dev For emergency use or migration
     */
    function withdrawFees() external onlyOwner nonReentrant {
        _withdrawTo(owner());
    }

    /**
     * @notice Withdraw fees to a specific address (V2 compatibility)
     * @param to Destination address
     */
    function withdrawFeesTo(address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        _withdrawTo(to);
    }

    // ============================================
    // View Functions
    // ============================================

    /**
     * @notice Get current fee balance
     * @return Current balance of the vault
     */
    function feeBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get contract version
     * @return Version number
     */
    function getVersion() external pure returns (uint256) {
        return VERSION;
    }

    /**
     * @notice Get all distribution ratios
     * @return treasury Treasury ratio
     * @return staking Staking ratio
     * @return development Development ratio
     */
    function getDistributionRatios() external view returns (
        uint256 treasury,
        uint256 staking,
        uint256 development
    ) {
        return (treasuryRatio, stakingRatio, developmentRatio);
    }

    /**
     * @notice Get all distribution addresses
     * @return treasury Treasury address
     * @return staking Staking contract address
     * @return development Development address
     */
    function getDistributionAddresses() external view returns (
        address treasury,
        address staking,
        address development
    ) {
        return (treasuryAddress, stakingContract, developmentAddress);
    }

    /**
     * @notice Preview distribution amounts for current balance
     * @return toTreasury Amount that would go to treasury
     * @return toStaking Amount that would go to staking
     * @return toDevelopment Amount that would go to development
     */
    function previewDistribution() external view returns (
        uint256 toTreasury,
        uint256 toStaking,
        uint256 toDevelopment
    ) {
        uint256 balance = address(this).balance;
        toTreasury = (balance * treasuryRatio) / RATIO_PRECISION;
        toStaking = (balance * stakingRatio) / RATIO_PRECISION;
        toDevelopment = balance - toTreasury - toStaking;
    }

    // ============================================
    // Internal Functions
    // ============================================

    /**
     * @dev Internal function to handle withdrawal logic
     * @param to Destination address
     */
    function _withdrawTo(address to) private {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFees();

        (bool success,) = payable(to).call{value: balance}("");
        if (!success) revert TransferFailed();

        emit FeesWithdrawn(to, balance);
    }

    // ============================================
    // Receive
    // ============================================

    /**
     * @notice Receive ETH from market contract
     */
    receive() external payable {
        emit FeesReceived(msg.sender, msg.value);
    }
}
