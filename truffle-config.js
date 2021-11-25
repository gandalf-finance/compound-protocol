const dotenv = require('dotenv');
const result = dotenv.config();
if (result.error) {
    throw result.error;
}
console.log(result.parsed);

//var NonceTrackerSubprovider = require("web3-provider-engine/subproviders/nonce-tracker");
var HDWalletProvider = require("truffle-hdwallet-provider");

/*访问https://infura.io/注册后获取的api-key*/
var infura_apikey = process.env.apikey;
var keys = [process.env.kovan_key0, process.env.kovan_key1, process.env.kovan_key2, process.env.kovan_key3];
//var mnemonic_mainnet = process.env.mnemonic_mainnet;
module.exports = {



    networks: {
        development: {
            host: "127.0.0.1",     // Localhost (default: none)
            port: 8545,            // Standard Ethereum port (default: none)
            network_id: "*",       // Any network (default: none)
            gas: 5002388,
            gasPrice: 30000000000
        },
        okChain: {
            provider: new HDWalletProvider(keys, "http://52.194.184.219:8545", 0, 4),
            network_id: 65,
            gas: 6500000,
            gasPrice: 30000000000
        },

        kovan: {
            provider: new HDWalletProvider(keys, "https://kovan.infura.io/v3/" + infura_apikey, 0, 4),
            network_id: 42,
            gas: 6500000,
            gasPrice: 30000000000
        },
        binance: {
            provider: new HDWalletProvider(keys, "https://data-seed-prebsc-1-s2.binance.org:8545/", 0, 4),
            network_id: 97,
            gas: 3012388,
            gasPrice: 30000000000,
            networkCheckTimeout: 30000
        },
        binanceTest: {
            provider: new HDWalletProvider(keys, "https://data-seed-prebsc-1-s1.binance.org:8545/", 0, 4),
            network_id: 97,
            gas: 8000000,
            gasPrice: 10000000000,
            networkCheckTimeout: 30000
        },
        hecoTestnet: {
            provider: new HDWalletProvider(keys, "https://http-testnet.hecochain.com", 0, 4),
            network_id: 256,
            gas: 6002388,
            gasPrice: 3000000000
        },
        hecochain: {
            provider: new HDWalletProvider(keys, "https://http-mainnet.hecochain.com", 0, 4),
            network_id: 128,
            gas: 3012388,
            gasPrice: 10000000000
        }
    },

    compilers: {
        solc: {
            version: "0.5.16",
            settings: {
                //evmVersion: 'byzantium', // Default: "petersburg"
                optimizer: {
                    enabled: true,
                    runs: 200
                }
            }
        },
    },
    plugins: [
        'truffle-plugin-verify'
    ],
    api_keys: {
        etherscan: process.env.ETHERSCAN_API_KEY
    }
};
