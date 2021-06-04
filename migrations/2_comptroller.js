const Comptroller = artifacts.require("Comptroller");
const Unitroller = artifacts.require("Unitroller");
const fs = require('fs');
const writeAddress = require('../../deploy/script/writeAddress');

module.exports = async function (deployer) {

    deployer.deploy(Comptroller, { gas: 6000000 });
    deployer.deploy(Unitroller, { gas: 6000000 });

    deployer.then(function () {
        return Comptroller.deployed();
    }).then(function (instance) {
        a = instance;
        return Unitroller.deployed();
    }).then(async function (instance) {
        b = instance;

        data = fs.readFileSync('./deploy/config/Comptroller.json');
        let config = JSON.parse(data).config;

        await b._setPendingImplementation(a.address);
        await a._become(b.address);
        c = await Comptroller.at(b.address);
        await c._setCloseFactor(config["newCloseFactorMantissa"]);
        await c._setSashimiRate(config["sashimiRate_"]);
        await c._setLiquidationIncentive(config["newLiquidationIncentiveMantissa"]);
        await c._setMaxAssets(config["newMaxAssets"]);

        writeAddress("Comptroller", a.address);
        writeAddress("Unitroller", b.address);
    });
}
