// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Test double for Robinhood Chain stock tokens: a standard ERC-20
///         (18 decimals) with the ERC-8056 "Scaled UI Amount" extension.
///         Corporate actions (splits, stock dividends) update `uiMultiplier`
///         — raw balances NEVER rebase, so AMM invariants are untouched.
///         underlying shares = raw amount × uiMultiplier ÷ 1e18
contract MockStockToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    address public owner;
    uint256 public uiMultiplier = 1e18; // 1.0 fixed-point

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event UIMultiplierUpdated(uint256 oldMultiplier, uint256 newMultiplier);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
    }

    // ── ERC-8056 scaled-UI views ─────────────────────────────
    function balanceOfUI(address account) external view returns (uint256) {
        return balanceOf[account] * uiMultiplier / 1e18;
    }

    function totalSupplyUI() external view returns (uint256) {
        return totalSupply * uiMultiplier / 1e18;
    }

    /// @notice Simulate a corporate action (e.g. 2:1 split doubles the
    ///         multiplier). Raw balances are untouched by design.
    function setUIMultiplier(uint256 newMultiplier) external {
        require(msg.sender == owner, "Stock: FORBIDDEN");
        emit UIMultiplierUpdated(uiMultiplier, newMultiplier);
        uiMultiplier = newMultiplier;
    }

    // ── standard ERC-20 ──────────────────────────────────────
    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - value;
        }
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
        return true;
    }
}
