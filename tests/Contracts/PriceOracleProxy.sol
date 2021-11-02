pragma solidity ^0.5.16;

import "../../contracts/GErc20.sol";
import "../../contracts/GToken.sol";
import "../../contracts/PriceOracle.sol";

interface V1PriceOracleInterface {
    function assetPrices(address asset) external view returns (uint);
}

contract PriceOracleProxy is PriceOracle {
    /// @notice Indicator that this is a PriceOracle contract (for inspection)
    bool public constant isPriceOracle = true;

    /// @notice The v1 price oracle, which will continue to serve prices for v1 assets
    V1PriceOracleInterface public v1PriceOracle;

    /// @notice Address of the guardian, which may set the SAI price once
    address public guardian;

    /// @notice Address of the gEther contract, which has a constant price
    address public gEthAddress;

    /// @notice Address of the gUSDC contract, which we hand pick a key for
    address public gUsdcAddress;

    /// @notice Address of the gUSDT contract, which uses the gUSDC price
    address public gUsdtAddress;

    /// @notice Address of the gSAI contract, which may have its price set
    address public gSaiAddress;

    /// @notice Address of the gDAI contract, which we hand pick a key for
    address public gDaiAddress;

    /// @notice Handpicked key for USDC
    address public constant usdcOracleKey = address(1);

    /// @notice Handpicked key for DAI
    address public constant daiOracleKey = address(2);

    /// @notice Frozen SAI price (or 0 if not set yet)
    uint public saiPrice;

    /**
     * @param guardian_ The address of the guardian, which may set the SAI price once
     * @param v1PriceOracle_ The address of the v1 price oracle, which will continue to operate and hold prices for collateral assets
     * @param gEthAddress_ The address of gETH, which will return a constant 1e18, since all prices relative to ether
     * @param gUsdcAddress_ The address of cUSDC, which will be read from a special oracle key
     * @param gSaiAddress_ The address of cSAI, which may be read directly from storage
     * @param gDaiAddress_ The address of cDAI, which will be read from a special oracle key
     * @param gUsdtAddress_ The address of cUSDT, which uses the cUSDC price
     */
    constructor(address guardian_,
                address v1PriceOracle_,
                address gEthAddress_,
                address gUsdcAddress_,
                address gSaiAddress_,
                address gDaiAddress_,
                address gUsdtAddress_) public {
        guardian = guardian_;
        v1PriceOracle = V1PriceOracleInterface(v1PriceOracle_);

        gEthAddress = gEthAddress_;
        gUsdcAddress = gUsdcAddress_;
        gSaiAddress = gSaiAddress_;
        gDaiAddress = gDaiAddress_;
        gUsdtAddress = gUsdtAddress_;
    }

    /**
     * @notice Get the underlying price of a listed gToken asset
     * @param gToken The gToken to get the underlying price of
     * @return The underlying asset price mantissa (scaled by 1e18)
     */
    function getUnderlyingPrice(GToken gToken) public view returns (uint) {
        address gTokenAddress = address(gToken);

        if (gTokenAddress == gEthAddress) {
            // ether always worth 1
            return 1e18;
        }

        if (gTokenAddress == gUsdcAddress || gTokenAddress == gUsdtAddress) {
            return v1PriceOracle.assetPrices(usdcOracleKey);
        }

        if (gTokenAddress == gDaiAddress) {
            return v1PriceOracle.assetPrices(daiOracleKey);
        }

        if (gTokenAddress == gSaiAddress) {
            // use the frozen SAI price if set, otherwise use the DAI price
            return saiPrice > 0 ? saiPrice : v1PriceOracle.assetPrices(daiOracleKey);
        }

        // otherwise just read from v1 oracle
        address underlying = GErc20(gTokenAddress).underlying();
        return v1PriceOracle.assetPrices(underlying);
    }

    /**
     * @notice Set the price of SAI, permanently
     * @param price The price for SAI
     */
    function setSaiPrice(uint price) public {
        require(msg.sender == guardian, "only guardian may set the SAI price");
        require(saiPrice == 0, "SAI price may only be set once");
        require(price < 0.1e18, "SAI price must be < 0.1 ETH");
        saiPrice = price;
    }
}
