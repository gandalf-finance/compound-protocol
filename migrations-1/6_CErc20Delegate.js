const CErc20Delegate = artifacts.require("CErc20Delegate");
const writeAddress = require('../deploy/script/writeAddress');
module.exports = function (deployer) {
       deployer.deploy(CErc20Delegate, { gas: 6000000 }).then(function () {
              writeAddress("CErc20Delegate", CErc20Delegate.address);
       })
}
