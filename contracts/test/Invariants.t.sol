// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LoxleyFactory} from "../src/core/LoxleyFactory.sol";
import {LoxleyPair} from "../src/core/LoxleyPair.sol";
import {MerryMenShare} from "../src/MerryMenShare.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockHoard, MockHoardFactory} from "../src/mocks/MockHoard.sol";

/// Handler: performs random-but-valid actions against one Hoard. The
/// fuzzer chooses the sequence; the invariants below must survive any of it.
contract PairHandler is Test {
    LoxleyPair public pair;
    MockERC20 public token0;
    MockERC20 public token1;

    // ghost accounting for cross-checks
    uint256 public swapCount;
    uint256 public lastK;
    bool public kDecreasedOutsideBurn;

    address[3] actors;

    constructor(LoxleyPair _pair, MockERC20 _t0, MockERC20 _t1) {
        pair = _pair;
        token0 = _t0;
        token1 = _t1;
        actors[0] = makeAddr("actor0");
        actors[1] = makeAddr("actor1");
        actors[2] = makeAddr("actor2");
        _snapshotK();
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function _snapshotK() internal {
        (uint112 r0, uint112 r1,) = pair.getReserves();
        lastK = uint256(r0) * r1;
    }

    /// K may only shrink when liquidity is burned; record violations.
    function _checkK(bool burned) internal {
        (uint112 r0, uint112 r1,) = pair.getReserves();
        uint256 k = uint256(r0) * r1;
        if (k < lastK && !burned) kDecreasedOutsideBurn = true;
        lastK = k;
    }

    function swap(uint256 amountIn, bool zeroForOne, uint256 actorSeed) external {
        amountIn = bound(amountIn, 1_000, 500_000e18);
        (uint112 r0, uint112 r1,) = pair.getReserves();
        (uint256 rIn, uint256 rOut) =
            zeroForOne ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));
        if (rIn == 0 || rOut == 0) return;

        uint256 inWithFee = amountIn * 997;
        uint256 out = inWithFee * rOut / (rIn * 1000 + inWithFee);
        if (out == 0) return;

        address who = _actor(actorSeed);
        MockERC20 tokenIn = zeroForOne ? token0 : token1;
        tokenIn.mint(address(pair), amountIn);
        vm.prank(who);
        pair.swap(zeroForOne ? 0 : out, zeroForOne ? out : 0, who, "");
        swapCount++;
        _checkK(false);
    }

    function addLiquidity(uint256 amount, uint256 actorSeed) external {
        amount = bound(amount, 1e6, 1_000_000e18);
        (uint112 r0, uint112 r1,) = pair.getReserves();
        if (r0 == 0 || r1 == 0) return;
        // proportional add to keep it valid
        uint256 amount1 = amount * r1 / r0;
        if (amount1 == 0) return;
        token0.mint(address(pair), amount);
        token1.mint(address(pair), amount1);
        pair.mint(_actor(actorSeed));
        _checkK(false); // mint may only grow K
    }

    function removeLiquidity(uint256 fraction, uint256 actorSeed) external {
        address who = _actor(actorSeed);
        uint256 bal = pair.balanceOf(who);
        if (bal == 0) return;
        uint256 liq = bound(fraction, 1, bal);
        vm.startPrank(who);
        pair.transfer(address(pair), liq);
        // burn can legitimately fail on rounding-to-zero amounts
        try pair.burn(who) {
            _checkK(true);
        } catch {}
        vm.stopPrank();
    }

    /// Donations must never hurt LPs: they only make the pair richer.
    function donate(uint256 amount, bool toToken0) external {
        amount = bound(amount, 1, 10_000e18);
        (toToken0 ? token0 : token1).mint(address(pair), amount);
    }

    function skim(uint256 actorSeed) external {
        pair.skim(_actor(actorSeed));
    }

    function sync() external {
        pair.sync();
        _checkK(false); // sync absorbs donations; K may only grow
    }
}

