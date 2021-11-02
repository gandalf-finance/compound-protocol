import { Event } from '../Event';
import { World } from '../World';
import { GErc20Delegate, GErc20DelegateScenario } from '../Contract/GErc20Delegate';
import { GToken } from '../Contract/GToken';
import { Invokation } from '../Invokation';
import { getStringV } from '../CoreValue';
import { AddressV, NumberV, StringV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract, getTestContract } from '../Contract';

const GDaiDelegateContract = getContract('GDaiDelegate');
const GDaiDelegateScenarioContract = getTestContract('GDaiDelegateScenario');
const GErc20DelegateContract = getContract('GErc20Delegate');
const GErc20DelegateScenarioContract = getTestContract('GErc20DelegateScenario');


export interface GTokenDelegateData {
  invokation: Invokation<GErc20Delegate>;
  name: string;
  contract: string;
  description?: string;
}

export async function buildGTokenDelegate(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; gTokenDelegate: GErc20Delegate; delegateData: GTokenDelegateData }> {
  const fetchers = [
    new Fetcher<{ name: StringV; }, GTokenDelegateData>(
      `
        #### GDaiDelegate

        * "GDaiDelegate name:<String>"
          * E.g. "GTokenDelegate Deploy GDaiDelegate gDAIDelegate"
      `,
      'GDaiDelegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await GDaiDelegateContract.deploy<GErc20Delegate>(world, from, []),
          name: name.val,
          contract: 'GDaiDelegate',
          description: 'Standard GDai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, GTokenDelegateData>(
      `
        #### GDaiDelegateScenario

        * "GDaiDelegateScenario name:<String>" - A GDaiDelegate Scenario for local testing
          * E.g. "GTokenDelegate Deploy GDaiDelegateScenario gDAIDelegate"
      `,
      'GDaiDelegateScenario',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await GDaiDelegateScenarioContract.deploy<GErc20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'GDaiDelegateScenario',
          description: 'Scenario GDai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, GTokenDelegateData>(
      `
        #### GErc20Delegate

        * "GErc20Delegate name:<String>"
          * E.g. "GTokenDelegate Deploy GErc20Delegate gDAIDelegate"
      `,
      'GErc20Delegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await GErc20DelegateContract.deploy<GErc20Delegate>(world, from, []),
          name: name.val,
          contract: 'GErc20Delegate',
          description: 'Standard GErc20 Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, GTokenDelegateData>(
      `
        #### GErc20DelegateScenario

        * "GErc20DelegateScenario name:<String>" - A GErc20Delegate Scenario for local testing
          * E.g. "GTokenDelegate Deploy GErc20DelegateScenario gDAIDelegate"
      `,
      'GErc20DelegateScenario',
      [
        new Arg('name', getStringV),
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await GErc20DelegateScenarioContract.deploy<GErc20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'GErc20DelegateScenario',
          description: 'Scenario GErc20 Delegate'
        };
      }
    )
  ];

  let delegateData = await getFetcherValue<any, GTokenDelegateData>("DeployGToken", fetchers, world, params);
  let invokation = delegateData.invokation;
  delete delegateData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const gTokenDelegate = invokation.value!;

  world = await storeAndSaveContract(
    world,
    gTokenDelegate,
    delegateData.name,
    invokation,
    [
      {
        index: ['GTokenDelegate', delegateData.name],
        data: {
          address: gTokenDelegate._address,
          contract: delegateData.contract,
          description: delegateData.description
        }
      }
    ]
  );

  return { world, gTokenDelegate, delegateData };
}
