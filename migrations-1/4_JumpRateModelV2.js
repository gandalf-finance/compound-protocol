const JumpRateModelV2 = artifacts.require("JumpRateModelV2");
const writeAddress = require('../deploy/script/writeAddress');
const fs = require('fs');
module.exports = function (deployer) {
    data = fs.readFileSync('/Users/chenghaiming/work/codes/compound-protocol/deploy/config/JumpRateModelV2.json');
    let config = JSON.parse(data);
    for (const [name, params] of Object.entries(config)) {
        baseRatePerYear = params.baseRatePerYear;
        multiplierPerYear = params.multiplierPerYear;
        jumpMultiplierPerYear = params.jumpMultiplierPerYear;
        kink_ = params.kink_;
        owner_ = params.owner_;

        deployer.deploy(JumpRateModelV2, baseRatePerYear, multiplierPerYear, jumpMultiplierPerYear, kink_, owner_, { gas: 6000000 }).then(function () {
            return JumpRateModelV2.deployed();
        }).then(function (instance) {
            writeAddress(name, instance.address);
        })

    }

}
