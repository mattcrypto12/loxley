// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LoxleyFactory} from "../src/core/LoxleyFactory.sol";
import {SpoilsSplitter} from "../src/SpoilsSplitter.sol";

/// @notice In-place upgrade for an existing deployment: deploy the
///         SpoilsSplitter and repoint the factory's feeTo at it. Cheap —
///         no redeploy or reseed of anything else.
/// Env: FACTORY, SHARE  (+ optional TREASURY, MERRY_BPS)
contract AddSplitter is Script {
    function run() external {
        LoxleyFactory factory = LoxleyFactory(vm.envAddress("FACTORY"));
        address share = vm.envAddress("SHARE");

        vm.startBroadcast();
        address guildTreasury = vm.envOr("TREASURY", msg.sender);
        uint256 merryBps = vm.envOr("MERRY_BPS", uint256(5_000));
        SpoilsSplitter splitter = new SpoilsSplitter(share, guildTreasury, merryBps);
        factory.setFeeTo(address(splitter));
        vm.stopBroadcast();

        console.log("SpoilsSplitter:", address(splitter));
        console.log("guild treasury:", guildTreasury);
        console.log("merryMenBps:   ", merryBps);
    }
}
