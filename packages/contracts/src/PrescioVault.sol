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
 * @notice Collects protocol fees from PrescioMarket and distributes to Staking
 * @dev Owner can withdraw accumulated fees or distribute to staking contract
 * 
 * Security Features:
 * - Zero address validation in withdrawFeesTo
 * - Code deduplication with internal _withdraw function
 * - ReentrancyGuard protection
 * - Staking integration for automated reward distribution
 * 
 * v2.0 - Staking Integration:
 * - Added stakingContract address storage
 * - distributeToStaking(amount) for partial distribution
 * - distributeAllToStaking() for full distribution
 * - Distribution ratio support for flexible treasury management
 */
contract PrescioVault is Ownable, ReentrancyGuard {
    // ============================================
    // Constants
    // ============================================

    uint256 public constant VERSION = 2;
    uint256 public constant RATIO_PRECISION = 10000; // 100% = 10000

    // ============================================
    // State Variables
    // ============================================

    /// @notice Staking contract address for reward distribution
    address public stakingContract;
    
    /// @notice Distribution ratio to staking (default 10000 = 100%)
    /// @dev Remaining goes to treasury (owner withdrawal)
    uint256 public stakingDistributionRatio;

    // ============================================
    // Events
    // ============================================

    event FeesReceived(address indexed from, uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event StakingContractUpdated(address indexed oldStaking, address indexed newStaking);
    event DistributedToStaking(address indexed staking, uint256 amount);
    event DistributionRatioUpdated(uint256 oldRatio, uint256 newRatio);

    // ============================================
    // Errors
    // ============================================

    error TransferFailed();
    error NoFees();
    error ZeroAddress();
    error StakingNotSet();
    error InsufficientBalance();
    error InvalidRatio();

    // ============================================
    // Constructor
    // ============================================

    constructor() Ownable(msg.sender) {
        stakingDistributionRatio = RATIO_PRECISION; // Default 100% to staking
    }

    // ============================================
    // Staking Distribution Functions
    // ============================================

    /**
     * @notice Set the staking contract address
     * @param _stakingContract Address of the staking contract
     */
    function setStakingContract(address _stakingContract) external onlyOwner {
        if (_stakingContract == address(0)) revert ZeroAddress();
        emit StakingContractUpdated(stakingContract, _stakingContract);
        stakingContract = _stakingContract;
    }

    /**
     * @notice Set the distribution ratio to staking
     * @param _ratio Ratio in basis points (10000 = 100%)
     * @dev Remaining balance can be withdrawn to treasury via withdrawFees
     */
    function setDistributionRatio(uint256 _ratio) external onlyOwner {
        if (_ratio > RATIO_PRECISION) revert InvalidRatio();
        emit DistributionRatioUpdated(stakingDistributionRatio, _ratio);
        stakingDistributionRatio = _ratio;
    }

    /**
     * @notice Distribute a specific amount to staking contract
     * @param amount Amount to distribute (in wei)
     */
    function distributeToStaking(uint256 amount) external onlyOwner nonReentrant {
        if (stakingContract == address(0)) revert StakingNotSet();
        if (amount == 0) revert NoFees();
        if (amount > address(this).balance) revert InsufficientBalance();

        IPrescioStaking(stakingContract).depositRewardsFromVault{value: amount}();
        
        emit DistributedToStaking(stakingContract, amount);
    }

    /**
     * @notice Distribute all balance to staking contract
     * @dev Uses stakingDistributionRatio to determine actual amount
     */
    function distributeAllToStaking() external onlyOwner nonReentrant {
        if (stakingContract == address(0)) revert StakingNotSet();
        
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFees();

        uint256 toStaking = (balance * stakingDistributionRatio) / RATIO_PRECISION;
        if (toStaking == 0) revert NoFees();

        IPrescioStaking(stakingContract).depositRewardsFromVault{value: toStaking}();
        
        emit DistributedToStaking(stakingContract, toStaking);
    }

    /**
     * @notice Distribute based on ratio and withdraw remainder to treasury
     * @dev Convenience function: distribute to staking + withdraw remainder in one TX
     */
    function distributeAndWithdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFees();

        uint256 toStaking = 0;
        uint256 toTreasury = balance;

        // Distribute to staking if configured
        if (stakingContract != address(0) && stakingDistributionRatio > 0) {
            toStaking = (balance * stakingDistributionRatio) / RATIO_PRECISION;
            toTreasury = balance - toStaking;

            if (toStaking > 0) {
                IPrescioStaking(stakingContract).depositRewardsFromVault{value: toStaking}();
                emit DistributedToStaking(stakingContract, toStaking);
            }
        }

        // Withdraw remainder to owner
        if (toTreasury > 0) {
            (bool success,) = payable(owner()).call{value: toTreasury}("");
            if (!success) revert TransferFailed();
            emit FeesWithdrawn(owner(), toTreasury);
        }
    }

    // ============================================
    // Core Functions
    // ============================================

    /**
     * @notice Withdraw all accumulated fees to owner
     */
    function withdrawFees() external onlyOwner nonReentrant {
        _withdrawTo(owner());
    }

    /**
     * @notice Withdraw fees to a specific address
     * @param to Destination address
     */
    function withdrawFeesTo(address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        _withdrawTo(to);
    }

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
