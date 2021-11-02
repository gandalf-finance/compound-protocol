const {etherUnsigned} = require('../Utils/Ethereum');
const {
  makeComptroller,
  makeGToken,
  setOraclePrice
} = require('../Utils/GandalfLending');

const borrowedPrice = 2e10;
const collateralPrice = 1e18;
const repayAmount = etherUnsigned(1e18);

async function calculateSeizeTokens(comptroller, gTokenBorrowed, gTokenCollateral, repayAmount) {
  return call(comptroller, 'liquidateCalculateSeizeTokens', [gTokenBorrowed._address, gTokenCollateral._address, repayAmount]);
}

function rando(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

describe('Comptroller', () => {
  let root, accounts;
  let comptroller, gTokenBorrowed, gTokenCollateral;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    gTokenBorrowed = await makeGToken({comptroller: comptroller, underlyingPrice: 0});
    gTokenCollateral = await makeGToken({comptroller: comptroller, underlyingPrice: 0});
  });

  beforeEach(async () => {
    await setOraclePrice(gTokenBorrowed, borrowedPrice);
    await setOraclePrice(gTokenCollateral, collateralPrice);
    await send(gTokenCollateral, 'harnessExchangeRateDetails', [8e10, 4e10, 0]);
  });

  describe('liquidateCalculateAmountSeize', () => {
    it("fails if either asset price is 0", async () => {
      await setOraclePrice(gTokenBorrowed, 0);
      expect(
        await calculateSeizeTokens(comptroller, gTokenBorrowed, gTokenCollateral, repayAmount)
      ).toHaveTrollErrorTuple(['PRICE_ERROR', 0]);

      await setOraclePrice(gTokenCollateral, 0);
      expect(
        await calculateSeizeTokens(comptroller, gTokenBorrowed, gTokenCollateral, repayAmount)
      ).toHaveTrollErrorTuple(['PRICE_ERROR', 0]);
    });

    it("fails if the repayAmount causes overflow ", async () => {
      expect(
        await calculateSeizeTokens(comptroller, gTokenBorrowed, gTokenCollateral, -1)
      ).toHaveTrollErrorTuple(['MATH_ERROR', 0]);
    });

    it("fails if the borrowed asset price causes overflow ", async () => {
      await setOraclePrice(gTokenBorrowed, -1);
      expect(
        await calculateSeizeTokens(comptroller, gTokenBorrowed, gTokenCollateral, repayAmount)
      ).toHaveTrollErrorTuple(['MATH_ERROR', 0]);
    });

    it("reverts if it fails to calculate the exchange rate", async () => {
      await send(gTokenCollateral, 'harnessExchangeRateDetails', [1, 0, 10]); // (1 - 10) -> underflow
      await expect(
        send(comptroller, 'liquidateCalculateSeizeTokens', [gTokenBorrowed._address, gTokenCollateral._address, repayAmount])
      ).rejects.toRevert("revert exchangeRateStored: exchangeRateStoredInternal failed");
    });

    [
      [1e18, 1e18, 1e18, 1e18, 1e18],
      [2e18, 1e18, 1e18, 1e18, 1e18],
      [2e18, 2e18, 1.42e18, 1.3e18, 2.45e18],
      [2.789e18, 5.230480842e18, 771.32e18, 1.3e18, 10002.45e18],
      [ 7.009232529961056e+24,2.5278726317240445e+24,2.6177112093242585e+23,1179713989619784000,7.790468414639561e+24 ],
      [rando(0, 1e25), rando(0, 1e25), rando(1, 1e25), rando(1e18, 1.5e18), rando(0, 1e25)]
    ].forEach((testCase) => {
      it(`returns the correct value for ${testCase}`, async () => {
        const [exchangeRate, borrowedPrice, collateralPrice, liquidationIncentive, repayAmount] = testCase.map(etherUnsigned);

        await setOraclePrice(gTokenCollateral, collateralPrice);
        await setOraclePrice(gTokenBorrowed, borrowedPrice);
        await send(comptroller, '_setLiquidationIncentive', [liquidationIncentive]);
        await send(gTokenCollateral, 'harnessSetExchangeRate', [exchangeRate]);

        const seizeAmount = repayAmount.mul(liquidationIncentive).mul(borrowedPrice).div(collateralPrice);
        const seizeTokens = seizeAmount.div(exchangeRate);

        expect(
          await calculateSeizeTokens(comptroller, gTokenBorrowed, gTokenCollateral, repayAmount)
        ).toHaveTrollErrorTuple(
          ['NO_ERROR', Number(seizeTokens)],
          (x, y) => Math.abs(x - y) < 1e7
        );
      });
    });
  });
});
