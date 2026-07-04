// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IERC20Like {
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
}

/// @title MerryMenShare — the Merry Men's Share
/// @notice The redistribution treasury. It is set as the factory's `feeTo`,
///         so every Hoard mints it LP tokens worth 0.05% of swap volume
///         (1/6 of the 0.30% fee). Those spoils are divided into weekly
///         epochs and claimable pro-rata by *active small wallets*:
///
///           eligible(user) =
///                acted through the Greenwood Path in the last 30 days
///             && earned points in the epoch being claimed
///             && ETH balance at claim time is at or below `wealthThreshold`
///
///         "Steal from the rich, give to the poor" — big wallets pay the
///         protocol fee like everyone else but cannot claim it back.
///
/// @dev    Points are capped per user per epoch to blunt spam. The wealth
///         check is an ETH-balance heuristic and is sybil-gameable; this is
///         documented, deliberate v1 simplicity — the mechanism itself stays
///         fully on-chain and inspectable.
contract MerryMenShare {
    // ---- configuration ----
    uint256 public constant EPOCH_LENGTH = 7 days;
    uint256 public constant ACTIVITY_WINDOW = 30 days;
    uint256 public constant POINTS_CAP_PER_EPOCH = 10;
    uint256 public constant RECLAIM_GRACE_EPOCHS = 4;

    address public owner;
    address public router; // the only address allowed to record activity
    uint256 public immutable genesis;
    uint256 public wealthThreshold; // max ETH balance (wei) to count as "poor"

    // ---- activity ----
    mapping(address => uint256) public lastActive;
    mapping(uint256 => mapping(address => uint256)) public points; // epoch => user => points
    mapping(uint256 => uint256) public totalPoints; // epoch => total points

    // ---- spoils accounting ----
    mapping(address => uint256) public reserved; // token => amount already allocated to epochs
    mapping(uint256 => address[]) private _epochTokens; // epoch => reward token list
    mapping(uint256 => mapping(address => uint256)) public allocations; // epoch => token => amount
    mapping(uint256 => bool) public finalized;
    mapping(uint256 => bool) public rolledForward;
    mapping(uint256 => mapping(address => bool)) public claimed; // epoch => user => claimed
    mapping(uint256 => uint256) public unclaimedPoints; // epoch => points not yet claimed

    event ActivityRecorded(address indexed user, uint256 indexed epoch, uint256 userPoints);
    event EpochFinalized(uint256 indexed epoch, address[] tokens, uint256[] amounts, uint256 totalPoints);
    event SpoilsClaimed(uint256 indexed epoch, address indexed user, address[] tokens, uint256[] amounts);
    event SpoilsRolledForward(uint256 indexed epoch);
    event WealthThresholdSet(uint256 threshold);
    event RouterSet(address router);

    modifier onlyOwner() {
        require(msg.sender == owner, "MerryMen: FORBIDDEN");
        _;
    }

    constructor(uint256 _wealthThreshold) {
        owner = msg.sender;
        genesis = block.timestamp;
        wealthThreshold = _wealthThreshold;
    }

    // ---- admin ----
    function setRouter(address _router) external onlyOwner {
        require(router == address(0), "MerryMen: ROUTER_SET");
        router = _router;
        emit RouterSet(_router);
    }

    function setWealthThreshold(uint256 _threshold) external onlyOwner {
        wealthThreshold = _threshold;
        emit WealthThresholdSet(_threshold);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    // ---- views ----
    function currentEpoch() public view returns (uint256) {
        return (block.timestamp - genesis) / EPOCH_LENGTH;
    }

    function epochEnd(uint256 epoch) public view returns (uint256) {
        return genesis + (epoch + 1) * EPOCH_LENGTH;
    }

    function epochTokens(uint256 epoch) external view returns (address[] memory) {
        return _epochTokens[epoch];
    }

    function isEligible(address user, uint256 epoch) public view returns (bool) {
        return points[epoch][user] > 0 && !claimed[epoch][user]
            && block.timestamp - lastActive[user] <= ACTIVITY_WINDOW && user.balance <= wealthThreshold;
    }

    /// @notice What `user` could claim from `epoch` right now.
    function pendingSpoils(address user, uint256 epoch)
        external
        view
        returns (address[] memory tokens, uint256[] memory amounts)
    {
        tokens = _epochTokens[epoch];
        amounts = new uint256[](tokens.length);
        if (!finalized[epoch] || rolledForward[epoch] || !isEligible(user, epoch)) return (tokens, amounts);
        uint256 userPoints = points[epoch][user];
        for (uint256 i; i < tokens.length; i++) {
            amounts[i] = allocations[epoch][tokens[i]] * userPoints / totalPoints[epoch];
        }
    }

    // ---- activity recording (router only) ----
    function recordActivity(address user) external {
        require(msg.sender == router, "MerryMen: ONLY_ROUTER");
        lastActive[user] = block.timestamp;
        uint256 epoch = currentEpoch();
        uint256 userPoints = points[epoch][user];
        if (userPoints < POINTS_CAP_PER_EPOCH) {
            points[epoch][user] = userPoints + 1;
            totalPoints[epoch] += 1;
            unclaimedPoints[epoch] += 1;
        }
        emit ActivityRecorded(user, epoch, points[epoch][user]);
    }

    // ---- epoch lifecycle (permissionless) ----

    /// @notice Lock in the spoils for a finished epoch. Anyone may call.
    /// @param epoch  epoch to finalize (must have ended)
    /// @param tokens reward tokens to allocate (typically Hoard LP tokens)
    function finalizeEpoch(uint256 epoch, address[] calldata tokens) external {
        require(block.timestamp >= epochEnd(epoch), "MerryMen: EPOCH_NOT_OVER");
        require(!finalized[epoch], "MerryMen: FINALIZED");
        finalized[epoch] = true;

        uint256[] memory amounts = new uint256[](tokens.length);
        if (totalPoints[epoch] > 0) {
            for (uint256 i; i < tokens.length; i++) {
                address token = tokens[i];
                require(allocations[epoch][token] == 0, "MerryMen: DUP_TOKEN");
                uint256 available = IERC20Like(token).balanceOf(address(this)) - reserved[token];
                if (available > 0) {
                    allocations[epoch][token] = available;
                    reserved[token] += available;
                    _epochTokens[epoch].push(token);
                    amounts[i] = available;
                }
            }
        }
        emit EpochFinalized(epoch, tokens, amounts, totalPoints[epoch]);
    }

    /// @notice Claim your share of a finalized epoch's spoils.
    function claim(uint256 epoch) external {
        require(finalized[epoch], "MerryMen: NOT_FINALIZED");
        require(!rolledForward[epoch], "MerryMen: ROLLED_FORWARD");
        require(points[epoch][msg.sender] > 0, "MerryMen: NO_POINTS");
        require(!claimed[epoch][msg.sender], "MerryMen: CLAIMED");
        require(block.timestamp - lastActive[msg.sender] <= ACTIVITY_WINDOW, "MerryMen: INACTIVE");
        require(msg.sender.balance <= wealthThreshold, "MerryMen: TOO_RICH");

        claimed[epoch][msg.sender] = true;
        uint256 userPoints = points[epoch][msg.sender];
        unclaimedPoints[epoch] -= userPoints;

        address[] memory tokens = _epochTokens[epoch];
        uint256[] memory amounts = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 amount = allocations[epoch][token] * userPoints / totalPoints[epoch];
            if (amount > 0) {
                amounts[i] = amount;
                reserved[token] -= amount;
                require(IERC20Like(token).transfer(msg.sender, amount), "MerryMen: TRANSFER_FAILED");
            }
        }
        emit SpoilsClaimed(epoch, msg.sender, tokens, amounts);
    }

    /// @notice After the grace period, release an old epoch's unclaimed spoils
    ///         back into the pot for future epochs. Anyone may call.
    function rollForward(uint256 epoch) external {
        require(finalized[epoch], "MerryMen: NOT_FINALIZED");
        require(!rolledForward[epoch], "MerryMen: ROLLED_FORWARD");
        require(currentEpoch() >= epoch + RECLAIM_GRACE_EPOCHS, "MerryMen: GRACE_PERIOD");
        rolledForward[epoch] = true;

        address[] memory tokens = _epochTokens[epoch];
        uint256 _unclaimedPoints = unclaimedPoints[epoch];
        uint256 _totalPoints = totalPoints[epoch];
        for (uint256 i; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 release = allocations[epoch][token] * _unclaimedPoints / _totalPoints;
            reserved[token] -= release; // becomes claimable by future epochs' finalize
        }
        emit SpoilsRolledForward(epoch);
    }
}
