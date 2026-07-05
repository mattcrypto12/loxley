// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LoxleyFactory} from "../src/core/LoxleyFactory.sol";
import {LoxleyPair} from "../src/core/LoxleyPair.sol";
import {GreenwoodRouter} from "../src/periphery/GreenwoodRouter.sol";
import {MockStockToken} from "../src/mocks/MockStockToken.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {WETH9} from "../src/mocks/WETH9.sol";

/// Robinhood Chain stock tokens are ERC-20 + the ERC-8056 scaled-UI
/// extension: corporate actions move `uiMultiplier`, never raw balances
/// (docs.robinhood.com/chain/building-with-stock-tokens). These tests prove
/// a Hoard holding a stock token is unaffected by corporate actions — the
/// AMM operates purely on raw amounts, exactly as the standard intends.
contract StockTokenHoardTest is Test {
    LoxleyFactory factory;
    GreenwoodRouter router;
    WETH9 weth;
    MockStockToken aapl; // "Apple of Sherwood"
    MockERC20 silver;

    address trader = makeAddr("trader");
    uint256 constant DEADLINE = type(uint256).max;

    function setUp() public {
        factory = new LoxleyFactory(address(this));
        weth = new WETH9();
        router = new GreenwoodRouter(address(factory), address(weth));

        aapl = new MockStockToken("Apple of Sherwood", "AAPL-s");
        silver = new MockERC20("Sheriff's Silver", "SILV", 6);

        aapl.mint(trader, 10_000e18);
        silver.mint(trader, 10_000_000e6);
        vm.deal(trader, 100 ether);

        vm.startPrank(trader);
        aapl.approve(address(router), type(uint256).max);
        silver.approve(address(router), type(uint256).max);
        // AAPL-s at $200: 100 shares vs 20,000 SILV ($1 stable, 6 decimals)
        router.addLiquidity(
            address(aapl), address(silver), 100e18, 20_000e6, 0, 0, trader, DEADLINE
        );
        vm.stopPrank();
    }

    function _pair() internal view returns (LoxleyPair) {
        return LoxleyPair(factory.getHoard(address(aapl), address(silver)));
    }

    function test_stockToken_swapsLikeAnyERC20() public {
        address[] memory path = new address[](2);
        path[0] = address(silver);
        path[1] = address(aapl);

        uint256 sharesBefore = aapl.balanceOf(trader);
        vm.prank(trader);
        uint256[] memory amounts =
            router.swapExactTokensForTokens(2_000e6, 0, path, trader, DEADLINE);
        assertEq(aapl.balanceOf(trader) - sharesBefore, amounts[1]);
        assertGt(amounts[1], 0);
    }

    /// A 2:1 split doubles uiMultiplier. Raw reserves, K, LP supply and
    /// swap quotes must all be bit-for-bit identical.
    function test_corporateAction_doesNotTouchPoolInvariants() public {
        LoxleyPair pair = _pair();
        (uint112 r0Before, uint112 r1Before,) = pair.getReserves();
        uint256 kBefore = uint256(r0Before) * r1Before;
        uint256 lpSupplyBefore = pair.totalSupply();
        uint256 quoteBefore = router.getAmountsOut(1_000e6, _silvToAapl())[1];

        // corporate action: 2:1 split
        aapl.setUIMultiplier(2e18);

        (uint112 r0After, uint112 r1After,) = pair.getReserves();
        assertEq(r0After, r0Before, "raw reserve0 changed");
        assertEq(r1After, r1Before, "raw reserve1 changed");
        assertEq(uint256(r0After) * r1After, kBefore, "K changed");
        assertEq(pair.totalSupply(), lpSupplyBefore, "LP supply changed");
        assertEq(
            router.getAmountsOut(1_000e6, _silvToAapl())[1],
            quoteBefore,
            "swap quote changed"
        );

        // ...while the UI layer correctly reports doubled shares
        assertEq(aapl.balanceOfUI(address(pair)), uint256(_aaplReserve(pair)) * 2);
    }

    function test_corporateAction_swapStillExecutesAfterSplit() public {
        aapl.setUIMultiplier(2e18);

        address[] memory path = _silvToAapl();
        vm.prank(trader);
        uint256[] memory amounts =
            router.swapExactTokensForTokens(1_000e6, 0, path, trader, DEADLINE);
        assertGt(amounts[1], 0);

        // pair K still holds after the post-split swap
        LoxleyPair pair = _pair();
        (uint112 r0, uint112 r1,) = pair.getReserves();
        assertGt(uint256(r0) * r1, 0);
    }

    function test_scaledUI_viewsReportUnderlyingShares() public {
        assertEq(aapl.balanceOfUI(trader), aapl.balanceOf(trader)); // 1.0x
        aapl.setUIMultiplier(3e18); // 3:1 split
        assertEq(aapl.balanceOfUI(trader), aapl.balanceOf(trader) * 3);
        assertEq(aapl.totalSupplyUI(), aapl.totalSupply() * 3);
    }

    function _silvToAapl() internal view returns (address[] memory path) {
        path = new address[](2);
        path[0] = address(silver);
        path[1] = address(aapl);
    }

    function _aaplReserve(LoxleyPair pair) internal view returns (uint112) {
        (uint112 r0, uint112 r1,) = pair.getReserves();
        return pair.token0() == address(aapl) ? r0 : r1;
    }
}
