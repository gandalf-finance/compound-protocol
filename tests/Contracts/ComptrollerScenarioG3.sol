pragma solidity ^0.5.16;

import "../../contracts/ComptrollerG3.sol";

contract ComptrollerScenarioG3 is ComptrollerG3 {
    uint public blockNumber;
    address public platformTokenAddress;

    constructor() ComptrollerG3() public {}

    function setPlatformTokenAddress(address platformTokenAddress_) public {
        platformTokenAddress = platformTokenAddress_;
    }

    function getPlatformTokenAddress() public view returns (address) {
        return platformTokenAddress;
    }

    function membershipLength(GToken gToken) public view returns (uint) {
        return accountAssets[address(gToken)].length;
    }

    function fastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;

        return blockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function getBlockNumber() public view returns (uint) {
        return blockNumber;
    }

    function getPlatformTokenMarkets() public view returns (address[] memory) {
        uint m = allMarkets.length;
        uint n = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isPlatformTokened) {
                n++;
            }
        }

        address[] memory platformTokenMarkets = new address[](n);
        uint k = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isPlatformTokened) {
                platformTokenMarkets[k++] = address(allMarkets[i]);
            }
        }
        return platformTokenMarkets;
    }

    function unlist(GToken gToken) public {
        markets[address(gToken)].isListed = false;
    }
}
