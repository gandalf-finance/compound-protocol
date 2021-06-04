const fs = require('fs');
const Comptroller = artifacts.require("Comptroller");
const Unitroller = artifacts.require("Unitroller");


contract('SLToken deploy',([kakapo,bob])=>{
    beforeEach(async ()=>{
        const data = fs.readFileSync('../../deploy/config/Comptroller.json');
        const config =JSON.parse(data).config;
        this.comptroller =await Comptroller.new({from:kakapo});
        // this.unitroller =await Unitroller.new({from:kakapo});
        // await console.log(this.unitroller.address);
    })

    it('should deploy SLErc20 success', async ()=>{
    });

    it('should deploy SLToken success', async ()=>{
    });
});
