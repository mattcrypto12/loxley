// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface ILoxleyFactory {
    event HoardCreated(address indexed token0, address indexed token1, address hoard, uint256 hoardCount);

    function feeTo() external view returns (address);
    function feeToSetter() external view returns (address);

    function getHoard(address tokenA, address tokenB) external view returns (address hoard);
    function allHoards(uint256 index) external view returns (address hoard);
    function allHoardsLength() external view returns (uint256);

    function createHoard(address tokenA, address tokenB) external returns (address hoard);

    function setFeeTo(address) external;
    function setFeeToSetter(address) external;
}
