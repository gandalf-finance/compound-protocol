"use strict";

const { dfn } = require('./JS');
const {
  encodeParameters,
  etherBalance,
  etherMantissa,
  etherUnsigned,
  mergeInterface
} = require('./Ethereum');

async function makeComptroller(opts = {}) {
  const {
    root = saddle.account,
    kind = 'unitroller'
  } = opts || {};

  if (kind == 'bool') {
    return await deploy('BoolComptroller');
  }

  if (kind == 'false-marker') {
    return await deploy('FalseMarkerMethodComptroller');
  }

  if (kind == 'v1-no-proxy') {
    const comptroller = await deploy('ComptrollerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));

    await send(comptroller, '_setCloseFactor', [closeFactor]);
    await send(comptroller, '_setMaxAssets', [maxAssets]);
    await send(comptroller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(comptroller, { priceOracle });
  }

  if (kind == 'unitroller-g2') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerScenarioG2');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    const liquidationIncentive = etherMantissa(1);

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address]);
    mergeInterface(unitroller, comptroller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(unitroller, { priceOracle });
  }

  if (kind == 'unitroller-g3') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerScenarioG3');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    const liquidationIncentive = etherMantissa(1);
    const platformTokenRate = etherUnsigned(dfn(opts.platformTokenRate, 1e18));
    const platformTokenMarkets = opts.platformTokenMarkets || [];
    const otherMarkets = opts.otherMarkets || [];

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address, platformTokenRate, platformTokenMarkets, otherMarkets]);
    mergeInterface(unitroller, comptroller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(unitroller, { priceOracle });
  }

  if (kind == 'unitroller') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    const liquidationIncentive = etherMantissa(1);
    const platformToken = opts.platformToken || await deploy('PlatformTokenToken');
    const platformTokenRate = etherUnsigned(dfn(opts.platformTokenRate, 1e18));

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address]);
    mergeInterface(unitroller, comptroller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);
    await send(unitroller, 'setPlatformTokenAddress', [platformToken._address]); // harness only
    await send(unitroller, '_setPlatformTokenRate', [platformTokenRate]);

    return Object.assign(unitroller, { priceOracle, platformToken });
  }
}

async function makeGToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'gerc20'
  } = opts || {};

  const comptroller = opts.comptroller || await makeComptroller(opts.comptrollerOpts);
  const interestRateModel = opts.interestRateModel || await makeInterestRateModel(opts.interestRateModelOpts);
  const exchangeRate = etherMantissa(dfn(opts.exchangeRate, 1));
  const decimals = etherUnsigned(dfn(opts.decimals, 8));
  const symbol = opts.symbol || (kind === 'gether' ? 'gETH' : 'gOMG');
  const name = opts.name || `GToken ${symbol}`;
  const admin = opts.admin || root;

  let gToken, underlying;
  let gDelegator, gDelegatee, gDaiMaker;

  switch (kind) {
    case 'gether':
      gToken = await deploy('GEtherHarness',
        [
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin
        ])
      break;

    case 'gdai':
      gDaiMaker  = await deploy('GDaiDelegateMakerHarness');
      underlying = gDaiMaker;
      gDelegatee = await deploy('GDaiDelegateHarness');
      gDelegator = await deploy('GErc20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          gDelegatee._address,
          encodeParameters(['address', 'address'], [gDaiMaker._address, gDaiMaker._address])
        ]
      );
      gToken = await saddle.getContractAt('GDaiDelegateHarness', gDelegator._address); // XXXS at
      break;

    case 'gerc20':
    default:
      underlying = opts.underlying || await makeToken(opts.underlyingOpts);
      gDelegatee = await deploy('GErc20DelegateHarness');
      gDelegator = await deploy('GErc20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          gDelegatee._address,
          "0x0"
        ]
      );
      gToken = await saddle.getContractAt('GErc20DelegateHarness', gDelegator._address); // XXXS at
      break;
  }

  if (opts.supportMarket) {
    await send(comptroller, '_supportMarket', [gToken._address]);
  }

  if (opts.addCompMarket) {
    await send(comptroller, '_addPlatformTokenMarket', [gToken._address]);
  }

  if (opts.underlyingPrice) {
    const price = etherMantissa(opts.underlyingPrice);
    await send(comptroller.priceOracle, 'setUnderlyingPrice', [gToken._address, price]);
  }

  if (opts.collateralFactor) {
    const factor = etherMantissa(opts.collateralFactor);
    expect(await send(comptroller, '_setCollateralFactor', [gToken._address, factor])).toSucceed();
  }

  return Object.assign(gToken, { name, symbol, underlying, comptroller, interestRateModel });
}

