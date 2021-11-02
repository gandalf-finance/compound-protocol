const {
  etherMantissa,
  etherUnsigned
} = require('../Utils/Ethereum');
const {
  makeGToken,
  setBorrowRate
} = require('../Utils/GandalfLending');

const blockNumber = 2e7;
const borrowIndex = 1e18;
const borrowRate = .000001;

async function pretendBlock(gToken, accrualBlock = blockNumber, deltaBlocks = 1) {
  await send(gToken, 'harnessSetAccrualBlockNumber', [etherUnsigned(blockNumber)]);
  await send(gToken, 'harnessSetBlockNumber', [etherUnsigned(blockNumber + deltaBlocks)]);
  await send(gToken, 'harnessSetBorrowIndex', [etherUnsigned(borrowIndex)]);
}

async function preAccrue(gToken) {
  await setBorrowRate(gToken, borrowRate);
  await send(gToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(gToken, 'harnessExchangeRateDetails', [0, 0, 0]);
}

describe('GToken', () => {
  let root, accounts;
  let gToken;
  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    gToken = await makeGToken({comptrollerOpts: {kind: 'bool'}});
  });

  beforeEach(async () => {
    await preAccrue(gToken);
  });

  describe('accrueInterest', () => {
    it('reverts if the interest rate is absurdly high', async () => {
      await pretendBlock(gToken, blockNumber, 1);
      expect(await call(gToken, 'getBorrowRateMaxMantissa')).toEqualNumber(etherMantissa(0.000005)); // 0.0005% per block
      await setBorrowRate(gToken, 0.001e-2); // 0.0010% per block
      await expect(send(gToken, 'accrueInterest')).rejects.toRevert("revert borrow rate is absurdly high");
    });

    it('fails if new borrow rate calculation fails', async () => {
      await pretendBlock(gToken, blockNumber, 1);
      await send(gToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(send(gToken, 'accrueInterest')).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it('fails if simple interest factor calculation fails', async () => {
      await pretendBlock(gToken, blockNumber, 5e70);
      expect(await send(gToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_SIMPLE_INTEREST_FACTOR_CALCULATION_FAILED');
    });

    it('fails if new borrow index calculation fails', async () => {
      await pretendBlock(gToken, blockNumber, 5e60);
      expect(await send(gToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_BORROW_INDEX_CALCULATION_FAILED');
    });

    it('fails if new borrow interest index calculation fails', async () => {
      await pretendBlock(gToken)
      await send(gToken, 'harnessSetBorrowIndex', [-1]);
      expect(await send(gToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_BORROW_INDEX_CALCULATION_FAILED');
    });

    it('fails if interest accumulated calculation fails', async () => {
      await send(gToken, 'harnessExchangeRateDetails', [0, -1, 0]);
      await pretendBlock(gToken)
      expect(await send(gToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_ACCUMULATED_INTEREST_CALCULATION_FAILED');
    });

    it('fails if new total borrows calculation fails', async () => {
      await setBorrowRate(gToken, 1e-18);
      await pretendBlock(gToken)
      await send(gToken, 'harnessExchangeRateDetails', [0, -1, 0]);
      expect(await send(gToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_TOTAL_BORROWS_CALCULATION_FAILED');
    });

    it('fails if interest accumulated for reserves calculation fails', async () => {
      await setBorrowRate(gToken, .000001);
      await send(gToken, 'harnessExchangeRateDetails', [0, etherUnsigned(1e30), -1]);
      await send(gToken, 'harnessSetReserveFactorFresh', [etherUnsigned(1e10)]);
      await pretendBlock(gToken, blockNumber, 5e20)
      expect(await send(gToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_TOTAL_RESERVES_CALCULATION_FAILED');
    });

    it('fails if new total reserves calculation fails', async () => {
      await setBorrowRate(gToken, 1e-18);
      await send(gToken, 'harnessExchangeRateDetails', [0, etherUnsigned(1e56), -1]);
      await send(gToken, 'harnessSetReserveFactorFresh', [etherUnsigned(1e17)]);
      await pretendBlock(gToken)
      expect(await send(gToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_TOTAL_RESERVES_CALCULATION_FAILED');
    });

    it('succeeds and saves updated values in storage on success', async () => {
      const startingTotalBorrows = 1e22;
      const startingTotalReserves = 1e20;
      const reserveFactor = 1e17;

      await send(gToken, 'harnessExchangeRateDetails', [0, etherUnsigned(startingTotalBorrows), etherUnsigned(startingTotalReserves)]);
      await send(gToken, 'harnessSetReserveFactorFresh', [etherUnsigned(reserveFactor)]);
      await pretendBlock(gToken)

      const expectedAccrualBlockNumber = blockNumber + 1;
      const expectedBorrowIndex = borrowIndex + borrowIndex * borrowRate;
      const expectedTotalBorrows = startingTotalBorrows + startingTotalBorrows * borrowRate;
      const expectedTotalReserves = startingTotalReserves + startingTotalBorrows *  borrowRate * reserveFactor / 1e18;

      const receipt = await send(gToken, 'accrueInterest')
      expect(receipt).toSucceed();
      expect(receipt).toHaveLog('AccrueInterest', {
        cashPrior: 0,
        interestAccumulated: etherUnsigned(expectedTotalBorrows).sub(etherUnsigned(startingTotalBorrows)),
        borrowIndex: etherUnsigned(expectedBorrowIndex),
        totalBorrows: etherUnsigned(expectedTotalBorrows)
      })
      expect(await call(gToken, 'accrualBlockNumber')).toEqualNumber(expectedAccrualBlockNumber);
      expect(await call(gToken, 'borrowIndex')).toEqualNumber(expectedBorrowIndex);
      expect(await call(gToken, 'totalBorrows')).toEqualNumber(expectedTotalBorrows);
      expect(await call(gToken, 'totalReserves')).toEqualNumber(expectedTotalReserves);
    });
  });
});
