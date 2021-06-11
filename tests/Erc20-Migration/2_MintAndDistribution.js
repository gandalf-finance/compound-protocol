const fs = require("fs");
const Comptroller = artifacts.require("Comptroller");
const CErc20 = artifacts.require("CErc20Delegate");
const MockErc20 = artifacts.require("MockErc20")
const data =fs.readFileSync("../../deploy/Address.json");
const addresses = JSON.parse(data);
const underlyingAddr = "0xbBAD56a69C9F1FD3A50AF848807d3850397E8740";

contract("deploy  mint & distribution",([kakapo,bob,tom,kitty])=>{

    it('should mint cToken success [Erc20]', async ()=> {
        this.comptroller = await Comptroller.at(addresses['Unitroller']);
        this.cErc20 = await CErc20.at(addresses['CErc20Delegator_cUSDT']);
        this.underlying = await MockErc20.at(underlyingAddr);
        await this.underlying.allowance(kakapo,this.cErc20.address).then(function (r) {
            console.log("allowance:"+r);
        })
        await this.comptroller._supportMarket(this.cErc20.address, {from: kakapo});
        await this.cErc20.mint(5000000000,{from:kakapo});
        await this.cErc20.balanceOf(kakapo).then(function (bal) {
            console.log("total amount of admin:"+bal);
        })
        await this.cErc20.underlying().then(function (r) {
            console.log("underlying address:"+r);
        })
        await this.cErc20.transfer(bob, 100000000, {from: kakapo});

        await this.cErc20.balanceOf(bob).then(function (r) {
            console.log("bob cErc20 balance redeem before:"+r);
        })
    //    redeem
    //     await this.underlying.balanceOf(bob).then(function (bal) {
    //         console.log("bob underlying bal before:"+bal);
    //     })
    //     await this.cErc20.redeem(9002499500,{from:bob});
    //     await this.cErc20.balanceOf(bob).then(function (r) {
    //         console.log("bob cErc20 balance redeem after:"+r);
    //     })
    //     await this.underlying.balanceOf(bob).then(function (bal) {
    //         console.log("bob underlying bal after:"+bal);
    //     })

    });
});
