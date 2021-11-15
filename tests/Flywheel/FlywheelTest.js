const {
  makeComptroller,
  makeGToken,
  balanceOf,
  fastForward,
  pretendBorrow,
  quickMint
} = require('../Utils/GandalfLending');
const {
  etherExp,
  etherDouble,
  etherUnsigned,
  etherMantissa
} = require('../Utils/Ethereum');

const platformTokenRate = etherUnsigned(1e18);

async function platformTokenAccrued(comptroller, user) {
  return etherUnsigned(await call(comptroller, 'platformTokenAccrued', [user]));
}

async function platformTokenBalance(comptroller, user) {
  return etherUnsigned(await call(comptroller.platformToken, 'balanceOf', [user]))
}

async function totalPlatformTokenAccrued(comptroller, user) {
  return (await platformTokenAccrued(comptroller, user)).add(await platformTokenBalance(comptroller, user));
}

describe('Flywheel upgrade', () => {
  describe('becomes the comptroller', () => {
    it('adds the platformToken markets', async () => {
      let root = saddle.accounts[0];
      let unitroller = await makeComptroller({kind: 'unitroller-g2'});
      let platformTokenMarkets = await Promise.all([1, 2, 3].map(async _ => {
        return makeGToken({comptroller: unitroller, supportMarket: true});
      }));
      platformTokenMarkets = platformTokenMarkets.map(c => c._address);
      unitroller = await makeComptroller({kind: 'unitroller-g3', unitroller, platformTokenMarkets});
      expect(await call(unitroller, 'getPlatformTokenMarkets')).toEqual(platformTokenMarkets);
    });

    it('adds the other markets', async () => {
      let root = saddle.accounts[0];
      let unitroller = await makeComptroller({kind: 'unitroller-g2'});
      let allMarkets = await Promise.all([1, 2, 3].map(async _ => {
        return makeGToken({comptroller: unitroller, supportMarket: true});
      }));
      allMarkets = allMarkets.map(c => c._address);
      unitroller = await makeComptroller({
        kind: 'unitroller-g3',
        unitroller,
        platformTokenMarkets: allMarkets.slice(0, 1),
        otherMarkets: allMarkets.slice(1)
      });
      expect(await call(unitroller, 'getAllMarkets')).toEqual(allMarkets);
      expect(await call(unitroller, 'getPlatformTokenMarkets')).toEqual(allMarkets.slice(0, 1));
    });

    it('_supportMarket() adds to all markets, and only once', async () => {
      let root = saddle.accounts[0];
      let unitroller = await makeComptroller({kind: 'unitroller-g3'});
      let allMarkets = [];
      for (let _ of Array(10)) {
        allMarkets.push(await makeGToken({comptroller: unitroller, supportMarket: true}));
      }
      expect(await call(unitroller, 'getAllMarkets')).toEqual(allMarkets.map(c => c._address));
      expect(
        makeComptroller({
          kind: 'unitroller-g3',
          unitroller,
          otherMarkets: [allMarkets[0]._address]
        })
      ).rejects.toRevert('revert market already added');
    });
  });
});