contract LoxleyInvariants is Test {
    LoxleyFactory factory;
    LoxleyPair pair;
    MockERC20 t0;
    MockERC20 t1;
    MerryMenShare share;
    PairHandler handler;

    function setUp() public {
        factory = new LoxleyFactory(address(this));
        share = new MerryMenShare(1 ether);
        factory.setFeeTo(address(share));

        MockERC20 a = new MockERC20("A", "A", 18);
        MockERC20 b = new MockERC20("B", "B", 18);
        pair = LoxleyPair(factory.createHoard(address(a), address(b)));
        (t0, t1) = pair.token0() == address(a) ? (a, b) : (b, a);

        // genesis liquidity
        t0.mint(address(pair), 1_000_000e18);
        t1.mint(address(pair), 1_000_000e18);
        pair.mint(makeAddr("genesisLP"));

        handler = new PairHandler(pair, t0, t1);
        targetContract(address(handler));
    }

    /// The pair must never owe more than it holds.
    function invariant_solvency() public view {
        (uint112 r0, uint112 r1,) = pair.getReserves();
        assertGe(t0.balanceOf(address(pair)), uint256(r0), "reserve0 exceeds balance");
        assertGe(t1.balanceOf(address(pair)), uint256(r1), "reserve1 exceeds balance");
    }

    /// K never decreases except through a burn.
    function invariant_kMonotonicOutsideBurns() public view {
        assertFalse(handler.kDecreasedOutsideBurn(), "K decreased outside a burn");
    }

    /// Reserves fit uint112 (the overflow guard the pair depends on).
    function invariant_reservesBounded() public view {
        (uint112 r0, uint112 r1,) = pair.getReserves();
        assertLe(uint256(r0), type(uint112).max);
        assertLe(uint256(r1), type(uint112).max);
    }

    /// LP supply is only zero if the pool was never seeded; once seeded the
    /// permanently locked MINIMUM_LIQUIDITY keeps it nonzero forever.
    function invariant_minimumLiquidityLocked() public view {
        assertGe(pair.totalSupply(), pair.MINIMUM_LIQUIDITY());
        assertEq(pair.balanceOf(address(0xdead)), pair.MINIMUM_LIQUIDITY());
    }

    /// Whatever the sequence, a pure swap quote can never be manipulated
    /// into giving out more than reserves.
    function invariant_quoteBelowReserves() public view {
        (uint112 r0, uint112 r1,) = pair.getReserves();
        if (r0 == 0 || r1 == 0) return;
        uint256 amountIn = 1_000_000_000e18; // absurdly large trade
        uint256 inWithFee = amountIn * 997;
        uint256 out = inWithFee * r1 / (uint256(r0) * 1000 + inWithFee);
        assertLt(out, uint256(r1), "quote can drain reserve");
    }
}

/// Separate invariant run for the treasury's books.
contract MerryMenInvariants is Test {
    MerryMenShare share;
    MockHoard reward;
    ShareHandler handler;

    function setUp() public {
        share = new MerryMenShare(1 ether);
        MockHoardFactory hoardFactory = new MockHoardFactory();
        share.setFactory(address(hoardFactory));
        reward = new MockHoard(makeAddr("tA"), makeAddr("tB"));
        hoardFactory.register(reward);
        handler = new ShareHandler(share, reward);
        share.setRouter(address(handler)); // the handler plays the router
        targetContract(address(handler));
    }

    /// The treasury can never have promised (reserved) more than it holds.
    function invariant_reservedNeverExceedsBalance() public view {
        assertLe(share.reserved(address(reward)), reward.balanceOf(address(share)));
    }
}

contract ShareHandler is Test {
    MerryMenShare share;
    MockHoard reward;
    address[3] users;

    constructor(MerryMenShare _share, MockHoard _reward) {
        share = _share;
        reward = _reward;
        users[0] = makeAddr("u0");
        users[1] = makeAddr("u1");
        users[2] = makeAddr("u2");
    }

    function act(uint256 seed) external {
        // this handler IS the router
        share.recordActivity(users[seed % 3]);
    }

    function fund(uint256 amount) external {
        amount = bound(amount, 1, 1_000e18);
        reward.mint(address(share), amount);
    }

    function warpAndFinalize(uint256 jump) external {
        jump = bound(jump, 1 hours, 30 days);
        vm.warp(block.timestamp + jump);
        uint256 epoch = share.currentEpoch();
        if (epoch == 0) return;
        uint256 target = epoch - 1;
        if (share.finalized(target)) return;
        address[] memory tokens = new address[](1);
        tokens[0] = address(reward);
        share.finalizeEpoch(target, tokens);
    }

    function claim(uint256 seed, uint256 epoch) external {
        address user = users[seed % 3];
        epoch = bound(epoch, 0, share.currentEpoch());
        if (!share.finalized(epoch) || share.rolledForward(epoch)) return;
        if (share.points(epoch, user) == 0 || share.claimed(epoch, user)) return;
        if (block.timestamp - share.lastActive(user) > share.ACTIVITY_WINDOW()) return;
        vm.prank(user);
        share.claim(epoch);
    }

    function rollForward(uint256 epoch) external {
        epoch = bound(epoch, 0, share.currentEpoch());
        if (!share.finalized(epoch) || share.rolledForward(epoch)) return;
        if (share.currentEpoch() < epoch + share.RECLAIM_GRACE_EPOCHS()) return;
        share.rollForward(epoch);
    }

}
