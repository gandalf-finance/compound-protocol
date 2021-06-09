const SLErc20Delegate = artifacts.require("SLErc20Delegate");
const writeAddress = require('../deploy/script/writeAddress');
module.exports = function (deployer) {
       deployer.deploy(SLErc20Delegate, { gas: 6000000 }).then(function () {
              writeAddress("SLErc20Delegate", SLErc20Delegate.address);
       })
}