async function makeInterestRateModel(opts = {}) {
  const {
    root = saddle.account,
    kind = 'harnessed'
  } = opts || {};

  if (kind == 'harnessed') {
    const borrowRate = etherMantissa(dfn(opts.borrowRate, 0));
    return await deploy('InterestRateModelHarness', [borrowRate]);
  }

  if (kind == 'false-marker') {
    const borrowRate = etherMantissa(dfn(opts.borrowRate, 0));
    return await deploy('FalseMarkerMethodInterestRateModel', [borrowRate]);
  }

  if (kind == 'white-paper') {
    const baseRate = etherMantissa(dfn(opts.baseRate, 0));
    const multiplier = etherMantissa(dfn(opts.multiplier, 1e-18));
    return await deploy('WhitePaperInterestRateModel', [baseRate, multiplier]);
  }

  if (kind == 'jump-rate') {
    const baseRate = etherMantissa(dfn(opts.baseRate, 0));
    const multiplier = etherMantissa(dfn(opts.multiplier, 1e-18));
    const jump = etherMantissa(dfn(opts.jump, 0));
    const kink = etherMantissa(dfn(opts.kink, 0));
    return await deploy('JumpRateModel', [baseRate, multiplier, jump, kink]);
  }
}

async function makePriceOracle(opts = {}) {
  const {
    root = saddle.account,
    kind = 'simple'
  } = opts || {};

  if (kind == 'simple') {
    return await deploy('SimplePriceOracle');
  }
}

async function makeToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'erc20'
  } = opts || {};

  if (kind == 'erc20') {
    const quantity = etherUnsigned(dfn(opts.quantity, 1e25));
    const decimals = etherUnsigned(dfn(opts.decimals, 18));
    const symbol = opts.symbol || 'OMG';
    const name = opts.name || `Erc20 ${symbol}`;
    return await deploy('ERC20Harness', [quantity, name, decimals, symbol]);
  }
}

async function balanceOf(token, account) {
  return etherUnsigned(await call(token, 'balanceOf', [account]));
}

async function totalSupply(token) {
  return etherUnsigned(await call(token, 'totalSupply'));
}

async function borrowSnapshot(gToken, account) {
  const { principal, interestIndex } = await call(gToken, 'harnessAccountBorrows', [account]);
  return { principal: etherUnsigned(principal), interestIndex: etherUnsigned(interestIndex) };
}

async function totalBorrows(gToken) {
  return etherUnsigned(await call(gToken, 'totalBorrows'));
}

async function totalReserves(gToken) {
  return etherUnsigned(await call(gToken, 'totalReserves'));
}

async function enterMarkets(gTokens, from) {
  return await send(gTokens[0].comptroller, 'enterMarkets', [gTokens.map(g => g._address)], { from });
}

async function fastForward(gToken, blocks = 5) {
  return await send(gToken, 'harnessFastForward', [blocks]);
}

async function setBalance(gToken, account, balance) {
  return await send(gToken, 'harnessSetBalance', [account, balance]);
}

async function setEtherBalance(gEther, balance) {
  const current = await etherBalance(gEther._address);
  const root = saddle.account;
  expect(await send(gEther, 'harnessDoTransferOut', [root, current])).toSucceed();
  expect(await send(gEther, 'harnessDoTransferIn', [root, balance], { value: balance })).toSucceed();
}

async function getBalances(gTokens, accounts) {
  const balances = {};
  for (let gToken of gTokens) {
    const cBalances = balances[gToken._address] = {};
    for (let account of accounts) {
      cBalances[account] = {
        eth: await etherBalance(account),
        cash: gToken.underlying && await balanceOf(gToken.underlying, account),
        tokens: await balanceOf(gToken, account),
        borrows: (await borrowSnapshot(gToken, account)).principal
      };
    }
    cBalances[gToken._address] = {
      eth: await etherBalance(gToken._address),
      cash: gToken.underlying && await balanceOf(gToken.underlying, gToken._address),
      tokens: await totalSupply(gToken),
      borrows: await totalBorrows(gToken),
      reserves: await totalReserves(gToken)
    };
  }
  return balances;
}

