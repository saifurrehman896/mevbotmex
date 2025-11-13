// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

interface IERC20Mock {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract MockDEXRouter {
    // Simple mock that simulates token swaps with a fixed rate
    
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        require(deadline >= block.timestamp, "Expired");
        require(path.length >= 2, "Invalid path");
        
        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];
        
        // Transfer tokens from sender to this contract
        IERC20Mock(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        
        // Calculate output (1:1 ratio for simplicity, with 1% fee)
        uint amountOut = (amountIn * 99) / 100;
        require(amountOut >= amountOutMin, "Insufficient output amount");
        
        // Transfer output tokens to recipient
        IERC20Mock(tokenOut).transfer(to, amountOut);
        
        amounts = new uint[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
        
        return amounts;
    }
    
    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        require(deadline >= block.timestamp, "Expired");
        require(path.length >= 2, "Invalid path");
        
        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];
        
        // Calculate required input (1:1 ratio with 1% fee)
        uint amountIn = (amountOut * 101) / 100;
        require(amountIn <= amountInMax, "Excessive input amount");
        
        // Transfer tokens from sender to this contract
        IERC20Mock(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        
        // Transfer output tokens to recipient
        IERC20Mock(tokenOut).transfer(to, amountOut);
        
        amounts = new uint[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
        
        return amounts;
    }
    
    function getAmountsOut(uint amountIn, address[] calldata path) 
        external 
        pure 
        returns (uint[] memory amounts) 
    {
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        
        // Simple 1:1 ratio with 1% fee
        for (uint i = 1; i < path.length; i++) {
            amounts[i] = (amounts[i-1] * 99) / 100;
        }
        
        return amounts;
    }
    
    function getAmountsIn(uint amountOut, address[] calldata path) 
        external 
        pure 
        returns (uint[] memory amounts) 
    {
        amounts = new uint[](path.length);
        amounts[amounts.length - 1] = amountOut;
        
        // Simple 1:1 ratio with 1% fee (reversed)
        for (uint i = path.length - 1; i > 0; i--) {
            amounts[i-1] = (amounts[i] * 101) / 100;
        }
        
        return amounts;
    }
}
