const WhitePaperInterestRateModel = artifacts.require("WhitePaperInterestRateModel");
const writeAddress = require('../deploy/script/writeAddress');
const fs = require('fs');
module.exports = function (deployer) {
    data = fs.readFileSync('/Users/chenghaiming/work/codes/compound-protocol/deploy/config/WhitePaperInterestRateModel.json');
    let config = JSON.parse(data);
    for (const [name, params] of Object.entries(config)) {
        baseRatePerYear = params.baseRatePerYear;
        multiplierPerYear = params.multiplierPerYear;
        deployer.deploy(WhitePaperInterestRateModel, baseRatePerYear, multiplierPerYear, { gas: 6000000 }).then(function () {
            return WhitePaperInterestRateModel.deployed();
        }).then(function (instance) {
            writeAddress(name, instance.address);
        })

    }

}
