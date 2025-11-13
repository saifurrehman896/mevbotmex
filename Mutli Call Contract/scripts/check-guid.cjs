const axios = require('axios');
require('dotenv').config();

const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
if (!BSCSCAN_API_KEY) {
  console.error('BSCSCAN_API_KEY not set in .env');
  process.exit(1);
}

const guid = process.argv[2];
if (!guid) {
  console.error('Usage: node check-guid.cjs <GUID>');
  process.exit(1);
}

(async () => {
  try {
    const params = new URLSearchParams({
      apikey: BSCSCAN_API_KEY,
      module: 'contract',
      action: 'checkverifystatus',
      guid,
    });
    const resp = await axios.get(`https://api.bscscan.com/api?${params.toString()}`, { timeout: 60000 });
    console.log(JSON.stringify(resp.data, null, 2));
  } catch (e) {
    console.error('Request failed:', e.message || e);
    process.exit(1);
  }
})();