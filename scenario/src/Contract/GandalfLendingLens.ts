import { Contract } from '../Contract';
import { encodedNumber } from '../Encoding';
import { Callable, Sendable } from '../Invokation';

export interface GandalfLendingLensMethods {
  gTokenBalances(gToken: string, account: string): Sendable<[string,number,number,number,number,number]>;
  gTokenBalancesAll(cTokens: string[], account: string): Sendable<[string,number,number,number,number,number][]>;
  gTokenMetadata(gToken: string): Sendable<[string,number,number,number,number,number,number,number,number,boolean,number,string,number,number]>;
  gTokenMetadataAll(cTokens: string[]): Sendable<[string,number,number,number,number,number,number,number,number,boolean,number,string,number,number][]>;
  gTokenUnderlyingPrice(gToken: string): Sendable<[string,number]>;
  gTokenUnderlyingPriceAll(cTokens: string[]): Sendable<[string,number][]>;
  getAccountLimits(comptroller: string, account: string): Sendable<[string[],number,number]>;
}

export interface GandalfLendingLens extends Contract {
  methods: GandalfLendingLensMethods;
  name: string;
}
