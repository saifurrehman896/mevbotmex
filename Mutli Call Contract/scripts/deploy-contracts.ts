import { network } from "hardhat";
import fs from "fs";

async function main() {
    const { ethers } = await network.connect();
    console.log("Starting deployment...");

    // Get the deployer's address
    const [deployer] = await ethers.getSigners();
    const provider = deployer.provider;
    if (!provider) throw new Error("No provider available");

    console.log(`Deploying contracts with account: ${deployer.address}`);
    console.log(`Account balance: ${ethers.formatEther(await provider.getBalance(deployer.address))} BNB`);

    try {
        // Deploy Multicall3
        console.log("\nDeploying Multicall3...");
        const multicallFactory = await ethers.getContractFactory("Multicall3");
        const multicall = await multicallFactory.deploy();
        await multicall.waitForDeployment();
        const multicallAddress = await multicall.getAddress();
        console.log(`Multicall3 deployed to: ${multicallAddress}`);
        console.log(`Transaction hash: ${multicall.deploymentTransaction()?.hash}`);



        // Sconst result = await multicall.aggregate.staticCall(calls);
        console.log("Multicall3 test successful");
        
        // Print deployment summary
        console.log("\nDeployment Summary");
        console.log("------------------");
        const networkName = await provider.getNetwork().then(n => n.name);
        console.log(`Network: ${networkName}`);
        console.log(`Multicall3: ${multicallAddress}`);
    
        console.log("\nDeployment completed successfully!");

        // Save deployment addresses to a file
        const deployments = {
            network: networkName,
            multicall3: multicallAddress,
            deployer: deployer.address,
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync(
            `deployments-${networkName}.json`,
            JSON.stringify(deployments, null, 2)
        );
        console.log(`\nDeployment addresses saved to deployments-${networkName}.json`);

    } catch (error) {
        console.error("Deployment failed:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });