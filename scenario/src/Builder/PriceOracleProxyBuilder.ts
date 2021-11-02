import {Event} from '../Event';
import {addAction, World} from '../World';
import {PriceOracleProxy} from '../Contract/PriceOracleProxy';
import {Invokation} from '../Invokation';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {storeAndSaveContract} from '../Networks';
import {getContract} from '../Contract';
import {getAddressV} from '../CoreValue';
import {AddressV} from '../Value';

const PriceOracleProxyContract = getContract("PriceOracleProxy");

export interface PriceOracleProxyData {
  invokation?: Invokation<PriceOracleProxy>,
  contract?: PriceOracleProxy,
  description: string,
  address?: string,
  gETH: string,
  gUSDC: string,
  gDAI: string
}

export async function buildPriceOracleProxy(world: World, from: string, event: Event): Promise<{world: World, priceOracleProxy: PriceOracleProxy, invokation: Invokation<PriceOracleProxy>}> {
  const fetchers = [
    new Fetcher<{guardian: AddressV, priceOracle: AddressV, gETH: AddressV, gUSDC: AddressV, cSAI: AddressV, gDAI: AddressV, gUSDT: AddressV}, PriceOracleProxyData>(`
        #### Price Oracle Proxy

        * "Deploy <Guardian:Address> <PriceOracle:Address> <gETH:Address> <gUSDC:Address> <cSAI:Address> <gDAI:Address> <gUSDT:Address>" - The Price Oracle which proxies to a backing oracle
        * E.g. "PriceOracleProxy Deploy Admin (PriceOracle Address) gETH gUSDC cSAI gDAI gUSDT"
      `,
      "PriceOracleProxy",
      [
        new Arg("guardian", getAddressV),
        new Arg("priceOracle", getAddressV),
        new Arg("gETH", getAddressV),
        new Arg("gUSDC", getAddressV),
        new Arg("cSAI", getAddressV),
        new Arg("gDAI", getAddressV),
        new Arg("gUSDT", getAddressV)
      ],
      async (world, {guardian, priceOracle, gETH, gUSDC, cSAI, gDAI, gUSDT}) => {
        return {
          invokation: await PriceOracleProxyContract.deploy<PriceOracleProxy>(world, from, [guardian.val, priceOracle.val, gETH.val, gUSDC.val, cSAI.val, gDAI.val, gUSDT.val]),
          description: "Price Oracle Proxy",
          gETH: gETH.val,
          gUSDC: gUSDC.val,
          cSAI: cSAI.val,
          gDAI: gDAI.val,
          gUSDT: gUSDT.val
        };
      },
      {catchall: true}
    )
  ];

  let priceOracleProxyData = await getFetcherValue<any, PriceOracleProxyData>("DeployPriceOracleProxy", fetchers, world, event);
  let invokation = priceOracleProxyData.invokation!;
  delete priceOracleProxyData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }
  const priceOracleProxy = invokation.value!;
  priceOracleProxyData.address = priceOracleProxy._address;

  world = await storeAndSaveContract(
    world,
    priceOracleProxy,
    'PriceOracleProxy',
    invokation,
    [
      { index: ['PriceOracleProxy'], data: priceOracleProxyData }
    ]
  );

  return {world, priceOracleProxy, invokation};
}
