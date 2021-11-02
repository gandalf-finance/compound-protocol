const {makeGToken} = require('../Utils/GandalfLending');

describe('GToken', function () {
  let root, accounts;
  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe('transfer', () => {
    it("cannot transfer from a zero balance", async () => {
      const gToken = await makeGToken({supportMarket: true});
      expect(await call(gToken, 'balanceOf', [root])).toEqualNumber(0);
      expect(await send(gToken, 'transfer', [accounts[0], 100])).toHaveTokenFailure('MATH_ERROR', 'TRANSFER_NOT_ENOUGH');
    });

    it("transfers 50 tokens", async () => {
      const gToken = await makeGToken({supportMarket: true});
      await send(gToken, 'harnessSetBalance', [root, 100]);
      expect(await call(gToken, 'balanceOf', [root])).toEqualNumber(100);
      await send(gToken, 'transfer', [accounts[0], 50]);
      expect(await call(gToken, 'balanceOf', [root])).toEqualNumber(50);
      expect(await call(gToken, 'balanceOf', [accounts[0]])).toEqualNumber(50);
    });

    it("doesn't transfer when src == dst", async () => {
      const gToken = await makeGToken({supportMarket: true});
      await send(gToken, 'harnessSetBalance', [root, 100]);
      expect(await call(gToken, 'balanceOf', [root])).toEqualNumber(100);
      expect(await send(gToken, 'transfer', [root, 50])).toHaveTokenFailure('BAD_INPUT', 'TRANSFER_NOT_ALLOWED');
    });

    it("rejects transfer when not allowed and reverts if not verified", async () => {
      const gToken = await makeGToken({comptrollerOpts: {kind: 'bool'}});
      await send(gToken, 'harnessSetBalance', [root, 100]);
      expect(await call(gToken, 'balanceOf', [root])).toEqualNumber(100);

      await send(gToken.comptroller, 'setTransferAllowed', [false])
      expect(await send(gToken, 'transfer', [root, 50])).toHaveTrollReject('TRANSFER_COMPTROLLER_REJECTION');

      await send(gToken.comptroller, 'setTransferAllowed', [true])
      await send(gToken.comptroller, 'setTransferVerify', [false])
      await expect(send(gToken, 'transfer', [accounts[0], 50])).rejects.toRevert("revert transferVerify rejected transfer");
    });
  });
});