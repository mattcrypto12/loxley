// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MerryMenShare} from "../src/MerryMenShare.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract MerryMenShareTest is Test {
    MerryMenShare share;
    MockERC20 rewardToken; // stands in for a Hoard LP token

    address router = makeAddr("router");
    address poor1 = makeAddr("poor1");
    address poor2 = makeAddr("poor2");
    address rich = makeAddr("rich");

    uint256 constant THRESHOLD = 1 ether;

    function setUp() public {
        share = new MerryMenShare(THRESHOLD);
        share.setRouter(router);
        rewardToken = new MockERC20("Hoard LP", "HOARD", 18);
        vm.deal(rich, 100 ether); // above threshold => ineligible
        vm.deal(poor1, 0.5 ether);
        vm.deal(poor2, 0.1 ether);
    }

    function _act(address user, uint256 times) internal {
        vm.startPrank(router);
        for (uint256 i; i < times; i++) {
            share.recordActivity(user);
        }
        vm.stopPrank();
    }

    function _finalizeEpoch0WithRewards(uint256 amount) internal {
        rewardToken.mint(address(share), amount);
        vm.warp(share.epochEnd(0));
        address[] memory tokens = new address[](1);
        tokens[0] = address(rewardToken);
        share.finalizeEpoch(0, tokens);
    }

    function test_onlyRouterRecordsActivity() public {
        vm.expectRevert(bytes("MerryMen: ONLY_ROUTER"));
        share.recordActivity(poor1);
    }

    function test_pointsCapped() public {
        _act(poor1, 25);
        assertEq(share.points(0, poor1), share.POINTS_CAP_PER_EPOCH());
        assertEq(share.totalPoints(0), share.POINTS_CAP_PER_EPOCH());
    }

    function test_finalize_beforeEpochEndReverts() public {
        address[] memory tokens = new address[](1);
        tokens[0] = address(rewardToken);
        vm.expectRevert(bytes("MerryMen: EPOCH_NOT_OVER"));
        share.finalizeEpoch(0, tokens);
    }

    function test_claim_proRata() public {
        _act(poor1, 3);
        _act(poor2, 1);
        _finalizeEpoch0WithRewards(100e18);

        vm.prank(poor1);
        share.claim(0);
        vm.prank(poor2);
        share.claim(0);

        assertEq(rewardToken.balanceOf(poor1), 75e18); // 3 of 4 points
        assertEq(rewardToken.balanceOf(poor2), 25e18); // 1 of 4 points
    }

    function test_claim_richWalletBlocked() public {
        _act(rich, 5);
        _act(poor1, 5);
        _finalizeEpoch0WithRewards(100e18);

        vm.prank(rich);
        vm.expectRevert(bytes("MerryMen: TOO_RICH"));
        share.claim(0);

        // poor1 still claims their half
        vm.prank(poor1);
        share.claim(0);
        assertEq(rewardToken.balanceOf(poor1), 50e18);
    }

    function test_claim_inactiveWalletBlocked() public {
        _act(poor1, 1);
        _finalizeEpoch0WithRewards(100e18);
        // let 31 days pass since last activity
        vm.warp(block.timestamp + 31 days);
        vm.prank(poor1);
        vm.expectRevert(bytes("MerryMen: INACTIVE"));
        share.claim(0);
    }

    function test_claim_doubleClaimBlocked() public {
        _act(poor1, 1);
        _finalizeEpoch0WithRewards(100e18);
        vm.startPrank(poor1);
        share.claim(0);
        vm.expectRevert(bytes("MerryMen: CLAIMED"));
        share.claim(0);
        vm.stopPrank();
    }

    function test_claim_noPointsBlocked() public {
        _act(poor1, 1);
        _finalizeEpoch0WithRewards(100e18);
        vm.prank(poor2);
        vm.expectRevert(bytes("MerryMen: NO_POINTS"));
        share.claim(0);
    }

    function test_rewardsSegregatedByEpoch() public {
        _act(poor1, 1);
        _finalizeEpoch0WithRewards(100e18); // warps to end of epoch 0

        // epoch 1: poor2 acts, new rewards arrive
        _act(poor2, 1);
        rewardToken.mint(address(share), 60e18);
        vm.warp(share.epochEnd(1));
        address[] memory tokens = new address[](1);
        tokens[0] = address(rewardToken);
        share.finalizeEpoch(1, tokens);

        // epoch 1 allocation only contains the fresh 60e18, not epoch 0's 100e18
        assertEq(share.allocations(1, address(rewardToken)), 60e18);

        vm.prank(poor1);
        share.claim(0);
        vm.prank(poor2);
        share.claim(1);
        assertEq(rewardToken.balanceOf(poor1), 100e18);
        assertEq(rewardToken.balanceOf(poor2), 60e18);
    }

    function test_rollForward_releasesUnclaimed() public {
        _act(poor1, 1);
        _act(poor2, 1);
        _finalizeEpoch0WithRewards(100e18);

        vm.prank(poor1);
        share.claim(0); // 50 claimed, 50 unclaimed

        vm.expectRevert(bytes("MerryMen: GRACE_PERIOD"));
        share.rollForward(0);

        vm.warp(share.epochEnd(share.RECLAIM_GRACE_EPOCHS()));
        share.rollForward(0);
        assertEq(share.reserved(address(rewardToken)), 0);

        // poor2 can no longer claim epoch 0
        vm.prank(poor2);
        vm.expectRevert(bytes("MerryMen: ROLLED_FORWARD"));
        share.claim(0);

        // the released 50e18 flows into the next finalized epoch
        uint256 epochNow = share.currentEpoch();
        _act(poor2, 1);
        vm.warp(share.epochEnd(epochNow));
        address[] memory tokens = new address[](1);
        tokens[0] = address(rewardToken);
        share.finalizeEpoch(epochNow, tokens);
        assertEq(share.allocations(epochNow, address(rewardToken)), 50e18);
    }

    function test_pendingSpoils_view() public {
        _act(poor1, 3);
        _act(poor2, 1);
        _finalizeEpoch0WithRewards(100e18);
        (address[] memory tokens, uint256[] memory amounts) = share.pendingSpoils(poor1, 0);
        assertEq(tokens.length, 1);
        assertEq(amounts[0], 75e18);
        // rich pending = 0
        (, uint256[] memory richAmounts) = share.pendingSpoils(rich, 0);
        assertEq(richAmounts[0], 0);
    }

    function test_wealthThreshold_adjustable() public {
        share.setWealthThreshold(200 ether);
        _act(rich, 1);
        _finalizeEpoch0WithRewards(10e18);
        vm.prank(rich); // now under the raised threshold
        share.claim(0);
        assertEq(rewardToken.balanceOf(rich), 10e18);
    }
}
