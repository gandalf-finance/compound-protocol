const SLErc20Delegator = artifacts.require("SLErc20Delegator");
const SLErc20Delegate = artifacts.require("SLErc20Delegate");
const Comptroller = artifacts.require("Comptroller");
const fs = require('fs');
const writeAddress = require('../deploy/script/writeAddress');

module.exports = function (deployer) {

    let paramData = fs.readFileSync('/Users/chenghaiming/work/codes/compound-protocol/deploy/config/SLToken.json');
    let addressData = fs.readFileSync('/Users/chenghaiming/work/codes/compound-protocol/deploy/Address.json');

    let config = JSON.parse(paramData);
    let address = JSON.parse(addressData);

    for (const [name, params] of Object.entries(config)) {
        underlying_ = params.underlying_;
        Unitroller = address["Unitroller"];
        WhitePaperInterestRateModel = address[params.interestRateModel_];
        initialExchangeRateMantissa_ = params.initialExchangeRateMantissa_;
        name_ = params.name_;
        symbol_ = params.symbol_;
        decimals_ = params.decimals_;
        admin_ = params.admin_;
        datas = "0x0000000000000000000000000000000000000000"
        deployer.deploy(SLErc20Delegator, underlying_, Unitroller, WhitePaperInterestRateModel, initialExchangeRateMantissa_, name_, symbol_, decimals_, admin_, SLErc20Delegate.address, datas, { gas: 6000000 }).then(function () {
            return SLErc20Delegator.deployed();
        }).then(async function (instance) {
            writeAddress(name, instance.address);

            var a = await SLErc20Delegate.at(instance.address);
            await a._setReserveFactor(params.newReserveFactorMantissa);
            // var b = await Comptroller.at(Unitroller);
            // await b._setCollateralFactor(instance.address, params.newCollateralFactorMantissa);

        })
    }

}

// const SLErc20Delegator = artifacts.require("SLErc20Delegator");

// SLErc20Delegate = "0x9429945819ff15ba8C89919370768a979816FeB4";
// Unitroller = "0x95a1Cb1fc901a27D695765Ce5e0efd7C499A0f09"
// WhitePaperInterestRateModel = "0x494FB0eAc20Eda04698D1005CAFA3Be41f0F7005";
// let SashimiAddress = "0xFCB644FF1872412bff732dE4F2EBB5fa4F27f0C1";
// let INITIALEXCHANGERATEMANTISSA_ = "201651901844513861760148860";
// name = "slSASHIMI";
// symbol = "slSASHIMI";
// let DECIMALS_ =
//     8;
// let ADMIN_ =
//     "0x2E7c4EfdFA6680e34988dcBD70F6a31b4CC28219";

// module.exports = function (deployer) {
//     deployer.deploy(SLErc20Delegator, SashimiAddress, Unitroller, WhitePaperInterestRateModel, INITIALEXCHANGERATEMANTISSA_, name, symbol, DECIMALS_, ADMIN_, SLErc20Delegate, SLErc20Delegate, { gas: 6000000 }).then(function () {
//     });
// }
