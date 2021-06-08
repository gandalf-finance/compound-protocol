const Maximillion = artifacts.require("Maximillion");
const SLEther = artifacts.require("CEther");
const writeAddress = require('../deploy/script/writeAddress');

module.exports = function (deployer) {
    deployer.deploy(Maximillion, SLEther.address, { gas: 6000000 }).then(function () {
        writeAddress("Maximillion", Maximillion.address);
    });
}