describe('Flywheel', () => {
  let root, a1, a2, a3, accounts;
  let comptroller, gLOW, gREP, gZRX, cEVIL;
  beforeEach(async () => {
    let interestRateModelOpts = {borrowRate: 0.000001};
    [root, a1, a2, a3, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    gLOW = await makeGToken({comptroller, supportMarket: true, underlyingPrice: 1, interestRateModelOpts});
    gREP = await makeGToken({comptroller, supportMarket: true, underlyingPrice: 2, interestRateModelOpts});
    gZRX = await makeGToken({comptroller, supportMarket: true, underlyingPrice: 3, interestRateModelOpts});
    cEVIL = await makeGToken({comptroller, supportMarket: false, underlyingPrice: 3, interestRateModelOpts});
    await send(comptroller, '_addPlatformTokenMarkets', [[gLOW, gREP, gZRX].map(c => c._address)]);
  });

  describe('getPlatformTokenMarkets()', () => {
    it('should return the platformToken markets', async () => {
      expect(await call(comptroller, 'getPlatformTokenMarkets')).toEqual(
        [gLOW, gREP, gZRX].map((c) => c._address)
      );
    });
  });

  describe('updatePlatformTokenBorrowIndex()', () => {
    it('should calculate platformToken borrower index correctly', async () => {
      const mkt = gREP;
      await send(comptroller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalBorrows', [etherUnsigned(11e18)]);
      await send(comptroller, 'setPlatformTokenSpeed', [mkt._address, etherExp(0.5)]);
      await send(comptroller, 'harnessUpdatePlatformTokenBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);
      /*
        100 blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed

        borrowAmt   = totalBorrows * 1e18 / borrowIdx
                    = 11e18 * 1e18 / 1.1e18 = 10e18
        platformTokenAccrued = deltaBlocks * borrowSpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += 1e36 + platformTokenAccrued * 1e36 / borrowAmt
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */

      const {index, block} = await call(comptroller, 'platformTokenBorrowState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not revert or update platformTokenBorrowState index if gToken not in PLATFORMTOKEN markets', async () => {
      const mkt = await makeGToken({
        comptroller: comptroller,
        supportMarket: true,
        addPlatformTokenMarket: false,
      });
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdatePlatformTokenBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'platformTokenBorrowState', [mkt._address]);
      expect(index).toEqualNumber(0);
      expect(block).toEqualNumber(100);
      const speed = await call(comptroller, 'platformTokenSpeeds', [mkt._address]);
      expect(speed).toEqualNumber(0);
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = gREP;
      await send(comptroller, 'setPlatformTokenSpeed', [mkt._address, etherExp(0.5)]);
      await send(comptroller, 'harnessUpdatePlatformTokenBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'platformTokenBorrowState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });

    it('should not update index if platformToken speed is 0', async () => {
      const mkt = gREP;
      await send(comptroller, 'setPlatformTokenSpeed', [mkt._address, etherExp(0)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdatePlatformTokenBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'platformTokenBorrowState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(100);
    });
  });

  describe('updatePlatformTokenSupplyIndex()', () => {
    it('should calculate platformToken supplier index correctly', async () => {
      const mkt = gREP;
      await send(comptroller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalSupply', [etherUnsigned(10e18)]);
      await send(comptroller, 'setPlatformTokenSpeed', [mkt._address, etherExp(0.5)]);
      await send(comptroller, 'harnessUpdatePlatformTokenSupplyIndex', [mkt._address]);
      /*
        suppyTokens = 10e18
        platformTokenAccrued = deltaBlocks * supplySpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += platformTokenAccrued * 1e36 / supplyTokens
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */
      const {index, block} = await call(comptroller, 'platformTokenSupplyState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not update index on non-PLATFORMTOKEN markets', async () => {
      const mkt = await makeGToken({
        comptroller: comptroller,
        supportMarket: true,
        addPlatformTokenMarket: false
      });
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdatePlatformTokenSupplyIndex', [
        mkt._address
      ]);

      const {index, block} = await call(comptroller, 'platformTokenSupplyState', [mkt._address]);
      expect(index).toEqualNumber(0);
      expect(block).toEqualNumber(100);
      const speed = await call(comptroller, 'platformTokenSpeeds', [mkt._address]);
      expect(speed).toEqualNumber(0);
      // gToken could have no platformToken speed or platformToken supplier state if not in platformToken markets
      // this logic could also possibly be implemented in the allowed hook
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = gREP;
      await send(comptroller, 'setBlockNumber', [0]);
      await send(mkt, 'harnessSetTotalSupply', [etherUnsigned(10e18)]);
      await send(comptroller, 'setPlatformTokenSpeed', [mkt._address, etherExp(0.5)]);
      await send(comptroller, 'harnessUpdatePlatformTokenSupplyIndex', [mkt._address]);

      const {index, block} = await call(comptroller, 'platformTokenSupplyState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });

    it('should not matter if the index is updated multiple times', async () => {
      const platformTokenRemaining = platformTokenRate.mul(100)
      await send(comptroller.platformToken, 'transfer', [comptroller._address, platformTokenRemaining], {from: root});
      await pretendBorrow(gLOW, a1, 1, 1, 100);
      await send(comptroller, 'refreshPlatformTokenSpeeds');

      await quickMint(gLOW, a2, etherUnsigned(10e18));
      await quickMint(gLOW, a3, etherUnsigned(15e18));

      const a2Accrued0 = await totalPlatformTokenAccrued(comptroller, a2);
      const a3Accrued0 = await totalPlatformTokenAccrued(comptroller, a3);
      const a2Balance0 = await balanceOf(gLOW, a2);
      const a3Balance0 = await balanceOf(gLOW, a3);

      await fastForward(comptroller, 20);

      const txT1 = await send(gLOW, 'transfer', [a2, a3Balance0.sub(a2Balance0)], {from: a3});

      const a2Accrued1 = await totalPlatformTokenAccrued(comptroller, a2);
      const a3Accrued1 = await totalPlatformTokenAccrued(comptroller, a3);
      const a2Balance1 = await balanceOf(gLOW, a2);
      const a3Balance1 = await balanceOf(gLOW, a3);

      await fastForward(comptroller, 10);
      await send(comptroller, 'harnessUpdatePlatformTokenSupplyIndex', [gLOW._address]);
      await fastForward(comptroller, 10);

      const txT2 = await send(gLOW, 'transfer', [a3, a2Balance1.sub(a3Balance1)], {from: a2});

      const a2Accrued2 = await totalPlatformTokenAccrued(comptroller, a2);
      const a3Accrued2 = await totalPlatformTokenAccrued(comptroller, a3);

      expect(a2Accrued0).toEqualNumber(0);
      expect(a3Accrued0).toEqualNumber(0);
      expect(a2Accrued1).not.toEqualNumber(0);
      expect(a3Accrued1).not.toEqualNumber(0);
      expect(a2Accrued1).toEqualNumber(a3Accrued2.sub(a3Accrued1));
      expect(a3Accrued1).toEqualNumber(a2Accrued2.sub(a2Accrued1));

      expect(txT1.gasUsed).toBeLessThan(200000);
      expect(txT1.gasUsed).toBeGreaterThan(150000);
      expect(txT2.gasUsed).toBeLessThan(200000);
      expect(txT2.gasUsed).toBeGreaterThan(140000);
    });
  });

  describe('distributeBorrowerPlatformToken()', () => {

    it('should update borrow index checkpoint but not platformTokenAccrued for first time user', async () => {
      const mkt = gREP;
      await send(comptroller, "setPlatformTokenBorrowState", [mkt._address, etherDouble(6), 10]);
      await send(comptroller, "setPlatformTokenBorrowerIndex", [mkt._address, root, etherUnsigned(0)]);

      await send(comptroller, "harnessDistributeBorrowerPlatformToken", [mkt._address, root, etherExp(1.1)]);
      expect(await call(comptroller, "platformTokenAccrued", [root])).toEqualNumber(0);
      expect(await call(comptroller, "platformTokenBorrowerIndex", [ mkt._address, root])).toEqualNumber(6e36);
    });

    it('should transfer platformToken and update borrow index checkpoint correctly for repeat time user', async () => {
      const mkt = gREP;
      await send(comptroller.platformToken, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, etherUnsigned(5.5e18), etherExp(1)]);
      await send(comptroller, "setPlatformTokenBorrowState", [mkt._address, etherDouble(6), 10]);
      await send(comptroller, "setPlatformTokenBorrowerIndex", [mkt._address, a1, etherDouble(1)]);

      /*
      * 100 delta blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed => 6e18 platformTokenBorrowIndex
      * this tests that an acct with half the total borrows over that time gets 25e18 PLATFORMTOKEN
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e18 * 1e18 / 1.1e18 = 5e18
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 6e36 - 1e36 = 5e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e18 * 5e36 / 1e36 = 25e18
      */
      const tx = await send(comptroller, "harnessDistributeBorrowerPlatformToken", [mkt._address, a1, etherUnsigned(1.1e18)]);
      expect(await platformTokenAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await platformTokenBalance(comptroller, a1)).toEqualNumber(25e18);
      expect(tx).toHaveLog('DistributedBorrowerPlatformToken', {
        gToken: mkt._address,
        borrower: a1,
        platformTokenDelta: etherUnsigned(25e18).toString(),
        platformTokenBorrowIndex: etherDouble(6).toString()
      });
    });

    it('should not transfer if below platformToken claim threshold', async () => {
      const mkt = gREP;
      await send(comptroller.platformToken, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, etherUnsigned(5.5e17), etherExp(1)]);
      await send(comptroller, "setPlatformTokenBorrowState", [mkt._address, etherDouble(1.0019), 10]);
      await send(comptroller, "setPlatformTokenBorrowerIndex", [mkt._address, a1, etherDouble(1)]);
      /*
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e17 * 1e18 / 1.1e18 = 5e17
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 1.0019e36 - 1e36 = 0.0019e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
        0.00095e18 < platformTokenClaimThreshold of 0.001e18
      */
      await send(comptroller, "harnessDistributeBorrowerPlatformToken", [mkt._address, a1, etherExp(1.1)]);
      expect(await platformTokenAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await platformTokenBalance(comptroller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-PLATFORMTOKEN market', async () => {
      const mkt = await makeGToken({
        comptroller: comptroller,
        supportMarket: true,
        addPlatformTokenMarket: false,
      });

      await send(comptroller, "harnessDistributeBorrowerPlatformToken", [mkt._address, a1, etherExp(1.1)]);
      expect(await platformTokenAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await platformTokenBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, 'platformTokenBorrowerIndex', [mkt._address, a1])).toEqualNumber(0);
    });
  });

  describe('distributeSupplierPlatformToken()', () => {
    it('should transfer platformToken and update supply index correctly for first time user', async () => {
      const mkt = gREP;
      await send(comptroller.platformToken, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, etherUnsigned(5e18)]);
      await send(comptroller, "setPlatformTokenSupplyState", [mkt._address, etherDouble(6), 10]);
      /*
      * 100 delta blocks, 10e18 total supply, 0.5e18 supplySpeed => 6e18 platformTokenSupplyIndex
      * confirming an acct with half the total supply over that time gets 25e18 PLATFORMTOKEN:
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 1e36 = 5e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 5e36 / 1e36 = 25e18
      */

      const tx = await send(comptroller, "harnessDistributeSupplierPlatformToken", [mkt._address, a1]);
      expect(await platformTokenAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await platformTokenBalance(comptroller, a1)).toEqualNumber(25e18);
      expect(tx).toHaveLog('DistributedSupplierPlatformToken', {
        gToken: mkt._address,
        supplier: a1,
        platformTokenDelta: etherUnsigned(25e18).toString(),
        platformTokenSupplyIndex: etherDouble(6).toString()
      });
    });

    it('should update platformToken accrued and supply index for repeat user', async () => {
      const mkt = gREP;
      await send(comptroller.platformToken, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, etherUnsigned(5e18)]);
      await send(comptroller, "setPlatformTokenSupplyState", [mkt._address, etherDouble(6), 10]);
      await send(comptroller, "setPlatformTokenSupplierIndex", [mkt._address, a1, etherDouble(2)])
      /*
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 2e36 = 4e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 4e36 / 1e36 = 20e18
      */

      await send(comptroller, "harnessDistributeSupplierPlatformToken", [mkt._address, a1]);
      expect(await platformTokenAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await platformTokenBalance(comptroller, a1)).toEqualNumber(20e18);
    });

    it('should not transfer when platformTokenAccrued below threshold', async () => {
      const mkt = gREP;
      await send(comptroller.platformToken, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, etherUnsigned(5e17)]);
      await send(comptroller, "setPlatformTokenSupplyState", [mkt._address, etherDouble(1.0019), 10]);
      /*
        supplierAmount  = 5e17
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 1.0019e36 - 1e36 = 0.0019e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
      */

      await send(comptroller, "harnessDistributeSupplierPlatformToken", [mkt._address, a1]);
      expect(await platformTokenAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await platformTokenBalance(comptroller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-PLATFORMTOKEN market', async () => {
      const mkt = await makeGToken({
        comptroller: comptroller,
        supportMarket: true,
        addPlatformTokenMarket: false,
      });

      await send(comptroller, "harnessDistributeSupplierPlatformToken", [mkt._address, a1]);
      expect(await platformTokenAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await platformTokenBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, 'platformTokenBorrowerIndex', [mkt._address, a1])).toEqualNumber(0);
    });

  });

  describe('transferPlatformToken', () => {
    it('should transfer platformToken accrued when amount is above threshold', async () => {
      const platformTokenRemaining = 1000, a1AccruedPre = 100, threshold = 1;
      const platformTokenBalancePre = await platformTokenBalance(comptroller, a1);
      const tx0 = await send(comptroller.platformToken, 'transfer', [comptroller._address, platformTokenRemaining], {from: root});
      const tx1 = await send(comptroller, 'setPlatformTokenAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferPlatformToken', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await platformTokenAccrued(comptroller, a1);
      const platformTokenBalancePost = await platformTokenBalance(comptroller, a1);
      expect(platformTokenBalancePre).toEqualNumber(0);
      expect(platformTokenBalancePost).toEqualNumber(a1AccruedPre);
    });

    it('should not transfer when platformToken accrued is below threshold', async () => {
      const platformTokenRemaining = 1000, a1AccruedPre = 100, threshold = 101;
      const platformTokenBalancePre = await call(comptroller.platformToken, 'balanceOf', [a1]);
      const tx0 = await send(comptroller.platformToken, 'transfer', [comptroller._address, platformTokenRemaining], {from: root});
      const tx1 = await send(comptroller, 'setPlatformTokenAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferPlatformToken', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await platformTokenAccrued(comptroller, a1);
      const platformTokenBalancePost = await platformTokenBalance(comptroller, a1);
      expect(platformTokenBalancePre).toEqualNumber(0);
      expect(platformTokenBalancePost).toEqualNumber(0);
    });

    it('should not transfer platformToken if platformToken accrued is greater than platformToken remaining', async () => {
      const platformTokenRemaining = 99, a1AccruedPre = 100, threshold = 1;
      const platformTokenBalancePre = await platformTokenBalance(comptroller, a1);
      const tx0 = await send(comptroller.platformToken, 'transfer', [comptroller._address, platformTokenRemaining], {from: root});
      const tx1 = await send(comptroller, 'setPlatformTokenAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferPlatformToken', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await platformTokenAccrued(comptroller, a1);
      const platformTokenBalancePost = await platformTokenBalance(comptroller, a1);
      expect(platformTokenBalancePre).toEqualNumber(0);
      expect(platformTokenBalancePost).toEqualNumber(0);
    });
  });

  describe('claimPlatformToken', () => {
    it('should accrue platformToken and then transfer platformToken accrued', async () => {
      const platformTokenRemaining = platformTokenRate.mul(100), mintAmount = etherUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.platformToken, 'transfer', [comptroller._address, platformTokenRemaining], {from: root});
      await pretendBorrow(gLOW, a1, 1, 1, 100);
      await send(comptroller, 'refreshPlatformTokenSpeeds');
      const speed = await call(comptroller, 'platformTokenSpeeds', [gLOW._address]);
      const a2AccruedPre = await platformTokenAccrued(comptroller, a2);
      const platformTokenBalancePre = await platformTokenBalance(comptroller, a2);
      await quickMint(gLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimPlatformToken', [a2]);
      const a2AccruedPost = await platformTokenAccrued(comptroller, a2);
      const platformTokenBalancePost = await platformTokenBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(330000);
      expect(speed).toEqualNumber(platformTokenRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(platformTokenBalancePre).toEqualNumber(0);
      expect(platformTokenBalancePost).toEqualNumber(platformTokenRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it('should accrue platformToken and then transfer platformToken accrued in a single market', async () => {
      const platformTokenRemaining = platformTokenRate.mul(100), mintAmount = etherUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.platformToken, 'transfer', [comptroller._address, platformTokenRemaining], {from: root});
      await pretendBorrow(gLOW, a1, 1, 1, 100);
      await send(comptroller, 'refreshPlatformTokenSpeeds');
      const speed = await call(comptroller, 'platformTokenSpeeds', [gLOW._address]);
      const a2AccruedPre = await platformTokenAccrued(comptroller, a2);
      const platformTokenBalancePre = await platformTokenBalance(comptroller, a2);
      await quickMint(gLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimPlatformToken', [a2, [gLOW._address]]);
      const a2AccruedPost = await platformTokenAccrued(comptroller, a2);
      const platformTokenBalancePost = await platformTokenBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(160000);
      expect(speed).toEqualNumber(platformTokenRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(platformTokenBalancePre).toEqualNumber(0);
      expect(platformTokenBalancePost).toEqualNumber(platformTokenRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it('should claim when platformToken accrued is below threshold', async () => {
      const platformTokenRemaining = etherExp(1), accruedAmt = etherUnsigned(0.0009e18)
      await send(comptroller.platformToken, 'transfer', [comptroller._address, platformTokenRemaining], {from: root});
      await send(comptroller, 'setPlatformTokenAccrued', [a1, accruedAmt]);
      await send(comptroller, 'claimPlatformToken', [a1, [gLOW._address]]);
      expect(await platformTokenAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await platformTokenBalance(comptroller, a1)).toEqualNumber(accruedAmt);
    });

    it('should revert when a market is not listed', async () => {
      const cNOT = await makeGToken({comptroller});
      await expect(
        send(comptroller, 'claimPlatformToken', [a1, [cNOT._address]])
      ).rejects.toRevert('revert market must be listed');
    });
  });

  describe('claimPlatformToken batch', () => {
    it('should revert when claiming platformToken from non-listed market', async () => {
      const platformTokenRemaining = platformTokenRate.mul(100), deltaBlocks = 10, mintAmount = etherExp(10);
      await send(comptroller.platformToken, 'transfer', [comptroller._address, platformTokenRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;

      for(let from of claimAccts) {
        expect(await send(gLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(gLOW.underlying, 'approve', [gLOW._address, mintAmount], { from });
        send(gLOW, 'mint', [mintAmount,""], { from });
      }

      await pretendBorrow(gLOW, root, 1, 1, etherExp(10));
      await send(comptroller, 'refreshPlatformTokenSpeeds');

      await fastForward(comptroller, deltaBlocks);

      await expect(send(comptroller, 'claimPlatformToken', [claimAccts, [gLOW._address, cEVIL._address], true, true])).rejects.toRevert('revert market must be listed');
    });


    it('should claim the expected amount when holders and gTokens arg is duplicated', async () => {
      const platformTokenRemaining = platformTokenRate.mul(100), deltaBlocks = 10, mintAmount = etherExp(10);
      await send(comptroller.platformToken, 'transfer', [comptroller._address, platformTokenRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(gLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(gLOW.underlying, 'approve', [gLOW._address, mintAmount], { from });
        send(gLOW, 'mint', [mintAmount,""], { from });
      }
      await pretendBorrow(gLOW, root, 1, 1, etherExp(10));
      await send(comptroller, 'refreshPlatformTokenSpeeds');

      await fastForward(comptroller, deltaBlocks);

      const tx = await send(comptroller, 'claimPlatformToken', [[...claimAccts, ...claimAccts], [gLOW._address, gLOW._address], false, true]);
      // platformToken distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'platformTokenSupplierIndex', [gLOW._address, acct])).toEqualNumber(etherDouble(1.125));
        expect(await platformTokenBalance(comptroller, acct)).toEqualNumber(etherExp(1.25));
      }
    });

    it('claims platformToken for multiple suppliers only', async () => {
      const platformTokenRemaining = platformTokenRate.mul(100), deltaBlocks = 10, mintAmount = etherExp(10);
      await send(comptroller.platformToken, 'transfer', [comptroller._address, platformTokenRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(gLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(gLOW.underlying, 'approve', [gLOW._address, mintAmount], { from });
        send(gLOW, 'mint', [mintAmount,""], { from });
      }
      await pretendBorrow(gLOW, root, 1, 1, etherExp(10));
      await send(comptroller, 'refreshPlatformTokenSpeeds');

      await fastForward(comptroller, deltaBlocks);

      const tx = await send(comptroller, 'claimPlatformToken', [claimAccts, [gLOW._address], false, true]);
      // platformToken distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'platformTokenSupplierIndex', [gLOW._address, acct])).toEqualNumber(etherDouble(1.125));
        expect(await platformTokenBalance(comptroller, acct)).toEqualNumber(etherExp(1.25));
      }
    });

    it('claims platformToken for multiple borrowers only, primes uninitiated', async () => {
      const platformTokenRemaining = platformTokenRate.mul(100), deltaBlocks = 10, mintAmount = etherExp(10), borrowAmt = etherExp(1), borrowIdx = etherExp(1)
      await send(comptroller.platformToken, 'transfer', [comptroller._address, platformTokenRemaining], {from: root});
      let [_,__, ...claimAccts] = saddle.accounts;

      for(let acct of claimAccts) {
        await send(gLOW, 'harnessIncrementTotalBorrows', [borrowAmt]);
        await send(gLOW, 'harnessSetAccountBorrows', [acct, borrowAmt, borrowIdx]);
      }
      await send(comptroller, 'refreshPlatformTokenSpeeds');

      await send(comptroller, 'harnessFastForward', [10]);

      const tx = await send(comptroller, 'claimPlatformToken', [claimAccts, [gLOW._address], true, false]);
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'platformTokenBorrowerIndex', [gLOW._address, acct])).toEqualNumber(etherDouble(2.25));
        expect(await call(comptroller, 'platformTokenSupplierIndex', [gLOW._address, acct])).toEqualNumber(0);
      }
    });

    it('should revert when a market is not listed', async () => {
      const cNOT = await makeGToken({comptroller});
      await expect(
        send(comptroller, 'claimPlatformToken', [[a1, a2], [cNOT._address], true, true])
      ).rejects.toRevert('revert market must be listed');
    });
  });

  describe('refreshPlatformTokenSpeeds', () => {
    it('should start out 0', async () => {
      await send(comptroller, 'refreshPlatformTokenSpeeds');
      const speed = await call(comptroller, 'platformTokenSpeeds', [gLOW._address]);
      expect(speed).toEqualNumber(0);
    });

    it('should get correct speeds with borrows', async () => {
      await pretendBorrow(gLOW, a1, 1, 1, 100);
      const tx = await send(comptroller, 'refreshPlatformTokenSpeeds');
      const speed = await call(comptroller, 'platformTokenSpeeds', [gLOW._address]);
      expect(speed).toEqualNumber(platformTokenRate);
      expect(tx).toHaveLog(['PlatformTokenSpeedUpdated', 0], {
        gToken: gLOW._address,
        newSpeed: speed
      });
      expect(tx).toHaveLog(['PlatformTokenSpeedUpdated', 1], {
        gToken: gREP._address,
        newSpeed: 0
      });
      expect(tx).toHaveLog(['PlatformTokenSpeedUpdated', 2], {
        gToken: gZRX._address,
        newSpeed: 0
      });
    });

    it('should get correct speeds for 2 assets', async () => {
      await pretendBorrow(gLOW, a1, 1, 1, 100);
      await pretendBorrow(gZRX, a1, 1, 1, 100);
      await send(comptroller, 'refreshPlatformTokenSpeeds');
      const speed1 = await call(comptroller, 'platformTokenSpeeds', [gLOW._address]);
      const speed2 = await call(comptroller, 'platformTokenSpeeds', [gREP._address]);
      const speed3 = await call(comptroller, 'platformTokenSpeeds', [gZRX._address]);
      expect(speed1).toEqualNumber(platformTokenRate.div(4));
      expect(speed2).toEqualNumber(0);
      expect(speed3).toEqualNumber(platformTokenRate.div(4).mul(3));
    });

    it('should not be callable inside a contract', async () => {
      await pretendBorrow(gLOW, a1, 1, 1, 100);
      await pretendBorrow(gZRX, a1, 1, 1, 100);
      await expect(deploy('RefreshSpeedsProxy', [comptroller._address])).rejects.toRevert('revert only externally owned accounts may refresh speeds');
    });
  });

  describe('_addPlatformTokenMarkets', () => {
    it('should correctly add a platformToken market if called by admin', async () => {
      const gBAT = await makeGToken({comptroller, supportMarket: true});
      const tx = await send(comptroller, '_addPlatformTokenMarkets', [[gBAT._address]]);
      const markets = await call(comptroller, 'getPlatformTokenMarkets');
      expect(markets).toEqual([gLOW, gREP, gZRX, gBAT].map((c) => c._address));
      expect(tx).toHaveLog('MarketPlatformTokened', {
        gToken: gBAT._address,
        isPlatformTokened: true
      });
    });

    it('should revert if not called by admin', async () => {
      const gBAT = await makeGToken({ comptroller, supportMarket: true });
      await expect(
        send(comptroller, '_addPlatformTokenMarkets', [[gBAT._address]], {from: a1})
      ).rejects.toRevert('revert only admin can add platformToken market');
    });

    it('should not add non-listed markets', async () => {
      const gBAT = await makeGToken({ comptroller, supportMarket: false });
      await expect(
        send(comptroller, '_addPlatformTokenMarkets', [[gBAT._address]])
      ).rejects.toRevert('revert platformToken market is not listed');

      const markets = await call(comptroller, 'getPlatformTokenMarkets');
      expect(markets).toEqual([gLOW, gREP, gZRX].map((c) => c._address));
    });

    it('should not add duplicate markets', async () => {
      const gBAT = await makeGToken({comptroller, supportMarket: true});
      await send(comptroller, '_addPlatformTokenMarkets', [[gBAT._address]]);

      await expect(
        send(comptroller, '_addPlatformTokenMarkets', [[gBAT._address]])
      ).rejects.toRevert('revert platformToken market already added');
    });

    it('should not write over a markets existing state', async () => {
      const mkt = gLOW._address;
      const bn0 = 10, bn1 = 20;
      const idx = etherUnsigned(1.5e36);

      await send(comptroller, "setPlatformTokenSupplyState", [mkt, idx, bn0]);
      await send(comptroller, "setPlatformTokenBorrowState", [mkt, idx, bn0]);
      await send(comptroller, "setBlockNumber", [bn1]);
      await send(comptroller, "_dropPlatformTokenMarket", [mkt]);
      await send(comptroller, "_addPlatformTokenMarkets", [[mkt]]);

      const supplyState = await call(comptroller, 'platformTokenSupplyState', [mkt]);
      expect(supplyState.block).toEqual(bn1.toString());
      expect(supplyState.index).toEqual(idx.toString());

      const borrowState = await call(comptroller, 'platformTokenBorrowState', [mkt]);
      expect(borrowState.block).toEqual(bn1.toString());
      expect(borrowState.index).toEqual(idx.toString());
    });
  });

  describe('_dropPlatformTokenMarket', () => {
    it('should correctly drop a platformToken market if called by admin', async () => {
      const tx = await send(comptroller, '_dropPlatformTokenMarket', [gLOW._address]);
      expect(await call(comptroller, 'getPlatformTokenMarkets')).toEqual(
        [gREP, gZRX].map((c) => c._address)
      );
      expect(tx).toHaveLog('MarketPlatformTokened', {
        gToken: gLOW._address,
        isPlatformTokened: false
      });
    });

    it('should correctly drop a platformToken market from middle of array', async () => {
      await send(comptroller, '_dropPlatformTokenMarket', [gREP._address]);
      expect(await call(comptroller, 'getPlatformTokenMarkets')).toEqual(
        [gLOW, gZRX].map((c) => c._address)
      );
    });

    it('should not drop a platformToken market unless called by admin', async () => {
      await expect(
        send(comptroller, '_dropPlatformTokenMarket', [gLOW._address], {from: a1})
      ).rejects.toRevert('revert only admin can drop platformToken market');
    });

    it('should not drop a platformToken market already dropped', async () => {
      await send(comptroller, '_dropPlatformTokenMarket', [gLOW._address]);
      await expect(
        send(comptroller, '_dropPlatformTokenMarket', [gLOW._address])
      ).rejects.toRevert('revert market is not a platformToken market');
    });
  });

  describe('_setPlatformTokenRate', () => {
    it('should correctly change platformToken rate if called by admin', async () => {
      expect(await call(comptroller, 'platformTokenRate')).toEqualNumber(etherUnsigned(1e18));
      const tx1 = await send(comptroller, '_setPlatformTokenRate', [etherUnsigned(3e18)]);
      expect(await call(comptroller, 'platformTokenRate')).toEqualNumber(etherUnsigned(3e18));
      const tx2 = await send(comptroller, '_setPlatformTokenRate', [etherUnsigned(2e18)]);
      expect(await call(comptroller, 'platformTokenRate')).toEqualNumber(etherUnsigned(2e18));
      expect(tx2).toHaveLog('NewPlatformTokenRate', {
        oldPlatformTokenRate: etherUnsigned(3e18),
        newPlatformTokenRate: etherUnsigned(2e18)
      });
    });

    it('should not change platformToken rate unless called by admin', async () => {
      await expect(
        send(comptroller, '_setPlatformTokenRate', [gLOW._address], {from: a1})
      ).rejects.toRevert('revert only admin can change platformToken rate');
    });
  });
});