async function adjustBalances(balances, deltas) {
  for (let delta of deltas) {
    let gToken, account, key, diff;
    if (delta.length == 4) {
      ([gToken, account, key, diff] = delta);
    } else {
      ([gToken, key, diff] = delta);
      account = gToken._address;
    }
    balances[gToken._address][account][key] = balances[gToken._address][account][key].add(diff);
  }
  return balances;
}


async function preApprove(gToken, from, amount, opts = {}) {
  if (dfn(opts.faucet, true)) {
    expect(await send(gToken.underlying, 'harnessSetBalance', [from, amount], { from })).toSucceed();
  }

  return send(gToken.underlying, 'approve', [gToken._address, amount], { from });
}

async function quickMint(gToken, minter, mintAmount, opts = {}) {
  // make sure to accrue interest
  await fastForward(gToken, 1);

  if (dfn(opts.approve, true)) {
    expect(await preApprove(gToken, minter, mintAmount, opts)).toSucceed();
  }
  if (dfn(opts.exchangeRate)) {
    expect(await send(gToken, 'harnessSetExchangeRate', [etherMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(gToken, 'mint', [mintAmount,""], { from: minter });
}


async function preSupply(gToken, account, tokens, opts = {}) {
  if (dfn(opts.total, true)) {
    expect(await send(gToken, 'harnessSetTotalSupply', [tokens])).toSucceed();
  }
  return send(gToken, 'harnessSetBalance', [account, tokens]);
}

async function quickRedeem(gToken, redeemer, redeemTokens, opts = {}) {
  await fastForward(gToken, 1);

  if (dfn(opts.supply, true)) {
    expect(await preSupply(gToken, redeemer, redeemTokens, opts)).toSucceed();
  }
  if (dfn(opts.exchangeRate)) {
    expect(await send(gToken, 'harnessSetExchangeRate', [etherMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(gToken, 'redeem', [redeemTokens], { from: redeemer });
}

async function quickRedeemUnderlying(gToken, redeemer, redeemAmount, opts = {}) {
  await fastForward(gToken, 1);

  if (dfn(opts.exchangeRate)) {
    expect(await send(gToken, 'harnessSetExchangeRate', [etherMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(gToken, 'redeemUnderlying', [redeemAmount], { from: redeemer });
}

async function setOraclePrice(gToken, price) {
  return send(gToken.comptroller.priceOracle, 'setUnderlyingPrice', [gToken._address, etherMantissa(price)]);
}

async function setBorrowRate(gToken, rate) {
  return send(gToken.interestRateModel, 'setBorrowRate', [etherMantissa(rate)]);
}

async function getBorrowRate(interestRateModel, cash, borrows, reserves) {
  return call(interestRateModel, 'getBorrowRate', [cash, borrows, reserves].map(etherUnsigned));
}

async function getSupplyRate(interestRateModel, cash, borrows, reserves, reserveFactor) {
  return call(interestRateModel, 'getSupplyRate', [cash, borrows, reserves, reserveFactor].map(etherUnsigned));
}

async function pretendBorrow(gToken, borrower, accountIndex, marketIndex, principalRaw, blockNumber = 2e7) {
  await send(gToken, 'harnessSetTotalBorrows', [etherUnsigned(principalRaw)]);
  await send(gToken, 'harnessSetAccountBorrows', [borrower, etherUnsigned(principalRaw), etherMantissa(accountIndex)]);
  await send(gToken, 'harnessSetBorrowIndex', [etherMantissa(marketIndex)]);
  await send(gToken, 'harnessSetAccrualBlockNumber', [etherUnsigned(blockNumber)]);
  await send(gToken, 'harnessSetBlockNumber', [etherUnsigned(blockNumber)]);
}

module.exports = {
  makeComptroller,
  makeGToken,
  makeInterestRateModel,
  makePriceOracle,
  makeToken,

  balanceOf,
  totalSupply,
  borrowSnapshot,
  totalBorrows,
  totalReserves,
  enterMarkets,
  fastForward,
  setBalance,
  setEtherBalance,
  getBalances,
  adjustBalances,

  preApprove,
  quickMint,

  preSupply,
  quickRedeem,
  quickRedeemUnderlying,

  setOraclePrice,
  setBorrowRate,
  getBorrowRate,
  getSupplyRate,
  pretendBorrow
};
