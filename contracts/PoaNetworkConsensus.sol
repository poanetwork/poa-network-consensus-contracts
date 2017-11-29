pragma solidity ^0.4.18;

contract PoaNetworkConsensus {
    /// Issue this log event to signal a desired change in validator set.
    /// This will not lead to a change in active validator set until 
    /// finalizeChange is called.
    ///
    /// Only the last log event of any block can take effect.
    /// If a signal is issued while another is being finalized it may never
    /// take effect.
    /// 
    /// parentHash here should be the parent block hash, or the
    /// signal will not be recognized.
    event InitiateChange(bytes32 indexed parentHash, address[] newSet);
    event ChangeFinalized(address[] newSet);
    event ChangeReference(string nameOfContract, address newAddress);
    struct ValidatorState {
        // Is this a validator.
        bool isValidator;
        // Index in the currentValidators.
        uint256 index;
    }

    bool public finalized = false;
    address public systemAddress = 0xfffffffffffffffffffffffffffffffffffffffe;
    address[] public currentValidators;
    address[] public pendingList;
    address public keysManager;
    address public ballotsManager;
    uint256 public currentValidatorsLength;
    mapping(address => ValidatorState) public validatorsState;


    modifier onlySystemAndNotFinalized() {
        require(msg.sender == systemAddress && !finalized);
        _;
    }

    modifier onlyBallotsManagerOrKeysManager() {
        require(msg.sender == ballotsManager || msg.sender == keysManager);
        _;
    }

    modifier onlyBallotsManager() {
        require(msg.sender == ballotsManager);
        _;
    }

    modifier onlyKeysManager() {
        require(msg.sender == keysManager);
        _;
    }

    modifier isValidator(address _someone) {
        require(validatorsState[_someone].isValidator);
        _;
    }

    modifier isNotValidator(address _someone) {
        require(!validatorsState[_someone].isValidator);
        _;
    }

    function PoaNetworkConsensus() {
        // TODO: When you deploy this contract, make sure you hardcode items below
        // Make sure you have those addresses defined in spec.json
        currentValidators = [0x0039F22efB07A647557C7C5d17854CFD6D489eF3];
        for (uint256 i = 0; i < currentValidators.length; i++) {
            validatorsState[currentValidators[i]] = ValidatorState({
                isValidator: true,
                index: i
            });
        }
        currentValidatorsLength = currentValidators.length;
        pendingList = currentValidators;
        keysManager = 0x0039F22efB07A647557C7C5d17854CFD6D489eF3;
        ballotsManager = 0x0039F22efB07A647557C7C5d17854CFD6D489eF3;
    }
    /// Get current validator set (last enacted or initial if no changes ever made)
    function getValidators() public view returns(address[]) {
        return currentValidators;
    }

    /// Called when an initiated change reaches finality and is activated. 
    /// Only valid when msg.sender == SUPER_USER (EIP96, 2**160 - 2)
    ///
    /// Also called when the contract is first enabled for consensus. In this case,
    /// the "change" finalized is the activation of the initial set.
    function finalizeChange() public onlySystemAndNotFinalized {
        finalized = true;
        currentValidators = pendingList;
        currentValidatorsLength = currentValidators.length;
        ChangeFinalized(getValidators());
    }


    function addValidator(address _validator) public onlyKeysManager isNotValidator(_validator) {
        require(_validator != address(0));
        pendingList = currentValidators;
        pendingList.push(_validator);
        validatorsState[_validator] = ValidatorState({
            isValidator: true,
            index: currentValidators.length
        });
        finalized = false;
        InitiateChange(block.blockhash(block.number - 1), pendingList);
    }

    function removeValidator(address _validator) public onlyKeysManager isValidator(_validator) {
        uint removedIndex = validatorsState[_validator].index;
        // Can not remove the last validator.
        uint lastIndex = pendingList.length - 1;
        address lastValidator = pendingList[lastIndex];
        // Override the removed validator with the last one.
        pendingList[removedIndex] = lastValidator;
        // Update the index of the last validator.
        validatorsState[lastValidator].index = removedIndex;
        delete pendingList[lastIndex];
        pendingList.length--;
        validatorsState[_validator].index = 0;
        validatorsState[_validator].isValidator = false;
        finalized = false;
        InitiateChange(block.blockhash(block.number - 1), pendingList);
    }

    function setKeysManager(address _newAddress) public onlyBallotsManager {
        require(_newAddress != address(0));
        require(_newAddress != ballotsManager);
        keysManager = _newAddress;
        ChangeReference("KeysManager", keysManager);
    }

    function setBallotsManager(address _newAddress) public onlyBallotsManager {
        require(_newAddress != address(0));
        require(_newAddress != keysManager);
        ballotsManager = _newAddress;
        ChangeReference("BallotsManager", ballotsManager);
    }

}