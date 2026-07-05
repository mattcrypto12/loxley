// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IERC20S {
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
}

/// @title SpoilsSplitter — the Guild's cut
/// @notice Sits as the factory's `feeTo`: every Hoard mints its protocol-fee
///         LP (0.05% of volume) here. Anyone may call `split` to forward the
///         balance — a fixed, immutable share to the Merry Men's Share
///         treasury, the remainder to the guild treasury.
///
///         The split ratio is set once at deployment and can never change;
///         the guild treasury address can only be rotated by the current
///         treasury. Both flows are visible on-chain per token, per split.
///
///         Disclosed everywhere: with the default 50/50, the effective fee is
///         0.30% = 0.25% LPs + 0.025% Merry Men's Share + 0.025% guild.
contract SpoilsSplitter {
    address public immutable merryMenShare;
    uint256 public immutable merryMenBps; // basis points of protocol fee to the Share
    address public treasury;

    event SpoilsSplit(address indexed token, uint256 toShare, uint256 toTreasury);
    event TreasuryRotated(address indexed previousTreasury, address indexed newTreasury);

    constructor(address _merryMenShare, address _treasury, uint256 _merryMenBps) {
        require(_merryMenShare != address(0), "Splitter: ZERO_SHARE");
        require(_treasury != address(0), "Splitter: ZERO_TREASURY");
        require(_merryMenBps <= 10_000, "Splitter: BPS_OVERFLOW");
        merryMenShare = _merryMenShare;
        treasury = _treasury;
        merryMenBps = _merryMenBps;
    }

    /// @notice Only the current treasury can hand the keys onward.
    function setTreasury(address newTreasury) external {
        require(msg.sender == treasury, "Splitter: FORBIDDEN");
        require(newTreasury != address(0), "Splitter: ZERO_TREASURY");
        emit TreasuryRotated(treasury, newTreasury);
        treasury = newTreasury;
    }

    /// @notice Forward this contract's balance of each token per the fixed
    ///         ratio. Permissionless: splitting can only move funds to the
    ///         two hardcoded destinations.
    function split(address[] calldata tokens) external {
        for (uint256 i; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 balance = IERC20S(token).balanceOf(address(this));
            if (balance == 0) continue;
            uint256 toShare = balance * merryMenBps / 10_000;
            uint256 toTreasury = balance - toShare;
            if (toShare > 0) {
                require(IERC20S(token).transfer(merryMenShare, toShare), "Splitter: SHARE_TRANSFER");
            }
            if (toTreasury > 0) {
                require(IERC20S(token).transfer(treasury, toTreasury), "Splitter: TREASURY_TRANSFER");
            }
            emit SpoilsSplit(token, toShare, toTreasury);
        }
    }
}
