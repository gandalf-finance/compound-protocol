const BigNumber = require('bignumber.js');

const {
  address,
  etherMantissa
} = require('./Utils/Ethereum');

const {
  makeGToken,
  makePriceOracle,
} = require('./Utils/GandalfLending');

describe('PriceOracleProxy', () => {
  let root, accounts;
  let oracle, backingOracle, gEth, gUsdc, gSai, gDai, gUsdt, cOther;
  let daiOracleKey = address(2);

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    gEth = await makeGToken({kind: "gether", comptrollerOpts: {kind: "v1-no-proxy"}, supportMarket: true});
    gUsdc = await makeGToken({comptroller: gEth.comptroller, supportMarket: true});
    gSai = await makeGToken({comptroller: gEth.comptroller, supportMarket: true});
    gDai = await makeGToken({comptroller: gEth.comptroller, supportMarket: true});
    gUsdt = await makeGToken({comptroller: gEth.comptroller, supportMarket: true});
    cOther = await makeGToken({comptroller: gEth.comptroller, supportMarket: true});

    backingOracle = await makePriceOracle();
    oracle = await deploy('PriceOracleProxy',
      [
        root,
        backingOracle._address,
        gEth._address,
        gUsdc._address,
        gSai._address,
        gDai._address,
        gUsdt._address
      ]
     );
  });

  describe("constructor", () => {
    it("sets address of guardian", async () => {
      let configuredGuardian = await call(oracle, "guardian");
      expect(configuredGuardian).toEqual(root);
    });

    it("sets address of v1 oracle", async () => {
      let configuredOracle = await call(oracle, "v1PriceOracle");
      expect(configuredOracle).toEqual(backingOracle._address);
    });

    it("sets address of gEth", async () => {
      let configuredGEther = await call(oracle, "gEthAddress");
      expect(configuredGEther).toEqual(gEth._address);
    });

    it("sets address of gUSDC", async () => {
      let configuredGUSD = await call(oracle, "gUsdcAddress");
      expect(configuredGUSD).toEqual(gUsdc._address);
    });

    it("sets address of gSAI", async () => {
      let configuredGSAI = await call(oracle, "gSaiAddress");
      expect(configuredGSAI).toEqual(gSai._address);
    });

    it("sets address of gDAI", async () => {
      let configuredGDAI = await call(oracle, "gDaiAddress");
      expect(configuredGDAI).toEqual(gDai._address);
    });

    it("sets address of gUSDT", async () => {
      let configuredGUSDT = await call(oracle, "gUsdtAddress");
      expect(configuredGUSDT).toEqual(gUsdt._address);
    });
  });

  describe("getUnderlyingPrice", () => {
    let setAndVerifyBackingPrice = async (gToken, price) => {
      await send(
        backingOracle,
        "setUnderlyingPrice",
        [gToken._address, etherMantissa(price)]);

      let backingOraclePrice = await call(
        backingOracle,
        "assetPrices",
        [gToken.underlying._address]);

      expect(Number(backingOraclePrice)).toEqual(price * 1e18);
    };

    let readAndVerifyProxyPrice = async (token, price) =>{
      let proxyPrice = await call(oracle, "getUnderlyingPrice", [token._address]);
      expect(Number(proxyPrice)).toEqual(price * 1e18);;
    };

    it("always returns 1e18 for gEth", async () => {
      await readAndVerifyProxyPrice(gEth, 1);
    });

    it("uses address(1) for USDC and address(2) for cdai", async () => {
      await send(backingOracle, "setDirectPrice", [address(1), etherMantissa(5e12)]);
      await send(backingOracle, "setDirectPrice", [address(2), etherMantissa(8)]);
      await readAndVerifyProxyPrice(gDai, 8);
      await readAndVerifyProxyPrice(gUsdc, 5e12);
      await readAndVerifyProxyPrice(gUsdt, 5e12);
    });

    it("proxies for whitelisted tokens", async () => {
      await setAndVerifyBackingPrice(cOther, 11);
      await readAndVerifyProxyPrice(cOther, 11);

      await setAndVerifyBackingPrice(cOther, 37);
      await readAndVerifyProxyPrice(cOther, 37);
    });

    it("returns 0 for token without a price", async () => {
      let unlistedToken = await makeGToken({comptroller: gEth.comptroller});

      await readAndVerifyProxyPrice(unlistedToken, 0);
    });

    it("correctly handle setting SAI price", async () => {
      await send(backingOracle, "setDirectPrice", [daiOracleKey, etherMantissa(0.01)]);

      await readAndVerifyProxyPrice(gDai, 0.01);
      await readAndVerifyProxyPrice(gSai, 0.01);

      await send(oracle, "setSaiPrice", [etherMantissa(0.05)]);

      await readAndVerifyProxyPrice(gDai, 0.01);
      await readAndVerifyProxyPrice(gSai, 0.05);

      await expect(send(oracle, "setSaiPrice", [1])).rejects.toRevert("revert SAI price may only be set once");
    });

    it("only guardian may set the sai price", async () => {
      await expect(send(oracle, "setSaiPrice", [1], {from: accounts[0]})).rejects.toRevert("revert only guardian may set the SAI price");
    });

    it("sai price must be bounded", async () => {
      await expect(send(oracle, "setSaiPrice", [etherMantissa(10)])).rejects.toRevert("revert SAI price must be < 0.1 ETH");
    });
});
});
