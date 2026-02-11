// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockPrescio
 * @notice Mock PRESCIO token for testnet testing
 */
contract MockPrescio is ERC20 {
    constructor() ERC20("Prescio Test", "tPRESCIO") {
        // Mint 1 billion tokens to deployer
        _mint(msg.sender, 1_000_000_000 * 1e18);
    }

    /// @notice Anyone can mint for testing
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
