const JumpRateModelV2 = artifacts.require("JumpRateModelV2");
const writeAddress = require('../deploy/script/writeAddress');
const fs = require('fs');
const argv = require('minimist')(process.argv.slice(2), { string: ['network'] });
module.exports = async function () {
    try {
        console.log("deploy start...");
        let accounts = await web3.eth.getAccounts();
        let admin = accounts[0];
        data = fs.readFileSync('./deploy/config/JumpRateModelV2.json');
        let config = JSON.parse(data);
        let network = argv['network']
        const path = './deploy/Address' + '_' + network + '.json';
        let addressData = fs.readFileSync(path);
        let address = JSON.parse(addressData);
        for (const [name, params] of Object.entries(config)) {
            if (address[name] == undefined) {
                baseRatePerYear = params.baseRatePerYear;
                multiplierPerYear = params.multiplierPerYear;
                jumpMultiplierPerYear = params.jumpMultiplierPerYear;
                kink_ = params.kink_;
                owner_ = params.owner_;
                this.JumpRateModelV2 = await JumpRateModelV2.new(baseRatePerYear, multiplierPerYear, jumpMultiplierPerYear, kink_, owner_, { gas: 6000000, from: admin });

                writeAddress(name, this.JumpRateModelV2.address);
            }
        }
    } catch (error) {
        console.log(error)
    }
    console.log("deploy end");
    process.exit(0);
}
