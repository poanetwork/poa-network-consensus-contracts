pragma solidity ^0.4.24;


interface IEternalStorageProxy {
    function upgradeTo(address) external returns(bool);
}