pragma solidity ^0.4.24;


interface IValidatorMetadata {
    function clearMetadata(address) external;
    function moveMetadata(address, address) external;
}
