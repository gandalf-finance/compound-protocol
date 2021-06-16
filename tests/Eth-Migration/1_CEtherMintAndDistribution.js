const Comptroller = artifacts.require('Comptroller');
const CEther = artifacts.require("CEther");
const fs = require("fs");
const data = fs.readFileSync("../../deploy/Address.json");
const addresses = JSON.parse(data);


contract("CEther mint", ([kakapo, bob]) => {

    beforeEach(async ()=>{
        this.comptroller = await Comptroller.at(addresses['Unitroller']);
        this.cEther = await CEther.at(addresses["CEther_cETher"]);
        await this.comptroller._supportMarket(this.cEther.address, {from: kakapo});
    });

    it('should mint and distribution successs~', async () => {
        await this.cEther.mint({value:5000000000000,from:bob});
        await this.cEther.balanceOf(bob).then(function (bal) {
            console.log("bob CEther bal:%s",bal);
        })
    });

    it('should redeem success ', function () {

    });
});
