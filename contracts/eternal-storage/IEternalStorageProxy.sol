pragma solidity ^0.4.18;


interface IEternalStorageProxy {
    function upgradeTo(address) public;
}