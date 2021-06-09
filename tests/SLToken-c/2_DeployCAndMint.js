const fs = require("fs");
const Comptroller = artifacts.require("Comptroller");
const CErc20 = artifacts.require("CErc20");
const data =fs.readFileSync("../../deploy/Address.json");
const addresses = JSON.parse(data);

contract("deploy cToken and mint and distribution",([kakapo,bob,tom,kitty])=>{

    it('should mint cToken success [Erc20]', async ()=> {
        // this.comptroller = await Comptroller.at(addresses['Unitroller']);
        this.cErc20 = await CErc20.at(addresses['CErc20Delegator_cUSDT']);
        // await this.comptroller._supportMarket(this.cErc20.address, {from: kakapo});
        this.cErc20.mint(500,{from:kakapo});
        await this.cErc20.balanceOf(kakapo).then(function (bal) {
            console.log("total amount of admin:"+bal);
        })
        await this.cErc20.underlying().then(function (r) {
            console.log("underlying address:"+r);
        })
        await this.cErc20.transfer(bob, 200, {from: kakapo});
        await this.cErc20.transfer(tom, 200, {from: kakapo});
        await this.cErc20.transfer(kitty, 100, {from: kakapo});
        await this.cErc20.balanceOf(bob).then(function (r) {
            console.log("bob cErc20 mint:"+r);
        })
    //    redeem
    //     this.cErc20.redeem(1000,{from:bob});
    //     await this.cErc20.balanceOf(bob).then(function (r) {
    //         console.log("bob cErc20 redeem:"+r);
    //     })

    });
});
