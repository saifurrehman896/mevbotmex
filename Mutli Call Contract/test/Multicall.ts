import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("Multicall3", function () {
  let multicall: any;
  let testContract: any;

  beforeEach(async function () {
    multicall = await ethers.deployContract("Multicall3");
    testContract = await ethers.deployContract("Counter");
  });

  describe("aggregate", function () {
    it("should aggregate multiple calls successfully", async function () {
      const calls = [
        {
          target: testContract.target,
          callData: testContract.interface.encodeFunctionData("inc"),
        },
        {
          target: testContract.target,
          callData: testContract.interface.encodeFunctionData("x"),
        },
      ];

      const { blockNumber, returnData } = await multicall.aggregate.staticCall(calls);
      
      expect(blockNumber).to.equal(await ethers.provider.getBlockNumber());
      expect(returnData).to.have.length(2);
      
      // Now do the actual call
      await multicall.aggregate(calls);
      
      // Verify the counter value directly
      expect(await testContract.x()).to.equal(1n);
    });
  });

  describe("tryAggregate", function () {
    it("should handle successful and failed calls appropriately", async function () {
      const calls = [
        {
          target: testContract.target,
          callData: testContract.interface.encodeFunctionData("inc"),
        },
        {
          target: testContract.target,
          callData: "0xdeadbeef", // Invalid function signature
        },
      ];

      const returnData = await multicall.tryAggregate.staticCall(false, calls);
      expect(returnData).to.have.length(2);
      expect(returnData[0].success).to.be.true;
      expect(returnData[1].success).to.be.false;
    });
  });

  describe("aggregate3", function () {
    it("should handle calls with allowFailure flag", async function () {
      const calls = [
        {
          target: testContract.target,
          allowFailure: true,
          callData: testContract.interface.encodeFunctionData("inc"),
        },
        {
          target: testContract.target,
          allowFailure: true,
          callData: "0xdeadbeef", // Invalid function signature
        },
      ];

      const returnData = await multicall.aggregate3.staticCall(calls);
      expect(returnData).to.have.length(2);
      expect(returnData[0].success).to.be.true;
      expect(returnData[1].success).to.be.false;
    });
  });
});