pragma solidity ^0.5.16;

interface UnitrollerInterface{
    //    Unitroller methods
    function getMigrator() external view  returns (address);
    function _setMigrator(address _migrator) external returns (address);
    function _removeMigrator() external returns (address);
}
