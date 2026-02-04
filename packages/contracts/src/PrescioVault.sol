// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PrescioVault
 * @notice Collects protocol fees from PrescioMarket
 * @dev Owner can withdraw accumulated fees
 */
contract PrescioVault is Ownable, ReentrancyGuard {
    // ============================================
    // Events
    // ============================================

    event FeesReceived(uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ============================================
    // Errors
    // ============================================

    error TransferFailed();
    error NoFees();

    // ============================================
    // Constructor
    // ============================================

    constructor() Ownable(msg.sender) {}

    // ============================================
    // Core Functions
    // ============================================

    /**
     * @notice Withdraw all accumulated fees
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFees();

        (bool success,) = payable(owner()).call{value: balance}("");
        if (!success) revert TransferFailed();

        emit FeesWithdrawn(owner(), balance);
    }

    /**
     * @notice Withdraw fees to a specific address
     */
    function withdrawFeesTo(address to) external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFees();

        (bool success,) = payable(to).call{value: balance}("");
        if (!success) revert TransferFailed();

        emit FeesWithdrawn(to, balance);
    }

    /**
     * @notice Get current fee balance
     */
    function feeBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {
        emit FeesReceived(msg.value);
    }
}
