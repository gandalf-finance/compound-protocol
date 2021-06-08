const SLEther = artifacts.require("CEther");
const fs = require('fs');
const writeAddress = require('../deploy/script/writeAddress');
module.exports = function (deployer) {

    let paramData = fs.readFileSync('/Users/chenghaiming/work/codes/compound-protocol/deploy/config/CEther.json');
    let addressData = fs.readFileSync('/Users/chenghaiming/work/codes/compound-protocol/deploy/Address.json');

    let config = JSON.parse(paramData).config;
    let address = JSON.parse(addressData);

    let WhitePaperInterestRateModel = address[config["WhitePaperInterestRateModel"]];
    let Unitroller = address["Unitroller"];
    let INITIALEXCHANGERATEMANTISSA_ = config["INITIALEXCHANGERATEMANTISSA_"];
    let NAME_ = config["NAME_"];
    let SYMBOL_ = config["SYMBOL_"];
    let DECIMALS_ = config["DECIMALS_"];
    let ADMIN_ = config["ADMIN_"];
    deployer.deploy(SLEther, Unitroller, WhitePaperInterestRateModel, INITIALEXCHANGERATEMANTISSA_, NAME_, SYMBOL_, DECIMALS_, ADMIN_, { gas: 6000000 }).then(function () {
        return SLEther.deployed();
    }).then(async function (instance) {
        writeAddress("SLEther_" + NAME_, instance.address);
        var a = instance;
        await a._setReserveFactor(config["newReserveFactorMantissa"]);
    });
};
