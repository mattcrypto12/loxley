// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SpoilsSplitter} from "../src/SpoilsSplitter.sol";
import {LoxleyFactory} from "../src/core/LoxleyFactory.sol";
import {LoxleyPair} from "../src/core/LoxleyPair.sol";
import {MerryMenShare} from "../src/MerryMenShare.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract SpoilsSplitterTest is Test {
    SpoilsSplitter splitter;
    MerryMenShare share;
    MockERC20 lp; // stand-in reward token for unit tests

    address guild = makeAddr("guild");
    address rando = makeAddr("rando");

    function setUp() public {
        share = new MerryMenShare(1 ether);
        splitter = new SpoilsSplitter(address(share), guild, 5_000); // 50/50
        lp = new MockERC20("LP", "LP", 18);
    }

    function test_split_fiftyFifty() public {
        lp.mint(address(splitter), 100e18);
        address[] memory tokens = new address[](1);
        tokens[0] = address(lp);
        vm.prank(rando); // permissionless
        splitter.split(tokens);
        assertEq(lp.balanceOf(address(share)), 50e18);
        assertEq(lp.balanceOf(guild), 50e18);
        assertEq(lp.balanceOf(address(splitter)), 0);
    }

    function test_split_roundingFavorsNobody() public {
        lp.mint(address(splitter), 3); // odd wei
        address[] memory tokens = new address[](1);
        tokens[0] = address(lp);
        splitter.split(tokens);
        // 3 * 5000/10000 = 1 to share, 2 to treasury; total conserved
        assertEq(lp.balanceOf(address(share)) + lp.balanceOf(guild), 3);
    }

    function test_split_zeroBalanceNoop() public {
        address[] memory tokens = new address[](1);
        tokens[0] = address(lp);
        splitter.split(tokens); // must not revert
        assertEq(lp.balanceOf(guild), 0);
    }

    function test_setTreasury_onlyTreasury() public {
        vm.prank(rando);
        vm.expectRevert(bytes("Splitter: FORBIDDEN"));
        splitter.setTreasury(rando);

        vm.prank(guild);
        splitter.setTreasury(rando);
        // new treasury receives the next split
        lp.mint(address(splitter), 10e18);
        address[] memory tokens = new address[](1);
        tokens[0] = address(lp);
        splitter.split(tokens);
        assertEq(lp.balanceOf(rando), 5e18);
    }

    function test_constructor_guards() public {
        vm.expectRevert(bytes("Splitter: BPS_OVERFLOW"));
        new SpoilsSplitter(address(share), guild, 10_001);
        vm.expectRevert(bytes("Splitter: ZERO_TREASURY"));
        new SpoilsSplitter(address(share), address(0), 5_000);
    }

    /// End-to-end through the real pair: swaps → fee growth → feeTo mint to
    /// the splitter → split → Share and guild both hold LP.
    function test_endToEnd_protocolFeeSplitsFromRealPair() public {
        LoxleyFactory factory = new LoxleyFactory(address(this));
        factory.setFeeTo(address(splitter));

        MockERC20 a = new MockERC20("A", "A", 18);
        MockERC20 b = new MockERC20("B", "B", 18);
        LoxleyPair pair = LoxleyPair(factory.createHoard(address(a), address(b)));
        (MockERC20 t0, MockERC20 t1) =
            pair.token0() == address(a) ? (a, b) : (b, a);

        t0.mint(address(pair), 1000e18);
        t1.mint(address(pair), 1000e18);
        pair.mint(makeAddr("lper"));

        // volume
        for (uint256 i; i < 6; i++) {
            uint256 out = _quote(pair, 5e18, true);
            t0.mint(address(pair), 5e18);
            pair.swap(0, out, makeAddr("trader"), "");
            out = _quote(pair, 5e18, false);
            t1.mint(address(pair), 5e18);
            pair.swap(out, 0, makeAddr("trader"), "");
        }

        // liquidity event triggers _mintFee → splitter
        t0.mint(address(pair), 1e18);
        t1.mint(address(pair), 1e18);
        pair.mint(makeAddr("lper"));
        uint256 minted = pair.balanceOf(address(splitter));
        assertGt(minted, 0, "no protocol fee minted");

        address[] memory tokens = new address[](1);
        tokens[0] = address(pair);
        splitter.split(tokens);
        assertEq(pair.balanceOf(address(share)), minted / 2);
        assertEq(pair.balanceOf(guild), minted - minted / 2);
    }

    function _quote(LoxleyPair pair, uint256 amountIn, bool zeroForOne)
        internal
        view
        returns (uint256)
    {
        (uint112 r0, uint112 r1,) = pair.getReserves();
        (uint256 rIn, uint256 rOut) =
            zeroForOne ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));
        uint256 inWithFee = amountIn * 997;
        return inWithFee * rOut / (rIn * 1000 + inWithFee);
    }
}
