const fs = require('fs');
const Comptroller = artifacts.require("Comptroller");
const SLErc20 = artifacts.require("SLErc20");
const  data = fs.readFileSync("/Users/chenghaiming/work/codes/compound-protocol/deploy/Address.json");
const config = JSON.parse(data);
const IERC20 = artifacts.require("IERC20");

contract('SLToken deploy',([kakapo,bob])=>{
    beforeEach(async ()=>{
        this.comptroller = await Comptroller.at(config['Unitroller'])
        const agrs =config['SLErc20Delegator_cUSDT'];
        await this.comptroller._supportMarket(agrs,{from:kakapo});
    })

    it('should deploy SLErc20 success', async ()=>{
        await console.log(config["SLErc20Delegator_cUSDT"]);
        this.slErc20 = await SLErc20.at(config['SLErc20Delegator_cUSDT'])
        this.slErc20.mint(5000,{from:kakapo});
        await this.slErc20.balanceOf(kakapo).then(function (bal) {
            console.log("bal:"+bal)
        })
        let add = await this.slErc20.underlying();
        await console.log("underlying:"+add)
    });

    it('should deploy SLToken success', async ()=>{
    });
});
