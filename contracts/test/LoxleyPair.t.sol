// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LoxleyFactory} from "../src/core/LoxleyFactory.sol";
import {LoxleyPair} from "../src/core/LoxleyPair.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract LoxleyPairTest is Test {
    LoxleyFactory factory;
    MockERC20 tokenA;
    MockERC20 tokenB;
    LoxleyPair pair;
    address token0;
    address token1;

    address alice = makeAddr("alice");
    address treasury = makeAddr("treasury");

    function setUp() public {
        factory = new LoxleyFactory(address(this));
        tokenA = new MockERC20("Token A", "TKA", 18);
        tokenB = new MockERC20("Token B", "TKB", 18);
        pair = LoxleyPair(factory.createHoard(address(tokenA), address(tokenB)));
        token0 = pair.token0();
        token1 = pair.token1();
    }

    function _addLiquidity(uint256 amount0, uint256 amount1, address to) internal returns (uint256 liq) {
        MockERC20(token0).mint(address(pair), amount0);
        MockERC20(token1).mint(address(pair), amount1);
        liq = pair.mint(to);
    }

    function test_createHoard_registry() public view {
        assertEq(factory.allHoardsLength(), 1);
        assertEq(factory.getHoard(address(tokenA), address(tokenB)), address(pair));
        assertEq(factory.getHoard(address(tokenB), address(tokenA)), address(pair));
    }

    function test_createHoard_duplicateReverts() public {
        vm.expectRevert(bytes("Loxley: HOARD_EXISTS"));
        factory.createHoard(address(tokenA), address(tokenB));
        vm.expectRevert(bytes("Loxley: HOARD_EXISTS"));
        factory.createHoard(address(tokenB), address(tokenA));
    }

    function test_mint_initialLiquidity() public {
        uint256 liq = _addLiquidity(1e18, 4e18, alice);
        // sqrt(1e18 * 4e18) = 2e18, minus MINIMUM_LIQUIDITY
        assertEq(liq, 2e18 - 1000);
        assertEq(pair.balanceOf(alice), 2e18 - 1000);
        assertEq(pair.totalSupply(), 2e18);
        (uint112 r0, uint112 r1,) = pair.getReserves();
        assertEq(uint256(r0), 1e18);
        assertEq(uint256(r1), 4e18);
    }

    function test_swap_respectsK() public {
        _addLiquidity(10e18, 10e18, alice);
        // swap 1 token0 in: out = 1e18*997*10e18 / (10e18*1000 + 1e18*997)
        uint256 expectedOut = uint256(1e18) * 997 * 10e18 / (10e18 * 1000 + uint256(1e18) * 997);
        MockERC20(token0).mint(address(pair), 1e18);
        pair.swap(0, expectedOut, alice, "");
        assertEq(MockERC20(token1).balanceOf(alice), expectedOut);
    }

    function test_swap_revertsAboveK() public {
        _addLiquidity(10e18, 10e18, alice);
        uint256 expectedOut = uint256(1e18) * 997 * 10e18 / (10e18 * 1000 + uint256(1e18) * 997);
        MockERC20(token0).mint(address(pair), 1e18);
        vm.expectRevert(bytes("Loxley: K"));
        pair.swap(0, expectedOut + 1, alice, "");
    }

    function test_swap_zeroOutputReverts() public {
        _addLiquidity(10e18, 10e18, alice);
        vm.expectRevert(bytes("Loxley: INSUFFICIENT_OUTPUT_AMOUNT"));
        pair.swap(0, 0, alice, "");
    }

    function test_burn_returnsProRata() public {
        uint256 liq = _addLiquidity(3e18, 3e18, alice);
        vm.startPrank(alice);
        pair.transfer(address(pair), liq);
        (uint256 amount0, uint256 amount1) = pair.burn(alice);
        vm.stopPrank();
        // alice holds all supply except locked MINIMUM_LIQUIDITY
        assertEq(amount0, 3e18 - 1000);
        assertEq(amount1, 3e18 - 1000);
    }

    /// The core Merry Men's Share plumbing: with feeTo set, 1/6 of fee growth
    /// is minted to the treasury as LP tokens — 0.05% of volume.
    function test_protocolFee_mintsToTreasury() public {
        factory.setFeeTo(treasury);
        _addLiquidity(1000e18, 1000e18, alice);

        // generate volume
        for (uint256 i; i < 10; i++) {
            uint256 out = _quoteOut(1e18, true);
            MockERC20(token0).mint(address(pair), 1e18);
            pair.swap(0, out, alice, "");
            out = _quoteOut(1e18, false);
            MockERC20(token1).mint(address(pair), 1e18);
            pair.swap(out, 0, alice, "");
        }

        // trigger _mintFee via a liquidity event
        assertEq(pair.balanceOf(treasury), 0);
        _addLiquidity(1e18, 1e18, alice);
        uint256 treasuryLP = pair.balanceOf(treasury);
        assertGt(treasuryLP, 0, "treasury received no fee LP");

        // value of the treasury's LP should approximate 1/6 of total fees:
        // 20 swaps of 1e18 at 0.30% fee = 0.06e18 fees; 1/6 => 0.01e18 (split across both tokens)
        uint256 ts = pair.totalSupply();
        (uint112 r0, uint112 r1,) = pair.getReserves();
        uint256 value0 = uint256(r0) * treasuryLP / ts;
        uint256 value1 = uint256(r1) * treasuryLP / ts;
        uint256 approxFeeValue = value0 + value1; // tokens trade ~1:1 here
        assertApproxEqRel(approxFeeValue, 0.01e18, 0.05e18); // within 5%
    }

    function test_noProtocolFee_whenFeeToUnset() public {
        _addLiquidity(1000e18, 1000e18, alice);
        uint256 out = _quoteOut(1e18, true);
        MockERC20(token0).mint(address(pair), 1e18);
        pair.swap(0, out, alice, "");
        _addLiquidity(1e18, 1e18, alice);
        assertEq(pair.balanceOf(treasury), 0);
    }

    function test_feeToSetter_accessControl() public {
        vm.prank(alice);
        vm.expectRevert(bytes("Loxley: FORBIDDEN"));
        factory.setFeeTo(alice);
    }

    function testFuzz_swap_neverBreaksK(uint96 amountIn) public {
        vm.assume(amountIn > 1000);
        _addLiquidity(1_000_000e18, 1_000_000e18, alice);
        (uint112 r0Before, uint112 r1Before,) = pair.getReserves();
        uint256 kBefore = uint256(r0Before) * r1Before;

        uint256 out = _quoteOut(amountIn, true);
        vm.assume(out > 0);
        MockERC20(token0).mint(address(pair), amountIn);
        pair.swap(0, out, alice, "");

        (uint112 r0, uint112 r1,) = pair.getReserves();
        assertGe(uint256(r0) * r1, kBefore, "k decreased");
    }

    function _quoteOut(uint256 amountIn, bool zeroForOne) internal view returns (uint256) {
        (uint112 r0, uint112 r1,) = pair.getReserves();
        (uint256 rIn, uint256 rOut) = zeroForOne ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));
        uint256 amountInWithFee = amountIn * 997;
        return amountInWithFee * rOut / (rIn * 1000 + amountInWithFee);
    }
}
