pragma solidity ^0.5.16;

import "../../../contracts/GDaiDelegate.sol";

contract GDaiDelegateCertora is GDaiDelegate {
    function getCashOf(address account) public view returns (uint) {
        return EIP20Interface(underlying).balanceOf(account);
    }
}
