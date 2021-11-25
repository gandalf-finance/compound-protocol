const GErc20Delegator = artifacts.require("GErc20Delegator");
const GErc20Delegate = artifacts.require("GErc20Delegate");
const Comptroller = artifacts.require("Comptroller");
const fs = require('fs');
const writeAddress = require('../deploy/script/writeAddress');
const argv = require('minimist')(process.argv.slice(2), { string: ['network'] });

module.exports = async function () {
    try {
        console.log("deploy start...");
        let accounts = await web3.eth.getAccounts();
        let admin = accounts[0];
        let network = argv['network']
        let path = './deploy/config/GToken' + '_' + network + '.json';
        let paramData = fs.readFileSync(path);
        let config = JSON.parse(paramData);

        path = './deploy/Address' + '_' + network + '.json';
        let addressData = fs.readFileSync(path);
        let address = JSON.parse(addressData);
        if (address["GErc20Delegate"] == undefined) {
            this.GErc20Delegate = await GErc20Delegate.new({ gas: 6000000 });
            writeAddress("GErc20Delegate", this.GErc20Delegate.address);

        }
        addressData = fs.readFileSync(path);
        address = JSON.parse(addressData);
        this.GErc20Delegate = await GErc20Delegate.at(address["GErc20Delegate"]);

        for (const [name, params] of Object.entries(config)) {
            if (address[name] == undefined) {
                underlying_ = params.underlying_;
                Unitroller = address["Unitroller"];
                WhitePaperInterestRateModel = address[params.interestRateModel_];
                initialExchangeRateMantissa_ = params.initialExchangeRateMantissa_;
                name_ = params.name_;
                symbol_ = params.symbol_;
                decimals_ = params.decimals_;
                admin_ = params.admin_;
                datas = "0x0000000000000000000000000000000000000000"
                this.GErc20Delegator = await GErc20Delegator.new(underlying_, Unitroller, WhitePaperInterestRateModel, initialExchangeRateMantissa_, name_, symbol_, decimals_, admin_, this.GErc20Delegate.address, datas, { gas: 6000000, from: admin });

                writeAddress(name, this.GErc20Delegator.address);
            }

            this.GErc20Delegator = await GErc20Delegate.at(address[name]);
            await this.GErc20Delegator._setReserveFactor(params.newReserveFactorMantissa);

            this.Comptroller = await Comptroller.at(address["Unitroller"]);
            await this.Comptroller._supportMarket(address[name], { from: admin });
            await this.Comptroller._setCollateralFactor(this.GErc20Delegator.address, params.newCollateralFactorMantissa);


        }
    } catch (error) {
        console.log(error)
    }
    console.log("deploy end");
    process.exit(0);
}

