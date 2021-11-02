const {
  address,
  encodeParameters,
} = require('../Utils/Ethereum');
const {
  makeComptroller,
  makeGToken,
} = require('../Utils/GandalfLending');

function cullTuple(tuple) {
  return Object.keys(tuple).reduce((acc, key) => {
    if (Number.isNaN(Number(key))) {
      return {
        ...acc,
        [key]: tuple[key]
      };
    } else {
      return acc;
    }
  }, {});
}

describe('GandalfLendingLens', () => {
  let gandalfLendingLens;
  let acct;

  beforeEach(async () => {
    gandalfLendingLens = await deploy('GandalfLendingLens');
    acct = accounts[0];
  });

  describe('gTokenMetadata', () => {
    it('is correct for a gErc20', async () => {
      let gErc20 = await makeGToken();
      expect(
        cullTuple(await call(gandalfLendingLens, 'gTokenMetadata', [gErc20._address]))
      ).toEqual(
        {
          gToken: gErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(gErc20, 'underlying', []),
          gTokenDecimals: "8",
          underlyingDecimals: "18"
        }
      );
    });

    it('is correct for gEth', async () => {
      let gEth = await makeGToken({kind: 'gether'});
      expect(
        cullTuple(await call(gandalfLendingLens, 'gTokenMetadata', [gEth._address]))
      ).toEqual({
        borrowRatePerBlock: "0",
        gToken: gEth._address,
        gTokenDecimals: "8",
        collateralFactorMantissa: "0",
        exchangeRateCurrent: "1000000000000000000",
        isListed: false,
        reserveFactorMantissa: "0",
        supplyRatePerBlock: "0",
        totalBorrows: "0",
        totalCash: "0",
        totalReserves: "0",
        totalSupply: "0",
        underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
        underlyingDecimals: "18",
      });
    });
  });

  describe('gTokenMetadataAll', () => {
    it('is correct for a gErc20 and gEther', async () => {
      let gErc20 = await makeGToken();
      let gEth = await makeGToken({kind: 'gether'});
      expect(
        (await call(gandalfLendingLens, 'gTokenMetadataAll', [[gErc20._address, gEth._address]])).map(cullTuple)
      ).toEqual([
        {
          gToken: gErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(gErc20, 'underlying', []),
          gTokenDecimals: "8",
          underlyingDecimals: "18"
        },
        {
          borrowRatePerBlock: "0",
          gToken: gEth._address,
          gTokenDecimals: "8",
          collateralFactorMantissa: "0",
          exchangeRateCurrent: "1000000000000000000",
          isListed: false,
          reserveFactorMantissa: "0",
          supplyRatePerBlock: "0",
          totalBorrows: "0",
          totalCash: "0",
          totalReserves: "0",
          totalSupply: "0",
          underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
          underlyingDecimals: "18",
        }
      ]);
    });
  });

  describe('gTokenBalances', () => {
    it('is correct for gERC20', async () => {
      let gErc20 = await makeGToken();
      expect(
        cullTuple(await call(gandalfLendingLens, 'gTokenBalances', [gErc20._address, acct]))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          gToken: gErc20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        }
      );
    });

    it('is correct for gETH', async () => {
      let gEth = await makeGToken({kind: 'gether'});
      let ethBalance = await web3.eth.getBalance(acct);
      expect(
        cullTuple(await call(gandalfLendingLens, 'gTokenBalances', [gEth._address, acct], {gasPrice: '0'}))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          gToken: gEth._address,
          tokenAllowance: ethBalance,
          tokenBalance: ethBalance,
        }
      );
    });
  });

  describe('gTokenBalancesAll', () => {
    it('is correct for gEth and gErc20', async () => {
      let gErc20 = await makeGToken();
      let gEth = await makeGToken({kind: 'gether'});
      let ethBalance = await web3.eth.getBalance(acct);
      
      expect(
        (await call(gandalfLendingLens, 'gTokenBalancesAll', [[gErc20._address, gEth._address], acct], {gasPrice: '0'})).map(cullTuple)
      ).toEqual([
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          gToken: gErc20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        },
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          gToken: gEth._address,
          tokenAllowance: ethBalance,
          tokenBalance: ethBalance,
        }
      ]);
    })
  });

  describe('gTokenUnderlyingPrice', () => {
    it('gets correct price for gErc20', async () => {
      let gErc20 = await makeGToken();
      expect(
        cullTuple(await call(gandalfLendingLens, 'gTokenUnderlyingPrice', [gErc20._address]))
      ).toEqual(
        {
          gToken: gErc20._address,
          underlyingPrice: "0",
        }
      );
    });

    it('gets correct price for gEth', async () => {
      let gEth = await makeGToken({kind: 'gether'});
      expect(
        cullTuple(await call(gandalfLendingLens, 'gTokenUnderlyingPrice', [gEth._address]))
      ).toEqual(
        {
          gToken: gEth._address,
          underlyingPrice: "1000000000000000000",
        }
      );
    });
  });

  describe('gTokenUnderlyingPriceAll', () => {
    it('gets correct price for both', async () => {
      let gErc20 = await makeGToken();
      let gEth = await makeGToken({kind: 'gether'});
      expect(
        (await call(gandalfLendingLens, 'gTokenUnderlyingPriceAll', [[gErc20._address, gEth._address]])).map(cullTuple)
      ).toEqual([
        {
          gToken: gErc20._address,
          underlyingPrice: "0",
        },
        {
          gToken: gEth._address,
          underlyingPrice: "1000000000000000000",
        }
      ]);
    });
  });

  describe('getAccountLimits', () => {
    it('gets correct values', async () => {
      let comptroller = await makeComptroller();

      expect(
        cullTuple(await call(gandalfLendingLens, 'getAccountLimits', [comptroller._address, acct]))
      ).toEqual({
        liquidity: "0",
        markets: [],
        shortfall: "0"
      });
    });
  });

  

  describe('platformToken', () => {
    let platformToken, currentBlock;

    beforeEach(async () => {
      currentBlock = +(await web3.eth.getBlockNumber());
      platformToken = await deploy('PlatformTokenToken', [acct]);
    });

    describe('getCompBalanceMetadata', () => {
      it('gets correct values', async () => {
        expect(
          cullTuple(await call(gandalfLendingLens, 'getPlatformTokenBalanceMetadata', [platformToken._address, acct]))
        ).toEqual({
          balance: "10000000000000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
        });
      });
    });

    describe('getPlatformTokenBalanceMetadataExt', () => {
      it('gets correct values', async () => {
        let comptroller = await makeComptroller();
        await send(comptroller, 'setPlatformTokenAccrued', [acct, 5]); // harness only

        expect(
          cullTuple(await call(gandalfLendingLens, 'getPlatformTokenBalanceMetadataExt', [platformToken._address, comptroller._address, acct]))
        ).toEqual({
          balance: "10000000000000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
          allocated: "5"
        });
      });
    });
  });
});
