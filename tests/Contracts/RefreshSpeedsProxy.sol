pragma solidity ^0.5.16;

interface IComptroller {
	function refreshPlatformTokenSpeeds() external;
}

contract RefreshSpeedsProxy {
	constructor(address comptroller) public {
		IComptroller(comptroller).refreshPlatformTokenSpeeds();
	}
}
