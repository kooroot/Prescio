// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PrescioVault
 * @notice Vault for managing user deposits and withdrawals on Monad
 * @dev Users deposit MON to participate in prediction markets
 */
contract PrescioVault {
    // ============================================
    // State
    // ============================================

    address public owner;
    address public marketContract;
    mapping(address => uint256) public balances;
    uint256 public totalDeposits;

    // ============================================
    // Events
    // ============================================

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event MarketContractUpdated(address indexed newMarketContract);

    // ============================================
    // Errors
    // ============================================

    error Unauthorized();
    error InsufficientBalance();
    error ZeroAmount();
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

    constructor() {
        owner = msg.sender;
    }

    // ============================================
    // Core Functions
    // ============================================

    /**
     * @notice Deposit MON into the vault
     */
    function deposit() external payable {
        if (msg.value == 0) revert ZeroAmount();

        balances[msg.sender] += msg.value;
        totalDeposits += msg.value;

        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw MON from the vault
     * @param amount Amount to withdraw in wei
     */
    function withdraw(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (balances[msg.sender] < amount) revert InsufficientBalance();

        balances[msg.sender] -= amount;
        totalDeposits -= amount;

        (bool success, ) = payable(msg.sender).call{ value: amount }("");
        if (!success) revert TransferFailed();

        emit Withdrawn(msg.sender, amount);
    }

    // ============================================
    // View Functions
    // ============================================

    /**
     * @notice Get the balance of an account
     */
    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }

    // ============================================
    // Admin Functions
    // ============================================

    function setMarketContract(address _marketContract) external onlyOwner {
        marketContract = _marketContract;
        emit MarketContractUpdated(_marketContract);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    receive() external payable {
        balances[msg.sender] += msg.value;
        totalDeposits += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
}
