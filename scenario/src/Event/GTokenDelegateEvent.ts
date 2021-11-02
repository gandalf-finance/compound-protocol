import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { decodeCall, getPastEvents } from '../Contract';
import { GToken, GTokenScenario } from '../Contract/GToken';
import { GErc20Delegate } from '../Contract/GErc20Delegate'
import { invoke, Sendable } from '../Invokation';
import {
  getAddressV,
  getEventV,
  getExpNumberV,
  getNumberV,
  getStringV,
  getBoolV
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  EventV,
  NothingV,
  NumberV,
  StringV
} from '../Value';
import { Arg, Command, View, processCommandEvent } from '../Command';
import { getGTokenDelegateData } from '../ContractLookup';
import { buildGTokenDelegate } from '../Builder/GTokenDelegateBuilder';
import { verify } from '../Verify';

async function genGTokenDelegate(world: World, from: string, event: Event): Promise<World> {
  let { world: nextWorld, gTokenDelegate, delegateData } = await buildGTokenDelegate(world, from, event);
  world = nextWorld;

  world = addAction(
    world,
    `Added gToken ${delegateData.name} (${delegateData.contract}) at address ${gTokenDelegate._address}`,
    delegateData.invokation
  );

  return world;
}

async function verifyGTokenDelegate(world: World, gTokenDelegate: GErc20Delegate, name: string, contract: string, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, gTokenDelegate._address);
  }

  return world;
}

export function gTokenDelegateCommands() {
  return [
    new Command<{ gTokenDelegateParams: EventV }>(`
        #### Deploy

        * "GTokenDelegate Deploy ...gTokenDelegateParams" - Generates a new GTokenDelegate
          * E.g. "GTokenDelegate Deploy CDaiDelegate cDAIDelegate"
      `,
      "Deploy",
      [new Arg("gTokenDelegateParams", getEventV, { variadic: true })],
      (world, from, { gTokenDelegateParams }) => genGTokenDelegate(world, from, gTokenDelegateParams.val)
    ),
    new View<{ gTokenDelegateArg: StringV, apiKey: StringV }>(`
        #### Verify

        * "GTokenDelegate <gTokenDelegate> Verify apiKey:<String>" - Verifies GTokenDelegate in Etherscan
          * E.g. "GTokenDelegate gDaiDelegate Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("gTokenDelegateArg", getStringV),
        new Arg("apiKey", getStringV)
      ],
      async (world, { gTokenDelegateArg, apiKey }) => {
        let [gToken, name, data] = await getGTokenDelegateData(world, gTokenDelegateArg.val);

        return await verifyGTokenDelegate(world, gToken, name, data.get('contract')!, apiKey.val);
      },
      { namePos: 1 }
    ),
  ];
}

export async function processGTokenDelegateEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("GTokenDelegate", gTokenDelegateCommands(), world, event, from);
}
