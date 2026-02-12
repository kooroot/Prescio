// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PrescioVault.sol";

contract DeployVaultV3 is Script {
    function run() external {
        // Addresses from spec
        address treasury = 0x0094f42BF79B7ACC942624A9173fa0ED7554d300;
        address staking = 0xB835F850E26809Ac18032dA45c207bB8859481a7;
        address development = 0x001436D283C6eC27F555c25dD045a6A57B5A4BE2;

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        PrescioVault vault = new PrescioVault(
            treasury,
            staking,
            development
        );
        
        vm.stopBroadcast();
        
        console.log("PrescioVault deployed to:", address(vault));
        console.log("Treasury:", treasury);
        console.log("Staking:", staking);
        console.log("Development:", development);
    }
}
