import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
if (!BSCSCAN_API_KEY) {
    console.error('BSCSCAN_API_KEY not set in .env');
    process.exit(1);
}

async function verifyContract(address, contractPath, contractName) {
    try {
        console.log(`\nVerifying ${contractName} at ${address}...`);
        
        // Read the contract source code
        const sourceCode = fs.readFileSync(contractPath, 'utf8');
        
        // Create FormData for the request
        const form = new FormData();
        
        form.append('apikey', BSCSCAN_API_KEY);
        form.append('module', 'contract');
        form.append('action', 'verify');
        form.append('contractaddress', address);
        form.append('sourceCode', sourceCode);
        form.append('codeformat', 'solidity-single-file');
        form.append('contractname', `${path.basename(contractPath)}:${contractName}`);
        form.append('compilerversion', 'v0.8.12+commit.f00d7308');
        form.append('optimizationUsed', '1');
        form.append('runs', '200');
        form.append('evmversion', 'london');
        
        // Submit verification request
        console.log('Submitting verification request...');
        const response = await axios.post('https://api.bscscan.com/api/v2/verify', form, {
            headers: form.getHeaders()
        });

        if (response.data.status !== '1') {
            throw new Error(`Verification submission failed: ${JSON.stringify(response.data)}`);
        }

        const guid = response.data.result;
        console.log(`Verification submitted. GUID: ${guid}`);

        // Poll for verification status
        for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const statusResponse = await axios.get('https://api.bscscan.com/api/v2/verify', {
                params: {
                    apikey: BSCSCAN_API_KEY,
                    module: 'contract',
                    action: 'checkverifystatus',
                    guid
                }
            });

            console.log(`Check ${i + 1}: ${statusResponse.data.result}`);
            
            if (statusResponse.data.status === '1') {
                console.log('Verification successful!');
                return true;
            } else if (!statusResponse.data.result.includes('Pending')) {
                throw new Error(`Verification failed: ${statusResponse.data.result}`);
            }
        }
        
        throw new Error('Verification timed out');
    } catch (error) {
        console.error(`Verification failed:`, error.message);
        return false;
    }
}

async function main() {
    const deployments = JSON.parse(fs.readFileSync('deployments-bsc.json', 'utf8'));

    // Verify Multicall3
    await verifyContract(
        deployments.multicall3,
        path.join(__dirname, '..', 'contracts', 'Multicall.sol'),
        'Multicall3'
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });