const {
  etherUnsigned,
  etherMantissa
} = require('../Utils/Ethereum');

const {
  makeGToken,
  balanceOf,
  borrowSnapshot,
  totalBorrows,
  fastForward,
  setBalance,
  preApprove,
  pretendBorrow
} = require('../Utils/GandalfLending');

const borrowAmount = etherUnsigned(10e3);
const repayAmount = etherUnsigned(10e2);

async function preBorrow(gToken, borrower, borrowAmount) {
  await send(gToken.comptroller, 'setBorrowAllowed', [true]);
  await send(gToken.comptroller, 'setBorrowVerify', [true]);
  await send(gToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(gToken.underlying, 'harnessSetBalance', [gToken._address, borrowAmount]);
  await send(gToken, 'harnessSetFailTransferToAddress', [borrower, false]);
  await send(gToken, 'harnessSetAccountBorrows', [borrower, 0, 0]);
  await send(gToken, 'harnessSetTotalBorrows', [0]);
}

async function borrowFresh(gToken, borrower, borrowAmount) {
  return send(gToken, 'harnessBorrowFresh', [borrower, borrowAmount]);
}

async function borrow(gToken, borrower, borrowAmount, opts = {}) {
  // make sure to have a block delta so we accrue interest
  await send(gToken, 'harnessFastForward', [1]);
  return send(gToken, 'borrow', [borrowAmount,""], {from: borrower});
}

async function preRepay(gToken, benefactor, borrower, repayAmount) {
  // setup either benefactor OR borrower for success in repaying
  await send(gToken.comptroller, 'setRepayBorrowAllowed', [true]);
  await send(gToken.comptroller, 'setRepayBorrowVerify', [true]);
  await send(gToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(gToken.underlying, 'harnessSetFailTransferFromAddress', [benefactor, false]);
  await send(gToken.underlying, 'harnessSetFailTransferFromAddress', [borrower, false]);
  await pretendBorrow(gToken, borrower, 1, 1, repayAmount);
  await preApprove(gToken, benefactor, repayAmount);
  await preApprove(gToken, borrower, repayAmount);
}

async function repayBorrowFresh(gToken, payer, borrower, repayAmount) {
  return send(gToken, 'harnessRepayBorrowFresh', [payer, borrower, repayAmount], {from: payer});
}

async function repayBorrow(gToken, borrower, repayAmount) {
  // make sure to have a block delta so we accrue interest
  await send(gToken, 'harnessFastForward', [1]);
  return send(gToken, 'repayBorrow', [repayAmount], {from: borrower});
}

async function repayBorrowBehalf(gToken, payer, borrower, repayAmount) {
  // make sure to have a block delta so we accrue interest
  await send(gToken, 'harnessFastForward', [1]);
  return send(gToken, 'repayBorrowBehalf', [borrower, repayAmount], {from: payer});
}

describe('GToken', function () {
  let gToken, root, borrower, benefactor, accounts;
  beforeEach(async () => {
    [root, borrower, benefactor, ...accounts] = saddle.accounts;
    gToken = await makeGToken({comptrollerOpts: {kind: 'bool'}});
  });

  describe('borrowFresh', () => {
    beforeEach(async () => await preBorrow(gToken, borrower, borrowAmount));

    it("fails if comptroller tells it to", async () => {
      await send(gToken.comptroller, 'setBorrowAllowed', [false]);
      expect(await borrowFresh(gToken, borrower, borrowAmount)).toHaveTrollReject('BORROW_COMPTROLLER_REJECTION');
    });

    it("proceeds if comptroller tells it to", async () => {
      await expect(await borrowFresh(gToken, borrower, borrowAmount)).toSucceed();
    });

    it("fails if market not fresh", async () => {
      await fastForward(gToken);
      expect(await borrowFresh(gToken, borrower, borrowAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'BORROW_FRESHNESS_CHECK');
    });

    it("continues if fresh", async () => {
      await expect(await send(gToken, 'accrueInterest')).toSucceed();
      await expect(await borrowFresh(gToken, borrower, borrowAmount)).toSucceed();
    });

    it("fails if error if protocol has less than borrowAmount of underlying", async () => {
      expect(await borrowFresh(gToken, borrower, borrowAmount.add(1))).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'BORROW_CASH_NOT_AVAILABLE');
    });

    it("fails if borrowBalanceStored fails (due to non-zero stored principal with zero account index)", async () => {
      await pretendBorrow(gToken, borrower, 0, 3e18, 5e18);
      expect(await borrowFresh(gToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_ACCUMULATED_BALANCE_CALCULATION_FAILED');
    });

    it("fails if calculating account new total borrow balance overflows", async () => {
      await pretendBorrow(gToken, borrower, 1e-18, 1e-18, -1);
      expect(await borrowFresh(gToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED');
    });

    it("fails if calculation of new total borrow balance overflows", async () => {
      await send(gToken, 'harnessSetTotalBorrows', [-1]);
      expect(await borrowFresh(gToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED');
    });

    it("reverts if transfer out fails", async () => {
      await send(gToken, 'harnessSetFailTransferToAddress', [borrower, true]);
      await expect(borrowFresh(gToken, borrower, borrowAmount)).rejects.toRevert("revert TOKEN_TRANSFER_OUT_FAILED");
    });

    it("reverts if borrowVerify fails", async() => {
      await send(gToken.comptroller, 'setBorrowVerify', [false]);
      await expect(borrowFresh(gToken, borrower, borrowAmount)).rejects.toRevert("revert borrowVerify rejected borrow");
    });

    it("transfers the underlying cash, tokens, and emits Transfer, Borrow events", async () => {
      const beforeProtocolCash = await balanceOf(gToken.underlying, gToken._address);
      const beforeProtocolBorrows = await totalBorrows(gToken);
      const beforeAccountCash = await balanceOf(gToken.underlying, borrower);
      const result = await borrowFresh(gToken, borrower, borrowAmount);
      expect(result).toSucceed();
      expect(await balanceOf(gToken.underlying, borrower)).toEqualNumber(beforeAccountCash.add(borrowAmount));
      expect(await balanceOf(gToken.underlying, gToken._address)).toEqualNumber(beforeProtocolCash.sub(borrowAmount));
      expect(await totalBorrows(gToken)).toEqualNumber(beforeProtocolBorrows.add(borrowAmount));
      expect(result).toHaveLog('Transfer', {
        from: gToken._address,
        to: borrower,
        amount: borrowAmount.toString()
      });
      expect(result).toHaveLog('Borrow', {
        borrower: borrower,
        borrowAmount: borrowAmount.toString(),
        accountBorrows: borrowAmount.toString(),
        totalBorrows: beforeProtocolBorrows.add(borrowAmount).toString(),
        channel: ""
      });
    });

    it("stores new borrow principal and interest index", async () => {
      const beforeProtocolBorrows = await totalBorrows(gToken);
      await pretendBorrow(gToken, borrower, 0, 3, 0);
      await borrowFresh(gToken, borrower, borrowAmount);
      const borrowSnap = await borrowSnapshot(gToken, borrower);
      expect(borrowSnap.principal).toEqualNumber(borrowAmount);
      expect(borrowSnap.interestIndex).toEqualNumber(etherMantissa(3));
      expect(await totalBorrows(gToken)).toEqualNumber(beforeProtocolBorrows.add(borrowAmount));
    });
  });

  describe('borrow', () => {
    beforeEach(async () => await preBorrow(gToken, borrower, borrowAmount));

    it("emits a borrow failure if interest accrual fails", async () => {
      await send(gToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(borrow(gToken, borrower, borrowAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from borrowFresh without emitting any extra logs", async () => {
      expect(await borrow(gToken, borrower, borrowAmount.add(1))).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'BORROW_CASH_NOT_AVAILABLE');
    });

    it("returns success from borrowFresh and transfers the correct amount", async () => {
      const beforeAccountCash = await balanceOf(gToken.underlying, borrower);
      await fastForward(gToken);
      expect(await borrow(gToken, borrower, borrowAmount)).toSucceed();
      expect(await balanceOf(gToken.underlying, borrower)).toEqualNumber(beforeAccountCash.add(borrowAmount));
    });
  });

  describe('repayBorrowFresh', () => {
    [true, false].forEach((benefactorIsPayer) => {
      let payer;
      const label = benefactorIsPayer ? "benefactor paying" : "borrower paying";
      describe(label, () => {
        beforeEach(async () => {
          payer = benefactorIsPayer ? benefactor : borrower;
          await preRepay(gToken, payer, borrower, repayAmount);
        });

        it("fails if repay is not allowed", async () => {
          await send(gToken.comptroller, 'setRepayBorrowAllowed', [false]);
          expect(await repayBorrowFresh(gToken, payer, borrower, repayAmount)).toHaveTrollReject('REPAY_BORROW_COMPTROLLER_REJECTION', 'MATH_ERROR');
        });

        it("fails if block number ≠ current block number", async () => {
          await fastForward(gToken);
          expect(await repayBorrowFresh(gToken, payer, borrower, repayAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'REPAY_BORROW_FRESHNESS_CHECK');
        });

        it("fails if insufficient approval", async() => {
          await preApprove(gToken, payer, 1);
          await expect(repayBorrowFresh(gToken, payer, borrower, repayAmount)).rejects.toRevert('revert Insufficient allowance');
        });

        it("fails if insufficient balance", async() => {
          await setBalance(gToken.underlying, payer, 1);
          await expect(repayBorrowFresh(gToken, payer, borrower, repayAmount)).rejects.toRevert('revert Insufficient balance');
        });


        it("returns an error if calculating account new account borrow balance fails", async () => {
          await pretendBorrow(gToken, borrower, 1, 1, 1);
          await expect(repayBorrowFresh(gToken, payer, borrower, repayAmount)).rejects.toRevert("revert REPAY_BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED");
        });

        it("returns an error if calculation of new total borrow balance fails", async () => {
          await send(gToken, 'harnessSetTotalBorrows', [1]);
          await expect(repayBorrowFresh(gToken, payer, borrower, repayAmount)).rejects.toRevert("revert REPAY_BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED");
        });


        it("reverts if doTransferIn fails", async () => {
          await send(gToken.underlying, 'harnessSetFailTransferFromAddress', [payer, true]);
          await expect(repayBorrowFresh(gToken, payer, borrower, repayAmount)).rejects.toRevert("revert TOKEN_TRANSFER_IN_FAILED");
        });

        it("reverts if repayBorrowVerify fails", async() => {
          await send(gToken.comptroller, 'setRepayBorrowVerify', [false]);
          await expect(repayBorrowFresh(gToken, payer, borrower, repayAmount)).rejects.toRevert("revert repayBorrowVerify rejected repayBorrow");
        });

        it("transfers the underlying cash, and emits Transfer, RepayBorrow events", async () => {
          const beforeProtocolCash = await balanceOf(gToken.underlying, gToken._address);
          const result = await repayBorrowFresh(gToken, payer, borrower, repayAmount);
          expect(await balanceOf(gToken.underlying, gToken._address)).toEqualNumber(beforeProtocolCash.add(repayAmount));
          expect(result).toHaveLog('Transfer', {
            from: payer,
            to: gToken._address,
            amount: repayAmount.toString()
          });
          expect(result).toHaveLog('RepayBorrow', {
            payer: payer,
            borrower: borrower,
            repayAmount: repayAmount.toString(),
            accountBorrows: "0",
            totalBorrows: "0"
          });
        });

        it("stores new borrow principal and interest index", async () => {
          const beforeProtocolBorrows = await totalBorrows(gToken);
          const beforeAccountBorrowSnap = await borrowSnapshot(gToken, borrower);
          expect(await repayBorrowFresh(gToken, payer, borrower, repayAmount)).toSucceed();
          const afterAccountBorrows = await borrowSnapshot(gToken, borrower);
          expect(afterAccountBorrows.principal).toEqualNumber(beforeAccountBorrowSnap.principal.sub(repayAmount));
          expect(afterAccountBorrows.interestIndex).toEqualNumber(etherMantissa(1));
          expect(await totalBorrows(gToken)).toEqualNumber(beforeProtocolBorrows.sub(repayAmount));
        });
      });
    });
  });

  describe('repayBorrow', () => {
    beforeEach(async () => {
      await preRepay(gToken, borrower, borrower, repayAmount);
    });

    it("emits a repay borrow failure if interest accrual fails", async () => {
      await send(gToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(repayBorrow(gToken, borrower, repayAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from repayBorrowFresh without emitting any extra logs", async () => {
      await setBalance(gToken.underlying, borrower, 1);
      await expect(repayBorrow(gToken, borrower, repayAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("returns success from repayBorrowFresh and repays the right amount", async () => {
      await fastForward(gToken);
      const beforeAccountBorrowSnap = await borrowSnapshot(gToken, borrower);
      expect(await repayBorrow(gToken, borrower, repayAmount)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(gToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(beforeAccountBorrowSnap.principal.sub(repayAmount));
    });

    it("repays the full amount owed if payer has enough", async () => {
      await fastForward(gToken);
      expect(await repayBorrow(gToken, borrower, -1)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(gToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(0);
    });

    it("fails gracefully if payer does not have enough", async () => {
      await setBalance(gToken.underlying, borrower, 3);
      await fastForward(gToken);
      await expect(repayBorrow(gToken, borrower, -1)).rejects.toRevert('revert Insufficient balance');
    });
  });

  describe('repayBorrowBehalf', () => {
    let payer;

    beforeEach(async () => {
      payer = benefactor;
      await preRepay(gToken, payer, borrower, repayAmount);
    });

    it("emits a repay borrow failure if interest accrual fails", async () => {
      await send(gToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(repayBorrowBehalf(gToken, payer, borrower, repayAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from repayBorrowFresh without emitting any extra logs", async () => {
      await setBalance(gToken.underlying, payer, 1);
      await expect(repayBorrowBehalf(gToken, payer, borrower, repayAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("returns success from repayBorrowFresh and repays the right amount", async () => {
      await fastForward(gToken);
      const beforeAccountBorrowSnap = await borrowSnapshot(gToken, borrower);
      expect(await repayBorrowBehalf(gToken, payer, borrower, repayAmount)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(gToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(beforeAccountBorrowSnap.principal.sub(repayAmount));
    });
  });
});
