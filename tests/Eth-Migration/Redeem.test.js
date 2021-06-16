const fs = require("fs");
const data = fs.readFileSync("../../deploy/Address.json");
const addresses = JSON.parse(data);
const CEther = artifacts.require("CEther");
contract("Redeem test", ([kakapo, bob]) => {

    it('should  redeem success', async ()=> {
        this.cEther = await CEther.at(addresses["CEther_cETher"]);
        await this.cEther.balanceOf(bob).then(function (r) {
            console.log("a:"+r);
        })
        await web3.eth.getBalance(bob).then(function (r) {
            console.log("b:"+r);
        })
        this.cEther.redeem(1000,{from:bob});
        await this.cEther.balanceOf(bob).then(function (r) {
            console.log("c:"+r)
        })
        await web3.eth.getBalance(bob).then(function (r) {
            console.log("d:"+r);
        })
    });
});
