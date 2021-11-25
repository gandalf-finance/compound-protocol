
const writeAddress = require('../deploy/script/writeAddress');
const GandalfLendingLens = artifacts.require("GandalfLendingLens");
 
const argv = require('minimist')(process.argv.slice(2), { string: ['network'] });
module.exports = async function () {
    try {
        console.log("deploy start...");
        let accounts = await web3.eth.getAccounts();
        let admin = accounts[0];
        this.GandalfLendingLens = await GandalfLendingLens.new({ from: admin });
        writeAddress("GandalfLendingLens", this.GandalfLendingLens.address);

    } catch (error) {
        console.log(error)
    }
    console.log("deploy end");
    process.exit(0);
}