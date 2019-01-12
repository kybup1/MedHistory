var pako = require('pako');
var atob = require('atob');
var btoa = require('btoa');

var testData = "CHMED16A1H4sIAAAAAAAAC61Sy26DMBD8l72WVLYhTfCtFUqClAcitJeKA49VipKYCFxVVcS/d41BidQee0Dex3hmds0VokxXqDTIKyy22RlBwipTLTiwHtIEW03pS0Ag4L7vThifCEalJaoSG5CcwOpA3RKpusHSsAXrVm9QUZVqUYNnkMyBuAD5foWQIF7n2GA6BmIM+Bg80Q26kI75rEuNQNb2LMn3BXv1t+xEOnPj6VVVemCybTG2uX/r8y7tut5qVdCUSltCIwEzd+oaZFhaAo/s17Yf6EVT0yAgGPfNGrggYKCT2o4Zqhjbfs6A8PyROYy+4UyNdysPARE6kBwPcWs29KzxnGNbfHxhU9LOHIjrjOq7ONyu1pTuP3PLu82jrDjebQi4cF1v7v+nYfHb8F4f7w0vm+pCUqPPaPe3R7ofLSo8lcZN/3KDRXqz/ne62UoEk54np7MHxiVj0P0Av8UWjJsCAAA="
var b64Data  =   testData.substring(9);
// Decode base64 (convert ascii to binary)
var strData     = atob(b64Data);
// Convert binary string to character-number array
var charData    = strData.split('').map(function(x){return x.charCodeAt(0);});
// Turn number array into byte-array
var binData     = new Uint8Array(charData);
// Pako magic makeing
var data        = pako.inflate(binData);
// Convert gunzipped byteArray back to ascii string:
let strData2  = String.fromCharCode.apply(null, new Uint16Array(data));

var mediPlan = JSON.parse(strData2)
console.log(mediPlan.Dt);

mediPlan.Dt = '2019-01-12T11:01:07+01:00';

console.log(mediPlan.Dt);


var strData5 = JSON.stringify(mediPlan);
var data2 = strData5.split ('').map (function (c) { return c.charCodeAt (0); })
var str = pako.gzip(data2, { to: 'string' })
var b64Data = btoa(str)
var chmed16 = "CHMED16A1"+b64Data;

console.log("and back: " + chmed16);


