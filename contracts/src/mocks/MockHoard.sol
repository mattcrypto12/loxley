// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {MockERC20} from "./MockERC20.sol";

/// @notice Test double for a Hoard LP token: mintable ERC-20 that exposes
///         token0/token1 so it can be registered in MockHoardFactory.
contract MockHoard is MockERC20 {
    address public token0;
    address public token1;

    constructor(address _token0, address _token1) MockERC20("Mock Hoard", "HOARD", 18) {
        token0 = _token0;
        token1 = _token1;
    }
}

/// @notice Registry double matching ILoxleyFactory.getHoard for treasury tests.
contract MockHoardFactory {
    mapping(address => mapping(address => address)) public getHoard;

    function register(MockHoard hoard) external {
        getHoard[hoard.token0()][hoard.token1()] = address(hoard);
        getHoard[hoard.token1()][hoard.token0()] = address(hoard);
    }
}
