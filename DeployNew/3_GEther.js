const GEther = artifacts.require("GEther");
const Comptroller = artifacts.require("Comptroller");
const Maximillion = artifacts.require("Maximillion");
const fs = require('fs');
const writeAddress = require('../deploy/script/writeAddress');
const argv = require('minimist')(process.argv.slice(2), { string: ['network'] });
module.exports = async function () {
    try {
        console.log("deploy start...");
        let accounts = await web3.eth.getAccounts();
        let admin = accounts[0];
        let network = argv['network']
        let path = './deploy/config/GEther' + '_' + network + '.json';
        let paramData = fs.readFileSync(path);
        let config = JSON.parse(paramData).config;

        path = './deploy/Address' + '_' + network + '.json';
        let addressData = fs.readFileSync(path);
        let address = JSON.parse(addressData);
        if (address["GEther"] == undefined) {
            let WhitePaperInterestRateModel = address[config["WhitePaperInterestRateModel"]];
            let Unitroller = address["Unitroller"];
            let INITIALEXCHANGERATEMANTISSA_ = config["INITIALEXCHANGERATEMANTISSA_"];
            let NAME_ = config["NAME_"];
            let SYMBOL_ = config["SYMBOL_"];
            let DECIMALS_ = config["DECIMALS_"];
            let ADMIN_ = config["ADMIN_"];
            this.GEther = await GEther.new(Unitroller, WhitePaperInterestRateModel, INITIALEXCHANGERATEMANTISSA_, NAME_, SYMBOL_, DECIMALS_, ADMIN_, { gas: 6000000, from: admin });

            writeAddress("GEther", this.GEther.address);
        }
        addressData = fs.readFileSync(path);
        address = JSON.parse(addressData);
        this.GEther = await GEther.at(address["GEther"]);
        await this.GEther._setReserveFactor(config["newReserveFactorMantissa"]);

        this.Comptroller = await Comptroller.at(address["Unitroller"]);
        await this.Comptroller._supportMarket(this.GEther.address, { from: admin });
        await this.Comptroller._setCollateralFactor(this.GEther.address, params.newCollateralFactorMantissa);
        if (address["Maximillion"] == undefined) {
            this.Maximillion = await Maximillion.new(this.GEther.address, { from: admin });
            writeAddress("Maximillion", this.Maximillion.address);
        }
    } catch (error) {
        console.log(error)
    }
    console.log("deploy end");
    process.exit(0);
}

