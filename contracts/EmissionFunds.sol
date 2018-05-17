pragma solidity ^0.4.23;

import "./interfaces/IEmissionFunds.sol";


contract EmissionFunds is IEmissionFunds {
    address public votingToManageEmissionFunds;

    event SendFundsTo(
        address indexed receiver,
        address indexed caller,
        uint256 amount,
        bool success
    );
    
    event BurnFunds(
        address indexed burner,
        uint256 amount,
        bool success
    );

    modifier onlyPayloadSize(uint256 numwords) {
        assert(msg.data.length >= numwords * 32 + 4);
        _;
    }

    modifier onlyVotingToManageEmissionFunds() {
        require(msg.sender == votingToManageEmissionFunds);
        _;
    }

    constructor(address _votingToManageEmissionFunds) public {
        require(_votingToManageEmissionFunds != address(0));
        votingToManageEmissionFunds = _votingToManageEmissionFunds;
    }

    function() external payable {}

    function sendFundsTo(address _receiver, uint256 _amount)
        external
        onlyVotingToManageEmissionFunds
        onlyPayloadSize(2)
        returns(bool)
    {
        // using `send` instead of `transfer` to avoid revert on failure
        bool success = _receiver.send(_amount);
        emit SendFundsTo(_receiver, msg.sender, _amount, success);
        return success;
    }

    function burnFunds(uint256 _amount)
        external
        onlyVotingToManageEmissionFunds
        returns(bool)
    {
        // using `send` instead of `transfer` to avoid revert on failure
        bool success = address(0).send(_amount);
        emit BurnFunds(msg.sender, _amount, success);
        return success;
    }
}