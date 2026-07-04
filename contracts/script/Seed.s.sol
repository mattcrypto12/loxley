// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LoxleyFactory} from "../src/core/LoxleyFactory.sol";
import {GreenwoodRouter} from "../src/periphery/GreenwoodRouter.sol";
import {LoxToken} from "../src/LoxToken.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @notice Seeds a freshly deployed Loxley with themed demo tokens, Hoards,
///         liquidity, and a burst of swaps so analytics and the Merry Men's
///         Share have real on-chain history. Local/testnet only.
/// Env: FACTORY, ROUTER, LOX, WETH — from the Deploy run's JSON.
contract Seed is Script {
    uint256 constant DEADLINE = type(uint256).max;

    function run() external {
        LoxleyFactory factory = LoxleyFactory(vm.envAddress("FACTORY"));
        GreenwoodRouter router = GreenwoodRouter(payable(vm.envAddress("ROUTER")));
        LoxToken lox = LoxToken(vm.envAddress("LOX"));
        address weth = vm.envAddress("WETH");

        vm.startBroadcast();
        address me = msg.sender;

        // ---- themed demo tokens ----
        MockERC20 gold = new MockERC20("Marian's Gold", "GOLD", 18);
        MockERC20 silver = new MockERC20("Sheriff's Silver", "SILV", 6);
        MockERC20 ale = new MockERC20("Friar's Ale", "ALE", 18);

        gold.mint(me, 10_000_000e18);
        silver.mint(me, 10_000_000e6);
        ale.mint(me, 10_000_000e18);
        lox.mint(me, 5_000_000e18);

        // fund the web demo wallet (anvil account #1) with pocket money
        address demoWallet = vm.envOr("DEMO_WALLET", address(0));
        if (demoWallet != address(0)) {
            gold.mint(demoWallet, 25_000e18);
            silver.mint(demoWallet, 40_000e6);
            ale.mint(demoWallet, 60_000e18);
            lox.mint(demoWallet, 80_000e18);
        }

        gold.approve(address(router), type(uint256).max);
        silver.approve(address(router), type(uint256).max);
        ale.approve(address(router), type(uint256).max);
        lox.approve(address(router), type(uint256).max);

        // ---- Hoards + liquidity ----
        // ETH/GOLD: 1 ETH = 2,000 GOLD
        router.addLiquidityETH{value: 40 ether}(address(gold), 80_000e18, 0, 0, me, DEADLINE);
        // ETH/SILV: 1 ETH = 3,400 SILV (SILV as a USDC-like 6-decimal stable)
        router.addLiquidityETH{value: 30 ether}(address(silver), 102_000e6, 0, 0, me, DEADLINE);
        // ETH/LOX: 1 ETH = 10,000 LOX
        router.addLiquidityETH{value: 25 ether}(address(lox), 250_000e18, 0, 0, me, DEADLINE);
        // GOLD/SILV: 1 GOLD = 1.7 SILV
        router.addLiquidity(address(gold), address(silver), 120_000e18, 204_000e6, 0, 0, me, DEADLINE);
        // ALE/GOLD: 1 GOLD = 8 ALE
        router.addLiquidity(address(ale), address(gold), 400_000e18, 50_000e18, 0, 0, me, DEADLINE);

        // ---- demo volume: a burst of swaps in both directions ----
        address[] memory path = new address[](2);
        for (uint256 i = 1; i <= 8; i++) {
            path[0] = weth;
            path[1] = address(gold);
            router.swapExactETHForTokens{value: (0.2 ether) * i}(0, path, me, DEADLINE);

            path[0] = address(gold);
            path[1] = address(silver);
            router.swapExactTokensForTokens(150e18 * i, 0, path, me, DEADLINE);

            path[0] = address(silver);
            path[1] = weth;
            router.swapExactTokensForETH(180e6 * i, 0, path, me, DEADLINE);

            path[0] = address(ale);
            path[1] = address(gold);
            router.swapExactTokensForTokens(900e18 * i, 0, path, me, DEADLINE);

            path[0] = weth;
            path[1] = address(lox);
            router.swapExactETHForTokens{value: 0.15 ether * i}(0, path, me, DEADLINE);
        }

        // small top-ups after the volume burst: each mint triggers _mintFee,
        // so the Merry Men's Share visibly holds LP spoils immediately
        router.addLiquidityETH{value: 0.5 ether}(address(gold), 1_000e18, 0, 0, me, DEADLINE);
        router.addLiquidityETH{value: 0.5 ether}(address(silver), 1_700e6, 0, 0, me, DEADLINE);
        router.addLiquidityETH{value: 0.5 ether}(address(lox), 5_000e18, 0, 0, me, DEADLINE);
        router.addLiquidity(address(gold), address(silver), 1_000e18, 1_700e6, 0, 0, me, DEADLINE);
        router.addLiquidity(address(ale), address(gold), 8_000e18, 1_000e18, 0, 0, me, DEADLINE);

        vm.stopBroadcast();

        console.log("GOLD:", address(gold));
        console.log("SILV:", address(silver));
        console.log("ALE: ", address(ale));
        console.log("Hoards:", factory.allHoardsLength());

        string memory json = "seed";
        vm.serializeAddress(json, "gold", address(gold));
        vm.serializeAddress(json, "silver", address(silver));
        string memory out = vm.serializeAddress(json, "ale", address(ale));
        vm.writeJson(out, string.concat("./deployments/", vm.toString(block.chainid), ".tokens.json"));
    }
}
