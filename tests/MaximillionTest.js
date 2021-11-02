const {
  etherBalance,
  etherGasCost,
  getContract
} = require('./Utils/Ethereum');

const {
  makeComptroller,
  makeGToken,
  makePriceOracle,
  pretendBorrow,
  borrowSnapshot
} = require('./Utils/GandalfLending');

describe('Maximillion', () => {
  let root, borrower;
  let maximillion, gEther;
  beforeEach(async () => {
    [root, borrower] = saddle.accounts;
    gEther = await makeGToken({kind: "gether", supportMarket: true});
    maximillion = await deploy('Maximillion', [gEther._address]);
  });

  describe("constructor", () => {
    it("sets address of gEther", async () => {
      expect(await call(maximillion, "gEther")).toEqual(gEther._address);
    });
  });

  describe("repayBehalf", () => {
    it("refunds the entire amount with no borrows", async () => {
      const beforeBalance = await etherBalance(root);
      const result = await send(maximillion, "repayBehalf", [borrower], {value: 100});
      const gasCost = await etherGasCost(result);
      const afterBalance = await etherBalance(root);
      expect(result).toSucceed();
      expect(afterBalance).toEqualNumber(beforeBalance.sub(gasCost));
    });

    it("repays part of a borrow", async () => {
      await pretendBorrow(gEther, borrower, 1, 1, 150);
      const beforeBalance = await etherBalance(root);
      const result = await send(maximillion, "repayBehalf", [borrower], {value: 100});
      const gasCost = await etherGasCost(result);
      const afterBalance = await etherBalance(root);
      const afterBorrowSnap = await borrowSnapshot(gEther, borrower);
      expect(result).toSucceed();
      expect(afterBalance).toEqualNumber(beforeBalance.sub(gasCost).sub(100));
      expect(afterBorrowSnap.principal).toEqualNumber(50);
    });

    it("repays a full borrow and refunds the rest", async () => {
      await pretendBorrow(gEther, borrower, 1, 1, 90);
      const beforeBalance = await etherBalance(root);
      const result = await send(maximillion, "repayBehalf", [borrower], {value: 100});
      const gasCost = await etherGasCost(result);
      const afterBalance = await etherBalance(root);
      const afterBorrowSnap = await borrowSnapshot(gEther, borrower);
      expect(result).toSucceed();
      expect(afterBalance).toEqualNumber(beforeBalance.sub(gasCost).sub(90));
      expect(afterBorrowSnap.principal).toEqualNumber(0);
    });
  });
});
