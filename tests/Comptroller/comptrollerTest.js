const {
  etherMantissa,
  both
} = require('../Utils/Ethereum');

const {
  makeComptroller,
  makePriceOracle,
  makeSLToken,
  makeToken
} = require('../Utils/SashimiLending');

describe('Comptroller', () => {
  let root, accounts;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe('constructor', () => {
    it("on success it sets admin to creator and pendingAdmin is unset", async () => {
      const comptroller = await makeComptroller();
      expect(await call(comptroller, 'admin')).toEqual(root);
      expect(await call(comptroller, 'pendingAdmin')).toEqualNumber(0);
    });

    it("on success it sets closeFactor and maxAssets as specified", async () => {
      const comptroller = await makeComptroller();
      expect(await call(comptroller, 'closeFactorMantissa')).toEqualNumber(0.051e18);
      expect(await call(comptroller, 'maxAssets')).toEqualNumber(10);
    });

    it("allows small and large maxAssets", async () => {
      const comptroller = await makeComptroller({maxAssets: 0});
      expect(await call(comptroller, 'maxAssets')).toEqualNumber(0);

      // 5000 is an arbitrary number larger than what we expect to ever actually use
      await send(comptroller, '_setMaxAssets', [5000]);
      expect(await call(comptroller, 'maxAssets')).toEqualNumber(5000);
    });
  });

  describe('_setLiquidationIncentive', () => {
    const initialIncentive = etherMantissa(1.0);
    const validIncentive = etherMantissa(1.1);
    const tooSmallIncentive = etherMantissa(0.99999);
    const tooLargeIncentive = etherMantissa(1.50000001);

    let comptroller;
    beforeEach(async () => {
      comptroller = await makeComptroller();
    });

    it("fails if called by non-admin", async () => {
      const {reply, receipt} = await both(comptroller, '_setLiquidationIncentive', [initialIncentive], {from: accounts[0]});
      expect(reply).toHaveTrollError('UNAUTHORIZED');
      expect(receipt).toHaveTrollFailure('UNAUTHORIZED', 'SET_LIQUIDATION_INCENTIVE_OWNER_CHECK');
      expect(await call(comptroller, 'liquidationIncentiveMantissa')).toEqualNumber(initialIncentive);
    });

    it("fails if incentive is less than min", async () => {
      const {reply, receipt} = await both(comptroller, '_setLiquidationIncentive', [tooSmallIncentive]);
      expect(reply).toHaveTrollError('INVALID_LIQUIDATION_INCENTIVE');
      expect(receipt).toHaveTrollFailure('INVALID_LIQUIDATION_INCENTIVE', 'SET_LIQUIDATION_INCENTIVE_VALIDATION');
      expect(await call(comptroller, 'liquidationIncentiveMantissa')).toEqualNumber(initialIncentive);
    });

    it("fails if incentive is greater than max", async () => {
      const {reply, receipt} = await both(comptroller, '_setLiquidationIncentive', [tooLargeIncentive]);
      expect(reply).toHaveTrollError('INVALID_LIQUIDATION_INCENTIVE');
      expect(receipt).toHaveTrollFailure('INVALID_LIQUIDATION_INCENTIVE', 'SET_LIQUIDATION_INCENTIVE_VALIDATION');
      expect(await call(comptroller, 'liquidationIncentiveMantissa')).toEqualNumber(initialIncentive);
    });

    it("accepts a valid incentive and emits a NewLiquidationIncentive event", async () => {
      const {reply, receipt} = await both(comptroller, '_setLiquidationIncentive', [validIncentive]);
      expect(reply).toHaveTrollError('NO_ERROR');
      expect(receipt).toHaveLog('NewLiquidationIncentive', {
        oldLiquidationIncentiveMantissa: initialIncentive.toString(),
        newLiquidationIncentiveMantissa: validIncentive.toString()
      });
      expect(await call(comptroller, 'liquidationIncentiveMantissa')).toEqualNumber(validIncentive);
    });
  });

  describe('_setPriceOracle', () => {
    let comptroller, oldOracle, newOracle;
    beforeEach(async () => {
      comptroller = await makeComptroller();
      oldOracle = comptroller.priceOracle;
      newOracle = await makePriceOracle();
    });

    it("fails if called by non-admin", async () => {
      expect(
        await send(comptroller, '_setPriceOracle', [newOracle._address], {from: accounts[0]})
      ).toHaveTrollFailure('UNAUTHORIZED', 'SET_PRICE_ORACLE_OWNER_CHECK');
      expect(await comptroller.methods.oracle().call()).toEqual(oldOracle._address);
    });

    it.skip("reverts if passed a contract that doesn't implement isPriceOracle", async () => {
      await expect(send(comptroller, '_setPriceOracle', [comptroller._address])).rejects.toRevert();
      expect(await call(comptroller, 'oracle')).toEqual(oldOracle._address);
    });

    it.skip("reverts if passed a contract that implements isPriceOracle as false", async () => {
      await send(newOracle, 'setIsPriceOracle', [false]); // Note: not yet implemented
      await expect(send(notOracle, '_setPriceOracle', [comptroller._address])).rejects.toRevert("revert oracle method isPriceOracle returned false");
      expect(await call(comptroller, 'oracle')).toEqual(oldOracle._address);
    });

    it("accepts a valid price oracle and emits a NewPriceOracle event", async () => {
      const result = await send(comptroller, '_setPriceOracle', [newOracle._address]);
      expect(result).toSucceed();
      expect(result).toHaveLog('NewPriceOracle', {
        oldPriceOracle: oldOracle._address,
        newPriceOracle: newOracle._address
      });
      expect(await call(comptroller, 'oracle')).toEqual(newOracle._address);
    });
  });

  describe('_setCloseFactor', () => {
    it("fails if not called by admin", async () => {
      const slToken = await makeSLToken();
      expect(
        await send(slToken.comptroller, '_setCloseFactor', [1], {from: accounts[0]})
      ).toHaveTrollFailure('UNAUTHORIZED', 'SET_CLOSE_FACTOR_OWNER_CHECK');
    });

    it("fails if close factor too low", async () => {
      const slToken = await makeSLToken();
      expect(await send(slToken.comptroller, '_setCloseFactor', [1])).toHaveTrollFailure('INVALID_CLOSE_FACTOR', 'SET_CLOSE_FACTOR_VALIDATION');
    });

    it("fails if close factor too low", async () => {
      const slToken = await makeSLToken();
      expect(await send(slToken.comptroller, '_setCloseFactor', [etherMantissa(1e18)])).toHaveTrollFailure('INVALID_CLOSE_FACTOR', 'SET_CLOSE_FACTOR_VALIDATION');
    });
  });

  describe('_setCollateralFactor', () => {
    const half = etherMantissa(0.5);
    const one = etherMantissa(1);

    it("fails if not called by admin", async () => {
      const slToken = await makeSLToken();
      expect(
        await send(slToken.comptroller, '_setCollateralFactor', [slToken._address, half], {from: accounts[0]})
      ).toHaveTrollFailure('UNAUTHORIZED', 'SET_COLLATERAL_FACTOR_OWNER_CHECK');
    });

    it("fails if asset is not listed", async () => {
      const slToken = await makeSLToken();
      expect(
        await send(slToken.comptroller, '_setCollateralFactor', [slToken._address, half])
      ).toHaveTrollFailure('MARKET_NOT_LISTED', 'SET_COLLATERAL_FACTOR_NO_EXISTS');
    });

    it("fails if factor is too high", async () => {
      const slToken = await makeSLToken({supportMarket: true});
      expect(
        await send(slToken.comptroller, '_setCollateralFactor', [slToken._address, one])
      ).toHaveTrollFailure('INVALID_COLLATERAL_FACTOR', 'SET_COLLATERAL_FACTOR_VALIDATION');
    });

    it("fails if factor is set without an underlying price", async () => {
      const slToken = await makeSLToken({supportMarket: true});
      expect(
        await send(slToken.comptroller, '_setCollateralFactor', [slToken._address, half])
      ).toHaveTrollFailure('PRICE_ERROR', 'SET_COLLATERAL_FACTOR_WITHOUT_PRICE');
    });

    it("succeeds and sets market", async () => {
      const slToken = await makeSLToken({supportMarket: true, underlyingPrice: 1});
      const result = await send(slToken.comptroller, '_setCollateralFactor', [slToken._address, half]);
      expect(result).toHaveLog('NewCollateralFactor', {
        slToken: slToken._address,
        oldCollateralFactorMantissa: '0',
        newCollateralFactorMantissa: half.toString()
      });
    });
  });

  describe('_supportMarket', () => {
    it("fails if not called by admin", async () => {
      const slToken = await makeSLToken(root);
      expect(
        await send(slToken.comptroller, '_supportMarket', [slToken._address], {from: accounts[0]})
      ).toHaveTrollFailure('UNAUTHORIZED', 'SUPPORT_MARKET_OWNER_CHECK');
    });

    it("fails if asset is not a SLToken", async () => {
      const comptroller = await makeComptroller()
      const asset = await makeToken(root);
      await expect(send(comptroller, '_supportMarket', [asset._address])).rejects.toRevert();
    });

    it("succeeds and sets market", async () => {
      const slToken = await makeSLToken();
      const result = await send(slToken.comptroller, '_supportMarket', [slToken._address]);
      expect(result).toHaveLog('MarketListed', {slToken: slToken._address});
    });

    it("cannot list a market a second time", async () => {
      const slToken = await makeSLToken();
      const result1 = await send(slToken.comptroller, '_supportMarket', [slToken._address]);
      const result2 = await send(slToken.comptroller, '_supportMarket', [slToken._address]);
      expect(result1).toHaveLog('MarketListed', {slToken: slToken._address});
      expect(result2).toHaveTrollFailure('MARKET_ALREADY_LISTED', 'SUPPORT_MARKET_EXISTS');
    });

    it("can list two different markets", async () => {
      const slToken1 = await makeSLToken();
      const slToken2 = await makeSLToken({comptroller: slToken1.comptroller});
      const result1 = await send(slToken1.comptroller, '_supportMarket', [slToken1._address]);
      const result2 = await send(slToken1.comptroller, '_supportMarket', [slToken2._address]);
      expect(result1).toHaveLog('MarketListed', {slToken: slToken1._address});
      expect(result2).toHaveLog('MarketListed', {slToken: slToken2._address});
    });
  });

  describe('redeemVerify', () => {
    it('should allow you to redeem 0 underlying for 0 tokens', async () => {
      const comptroller = await makeComptroller();
      const slToken = await makeSLToken({comptroller: comptroller});
      await call(comptroller, 'redeemVerify', [slToken._address, accounts[0], 0, 0]);
    });

    it('should allow you to redeem 5 underlyig for 5 tokens', async () => {
      const comptroller = await makeComptroller();
      const slToken = await makeSLToken({comptroller: comptroller});
      await call(comptroller, 'redeemVerify', [slToken._address, accounts[0], 5, 5]);
    });

    it('should not allow you to redeem 5 underlying for 0 tokens', async () => {
      const comptroller = await makeComptroller();
      const slToken = await makeSLToken({comptroller: comptroller});
      await expect(call(comptroller, 'redeemVerify', [slToken._address, accounts[0], 5, 0])).rejects.toRevert("revert redeemTokens zero");
    });
  })
});
