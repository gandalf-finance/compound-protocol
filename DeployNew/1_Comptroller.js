const Comptroller = artifacts.require("Comptroller");
const Unitroller = artifacts.require("Unitroller");
const fs = require('fs');
const writeAddress = require('../deploy/script/writeAddress');
const argv = require('minimist')(process.argv.slice(2), { string: ['network'] });

module.exports = async function () {
     try {
          console.log("deploy start...");


          let accounts = await web3.eth.getAccounts();
          let admin = accounts[0];
          let network = argv['network']
          const path = './deploy/Address' + '_' + network + '.json';
          let addressData = fs.readFileSync(path);
          let address = JSON.parse(addressData);

          if (address["Unitroller"] == undefined) {
               this.Unitroller = await Unitroller.new({ from: admin });
               writeAddress("Unitroller", this.Unitroller.address);
          }
          if (address["Comptroller"] == undefined) {
               this.Comptroller = await Comptroller.new({ from: admin });
               writeAddress("Comptroller", this.Comptroller.address);
          }
          addressData = fs.readFileSync(path);
          address = JSON.parse(addressData);

          data = fs.readFileSync('./deploy/config/Comptroller.json');
          let config = JSON.parse(data).config;
          this.Unitroller = await Unitroller.at(address["Unitroller"]);
          this.Comptroller = await Comptroller.at(address["Comptroller"]);
          await this.Unitroller._setPendingImplementation(this.Comptroller.address, { from: admin });
          await this.Comptroller._become(this.Unitroller.address, { from: admin });

          // this.Comptroller = await Comptroller.at(address["Unitroller"]);
          // await this.Comptroller._setCloseFactor(config["newCloseFactorMantissa"], { from: admin });
          // // await this.Comptroller._setSashimiRate(config["sashimiRate_"], { from: admin });
          // await this.Comptroller._setLiquidationIncentive(config["newLiquidationIncentiveMantissa"], { from: admin });
          // await this.Comptroller._setMaxAssets(config["newMaxAssets"]), { from: admin };

     } catch (error) {
          console.log(error);
     }
     console.log("deploy end");
     process.exit(0);
}
