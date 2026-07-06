// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @dev Reward accounting follows the Synthetix StakingRewards pattern
///      (Copyright (c) Synthetix, MIT license), reimplemented for 0.8.

interface IERC20S {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

/// @title BowStaking — "Drawing the Bow"
/// @notice Synthetix-style staking: stake LOX, earn LOX streamed from funded
///         reward periods. Draw the bow (stake), hold the tension (accrue),
///         loose when ready (claim).
contract BowStaking {
    IERC20S public immutable lox;
    address public owner;

    uint256 public constant REWARDS_DURATION = 7 days;

    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 public totalStaked;
    mapping(address => uint256) public stakedOf;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardAdded(uint256 reward);

    constructor(address _lox) {
        lox = IERC20S(_lox);
        owner = msg.sender;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) return rewardPerTokenStored;
        return rewardPerTokenStored + (lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18 / totalStaked;
    }

    function earned(address account) public view returns (uint256) {
        return stakedOf[account] * (rewardPerToken() - userRewardPerTokenPaid[account]) / 1e18 + rewards[account];
    }

    /// @notice Draw the bow.
    function stake(uint256 amount) external updateReward(msg.sender) {
        require(amount > 0, "Bow: ZERO");
        totalStaked += amount;
        stakedOf[msg.sender] += amount;
        require(lox.transferFrom(msg.sender, address(this), amount), "Bow: TRANSFER_FAILED");
        emit Staked(msg.sender, amount);
    }

    /// @notice Ease the string.
    function withdraw(uint256 amount) public updateReward(msg.sender) {
        require(amount > 0, "Bow: ZERO");
        totalStaked -= amount;
        stakedOf[msg.sender] -= amount;
        require(lox.transfer(msg.sender, amount), "Bow: TRANSFER_FAILED");
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Loose the arrow: collect accrued rewards.
    function getReward() public updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            require(lox.transfer(msg.sender, reward), "Bow: TRANSFER_FAILED");
            emit RewardPaid(msg.sender, reward);
        }
    }

    function exit() external {
        withdraw(stakedOf[msg.sender]);
        getReward();
    }

    /// @notice Fund a 7-day reward stream. Caller must have transferred the
    ///         reward LOX to this contract beforehand (or in the same tx).
    function notifyRewardAmount(uint256 reward) external updateReward(address(0)) {
        require(msg.sender == owner, "Bow: FORBIDDEN");
        if (block.timestamp >= periodFinish) {
            rewardRate = reward / REWARDS_DURATION;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (reward + leftover) / REWARDS_DURATION;
        }
        // ensure the contract can cover the stream (staked funds excluded)
        uint256 balance = lox.balanceOf(address(this)) - totalStaked;
        require(rewardRate <= balance / REWARDS_DURATION, "Bow: REWARD_TOO_HIGH");
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + REWARDS_DURATION;
        emit RewardAdded(reward);
    }
}
