pragma solidity ^0.4.23;


interface IEternalStorageProxy {
    function upgradeTo(address) external;
}