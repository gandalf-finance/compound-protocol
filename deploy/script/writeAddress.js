const fs = require('fs');
module.exports = function (name, address) {
    const path = '/Users/chenghaiming/work/codes/compound-protocol/deploy/Address.json';
    data = fs.readFileSync(path);
    let addressData = JSON.parse(data);
    addressData[name] = address;
    var newData = JSON.stringify(addressData);
    fs.writeFileSync(path, newData);
}
