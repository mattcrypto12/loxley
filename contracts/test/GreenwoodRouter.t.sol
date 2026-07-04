// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LoxleyFactory} from "../src/core/LoxleyFactory.sol";
import {LoxleyPair} from "../src/core/LoxleyPair.sol";
import {GreenwoodRouter} from "../src/periphery/GreenwoodRouter.sol";
import {MerryMenShare} from "../src/MerryMenShare.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {WETH9} from "../src/mocks/WETH9.sol";

contract GreenwoodRouterTest is Test {
    LoxleyFactory factory;
    GreenwoodRouter router;
    MerryMenShare share;
    WETH9 weth;
    MockERC20 gold; // "Marian's Gold"
    MockERC20 silver;

    address alice = makeAddr("alice");
    uint256 constant DEADLINE = type(uint256).max;

    function setUp() public {
        factory = new LoxleyFactory(address(this));
        weth = new WETH9();
        router = new GreenwoodRouter(address(factory), address(weth));
        share = new MerryMenShare(1 ether);
        share.setRouter(address(router));
        router.setMerryMenShare(address(share));
        factory.setFeeTo(address(share));

        gold = new MockERC20("Marian's Gold", "GOLD", 18);
        silver = new MockERC20("Sheriff's Silver", "SILV", 18);

        gold.mint(alice, 10_000e18);
        silver.mint(alice, 10_000e18);
        vm.deal(alice, 100 ether);
        vm.startPrank(alice);
        gold.approve(address(router), type(uint256).max);
        silver.approve(address(router), type(uint256).max);
        vm.stopPrank();
    }

    function _seedGoldSilver() internal {
        vm.prank(alice);
        router.addLiquidity(address(gold), address(silver), 1000e18, 1000e18, 0, 0, alice, DEADLINE);
    }

    function test_addLiquidity_createsPairAndMints() public {
        vm.prank(alice);
        (uint256 aA, uint256 aB, uint256 liq) =
            router.addLiquidity(address(gold), address(silver), 100e18, 400e18, 0, 0, alice, DEADLINE);
        assertEq(aA, 100e18);
        assertEq(aB, 400e18);
        assertEq(liq, 200e18 - 1000);
        assertTrue(factory.getHoard(address(gold), address(silver)) != address(0));
    }

    function test_addLiquidity_respectsRatioAndMins() public {
        _seedGoldSilver();
        // pool is 1:1; adding 100:200 pairs as 100:100, so a min-B of 150 must revert
        vm.prank(alice);
        vm.expectRevert(bytes("Greenwood: INSUFFICIENT_B_AMOUNT"));
        router.addLiquidity(address(gold), address(silver), 100e18, 200e18, 100e18, 150e18, alice, DEADLINE);
    }

    function test_deadline_reverts() public {
        vm.warp(1000);
        vm.prank(alice);
        vm.expectRevert(bytes("Greenwood: EXPIRED"));
        router.addLiquidity(address(gold), address(silver), 1e18, 1e18, 0, 0, alice, 999);
    }

    function test_swapExactTokensForTokens() public {
        _seedGoldSilver();
        address[] memory path = new address[](2);
        path[0] = address(gold);
        path[1] = address(silver);

        uint256 balBefore = silver.balanceOf(alice);
        vm.prank(alice);
        uint256[] memory amounts = router.swapExactTokensForTokens(10e18, 0, path, alice, DEADLINE);
        assertEq(silver.balanceOf(alice) - balBefore, amounts[1]);
        // 10 * 997 * 1000 / (1000*1000 + 10*997)
        assertEq(amounts[1], uint256(10e18) * 997 * 1000e18 / (1000e18 * 1000 + uint256(10e18) * 997) * 1);
    }

    function test_swap_slippageProtection() public {
        _seedGoldSilver();
        address[] memory path = new address[](2);
        path[0] = address(gold);
        path[1] = address(silver);
        vm.prank(alice);
        vm.expectRevert(bytes("Greenwood: INSUFFICIENT_OUTPUT_AMOUNT"));
        router.swapExactTokensForTokens(10e18, 100e18, path, alice, DEADLINE);
    }

    function test_swapTokensForExactTokens_inputCap() public {
        _seedGoldSilver();
        address[] memory path = new address[](2);
        path[0] = address(gold);
        path[1] = address(silver);
        vm.prank(alice);
        vm.expectRevert(bytes("Greenwood: EXCESSIVE_INPUT_AMOUNT"));
        router.swapTokensForExactTokens(10e18, 1e18, path, alice, DEADLINE);
    }

    function test_swapETH_roundTrip() public {
        // seed WETH/GOLD pool with ETH
        vm.prank(alice);
        router.addLiquidityETH{value: 10 ether}(address(gold), 1000e18, 0, 0, alice, DEADLINE);

        address[] memory path = new address[](2);
        path[0] = address(weth);
        path[1] = address(gold);

        uint256 goldBefore = gold.balanceOf(alice);
        vm.prank(alice);
        router.swapExactETHForTokens{value: 1 ether}(0, path, alice, DEADLINE);
        uint256 gained = gold.balanceOf(alice) - goldBefore;
        assertGt(gained, 0);

        // and back: tokens -> ETH
        path[0] = address(gold);
        path[1] = address(weth);
        uint256 ethBefore = alice.balance;
        vm.prank(alice);
        router.swapExactTokensForETH(gained, 0, path, alice, DEADLINE);
        assertGt(alice.balance, ethBefore);
    }

    function test_multiHopSwap() public {
        _seedGoldSilver();
        vm.prank(alice);
        router.addLiquidityETH{value: 10 ether}(address(silver), 1000e18, 0, 0, alice, DEADLINE);

        // gold -> silver -> weth
        address[] memory path = new address[](3);
        path[0] = address(gold);
        path[1] = address(silver);
        path[2] = address(weth);

        vm.prank(alice);
        uint256[] memory amounts = router.swapExactTokensForTokens(10e18, 0, path, alice, DEADLINE);
        assertEq(amounts.length, 3);
        assertGt(amounts[2], 0);
    }

    function test_removeLiquidity_full() public {
        vm.startPrank(alice);
        (,, uint256 liq) = router.addLiquidity(address(gold), address(silver), 100e18, 100e18, 0, 0, alice, DEADLINE);
        LoxleyPair pair = LoxleyPair(factory.getHoard(address(gold), address(silver)));
        pair.approve(address(router), liq);
        (uint256 outA, uint256 outB) =
            router.removeLiquidity(address(gold), address(silver), liq, 0, 0, alice, DEADLINE);
        vm.stopPrank();
        assertApproxEqAbs(outA, 100e18, 2000);
        assertApproxEqAbs(outB, 100e18, 2000);
    }

    function test_removeLiquidityETH() public {
        vm.startPrank(alice);
        (,, uint256 liq) = router.addLiquidityETH{value: 5 ether}(address(gold), 500e18, 0, 0, alice, DEADLINE);
        LoxleyPair pair = LoxleyPair(factory.getHoard(address(gold), address(weth)));
        pair.approve(address(router), liq);
        uint256 ethBefore = alice.balance;
        (, uint256 outETH) = router.removeLiquidityETH(address(gold), liq, 0, 0, alice, DEADLINE);
        vm.stopPrank();
        assertEq(alice.balance - ethBefore, outETH);
        assertApproxEqAbs(outETH, 5 ether, 1e15);
    }

    function test_activityRecorded_onSwapAndLiquidity() public {
        assertEq(share.points(share.currentEpoch(), alice), 0);
        _seedGoldSilver(); // addLiquidity -> 1 point
        assertEq(share.points(share.currentEpoch(), alice), 1);

        address[] memory path = new address[](2);
        path[0] = address(gold);
        path[1] = address(silver);
        vm.prank(alice);
        router.swapExactTokensForTokens(1e18, 0, path, alice, DEADLINE); // swap -> 1 point
        assertEq(share.points(share.currentEpoch(), alice), 2);
        assertEq(share.lastActive(alice), block.timestamp);
    }
}
