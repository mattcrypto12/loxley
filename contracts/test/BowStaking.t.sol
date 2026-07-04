// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BowStaking} from "../src/BowStaking.sol";
import {LoxToken} from "../src/LoxToken.sol";

contract BowStakingTest is Test {
    LoxToken lox;
    BowStaking bow;

    address archer1 = makeAddr("archer1");
    address archer2 = makeAddr("archer2");

    function setUp() public {
        lox = new LoxToken();
        bow = new BowStaking(address(lox));
        lox.mint(archer1, 1000e18);
        lox.mint(archer2, 1000e18);
        vm.prank(archer1);
        lox.approve(address(bow), type(uint256).max);
        vm.prank(archer2);
        lox.approve(address(bow), type(uint256).max);
    }

    function _fund(uint256 amount) internal {
        lox.mint(address(bow), amount);
        bow.notifyRewardAmount(amount);
    }

    function test_stakeAndEarn() public {
        vm.prank(archer1);
        bow.stake(100e18);
        _fund(70e18); // 10e18/day over 7 days

        vm.warp(block.timestamp + 7 days);
        uint256 earned = bow.earned(archer1);
        assertApproxEqRel(earned, 70e18, 0.001e18);

        vm.prank(archer1);
        bow.getReward();
        assertApproxEqRel(lox.balanceOf(archer1), 900e18 + 70e18, 0.001e18);
    }

    function test_rewardsSplitByStake() public {
        vm.prank(archer1);
        bow.stake(300e18);
        vm.prank(archer2);
        bow.stake(100e18);
        _fund(70e18);

        vm.warp(block.timestamp + 7 days);
        assertApproxEqRel(bow.earned(archer1), 52.5e18, 0.001e18); // 3/4
        assertApproxEqRel(bow.earned(archer2), 17.5e18, 0.001e18); // 1/4
    }

    function test_exit_returnsStakeAndRewards() public {
        vm.prank(archer1);
        bow.stake(500e18);
        _fund(70e18);
        vm.warp(block.timestamp + 3.5 days);

        vm.prank(archer1);
        bow.exit();
        // full stake back + ~half the reward stream
        assertApproxEqRel(lox.balanceOf(archer1), 1000e18 + 35e18, 0.01e18);
        assertEq(bow.stakedOf(archer1), 0);
    }

    function test_notify_requiresFunding() public {
        vm.expectRevert(bytes("Bow: REWARD_TOO_HIGH"));
        bow.notifyRewardAmount(70e18); // nothing transferred in
    }

    function test_notify_onlyOwner() public {
        vm.prank(archer1);
        vm.expectRevert(bytes("Bow: FORBIDDEN"));
        bow.notifyRewardAmount(1e18);
    }

    function test_cannotWithdrawMoreThanStaked() public {
        vm.startPrank(archer1);
        bow.stake(10e18);
        vm.expectRevert(); // underflow
        bow.withdraw(11e18);
        vm.stopPrank();
    }
}
