// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PrescioVaultV2
 * @author Prescio Team
 * @notice Collects protocol fees from PrescioMarket
 * @dev Owner can withdraw accumulated fees
 * 
 * V2 Security Fixes:
 * - Zero address validation in withdrawFeesTo
 * - Code deduplication with internal _withdraw function
 * - Better error messages
 */
contract PrescioVaultV2 is Ownable, ReentrancyGuard {
    // ============================================
    // Events
    // ============================================

    event FeesReceived(address indexed from, uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ============================================
    // Errors
    // ============================================

    error TransferFailed();
    error NoFees();
    error ZeroAddress();

    // ============================================
    // Constructor
    // ============================================

    constructor() Ownable(msg.sender) {}

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
