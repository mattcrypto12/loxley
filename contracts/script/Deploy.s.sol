// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LoxleyFactory} from "../src/core/LoxleyFactory.sol";
import {GreenwoodRouter} from "../src/periphery/GreenwoodRouter.sol";
import {MerryMenShare} from "../src/MerryMenShare.sol";
import {LoxToken} from "../src/LoxToken.sol";
import {BowStaking} from "../src/BowStaking.sol";
import {WETH9} from "../src/mocks/WETH9.sol";

/// @notice Deploys the full Loxley protocol.
/// Env:
///   WETH_ADDRESS       — existing WETH on the target chain (deploys WETH9 if unset; local/test only)
///   WEALTH_THRESHOLD   — Merry Men eligibility ceiling in wei (default 1 ether)
contract Deploy is Script {
    function run() external {
        uint256 wealthThreshold = vm.envOr("WEALTH_THRESHOLD", uint256(1 ether));
        address weth = vm.envOr("WETH_ADDRESS", address(0));

        vm.startBroadcast();

        if (weth == address(0)) {
            weth = address(new WETH9());
            console.log("WETH9 (mock) deployed:", weth);
        }

        LoxleyFactory factory = new LoxleyFactory(msg.sender);
        GreenwoodRouter router = new GreenwoodRouter(address(factory), weth);
        MerryMenShare share = new MerryMenShare(wealthThreshold);
        LoxToken lox = new LoxToken();
        BowStaking bow = new BowStaking(address(lox));

        // wire the fee redistribution loop
        share.setRouter(address(router));
        share.setFactory(address(factory)); // only real Hoard LP as rewards
        router.setMerryMenShare(address(share));
        factory.setFeeTo(address(share));

        vm.stopBroadcast();

        console.log("chainId:            ", block.chainid);
        console.log("LoxleyFactory:      ", address(factory));
        console.log("GreenwoodRouter:    ", address(router));
        console.log("MerryMenShare:      ", address(share));
        console.log("LoxToken:           ", address(lox));
        console.log("BowStaking:         ", address(bow));
        console.log("WETH:               ", weth);

        // machine-readable deployment record for the web app
        string memory json = "deployment";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "factory", address(factory));
        vm.serializeAddress(json, "router", address(router));
        vm.serializeAddress(json, "merryMenShare", address(share));
        vm.serializeAddress(json, "lox", address(lox));
        vm.serializeAddress(json, "bowStaking", address(bow));
        string memory out = vm.serializeAddress(json, "weth", weth);
        vm.writeJson(out, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}
