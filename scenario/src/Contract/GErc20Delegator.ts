import { Contract } from '../Contract';
import { Callable, Sendable } from '../Invokation';
import { GTokenMethods } from './GToken';
import { encodedNumber } from '../Encoding';

interface GErc20DelegatorMethods extends GTokenMethods {
  implementation(): Callable<string>;
  _setImplementation(
    implementation_: string,
    allowResign: boolean,
    becomImplementationData: string
  ): Sendable<void>;
}

interface GErc20DelegatorScenarioMethods extends GErc20DelegatorMethods {
  setTotalBorrows(amount: encodedNumber): Sendable<void>;
  setTotalReserves(amount: encodedNumber): Sendable<void>;
}

export interface GErc20Delegator extends Contract {
  methods: GErc20DelegatorMethods;
  name: string;
}

export interface GErc20DelegatorScenario extends Contract {
  methods: GErc20DelegatorMethods;
  name: string;
}
