import { Event } from '../Event';
import { World } from '../World';
import { GErc20Delegate } from '../Contract/GErc20Delegate';
import {
  getCoreValue,
  mapValue
} from '../CoreValue';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import {
  AddressV,
  Value,
} from '../Value';
import { getWorldContractByAddress, getGTokenDelegateAddress } from '../ContractLookup';

export async function getGTokenDelegateV(world: World, event: Event): Promise<GErc20Delegate> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getGTokenDelegateAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<GErc20Delegate>(world, address.val);
}

async function gTokenDelegateAddress(world: World, gTokenDelegate: GErc20Delegate): Promise<AddressV> {
  return new AddressV(gTokenDelegate._address);
}

export function gTokenDelegateFetchers() {
  return [
    new Fetcher<{ gTokenDelegate: GErc20Delegate }, AddressV>(`
        #### Address

        * "GTokenDelegate <GTokenDelegate> Address" - Returns address of GTokenDelegate contract
          * E.g. "GTokenDelegate gDaiDelegate Address" - Returns gDaiDelegate's address
      `,
      "Address",
      [
        new Arg("gTokenDelegate", getGTokenDelegateV)
      ],
      (world, { gTokenDelegate }) => gTokenDelegateAddress(world, gTokenDelegate),
      { namePos: 1 }
    ),
  ];
}

export async function getGTokenDelegateValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("GTokenDelegate", gTokenDelegateFetchers(), world, event);
}
