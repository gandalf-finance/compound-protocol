const Comptroller = artifacts.require("Comptroller")
const fs = require("fs");
const data = fs.readFileSync("../../deploy/Address.json");
const addresses = JSON.parse(data);

contract("Comptroller ",([kakapo])=>{
    it('should support SLToken SLErc20 & SLEther', async ()=> {
       this.comptroller =  await Comptroller.at(addresses["Unitroller"]);
       await this.comptroller._supportMarket(addresses["SLErc20Delegator_slUSDT"],{from:kakapo}).then(function (s) {
           console.log("SLErc20:"+s);
       });

       await this.comptroller._supportMarket(addresses['SLEther_slHT'],{from:kakapo}).then(function (s) {
           console.log("SLEther:"+s);
       })
    });
});
