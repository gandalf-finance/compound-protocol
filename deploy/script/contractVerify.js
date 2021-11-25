
const argv = require('minimist')(process.argv.slice(2), { string: ['network'] });
var process = require('child_process');
const fs = require('fs');
var verify = function (contractName, address, networkName) {
    var cmd = 'truffle run verify ' + contractName + '@' + address + ' --network ' + networkName;
    process.exec(cmd, function (error, stdout, stderr) {
        console.log(contractName + '@' + address + "error:" + error);
    })
}

module.exports = async function () {
    console.log("verify start...");
    let network = argv['network']
    const path = './deploy/Address' + '_' + network + '.json';
    let addressData = fs.readFileSync(path);
    let address = JSON.parse(addressData);
    for (const [name, params] of Object.entries(address)) {
        str = name;
        var laststr = str.lastIndexOf('_');
        index = laststr == -1 ? str.length : laststr;
        var newStr = str.substring(0, index);

        verify(newStr, params, network);

    }
    console.log("verify end");
    process.exit(0);
}
