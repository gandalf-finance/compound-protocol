import {Event} from '../Event';
import {World} from '../World';
import {Comptroller} from '../Contract/Comptroller';
import {GToken} from '../Contract/GToken';
import {
  getAddressV,
  getCoreValue,
  getStringV,
  getNumberV
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  ListV,
  NumberV,
  StringV,
  Value
} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {getComptroller} from '../ContractLookup';
import {encodedNumber} from '../Encoding';
import {getGTokenV} from './GTokenValue';
import { encodeParameters, encodeABI } from '../Utils';

export async function getComptrollerAddress(world: World, comptroller: Comptroller): Promise<AddressV> {
  return new AddressV(comptroller._address);
}

export async function getLiquidity(world: World, comptroller: Comptroller, user: string): Promise<NumberV> {
  let {0: error, 1: liquidity, 2: shortfall} = await comptroller.methods.getAccountLiquidity(user).call();
  if (Number(error) != 0) {
    throw new Error(`Failed to compute account liquidity: error code = ${error}`);
  }
  return new NumberV(Number(liquidity) - Number(shortfall));
}

export async function getHypotheticalLiquidity(world: World, comptroller: Comptroller, account: string, asset: string, redeemTokens: encodedNumber, borrowAmount: encodedNumber): Promise<NumberV> {
  let {0: error, 1: liquidity, 2: shortfall} = await comptroller.methods.getHypotheticalAccountLiquidity(account, asset, redeemTokens, borrowAmount).call();
  if (Number(error) != 0) {
    throw new Error(`Failed to compute account hypothetical liquidity: error code = ${error}`);
  }
  return new NumberV(Number(liquidity) - Number(shortfall));
}

async function getPriceOracle(world: World, comptroller: Comptroller): Promise<AddressV> {
  return new AddressV(await comptroller.methods.oracle().call());
}

async function getCloseFactor(world: World, comptroller: Comptroller): Promise<NumberV> {
  return new NumberV(await comptroller.methods.closeFactorMantissa().call(), 1e18);
}

async function getMaxAssets(world: World, comptroller: Comptroller): Promise<NumberV> {
  return new NumberV(await comptroller.methods.maxAssets().call());
}

async function getLiquidationIncentive(world: World, comptroller: Comptroller): Promise<NumberV> {
  return new NumberV(await comptroller.methods.liquidationIncentiveMantissa().call(), 1e18);
}

async function getImplementation(world: World, comptroller: Comptroller): Promise<AddressV> {
  return new AddressV(await comptroller.methods.comptrollerImplementation().call());
}

async function getBlockNumber(world: World, comptroller: Comptroller): Promise<NumberV> {
  return new NumberV(await comptroller.methods.getBlockNumber().call());
}

async function getAdmin(world: World, comptroller: Comptroller): Promise<AddressV> {
  return new AddressV(await comptroller.methods.admin().call());
}

async function getPendingAdmin(world: World, comptroller: Comptroller): Promise<AddressV> {
  return new AddressV(await comptroller.methods.pendingAdmin().call());
}

async function getCollateralFactor(world: World, comptroller: Comptroller, gToken: GToken): Promise<NumberV> {
  let {0: _isListed, 1: collateralFactorMantissa} = await comptroller.methods.markets(gToken._address).call();
  return new NumberV(collateralFactorMantissa, 1e18);
}

async function membershipLength(world: World, comptroller: Comptroller, user: string): Promise<NumberV> {
  return new NumberV(await comptroller.methods.membershipLength(user).call());
}

async function checkMembership(world: World, comptroller: Comptroller, user: string, gToken: GToken): Promise<BoolV> {
  return new BoolV(await comptroller.methods.checkMembership(user, gToken._address).call());
}

async function getAssetsIn(world: World, comptroller: Comptroller, user: string): Promise<ListV> {
  let assetsList = await comptroller.methods.getAssetsIn(user).call();

  return new ListV(assetsList.map((a) => new AddressV(a)));
}

async function getPlatformTokenMarkets(world: World, comptroller: Comptroller): Promise<ListV> {
  let mkts = await comptroller.methods.getPlatformTokenMarkets().call();

  return new ListV(mkts.map((a) => new AddressV(a)));
}

async function checkListed(world: World, comptroller: Comptroller, gToken: GToken): Promise<BoolV> {
  let {0: isListed, 1: _collateralFactorMantissa} = await comptroller.methods.markets(gToken._address).call();

  return new BoolV(isListed);
}

