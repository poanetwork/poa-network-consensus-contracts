pragma solidity ^0.4.24;

import "./interfaces/IEmissionFunds.sol";


contract EmissionFunds is IEmissionFunds {
    address public votingToManageEmissionFunds;

    event FundsSentTo(
        address indexed receiver,
        address caller,
        uint256 amount,
        bool indexed success
    );
    
    event FundsBurnt(
        address caller,
        uint256 amount,
        bool indexed success
    );

    event FundsFrozen(
        address caller,
        uint256 amount
    );

    modifier onlyVotingToManageEmissionFunds() {
        require(msg.sender == votingToManageEmissionFunds);
        _;
    }

    constructor(address _votingToManageEmissionFunds) public {
        require(_votingToManageEmissionFunds != address(0));
        votingToManageEmissionFunds = _votingToManageEmissionFunds;
    }

    function() external payable {} // solhint-disable-line no-empty-blocks

    function sendFundsTo(address _receiver, uint256 _amount)
        external
        onlyVotingToManageEmissionFunds
        returns(bool)
    {
        if (msg.data.length < 32*2 + 4) return false;
        // using `send` instead of `transfer` to avoid revert on failure
        bool success = _receiver.send(_amount);
        // solhint-disable avoid-tx-origin
        emit FundsSentTo(_receiver, msg.sender, _amount, success);
        // solhint-enable avoid-tx-origin
        return success;
    }

    function burnFunds(uint256 _amount)
        external
        onlyVotingToManageEmissionFunds
        returns(bool)
    {
        // using `send` instead of `transfer` to avoid revert on failure
        bool success = address(0).send(_amount);
        // solhint-disable avoid-tx-origin
        emit FundsBurnt(msg.sender, _amount, success);
        // solhint-enable avoid-tx-origin
        return success;
    }

    function freezeFunds(uint256 _amount)
        external
        onlyVotingToManageEmissionFunds
    {
        // solhint-disable avoid-tx-origin
        emit FundsFrozen(msg.sender, _amount);
        // solhint-enable avoid-tx-origin
    }
}
