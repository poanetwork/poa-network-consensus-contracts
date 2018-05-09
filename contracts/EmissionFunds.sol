pragma solidity ^0.4.23;

import "./interfaces/IEmissionFunds.sol";


contract EmissionFunds is IEmissionFunds {
    address public votingToManageEmissionFunds;

    event SendFundsTo(address indexed receiver, address indexed caller, uint256 value);
    event BurnFunds(address indexed burner, uint256 value);

    modifier onlyVotingToManageEmissionFunds() {
        require(msg.sender == votingToManageEmissionFunds);
        _;
    }

    constructor(address _votingToManageEmissionFunds) public {
        require(_votingToManageEmissionFunds != address(0));
        votingToManageEmissionFunds = _votingToManageEmissionFunds;
    }

    function () external payable {}

    function sendFundsTo(address _receiver)
        external
        onlyVotingToManageEmissionFunds
        returns(bool)
    {
        uint256 value = _balance();
        emit SendFundsTo(_receiver, msg.sender, value);
        // using `send` instead of `transfer` to avoid revert on failure
        return _receiver.send(value);
    }

    function burnFunds()
        external
        onlyVotingToManageEmissionFunds
        returns(bool)
    {
        uint256 value = _balance();
        emit BurnFunds(msg.sender, value);
        // using `send` instead of `transfer` to avoid revert on failure
        return address(0).send(value);
    }

    function _balance() private view returns(uint256) {
        return address(this).balance;
    }
}