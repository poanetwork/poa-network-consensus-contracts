pragma solidity ^0.4.24;

import '../../contracts/RewardByBlock.sol';


contract RewardByBlockMock is RewardByBlock {
    modifier onlySystem {
        require(msg.sender == addressStorage[keccak256("systemAddress")]);
        _;
    }

    function bridgesAllowed() public pure returns(address[3]) {
        return([
            0x6704Fbfcd5Ef766B287262fA2281C105d57246a6,
            0x9E1Ef1eC212F5DFfB41d35d9E5c14054F26c6560,
            0xce42bdB34189a93c55De250E011c68FaeE374Dd3
        ]);
    }

    function setSystemAddress(address _address) public {
        addressStorage[keccak256("systemAddress")] = _address;
    }
}