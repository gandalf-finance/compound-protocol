pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "../GErc20.sol";
import "../GToken.sol";
import "../PriceOracle.sol";
import "../EIP20Interface.sol";

interface ComptrollerLensInterface {
    function markets(address) external view returns (bool, uint);
    function oracle() external view returns (PriceOracle);
    function getAccountLiquidity(address) external view returns (uint, uint, uint);
    function getAssetsIn(address) external view returns (GToken[] memory);
    function claimPlatformToken(address) external;
    function platformTokenAccrued(address) external view returns (uint);
}

contract GandalfLendingLens {
    struct GTokenMetadata {
        address gToken;
        uint exchangeRateCurrent;
        uint supplyRatePerBlock;
        uint borrowRatePerBlock;
        uint reserveFactorMantissa;
        uint totalBorrows;
        uint totalReserves;
        uint totalSupply;
        uint totalCash;
        bool isListed;
        uint collateralFactorMantissa;
        address underlyingAssetAddress;
        uint gTokenDecimals;
        uint underlyingDecimals;
    }

    function gTokenMetadata(GToken gToken) public returns (GTokenMetadata memory) {
        uint exchangeRateCurrent = gToken.exchangeRateCurrent();
        ComptrollerLensInterface comptroller = ComptrollerLensInterface(address(gToken.comptroller()));
        (bool isListed, uint collateralFactorMantissa) = comptroller.markets(address(gToken));
        address underlyingAssetAddress;
        uint underlyingDecimals;

        if (compareStrings(gToken.symbol(), "gETH")) {
            underlyingAssetAddress = address(0);
            underlyingDecimals = 18;
        } else {
            GErc20 gErc20 = GErc20(address(gToken));
            underlyingAssetAddress = gErc20.underlying();
            underlyingDecimals = EIP20Interface(gErc20.underlying()).decimals();
        }

        return GTokenMetadata({
            gToken: address(gToken),
            exchangeRateCurrent: exchangeRateCurrent,
            supplyRatePerBlock: gToken.supplyRatePerBlock(),
            borrowRatePerBlock: gToken.borrowRatePerBlock(),
            reserveFactorMantissa: gToken.reserveFactorMantissa(),
            totalBorrows: gToken.totalBorrows(),
            totalReserves: gToken.totalReserves(),
            totalSupply: gToken.totalSupply(),
            totalCash: gToken.getCash(),
            isListed: isListed,
            collateralFactorMantissa: collateralFactorMantissa,
            underlyingAssetAddress: underlyingAssetAddress,
            gTokenDecimals: gToken.decimals(),
            underlyingDecimals: underlyingDecimals
        });
    }

    function gTokenMetadataAll(GToken[] calldata gTokens) external returns (GTokenMetadata[] memory) {
        uint gTokenCount = gTokens.length;
        GTokenMetadata[] memory res = new GTokenMetadata[](gTokenCount);
        for (uint i = 0; i < gTokenCount; i++) {
            res[i] = gTokenMetadata(gTokens[i]);
        }
        return res;
    }

    struct GTokenBalances {
        address gToken;
        uint balanceOf;
        uint borrowBalanceCurrent;
        uint balanceOfUnderlying;
        uint tokenBalance;
        uint tokenAllowance;
    }

    function gTokenBalances(GToken gToken, address payable account) public returns (GTokenBalances memory) {
        uint balanceOf = gToken.balanceOf(account);
        uint borrowBalanceCurrent = gToken.borrowBalanceCurrent(account);
        uint balanceOfUnderlying = gToken.balanceOfUnderlying(account);
        uint tokenBalance;
        uint tokenAllowance;

        if (compareStrings(gToken.symbol(), "gETH")) {
            tokenBalance = account.balance;
            tokenAllowance = account.balance;
        } else {
            GErc20 gErc20 = GErc20(address(gToken));
            EIP20Interface underlying = EIP20Interface(gErc20.underlying());
            tokenBalance = underlying.balanceOf(account);
            tokenAllowance = underlying.allowance(account, address(gToken));
        }

        return GTokenBalances({
            gToken: address(gToken),
            balanceOf: balanceOf,
            borrowBalanceCurrent: borrowBalanceCurrent,
            balanceOfUnderlying: balanceOfUnderlying,
            tokenBalance: tokenBalance,
            tokenAllowance: tokenAllowance
        });
    }

    function gTokenBalancesAll(GToken[] calldata gTokens, address payable account) external returns (GTokenBalances[] memory) {
        uint gTokenCount = gTokens.length;
        GTokenBalances[] memory res = new GTokenBalances[](gTokenCount);
        for (uint i = 0; i < gTokenCount; i++) {
            res[i] = gTokenBalances(gTokens[i], account);
        }
        return res;
    }

    struct GTokenUnderlyingPrice {
        address gToken;
        uint underlyingPrice;
    }

    function gTokenUnderlyingPrice(GToken gToken) public returns (GTokenUnderlyingPrice memory) {
        ComptrollerLensInterface comptroller = ComptrollerLensInterface(address(gToken.comptroller()));
        PriceOracle priceOracle = comptroller.oracle();

        return GTokenUnderlyingPrice({
            gToken: address(gToken),
            underlyingPrice: priceOracle.getUnderlyingPrice(gToken)
        });
    }

    function gTokenUnderlyingPriceAll(GToken[] calldata gTokens) external returns (GTokenUnderlyingPrice[] memory) {
        uint gTokenCount = gTokens.length;
        GTokenUnderlyingPrice[] memory res = new GTokenUnderlyingPrice[](gTokenCount);
        for (uint i = 0; i < gTokenCount; i++) {
            res[i] = gTokenUnderlyingPrice(gTokens[i]);
        }
        return res;
    }

    struct AccountLimits {
        GToken[] markets;
        uint liquidity;
        uint shortfall;
    }

    function getAccountLimits(ComptrollerLensInterface comptroller, address account) public returns (AccountLimits memory) {
        (uint errorCode, uint liquidity, uint shortfall) = comptroller.getAccountLiquidity(account);
        require(errorCode == 0);

        return AccountLimits({
            markets: comptroller.getAssetsIn(account),
            liquidity: liquidity,
            shortfall: shortfall
        });
    }

    struct PlatformTokenBalanceMetadata {
        uint balance;
        uint votes;
        address delegate;
    }

    function getPlatformTokenBalanceMetadata(EIP20Interface platformToken, address account) external view returns (PlatformTokenBalanceMetadata memory) {
        return PlatformTokenBalanceMetadata({
            balance: platformToken.balanceOf(account),
            votes : 0,
            delegate :address(0)
        });
    }

    struct PlatformTokenBalanceMetadataExt {
        uint balance;
        uint votes;
        address delegate;
        uint allocated;
    }

    function getPlatformTokenBalanceMetadataExt(EIP20Interface platformToken, ComptrollerLensInterface comptroller, address account) external returns (PlatformTokenBalanceMetadataExt memory) {
        uint balance = platformToken.balanceOf(account);
        comptroller.claimPlatformToken(account);
        uint newBalance = platformToken.balanceOf(account);
        uint accrued = comptroller.platformTokenAccrued(account);
        uint total = add(accrued, newBalance, "sum platformToken total");
        uint allocated = sub(total, balance, "sub allocated");

        return PlatformTokenBalanceMetadataExt({
            balance: balance,
            votes: 0,
            delegate: address(0),
            allocated: allocated
        });
    }

    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }

    function add(uint a, uint b, string memory errorMessage) internal pure returns (uint) {
        uint c = a + b;
        require(c >= a, errorMessage);
        return c;
    }

    function sub(uint a, uint b, string memory errorMessage) internal pure returns (uint) {
        require(b <= a, errorMessage);
        uint c = a - b;
        return c;
    }
}
