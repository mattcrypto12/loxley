// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {ILoxleyFactory} from "./interfaces/ILoxleyFactory.sol";
import {LoxleyPair} from "./LoxleyPair.sol";

/// @title LoxleyFactory — deploys Hoards (constant-product pools)
/// @notice feeTo is intended to be the Merry Men's Share treasury: setting it
///         diverts 1/6 of LP fee growth (0.05% of volume) to redistribution.
contract LoxleyFactory is ILoxleyFactory {
    address public feeTo;
    address public feeToSetter;

    mapping(address => mapping(address => address)) public getHoard;
    address[] public allHoards;

    constructor(address _feeToSetter) {
        feeToSetter = _feeToSetter;
    }

    function allHoardsLength() external view returns (uint256) {
        return allHoards.length;
    }

    /// @dev Init-code hash of LoxleyPair, used for CREATE2 address derivation off-chain.
    function pairCodeHash() external pure returns (bytes32) {
        return keccak256(type(LoxleyPair).creationCode);
    }

    function createHoard(address tokenA, address tokenB) external returns (address hoard) {
        require(tokenA != tokenB, "Loxley: IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "Loxley: ZERO_ADDRESS");
        require(getHoard[token0][token1] == address(0), "Loxley: HOARD_EXISTS");
        bytes memory bytecode = type(LoxleyPair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            hoard := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        LoxleyPair(hoard).initialize(token0, token1);
        getHoard[token0][token1] = hoard;
        getHoard[token1][token0] = hoard; // populate mapping in the reverse direction
        allHoards.push(hoard);
        emit HoardCreated(token0, token1, hoard, allHoards.length);
    }

    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, "Loxley: FORBIDDEN");
        feeTo = _feeTo;
    }

    function setFeeToSetter(address _feeToSetter) external {
        require(msg.sender == feeToSetter, "Loxley: FORBIDDEN");
        feeToSetter = _feeToSetter;
    }
}
