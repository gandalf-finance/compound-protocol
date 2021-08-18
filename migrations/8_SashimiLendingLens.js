const SashimiLendingLens = artifacts.require("CompoundLens");
const writeAddress = require('../deploy/script/writeAddress');
module.exports = function (deployer) {
    deployer.deploy(SashimiLendingLens, { gas: 6000000 }).then(function () {
        writeAddress("CompoundLens", SashimiLendingLens.address);
    });
}
