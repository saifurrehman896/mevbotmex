// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

/// @title Multicall3
/// @notice Aggregate results from multiple function calls
/// @author Modified from Multicall3 (https://github.com/mds1/multicall)
/// @dev Multicall & Multicall2 backwards-compatible
/// @dev Aggregate methods are marked `payable` to save 24 gas per call

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract Multicall3 {
    
    // ============ State Variables ============
    
    address public immutable owner;

    // ============ Structs ============

    struct Call {
        address target;
        bytes callData;
    }

    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }

    struct Call3Value {
        address target;
        bool allowFailure;
        uint256 value;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    // ============ Events ============

    event TokenWithdrawn(address indexed token, address indexed to, uint256 amount);
    event NativeWithdrawn(address indexed to, uint256 amount);
    event TokenApproved(address indexed token, address indexed spender, uint256 amount);

    // ============ Errors ============

    error CallFailed(uint256 callIndex);
    error InsufficientValue(uint256 required, uint256 provided);
    error TransferFailed();
    error Unauthorized();
    error InvalidAddress();
    error InsufficientBalance();

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
    }

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ============ Multicall Functions ============

    /// @notice Backwards-compatible call aggregation with Multicall
    /// @param calls An array of Call structs
    /// @return blockNumber The block number where the calls were executed
    /// @return returnData An array of bytes containing the responses
    function aggregate(Call[] calldata calls) 
        public 
        payable 
        onlyOwner
        returns (uint256 blockNumber, bytes[] memory returnData) 
    {
        blockNumber = block.number;
        uint256 length = calls.length;
        returnData = new bytes[](length);
        
        for (uint256 i; i < length;) {
            Call calldata calli = calls[i];
            (bool success, bytes memory ret) = calli.target.call(calli.callData);
            if (!success) revert CallFailed(i);
            returnData[i] = ret;
            unchecked { ++i; }
        }
    }

    /// @notice Backwards-compatible with Multicall2
    /// @notice Aggregate calls without requiring success
    /// @param requireSuccess If true, require all calls to succeed
    /// @param calls An array of Call structs
    /// @return returnData An array of Result structs
    function tryAggregate(bool requireSuccess, Call[] calldata calls) 
        public 
        payable 
        onlyOwner
        returns (Result[] memory returnData) 
    {
        uint256 length = calls.length;
        returnData = new Result[](length);
        
        for (uint256 i; i < length;) {
            Call calldata calli = calls[i];
            (bool success, bytes memory ret) = calli.target.call(calli.callData);
            
            if (requireSuccess && !success) revert CallFailed(i);
            
            returnData[i] = Result(success, ret);
            unchecked { ++i; }
        }
    }

    /// @notice Backwards-compatible with Multicall2
    /// @notice Aggregate calls and allow failures using tryAggregate
    /// @param requireSuccess If true, require all calls to succeed
    /// @param calls An array of Call structs
    /// @return blockNumber The block number where the calls were executed
    /// @return blockHash The hash of the block where the calls were executed
    /// @return returnData An array of Result structs
    function tryBlockAndAggregate(bool requireSuccess, Call[] calldata calls) 
        public 
        payable 
        onlyOwner
        returns (uint256 blockNumber, bytes32 blockHash, Result[] memory returnData) 
    {
        blockNumber = block.number;
        blockHash = blockhash(block.number);
        returnData = tryAggregate(requireSuccess, calls);
    }

    /// @notice Backwards-compatible with Multicall2
    /// @notice Aggregate calls requiring all to succeed
    /// @param calls An array of Call structs
    /// @return blockNumber The block number where the calls were executed
    /// @return blockHash The hash of the block where the calls were executed
    /// @return returnData An array of Result structs
    function blockAndAggregate(Call[] calldata calls) 
        public 
        payable 
        onlyOwner
        returns (uint256 blockNumber, bytes32 blockHash, Result[] memory returnData) 
    {
        (blockNumber, blockHash, returnData) = tryBlockAndAggregate(true, calls);
    }

    /// @notice Aggregate calls, ensuring each returns success if required
    /// @param calls An array of Call3 structs
    /// @return returnData An array of Result structs
    function aggregate3(Call3[] calldata calls) 
        public 
        payable 
        onlyOwner
        returns (Result[] memory returnData) 
    {
        uint256 length = calls.length;
        returnData = new Result[](length);
        
        for (uint256 i; i < length;) {
            Call3 calldata calli = calls[i];
            (bool success, bytes memory ret) = calli.target.call(calli.callData);
            
            if (!calli.allowFailure && !success) revert CallFailed(i);
            
            returnData[i] = Result(success, ret);
            unchecked { ++i; }
        }
    }

    /// @notice Aggregate calls with a msg value
    /// @notice Reverts if msg.value is less than the sum of the call values
    /// @param calls An array of Call3Value structs
    /// @return returnData An array of Result structs
    function aggregate3Value(Call3Value[] calldata calls) 
        public 
        payable 
        onlyOwner
        returns (Result[] memory returnData) 
    {
        uint256 valAccumulator;
        uint256 length = calls.length;
        returnData = new Result[](length);
        
        for (uint256 i; i < length;) {
            Call3Value calldata calli = calls[i];
            uint256 val = calli.value;
            unchecked { valAccumulator += val; }
            
            (bool success, bytes memory ret) = calli.target.call{value: val}(calli.callData);
            
            if (!calli.allowFailure && !success) revert CallFailed(i);
            
            returnData[i] = Result(success, ret);
            unchecked { ++i; }
        }
        
        if (msg.value != valAccumulator) {
            revert InsufficientValue(valAccumulator, msg.value);
        }
    }

    // ============ Helper Functions ============

    /// @notice Returns the block hash for the given block number
    /// @param blockNumber The block number
    /// @return blockHash The block hash
    function getBlockHash(uint256 blockNumber) 
        public 
        view 
        onlyOwner
        returns (bytes32 blockHash) 
    {
        blockHash = blockhash(blockNumber);
    }

    /// @notice Returns the block number
    /// @return blockNumber The current block number
    function getBlockNumber() 
        public 
        view 
        onlyOwner
        returns (uint256 blockNumber) 
    {
        blockNumber = block.number;
    }

    /// @notice Returns the block coinbase
    /// @return coinbase The current block coinbase
    function getCurrentBlockCoinbase() 
        public 
        view 
        onlyOwner
        returns (address coinbase) 
    {
        coinbase = block.coinbase;
    }

    /// @notice Returns the block difficulty
    /// @return difficulty The current block difficulty
    function getCurrentBlockDifficulty() 
        public 
        view 
        onlyOwner
        returns (uint256 difficulty) 
    {
        difficulty = block.difficulty;
    }

    /// @notice Returns the block gas limit
    /// @return gaslimit The current block gas limit
    function getCurrentBlockGasLimit() 
        public 
        view 
        onlyOwner
        returns (uint256 gaslimit) 
    {
        gaslimit = block.gaslimit;
    }

    /// @notice Returns the block timestamp
    /// @return timestamp The current block timestamp
    function getCurrentBlockTimestamp() 
        public 
        view 
        onlyOwner
        returns (uint256 timestamp) 
    {
        timestamp = block.timestamp;
    }

    /// @notice Returns the (ETH/BNB) balance of a given address
    /// @param addr The address to query
    /// @return balance The native token balance
    function getEthBalance(address addr) 
        public 
        view 
        onlyOwner
        returns (uint256 balance) 
    {
        balance = addr.balance;
    }

    /// @notice Returns the block hash of the last block
    /// @return blockHash The last block hash
    function getLastBlockHash() 
        public 
        view 
        onlyOwner
        returns (bytes32 blockHash) 
    {
        unchecked {
            blockHash = blockhash(block.number - 1);
        }
    }

    /// @notice Gets the base fee of the given block
    /// @return basefee The current block base fee
    function getBasefee() 
        public 
        view 
        onlyOwner
        returns (uint256 basefee) 
    {
        basefee = block.basefee;
    }

    /// @notice Returns the chain id
    /// @return chainid The current chain id
    function getChainId() 
        public 
        view 
        onlyOwner
        returns (uint256 chainid) 
    {
        chainid = block.chainid;
    }

    // ============ Token Management Functions ============

    /// @notice Withdraw ERC20 tokens to owner
    /// @param token The ERC20 token address
    /// @param amount The amount to withdraw (0 = withdraw all)
    function withdrawToken(address token, uint256 amount) 
        external 
        onlyOwner 
    {
        if (token == address(0)) revert InvalidAddress();
        
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert InsufficientBalance();
        
        uint256 withdrawAmount = amount == 0 ? balance : amount;
        if (withdrawAmount > balance) revert InsufficientBalance();
        
        bool success = IERC20(token).transfer(owner, withdrawAmount);
        if (!success) revert TransferFailed();
        
        emit TokenWithdrawn(token, owner, withdrawAmount);
    }

    /// @notice Approve a spender to use ERC20 tokens (for DeFi interactions)
    /// @param token The ERC20 token address
    /// @param spender The address to approve (e.g., DEX router)
    /// @param amount The amount to approve (use type(uint256).max for unlimited)
    function approveToken(address token, address spender, uint256 amount) 
        external 
        onlyOwner 
    {
        if (token == address(0) || spender == address(0)) revert InvalidAddress();
        
        bool success = IERC20(token).approve(spender, amount);
        if (!success) revert TransferFailed();
        
        emit TokenApproved(token, spender, amount);
    }

    /// @notice Revoke approval for a spender
    /// @param token The ERC20 token address
    /// @param spender The address to revoke approval from
    function revokeApproval(address token, address spender) 
        external 
        onlyOwner 
    {
        if (token == address(0) || spender == address(0)) revert InvalidAddress();
        
        bool success = IERC20(token).approve(spender, 0);
        if (!success) revert TransferFailed();
        
        emit TokenApproved(token, spender, 0);
    }

    /// @notice Check token allowance
    /// @param token The ERC20 token address
    /// @param spender The spender address
    /// @return allowance The approved amount
    function getAllowance(address token, address spender) 
        external 
        view 
        onlyOwner 
        returns (uint256) 
    {
        return IERC20(token).allowance(address(this), spender);
    }

    /// @notice Get token balance
    /// @param token The ERC20 token address
    /// @return balance The token balance of this contract
    function getTokenBalance(address token) 
        external 
        view 
        onlyOwner 
        returns (uint256) 
    {
        return IERC20(token).balanceOf(address(this));
    }

    /// @notice Withdraw native token (BNB/ETH) to owner
    /// @param amount The amount to withdraw (0 = withdraw all)
    function withdrawNative(uint256 amount) 
        external 
        onlyOwner 
    {
        uint256 balance = address(this).balance;
        if (balance == 0) revert InsufficientBalance();
        
        uint256 withdrawAmount = amount == 0 ? balance : amount;
        if (withdrawAmount > balance) revert InsufficientBalance();
        
        (bool success, ) = owner.call{value: withdrawAmount}("");
        if (!success) revert TransferFailed();
        
        emit NativeWithdrawn(owner, withdrawAmount);
    }

    /// @notice Emergency function to rescue accidentally sent tokens
    /// @param token The token address to rescue
    /// @param to The address to send tokens to
    /// @param amount The amount to rescue
    function rescueToken(address token, address to, uint256 amount) 
        external 
        onlyOwner 
    {
        if (token == address(0) || to == address(0)) revert InvalidAddress();
        
        bool success = IERC20(token).transfer(to, amount);
        if (!success) revert TransferFailed();
        
        emit TokenWithdrawn(token, to, amount);
    }

    // ============ Receive Function ============

    /// @notice Allow contract to receive native tokens
    receive() external payable {}
    
    /// @notice Fallback function
    fallback() external payable {}
}