async function checkIsPlatformTokened(world: World, comptroller: Comptroller, gToken: GToken): Promise<BoolV> {
  let {0: isListed, 1: _collateralFactorMantissa, 2: isPlatformTokened} = await comptroller.methods.markets(gToken._address).call();
  return new BoolV(isPlatformTokened);
}


export function comptrollerFetchers() {
  return [
    new Fetcher<{comptroller: Comptroller}, AddressV>(`
        #### Address

        * "Comptroller Address" - Returns address of comptroller
      `,
      "Address",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      (world, {comptroller}) => getComptrollerAddress(world, comptroller)
    ),
    new Fetcher<{comptroller: Comptroller, account: AddressV}, NumberV>(`
        #### Liquidity

        * "Comptroller Liquidity <User>" - Returns a given user's trued up liquidity
          * E.g. "Comptroller Liquidity Geoff"
      `,
      "Liquidity",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("account", getAddressV)
      ],
      (world, {comptroller, account}) => getLiquidity(world, comptroller, account.val)
    ),
    new Fetcher<{comptroller: Comptroller, account: AddressV, action: StringV, amount: NumberV, gToken: GToken}, NumberV>(`
        #### Hypothetical

        * "Comptroller Hypothetical <User> <Action> <Asset> <Number>" - Returns a given user's trued up liquidity given a hypothetical change in asset with redeeming a certain number of tokens and/or borrowing a given amount.
          * E.g. "Comptroller Hypothetical Geoff Redeems 6.0 gZRX"
          * E.g. "Comptroller Hypothetical Geoff Borrows 5.0 gZRX"
      `,
      "Hypothetical",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("account", getAddressV),
        new Arg("action", getStringV),
        new Arg("amount", getNumberV),
        new Arg("gToken", getGTokenV)
      ],
      async (world, {comptroller, account, action, gToken, amount}) => {
        let redeemTokens: NumberV;
        let borrowAmount: NumberV;

        switch (action.val.toLowerCase()) {
          case "borrows":
            redeemTokens = new NumberV(0);
            borrowAmount = amount;
            break;
          case "redeems":
            redeemTokens = amount;
            borrowAmount = new NumberV(0);
            break;
          default:
            throw new Error(`Unknown hypothetical: ${action.val}`);
        }

        return await getHypotheticalLiquidity(world, comptroller, account.val, gToken._address, redeemTokens.encode(), borrowAmount.encode());
      }
    ),
    new Fetcher<{comptroller: Comptroller}, AddressV>(`
        #### Admin

        * "Comptroller Admin" - Returns the Comptrollers's admin
          * E.g. "Comptroller Admin"
      `,
      "Admin",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      (world, {comptroller}) => getAdmin(world, comptroller)
    ),
    new Fetcher<{comptroller: Comptroller}, AddressV>(`
        #### PendingAdmin

        * "Comptroller PendingAdmin" - Returns the pending admin of the Comptroller
          * E.g. "Comptroller PendingAdmin" - Returns Comptroller's pending admin
      `,
      "PendingAdmin",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
      ],
      (world, {comptroller}) => getPendingAdmin(world, comptroller)
    ),
    new Fetcher<{comptroller: Comptroller}, AddressV>(`
        #### PriceOracle

        * "Comptroller PriceOracle" - Returns the Comptrollers's price oracle
          * E.g. "Comptroller PriceOracle"
      `,
      "PriceOracle",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      (world, {comptroller}) => getPriceOracle(world, comptroller)
    ),
    new Fetcher<{comptroller: Comptroller}, NumberV>(`
        #### CloseFactor

        * "Comptroller CloseFactor" - Returns the Comptrollers's price oracle
          * E.g. "Comptroller CloseFactor"
      `,
      "CloseFactor",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      (world, {comptroller}) => getCloseFactor(world, comptroller)
    ),
    new Fetcher<{comptroller: Comptroller}, NumberV>(`
        #### MaxAssets

        * "Comptroller MaxAssets" - Returns the Comptrollers's price oracle
          * E.g. "Comptroller MaxAssets"
      `,
      "MaxAssets",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      (world, {comptroller}) => getMaxAssets(world, comptroller)
    ),
    new Fetcher<{comptroller: Comptroller}, NumberV>(`
        #### LiquidationIncentive

        * "Comptroller LiquidationIncentive" - Returns the Comptrollers's liquidation incentive
          * E.g. "Comptroller LiquidationIncentive"
      `,
      "LiquidationIncentive",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      (world, {comptroller}) => getLiquidationIncentive(world, comptroller)
    ),
    new Fetcher<{comptroller: Comptroller}, AddressV>(`
        #### Implementation

        * "Comptroller Implementation" - Returns the Comptrollers's implementation
          * E.g. "Comptroller Implementation"
      `,
      "Implementation",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      (world, {comptroller}) => getImplementation(world, comptroller)
    ),
    new Fetcher<{comptroller: Comptroller}, NumberV>(`
        #### BlockNumber

        * "Comptroller BlockNumber" - Returns the Comptrollers's mocked block number (for scenario runner)
          * E.g. "Comptroller BlockNumber"
      `,
      "BlockNumber",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      (world, {comptroller}) => getBlockNumber(world, comptroller)
    ),
    new Fetcher<{comptroller: Comptroller, gToken: GToken}, NumberV>(`
        #### CollateralFactor

        * "Comptroller CollateralFactor <GToken>" - Returns the collateralFactor associated with a given asset
          * E.g. "Comptroller CollateralFactor gZRX"
      `,
      "CollateralFactor",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("gToken", getGTokenV)
      ],
      (world, {comptroller, gToken}) => getCollateralFactor(world, comptroller, gToken)
    ),
    new Fetcher<{comptroller: Comptroller, account: AddressV}, NumberV>(`
        #### MembershipLength

        * "Comptroller MembershipLength <User>" - Returns a given user's length of membership
          * E.g. "Comptroller MembershipLength Geoff"
      `,
      "MembershipLength",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("account", getAddressV)
      ],
      (world, {comptroller, account}) => membershipLength(world, comptroller, account.val)
    ),
    new Fetcher<{comptroller: Comptroller, account: AddressV, gToken: GToken}, BoolV>(`
        #### CheckMembership

        * "Comptroller CheckMembership <User> <GToken>" - Returns one if user is in asset, zero otherwise.
          * E.g. "Comptroller CheckMembership Geoff gZRX"
      `,
      "CheckMembership",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("account", getAddressV),
        new Arg("gToken", getGTokenV)
      ],
      (world, {comptroller, account, gToken}) => checkMembership(world, comptroller, account.val, gToken)
    ),
    new Fetcher<{comptroller: Comptroller, account: AddressV}, ListV>(`
        #### AssetsIn

        * "Comptroller AssetsIn <User>" - Returns the assets a user is in
          * E.g. "Comptroller AssetsIn Geoff"
      `,
      "AssetsIn",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("account", getAddressV)
      ],
      (world, {comptroller, account}) => getAssetsIn(world, comptroller, account.val)
    ),
    new Fetcher<{comptroller: Comptroller, gToken: GToken}, BoolV>(`
        #### CheckListed

        * "Comptroller CheckListed <GToken>" - Returns true if market is listed, false otherwise.
          * E.g. "Comptroller CheckListed gZRX"
      `,
      "CheckListed",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("gToken", getGTokenV)
      ],
      (world, {comptroller, gToken}) => checkListed(world, comptroller, gToken)
    ),
    new Fetcher<{comptroller: Comptroller, gToken: GToken}, BoolV>(`
        #### CheckIsPlatformTokened

        * "Comptroller CheckIsPlatformTokened <GToken>" - Returns true if market is listed, false otherwise.
          * E.g. "Comptroller CheckIsPlatformTokened gZRX"
      `,
      "CheckIsPlatformTokened",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("gToken", getGTokenV)
      ],
      (world, {comptroller, gToken}) => checkIsPlatformTokened(world, comptroller, gToken)
    ),
    new Fetcher<{comptroller: Comptroller}, AddressV>(`
        #### PauseGuardian

        * "PauseGuardian" - Returns the Comptrollers's PauseGuardian
        * E.g. "Comptroller PauseGuardian"
        `,
        "PauseGuardian",
        [
          new Arg("comptroller", getComptroller, {implicit: true})
        ],
        async (world, {comptroller}) => new AddressV(await comptroller.methods.pauseGuardian().call())
    ),

    new Fetcher<{comptroller: Comptroller}, BoolV>(`
        #### _MintGuardianPaused

        * "_MintGuardianPaused" - Returns the Comptrollers's original global Mint paused status
        * E.g. "Comptroller _MintGuardianPaused"
        `,
        "_MintGuardianPaused",
        [new Arg("comptroller", getComptroller, {implicit: true})],
        async (world, {comptroller}) => new BoolV(await comptroller.methods._mintGuardianPaused().call())
    ),
    new Fetcher<{comptroller: Comptroller}, BoolV>(`
        #### _BorrowGuardianPaused

        * "_BorrowGuardianPaused" - Returns the Comptrollers's original global Borrow paused status
        * E.g. "Comptroller _BorrowGuardianPaused"
        `,
        "_BorrowGuardianPaused",
        [new Arg("comptroller", getComptroller, {implicit: true})],
        async (world, {comptroller}) => new BoolV(await comptroller.methods._borrowGuardianPaused().call())
    ),

    new Fetcher<{comptroller: Comptroller}, BoolV>(`
        #### TransferGuardianPaused

        * "TransferGuardianPaused" - Returns the Comptrollers's Transfer paused status
        * E.g. "Comptroller TransferGuardianPaused"
        `,
        "TransferGuardianPaused",
        [new Arg("comptroller", getComptroller, {implicit: true})],
        async (world, {comptroller}) => new BoolV(await comptroller.methods.transferGuardianPaused().call())
    ),
    new Fetcher<{comptroller: Comptroller}, BoolV>(`
        #### SeizeGuardianPaused

        * "SeizeGuardianPaused" - Returns the Comptrollers's Seize paused status
        * E.g. "Comptroller SeizeGuardianPaused"
        `,
        "SeizeGuardianPaused",
        [new Arg("comptroller", getComptroller, {implicit: true})],
        async (world, {comptroller}) => new BoolV(await comptroller.methods.seizeGuardianPaused().call())
    ),

    new Fetcher<{comptroller: Comptroller, gToken: GToken}, BoolV>(`
        #### MintGuardianMarketPaused

        * "MintGuardianMarketPaused" - Returns the Comptrollers's Mint paused status in market
        * E.g. "Comptroller MintGuardianMarketPaused gREP"
        `,
        "MintGuardianMarketPaused",
        [
          new Arg("comptroller", getComptroller, {implicit: true}),
          new Arg("gToken", getGTokenV)
        ],
        async (world, {comptroller, gToken}) => new BoolV(await comptroller.methods.mintGuardianPaused(gToken._address).call())
    ),
    new Fetcher<{comptroller: Comptroller, gToken: GToken}, BoolV>(`
        #### BorrowGuardianMarketPaused

        * "BorrowGuardianMarketPaused" - Returns the Comptrollers's Borrow paused status in market
        * E.g. "Comptroller BorrowGuardianMarketPaused gREP"
        `,
        "BorrowGuardianMarketPaused",
        [
          new Arg("comptroller", getComptroller, {implicit: true}),
          new Arg("gToken", getGTokenV)
        ],
        async (world, {comptroller, gToken}) => new BoolV(await comptroller.methods.borrowGuardianPaused(gToken._address).call())
    ),

    new Fetcher<{comptroller: Comptroller}, ListV>(`
      #### GetPlatformTokenMarkets

      * "GetPlatformTokenMarkets" - Returns an array of the currently enabled PlatformToken markets. To use the auto-gen array getter platformTokenMarkets(uint), use PlatformTokenMarkets
      * E.g. "Comptroller GetPlatformTokenMarkets"
      `,
      "GetPlatformTokenMarkets",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      async(world, {comptroller}) => await getPlatformTokenMarkets(world, comptroller)
     ),

    new Fetcher<{comptroller: Comptroller}, NumberV>(`
      #### PlatformTokenRate

      * "PlatformTokenRate" - Returns the current platformToken rate.
      * E.g. "Comptroller PlatformTokenRate"
      `,
      "PlatformTokenRate",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      async(world, {comptroller}) => new NumberV(await comptroller.methods.platformTokenRate().call())
    ),

    new Fetcher<{comptroller: Comptroller, signature: StringV, callArgs: StringV[]}, NumberV>(`
        #### CallNum

        * "CallNum signature:<String> ...callArgs<CoreValue>" - Simple direct call method
          * E.g. "Comptroller CallNum \"platformTokenSpeeds(address)\" (Address Coburn)"
      `,
      "CallNum",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("signature", getStringV),
        new Arg("callArgs", getCoreValue, {variadic: true, mapped: true})
      ],
      async (world, {comptroller, signature, callArgs}) => {
        const fnData = encodeABI(world, signature.val, callArgs.map(a => a.val));
        const res = await world.web3.eth.call({
            to: comptroller._address,
            data: fnData
          })
        const resNum : any = world.web3.eth.abi.decodeParameter('uint256',res);
        return new NumberV(resNum);
      }
    ),
    new Fetcher<{comptroller: Comptroller, GToken: GToken, key: StringV}, NumberV>(`
        #### PlatformTokenSupplyState(address)

        * "Comptroller PlatformTokenBorrowState gZRX "index"
      `,
      "PlatformTokenSupplyState",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("GToken", getGTokenV),
        new Arg("key", getStringV),
      ],
      async (world, {comptroller, GToken, key}) => {
        const result = await comptroller.methods.platformTokenSupplyState(GToken._address).call();
        return new NumberV(result[key.val]);
      }
    ),
    new Fetcher<{comptroller: Comptroller, GToken: GToken, key: StringV}, NumberV>(`
        #### PlatformTokenBorrowState(address)

        * "Comptroller PlatformTokenBorrowState gZRX "index"
      `,
      "PlatformTokenBorrowState",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("GToken", getGTokenV),
        new Arg("key", getStringV),
      ],
      async (world, {comptroller, GToken, key}) => {
        const result = await comptroller.methods.platformTokenBorrowState(GToken._address).call();
        return new NumberV(result[key.val]);
      }
    ),
    new Fetcher<{comptroller: Comptroller, account: AddressV, key: StringV}, NumberV>(`
        #### PlatformTokenAccrued(address)

        * "Comptroller PlatformTokenAccrued Coburn
      `,
      "PlatformTokenAccrued",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("account", getAddressV),
      ],
      async (world, {comptroller,account}) => {
        const result = await comptroller.methods.platformTokenAccrued(account.val).call();
        return new NumberV(result);
      }
    ),
    new Fetcher<{comptroller: Comptroller, GToken: GToken, account: AddressV}, NumberV>(`
        #### platformTokenSupplierIndex

        * "Comptroller PlatformTokenSupplierIndex gZRX Coburn
      `,
      "PlatformTokenSupplierIndex",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("GToken", getGTokenV),
        new Arg("account", getAddressV),
      ],
      async (world, {comptroller, GToken, account}) => {
        return new NumberV(await comptroller.methods.platformTokenSupplierIndex(GToken._address, account.val).call());
      }
    ),
    new Fetcher<{comptroller: Comptroller, GToken: GToken, account: AddressV}, NumberV>(`
        #### PlatformTokenBorrowerIndex

        * "Comptroller PlatformTokenBorrowerIndex gZRX Coburn
      `,
      "PlatformTokenBorrowerIndex",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("GToken", getGTokenV),
        new Arg("account", getAddressV),
      ],
      async (world, {comptroller, GToken, account}) => {
        return new NumberV(await comptroller.methods.platformTokenBorrowerIndex(GToken._address, account.val).call());
      }
    ),
    new Fetcher<{comptroller: Comptroller, GToken: GToken}, NumberV>(`
        #### PlatformTokenSpeed

        * "Comptroller PlatformTokenSpeed gZRX
      `,
      "PlatformTokenSpeed",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("GToken", getGTokenV),
      ],
      async (world, {comptroller, GToken}) => {
        return new NumberV(await comptroller.methods.platformTokenSpeeds(GToken._address).call());
      }
    ),
    new Fetcher<{comptroller: Comptroller}, AddressV>(`
        #### BorrowCapGuardian

        * "BorrowCapGuardian" - Returns the Comptrollers's BorrowCapGuardian
        * E.g. "Comptroller BorrowCapGuardian"
        `,
        "BorrowCapGuardian",
        [
          new Arg("comptroller", getComptroller, {implicit: true})
        ],
        async (world, {comptroller}) => new AddressV(await comptroller.methods.borrowCapGuardian().call())
    ),
    new Fetcher<{comptroller: Comptroller, GToken: GToken}, NumberV>(`
        #### BorrowCaps

        * "Comptroller BorrowCaps gZRX
      `,
      "BorrowCaps",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("GToken", getGTokenV),
      ],
      async (world, {comptroller, GToken}) => {
        return new NumberV(await comptroller.methods.borrowCaps(GToken._address).call());
      }
    )
  ];
}

export async function getComptrollerValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("Comptroller", comptrollerFetchers(), world, event);
}
