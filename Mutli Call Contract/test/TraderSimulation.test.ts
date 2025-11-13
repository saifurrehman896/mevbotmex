import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("Trader - Multicall Arbitrage Simulation", function () {
  let owner: any;
  let user: any;
  let multicall: any;
  let tokenA: any;
  let tokenB: any;
  let mockRouter: any;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const TRADE_AMOUNT = ethers.parseEther("100");
  const TEST_AMOUNT = ethers.parseEther("1"); // 1000000000000000n from your code

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy Multicall3
    const Multicall3Factory = await ethers.getContractFactory("Multicall3");
    multicall = await Multicall3Factory.deploy();
    await multicall.waitForDeployment();

    // Deploy mock ERC20 tokens
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    tokenA = await MockERC20Factory.deploy("Token A", "TKA", INITIAL_SUPPLY);
    await tokenA.waitForDeployment();

    tokenB = await MockERC20Factory.deploy("Token B", "TKB", INITIAL_SUPPLY);
    await tokenB.waitForDeployment();

    // Deploy mock DEX router
    const MockRouterFactory = await ethers.getContractFactory("MockDEXRouter");
    mockRouter = await MockRouterFactory.deploy();
    await mockRouter.waitForDeployment();

    // Fund mock router with tokens for swaps
    await tokenA.transfer(await mockRouter.getAddress(), ethers.parseEther("10000"));
    await tokenB.transfer(await mockRouter.getAddress(), ethers.parseEther("10000"));

    // Transfer some tokens to user for testing
    await tokenA.transfer(await user.getAddress(), TRADE_AMOUNT);
    await tokenB.transfer(await user.getAddress(), TRADE_AMOUNT);
  });

  describe("Setup and Deployment", function () {
    it("should deploy all contracts successfully", async function () {
      expect(await multicall.getAddress()).to.be.properAddress;
      expect(await tokenA.getAddress()).to.be.properAddress;
      expect(await tokenB.getAddress()).to.be.properAddress;
      expect(await mockRouter.getAddress()).to.be.properAddress;
    });

    it("should have correct initial token balances", async function () {
      const ownerBalanceA = await tokenA.balanceOf(await owner.getAddress());
      const routerBalanceA = await tokenA.balanceOf(await mockRouter.getAddress());
      
      expect(ownerBalanceA).to.be.gt(0);
      expect(routerBalanceA).to.equal(ethers.parseEther("10000"));
    });

    it("should set multicall owner correctly", async function () {
      const multicallOwner = await multicall.owner();
      expect(multicallOwner).to.equal(await owner.getAddress());
    });
  });

  describe("Token Approval Flow", function () {
    it("should approve multicall to transfer tokens", async function () {
      await tokenA.approve(await multicall.getAddress(), TRADE_AMOUNT);
      
      const allowance = await tokenA.allowance(
        await owner.getAddress(),
        await multicall.getAddress()
      );
      
      expect(allowance).to.equal(TRADE_AMOUNT);
    });

    it("should approve router to spend tokens from multicall", async function () {
      const routerAddress = await mockRouter.getAddress();
      const tokenAAddress = await tokenA.getAddress();
      
      await multicall.approveToken(tokenAAddress, routerAddress, TRADE_AMOUNT);
      
      const allowance = await tokenA.allowance(
        await multicall.getAddress(),
        routerAddress
      );
      
      expect(allowance).to.equal(TRADE_AMOUNT);
    });
  });

  describe("Multicall Aggregate3 - Single Operations", function () {
    it("should execute transferFrom through aggregate3", async function () {
      const multicallAddress = await multicall.getAddress();
      const ownerAddress = await owner.getAddress();
      
      // Approve multicall to pull tokens
      await tokenA.approve(multicallAddress, TRADE_AMOUNT);
      
      const erc20Iface = new ethers.Interface([
        "function transferFrom(address from, address to, uint256 amount)"
      ]);
      
      const calls = [
        {
          target: await tokenA.getAddress(),
          allowFailure: false,
          callData: erc20Iface.encodeFunctionData("transferFrom", [
            ownerAddress,
            multicallAddress,
            TEST_AMOUNT
          ])
        }
      ];
      
      await multicall.aggregate3(calls);
      
      const multicallBalance = await tokenA.balanceOf(multicallAddress);
      expect(multicallBalance).to.equal(TEST_AMOUNT);
    });

    it("should execute approve through aggregate3", async function () {
      const routerAddress = await mockRouter.getAddress();
      const tokenAAddress = await tokenA.getAddress();
      
      const erc20Iface = new ethers.Interface([
        "function approve(address spender, uint256 amount)"
      ]);
      
      const calls = [
        {
          target: tokenAAddress,
          allowFailure: false,
          callData: erc20Iface.encodeFunctionData("approve", [
            routerAddress,
            TRADE_AMOUNT
          ])
        }
      ];
      
      await multicall.aggregate3(calls);
      
      const allowance = await tokenA.allowance(await multicall.getAddress(), routerAddress);
      expect(allowance).to.equal(TRADE_AMOUNT);
    });
  });

  describe("Simulated Arbitrage Flow", function () {
    it("should execute complete arbitrage cycle", async function () {
      const multicallAddress = await multicall.getAddress();
      const ownerAddress = await owner.getAddress();
      const tokenAAddress = await tokenA.getAddress();
      const tokenBAddress = await tokenB.getAddress();
      const routerAddress = await mockRouter.getAddress();
      
      const amountIn = TEST_AMOUNT;
      const buyAmountIn = TEST_AMOUNT / 2n;
      const maxInBuy = (buyAmountIn * 1100n) / 1000n;
      
      // 1. Approve multicall to pull tokenA
      await tokenA.approve(multicallAddress, amountIn);
      
      // 2. Fund router with both tokens
      await tokenA.approve(routerAddress, ethers.parseEther("1000"));
      await tokenB.approve(routerAddress, ethers.parseEther("1000"));
      
      const erc20Iface = new ethers.Interface([
        "function transferFrom(address from, address to, uint256 amount)",
        "function approve(address spender, uint256 amount)"
      ]);
      
      const routerIface = new ethers.Interface([
        "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)"
      ]);
      
      const multicallExtraIface = new ethers.Interface([
        "function withdrawToken(address token, uint256 amount)"
      ]);
      
      const calls = [
        // 1) Pull tokenA from owner to Multicall
        {
          target: tokenAAddress,
          allowFailure: false,
          callData: erc20Iface.encodeFunctionData("transferFrom", [
            ownerAddress,
            multicallAddress,
            amountIn
          ])
        },
        // 2) Approve router to spend tokenA from Multicall
        {
          target: tokenAAddress,
          allowFailure: false,
          callData: erc20Iface.encodeFunctionData("approve", [
            routerAddress,
            amountIn
          ])
        },
        // 3) Execute SELL swap (tokenA -> tokenB)
        {
          target: routerAddress,
          allowFailure: false,
          callData: routerIface.encodeFunctionData("swapExactTokensForTokens", [
            amountIn,
            0,
            [tokenAAddress, tokenBAddress],
            multicallAddress,
            Math.floor(Date.now() / 1000) + 300
          ])
        },
        // 4) Withdraw tokenA back to owner
        {
          target: multicallAddress,
          allowFailure: false,
          callData: multicallExtraIface.encodeFunctionData("withdrawToken", [
            tokenAAddress,
            0 // withdraw all
          ])
        }
      ];
      
      const initialOwnerBalance = await tokenA.balanceOf(ownerAddress);
      
      await multicall.aggregate3(calls);
      
      // Check that tokens were processed
      const finalOwnerBalance = await tokenA.balanceOf(ownerAddress);
      const multicallBalanceA = await tokenA.balanceOf(multicallAddress);
      const multicallBalanceB = await tokenB.balanceOf(multicallAddress);
      
      console.log("Initial Owner Balance:", ethers.formatEther(initialOwnerBalance));
      console.log("Final Owner Balance:", ethers.formatEther(finalOwnerBalance));
      console.log("Multicall Balance A:", ethers.formatEther(multicallBalanceA));
      console.log("Multicall Balance B:", ethers.formatEther(multicallBalanceB));
      
      // Multicall should have minimal remaining balance after withdraw
      expect(multicallBalanceA).to.equal(0n);
    });
  });

  describe("Slippage Calculations", function () {
    it("should calculate maxInBuy with 10% slippage", function () {
      const buyAmountIn = ethers.parseEther("100");
      const maxInBuy = (buyAmountIn * 1100n) / 1000n;
      
      expect(maxInBuy).to.equal(ethers.parseEther("110"));
    });

    it("should calculate minOutSell with 15% slippage", function () {
      const expectedOutSell = ethers.parseEther("200");
      const minOutSell = (expectedOutSell * 850n) / 1000n;
      
      expect(minOutSell).to.equal(ethers.parseEther("170"));
    });

    it("should handle different slippage values", function () {
      const amount = ethers.parseEther("1000");
      
      // 1% slippage
      const slippage1 = (amount * 990n) / 1000n;
      expect(slippage1).to.equal(ethers.parseEther("990"));
      
      // 5% slippage
      const slippage5 = (amount * 950n) / 1000n;
      expect(slippage5).to.equal(ethers.parseEther("950"));
      
      // 20% slippage
      const slippage20 = (amount * 800n) / 1000n;
      expect(slippage20).to.equal(ethers.parseEther("800"));
    });
  });

  describe("Withdraw Functions", function () {
    it("should withdraw tokens to owner", async function () {
      const multicallAddress = await multicall.getAddress();
      const ownerAddress = await owner.getAddress();
      
      // Send tokens to multicall
      await tokenA.transfer(multicallAddress, TRADE_AMOUNT);
      
      const initialBalance = await tokenA.balanceOf(ownerAddress);
      
      // Withdraw
      await multicall.withdrawToken(await tokenA.getAddress(), 0);
      
      const finalBalance = await tokenA.balanceOf(ownerAddress);
      const multicallBalance = await tokenA.balanceOf(multicallAddress);
      
      expect(finalBalance).to.equal(initialBalance + TRADE_AMOUNT);
      expect(multicallBalance).to.equal(0n);
    });

    it("should only allow owner to withdraw", async function () {
      const multicallAddress = await multicall.getAddress();
      
      // Send tokens to multicall
      await tokenA.transfer(multicallAddress, TRADE_AMOUNT);
      
      // Try to withdraw as user (not owner)
      await expect(
        multicall.connect(user).withdrawToken(await tokenA.getAddress(), TRADE_AMOUNT)
      ).to.be.revertedWith("Multicall3: caller is not the owner");
    });
  });

  describe("Error Handling", function () {
    it("should revert if any call fails with allowFailure=false", async function () {
      const erc20Iface = new ethers.Interface([
        "function transfer(address to, uint256 amount)"
      ]);
      
      const calls = [
        {
          target: await tokenA.getAddress(),
          allowFailure: false,
          callData: erc20Iface.encodeFunctionData("transfer", [
            await user.getAddress(),
            ethers.parseEther("999999999") // Amount too large
          ])
        }
      ];
      
      await expect(multicall.aggregate3(calls)).to.be.reverted;
    });

    it("should continue if call fails with allowFailure=true", async function () {
      const erc20Iface = new ethers.Interface([
        "function transfer(address to, uint256 amount)"
      ]);
      
      const calls = [
        {
          target: await tokenA.getAddress(),
          allowFailure: true, // Allow this to fail
          callData: erc20Iface.encodeFunctionData("transfer", [
            await user.getAddress(),
            ethers.parseEther("999999999")
          ])
        }
      ];
      
      const results = await multicall.aggregate3.staticCall(calls);
      expect(results[0].success).to.be.false;
    });
  });
});
