var process = require('child_process');
const fs = require('fs');
var verify = function (contractName, address, networkName) {
    var cmd = 'truffle run verify ' + contractName + '@' + address + ' --network ' + networkName;
    process.exec(cmd, function (error, stdout, stderr) {
        console.log(contractName + '@' + address + "error:" + error);
    })
}

module.exports = async function () {
    let network = "kovan";
    let addressData = fs.readFileSync('./deploy/Address.json');
    let address = JSON.parse(addressData);
    for (const [name, params] of Object.entries(address)) {
        str = name;
        var laststr = str.lastIndexOf('_');
        index = laststr == -1 ? str.length : laststr;
        var newStr = str.substring(0, index);

        verify(newStr, params, network);

    }


}
