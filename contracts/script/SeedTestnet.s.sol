// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {GreenwoodRouter} from "../src/periphery/GreenwoodRouter.sol";
import {LoxToken} from "../src/LoxToken.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @notice Faucet-budget seeding for public testnets: demo tokens, four
///         Hoards with tiny ETH liquidity, and a couple of swaps so the
///         UI and analytics are live. Total ETH spent ≈ 4 × ETH_PER_POOL
///         (default 0.005 ether) plus gas.
/// Env: ROUTER, LOX, WETH  (+ optional ETH_PER_POOL in wei, BOW for staking stream)
contract SeedTestnet is Script {
    uint256 constant DEADLINE = type(uint256).max;

    function run() external {
        GreenwoodRouter router = GreenwoodRouter(payable(vm.envAddress("ROUTER")));
        LoxToken lox = LoxToken(vm.envAddress("LOX"));
        address weth = vm.envAddress("WETH");
        uint256 ethPerPool = vm.envOr("ETH_PER_POOL", uint256(0.005 ether));
        address bow = vm.envOr("BOW", address(0));

        vm.startBroadcast();
        address me = msg.sender;

        MockERC20 gold = new MockERC20("Marian's Gold", "GOLD", 18);
        MockERC20 silver = new MockERC20("Sheriff's Silver", "SILV", 6);
        MockERC20 ale = new MockERC20("Friar's Ale", "ALE", 18);

        gold.mint(me, 1_000_000e18);
        silver.mint(me, 1_000_000e6);
        ale.mint(me, 1_000_000e18);
        lox.mint(me, 1_000_000e18);

        gold.approve(address(router), type(uint256).max);
        silver.approve(address(router), type(uint256).max);
        ale.approve(address(router), type(uint256).max);
        lox.approve(address(router), type(uint256).max);

        // pools priced as on the local demo: 1 ETH = 2000 GOLD = 3400 SILV = 10000 LOX
        router.addLiquidityETH{value: ethPerPool}(
            address(gold), ethPerPool * 2000, 0, 0, me, DEADLINE
        );
        router.addLiquidityETH{value: ethPerPool}(
            address(silver), ethPerPool * 3400 / 1e12, 0, 0, me, DEADLINE
        );
        router.addLiquidityETH{value: ethPerPool}(
            address(lox), ethPerPool * 10_000, 0, 0, me, DEADLINE
        );
        // GOLD/SILV: 1 GOLD = 1.7 SILV
        router.addLiquidity(
            address(gold), address(silver), 20_000e18, 34_000e6, 0, 0, me, DEADLINE
        );

        // a few tiny swaps so analytics and the Merry Men's chest are non-zero
        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = address(gold);
        router.swapExactETHForTokens{value: ethPerPool / 10}(0, path, me, DEADLINE);
        path[0] = address(gold);
        path[1] = address(silver);
        router.swapExactTokensForTokens(500e18, 0, path, me, DEADLINE);

        // trigger _mintFee so the treasury holds spoils immediately
        router.addLiquidityETH{value: ethPerPool / 20}(
            address(gold), ethPerPool * 100, 0, 0, me, DEADLINE
        );

        // fund the Drawing-the-Bow reward stream so staking APR is live
        if (bow != address(0)) {
            lox.mint(bow, 70_000e18);
            (bool ok,) = bow.call(abi.encodeWithSignature("notifyRewardAmount(uint256)", 70_000e18));
            require(ok, "Seed: BOW_NOTIFY_FAILED");
        }

        vm.stopBroadcast();

        console.log("GOLD:", address(gold));
        console.log("SILV:", address(silver));
        console.log("ALE: ", address(ale));

        string memory json = "seed";
        vm.serializeAddress(json, "gold", address(gold));
        vm.serializeAddress(json, "silver", address(silver));
        string memory out = vm.serializeAddress(json, "ale", address(ale));
        vm.writeJson(out, string.concat("./deployments/", vm.toString(block.chainid), ".tokens.json"));
    }
}
