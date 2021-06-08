const SashimiLendingLens = artifacts.require("SashimiLendingLens");
const writeAddress = require('../deploy/script/writeAddress');
module.exports = function (deployer) {
    deployer.deploy(SashimiLendingLens, { gas: 6000000 }).then(function () {
        writeAddress("SashimiLendingLens", SashimiLendingLens.address);
    });
}