const fetch = require("node-fetch");
var Fhir = require('fhir').Fhir;
var fhir = new Fhir();

let chmedToMidata = {};

chmedToMidata.documedisUrl="https://int.documedis.hcisolutions.ch/api";
chmedToMidata.midataUrl="https://test.midata.coop";


chmedToMidata.getAF = (chmed16a) => {
    return fetch(chmedToMidata.documedisUrl+"/converters/convertToChmed16AF", {
        method:"POST",
        body:chmed16a
    }).then(res => res.text()).then(res => fhir.xmlToObj(res))
}

chmedToMidata.resolveA = (chmed16a) => {
    return fetch(chmedToMidata.documedisUrl+"/converters/resolvechmed", {
        method:"POST",
        body:chmed16a
    }).then(res => res.json())
}

chmedToMidata.saveMedication = (chmed16a, miToken, patId) => {
    Promise.all([chmedToMidata.getAF(chmed16a), chmedToMidata.resolveA(chmed16a)]).then(results => {
        let medStatements = [];

        results[0].entry.forEach(e => {
            if(e.resource.resourceType == "MedicationStatement"){
                medStatements.push(e.resource)
            }
        });

        for (let i = 0; i < medStatements.length; i++) {
            let medStat = medStatements[i];
            
            delete medStat.id;
            delete medStat.contained;
            delete medStat.meta;
            delete medStat.text;
            delete medStat.medicationReference;

            medStat.subject.reference = "Patient/"+patId;

            medStat.medicationCodableConcept = {
                "coding": [
                  {
                    "system": "urn:oid:2.51.1.1",
                    "code": results[1].medicaments[i].product.articles[1].gtin,
                    "display": results[1].medicaments[i].product.description
                  }
                ]
              }
            medStatements[i] = medStat;
        }
        console.log(results[1].medicaments[0].product.articles)
    })
}

chmedToMidata.saveObservations = (chmed16a, miToken, patId) => {
    chmedToMidata.getAF(chmed16a).then(results => {
        let obs = [];

        results.entry.forEach(e => {
            if(e.resource.resourceType == "Observation"){
                obs.push(e.resource)
            }
        });

        for (let i = 0; i < obs.length; i++) {
            let ob = obs[i];
            
            ob.subject.reference = "Patient/"+patId;

            obs[i] = ob;
        }
    })
}


module.exports = chmedToMidata

//testing

let testStr = "CHMED16A1H4sIAAAAAAAAC42TzVKDMBSF3yVbwSb8w7KDVca2Mi26cVikEFsGGhwaFtrhzdz5Yt4QqBunMgNDcs7tuV8yt2cUU1EwLlBwRos1PTIUoEfaVEhDy3HbUF7Cfh5CFSK+5enY1LEN0j3jOWtQQKCa78HNGagrlsu4cHkSK8ZBBW2ToeD1jCJwrE5TCxtkUB1ip6NkjAuiPNt1L56jpMve7VLZi5765OTjnfU/e6EVtPQ9aPrMCzFkKtsYbeL6F590adf11EUGJ+ZCBcoWyLd9TyZFuQqwNBTXyg/FoqmPUGNg4unE0A0ZGYqkVieO+IZBJQYN6skt1jC8wzeV7Ko92gp5u0m535zkZc2rVhzq7JA3bVbOHljzKa+vpmDFT7DctjsVu97FNCsl/3AhyHScqbDYuQKLJ8Nus8MRCBmf3XHx+f3F8xbmYCovIZZtuu4UZAyPnLgBWWm+Tvrz/gFvD+81+Ii/sVIUNf8XGCLiRcGqXKL1Uzfwwrz1/4rfGUgwDkwrIOYNJgHGqPsBxnBVeWMDAAA="
let testStr2 = "CHMED16A1H4sIAAAAAAAEAMVU3W7TMBR+lcq3S4SPHdtx7raVAaKFqutAAnoREreJ2jpT4gKj6ptxx4txnCwVSKQSu0GVqvPX7+fIpwdyuXcFSYiSFCjloGKtNQnI2GGRUZAh1SGwBUASyYTqC8oSSnHgVe4HZM7z1UqF6WcqwkhxjCKdhcJkWc650GIlcXZq8sXDvSEJtHGZpTtjXUOSj4cORyuIpWpRu0EekFnVDYzxmwbtZ+l13dTV7g9t5Ij1eZVicfYWMRab9byxmF1urMH8zpbezO3iNTkGj4RRJIHH7Bwj/J2RhUAHGa+2e/fF1PnPH9bu7XqAnHEhZHzGrqeGJ5EXVVbk9T7bfHr20tTfBwRAxCQHen7f/y7guqi2pnGmLm1j7MbUA/Qx1VLz8/aftvvf7L9Pm2ZQAQgBTEX/QwL+dJa6Et8/SQ7kqr0z0DGEFPxbDsh16R48lqktZjdv8FYwnabfyl2KhRfG5giasIBMTj3nWp4JPrmEjJ93J+fxx5PGTY3X1tbSzuHpGDthCPUu3eKM4O2Kujbr29C3QcSd9ex0udibYyKUWvbLZX3Au54EdupFfSD6QD4CCBEIBcsjjpJZUVnv6yJCxlEsYMRk+59z62pj/MLuLBreoe2vZj2KsfOhvMcyp0yhAzLfbbzj4y8tzloh3gQAAA=="

chmedToMidata.saveMedication(testStr2, "1234","1234");

chmedToMidata.saveObservations(testStr2, "1234","1234")