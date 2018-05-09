pragma solidity ^0.4.18;

import "./interfaces/IEmissionFunds.sol";


contract EmissionFunds is IEmissionFunds {
    address public votingToManageEmissionFunds;

    event SendFundsTo(address indexed receiver, address indexed caller, uint256 value, bool success);
    event BurnFunds(address indexed burner, uint256 value, bool success);

    modifier onlyVotingToManageEmissionFunds() {
        require(msg.sender == votingToManageEmissionFunds);
        _;
    }

    function EmissionFunds(address _votingToManageEmissionFunds) public {
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
        // using `send` instead of `transfer` to avoid revert on failure
        bool success = _receiver.send(value);
        SendFundsTo(_receiver, msg.sender, value, success);
        return success;
    }

    function burnFunds()
        external
        onlyVotingToManageEmissionFunds
        returns(bool)
    {
        uint256 value = _balance();
        // using `send` instead of `transfer` to avoid revert on failure
        bool success = address(0).send(value);
        BurnFunds(msg.sender, value, success);
        return success;
    }

    function _balance() private view returns(uint256) {
        return address(this).balance;
    }
}