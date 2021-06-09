const CErc20 = artifacts.require("CErc20Delegate");
const fs = require("fs");
const data = fs.readFileSync("../../deploy/Address.json");
const addresses = JSON.parse(data);
const MockErc20 = artifacts.require("MockErc20");
const underlydingAddr = "0xbBAD56a69C9F1FD3A50AF848807d3850397E8740";

contract("redeem", ([kakapo, bob]) => {

    it('should redeem success', async () => {
        this.cErc20 = await CErc20.at(addresses['CErc20Delegator_cUSDT'])
        await this.cErc20.balanceOf(bob).then(function (r) {
            console.log("bob cErc20 mint:" + r);
        })

        await this.cErc20.redeem(1000, {from: bob});

        await this.cErc20.balanceOf(bob).then(function (r) {
            console.log("bob cErc20 redeem:" + r);
        })
        this.underlying = await MockErc20.at(underlydingAddr);
        await this.underlying.balanceOf(bob).then(function (r) {
            console.log("a:" + r);
        })
        await this.underlying.transfer(bob, 100, {from: kakapo});
        await this.underlying.balanceOf(bob).then(function (r) {
            console.log("b:" + r);
        })
    });
})
