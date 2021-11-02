import { Contract } from '../Contract';
import { Sendable } from '../Invokation';
import { GTokenMethods, GTokenScenarioMethods } from './GToken';

interface GErc20DelegateMethods extends GTokenMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

interface GErc20DelegateScenarioMethods extends GTokenScenarioMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

export interface GErc20Delegate extends Contract {
  methods: GErc20DelegateMethods;
  name: string;
}

export interface GErc20DelegateScenario extends Contract {
  methods: GErc20DelegateScenarioMethods;
  name: string;
}
