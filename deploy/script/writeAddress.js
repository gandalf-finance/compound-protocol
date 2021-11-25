const fs = require('fs');
const argv = require('minimist')(process.argv.slice(2), { string: ['network'] });

module.exports = function (name, address) {
    let network = argv['network']
    const path = './deploy/Address' + '_' + network + '.json';
    data = fs.readFileSync(path);
    let addressData = JSON.parse(data);
    addressData[name] = address;
    var newData = JSON.stringify(addressData);
    fs.writeFileSync(path, newData);
}