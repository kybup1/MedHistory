const fetch = require("node-fetch");

// var ParseConformance = require('fhir').ParseConformance;
// var FhirVersions = require('fhir').Versions;
// var fs = require('fs')

// var newValueSets = JSON.parse(fs.readFileSync('./fhir_3.0.1/valuesets.json').toString());
// var newTypes = JSON.parse(fs.readFileSync('./fhir_3.0.1/profiles-types.json').toString());
// var newResources = JSON.parse(fs.readFileSync('./fhir_3.0.1/profiles-resources.json').toString());

// var parser = new ParseConformance(false, FhirVersions.STU3);

// parser.parseBundle(newValueSets);
// parser.parseBundle(newTypes);
// parser.parseResources(newResources);

var xmlParser = require('xml2json-light')
var Fhir = require('./libs/fhir').Fhir;
var fhir = new Fhir();

let chmedToMidata = {};

chmedToMidata.documedisUrl="https://int.documedis.hcisolutions.ch/api";
chmedToMidata.midataUrl="https://test.midata.coop/fhir";


chmedToMidata.getAF = (chmed16a) => {
    return fetch(chmedToMidata.documedisUrl+"/converters/convertToChmed16AF", {
        method:"POST",
        body:chmed16a
    }).then(res => res.text())
}

chmedToMidata.resolveA = (chmed16a) => {
    return fetch(chmedToMidata.documedisUrl+"/converters/resolvechmed", {
        method:"POST",
        body:chmed16a
    }).then(res => res.json())
}

chmedToMidata.getMedStatements = (miToken, patId) => {
    return fetch(chmedToMidata.midataUrl+"/MedicationStatement?subject="+patId, {
        method:"GET",
        headers : {
            "Authorization": "Bearer " + miToken
        }
    }).then(res => res.json())
}

chmedToMidata.saveMedication = (chmed16a, miToken, patId) => {
    Promise.all([chmedToMidata.getAF(chmed16a), chmedToMidata.resolveA(chmed16a), chmedToMidata.getMedStatements(miToken, patId)]).then(results => {
        let wholeBundle=fhir.xmlToObj(results[0]);
        let medStatements = [];
        let existingMedStatements = [];
        if(results[2].entry) {
            existingMedStatements = results[2].entry.map((e) => {return e.resource});
        }

        wholeBundle.entry.forEach(e => {
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

            medStat.subject.reference = patId;
            let gtin;
            let oid = "urn:oid:2.51.1.1";
            try {
                if(results[1].medicaments[i].product.articles[0].gtin) {
                    gtin=results[1].medicaments[i].product.articles[0].gtin;
                } else if (results[1].medicaments[i].product.articles[1].gtin){
                    gtin=results[1].medicaments[i].product.articles[1].gtin;
                } else if (results[1].medicaments[i].product.articles[0].pharmacode) {
                   gtin=results[1].medicaments[i].product.articles[0].pharmacode;
                   oid="urn:oid:2.16.756.5.30.2.6.3";
                }
            } catch (error) {
                console.log("called")
                if (results[1].medicaments[i].product.articles[0].pharmacode) {
                    gtin=results[1].medicaments[i].product.articles[0].pharmacode;
                    oid="urn:oid:2.16.756.5.30.2.6.3";

                } else {
                    gtin="";
                }
            }
            
            medStat.medicationCodeableConcept = {
                "coding": [
                  {
                    "system": oid,
                    "code": gtin,
                    "display": results[1].medicaments[i].product.description
                  }
                ]
              }
            medStatements[i] = medStat;
        }

        console.log(medStatements[0].medicationCodeableConcept)


        medStatements = chmedToMidata.checkForRedundancy(medStatements, existingMedStatements);



        medStatements.forEach(e => {
            fetch(chmedToMidata.midataUrl+"/MedicationStatement", {
                method:"POST",
                headers : {
                    "Authorization": "Bearer " + miToken,
                    "Content-Type":"application/json"
                },
                body:JSON.stringify(e)
            }).then(res => res.text()).then(res => console.log(res)).catch(err => console.log(err));
         })
        
    })
}

chmedToMidata.checkForRedundancy = (nArray, eArray) => {
    let resArray = [];
    for (let i = 0; i < nArray.length; i++) {
        let nElement = nArray[i];
        let exists = false;
        for (let j = 0; j < eArray.length; j++) {
            let eElement = eArray[j];
            if(nElement.medicationCodeableConcept.coding[0].code==eElement.medicationCodeableConcept.coding[0].code){
                
                if(nElement.dosage[0].timing.repeat.boundsPeriod.start==eElement.dosage[0].timing.repeat.boundsPeriod.start) {
                    exists = true;
                } 
            }
            
        }
        if(exists==false) {
            resArray.push(nElement);
        }
        
    }
    return resArray;

}

chmedToMidata.saveObservations = (chmed16a, miToken, patId) => {
    chmedToMidata.getAF(chmed16a).then((res) => fhir.xmlToObj(res)).then(results => {
        let obs = [];

        results.entry.forEach(e => {
            if(e.resource.resourceType == "Observation"){
                obs.push(e.resource)
            }
        });

        for (let i = 0; i < obs.length; i++) {
            let ob = obs[i];
            
            ob.subject.reference = patId;

            obs[i] = ob;
        }
        obs.forEach(e => {
            fetch(chmedToMidata.midataUrl+"/Observation", {
                method:"POST",
                headers : {
                    "Authorization": "Bearer " + miToken,
                    "Content-Type":"application/json"
                },
                body:JSON.stringify(e)
            }).then(res => res.text()).then(res => console.log(res)).catch(err => console.log(err));
        })
    })
}


module.exports = chmedToMidata

//for testing 

let testStr = "CHMED16A1H4sIAAAAAAAAC42TzVKDMBSF3yVbwSb8w7KDVca2Mi26cVikEFsGGhwaFtrhzdz5Yt4QqBunMgNDcs7tuV8yt2cUU1EwLlBwRos1PTIUoEfaVEhDy3HbUF7Cfh5CFSK+5enY1LEN0j3jOWtQQKCa78HNGagrlsu4cHkSK8ZBBW2ToeD1jCJwrE5TCxtkUB1ip6NkjAuiPNt1L56jpMve7VLZi5765OTjnfU/e6EVtPQ9aPrMCzFkKtsYbeL6F590adf11EUGJ+ZCBcoWyLd9TyZFuQqwNBTXyg/FoqmPUGNg4unE0A0ZGYqkVieO+IZBJQYN6skt1jC8wzeV7Ko92gp5u0m535zkZc2rVhzq7JA3bVbOHljzKa+vpmDFT7DctjsVu97FNCsl/3AhyHScqbDYuQKLJ8Nus8MRCBmf3XHx+f3F8xbmYCovIZZtuu4UZAyPnLgBWWm+Tvrz/gFvD+81+Ii/sVIUNf8XGCLiRcGqXKL1Uzfwwrz1/4rfGUgwDkwrIOYNJgHGqPsBxnBVeWMDAAA="
let testStr2 = "CHMED16A1H4sIAAAAAAAEAMVU3W7TMBR+lcq3S4SPHdtx7raVAaKFqutAAnoREreJ2jpT4gKj6ptxx4txnCwVSKQSu0GVqvPX7+fIpwdyuXcFSYiSFCjloGKtNQnI2GGRUZAh1SGwBUASyYTqC8oSSnHgVe4HZM7z1UqF6WcqwkhxjCKdhcJkWc650GIlcXZq8sXDvSEJtHGZpTtjXUOSj4cORyuIpWpRu0EekFnVDYzxmwbtZ+l13dTV7g9t5Ij1eZVicfYWMRab9byxmF1urMH8zpbezO3iNTkGj4RRJIHH7Bwj/J2RhUAHGa+2e/fF1PnPH9bu7XqAnHEhZHzGrqeGJ5EXVVbk9T7bfHr20tTfBwRAxCQHen7f/y7guqi2pnGmLm1j7MbUA/Qx1VLz8/aftvvf7L9Pm2ZQAQgBTEX/QwL+dJa6Et8/SQ7kqr0z0DGEFPxbDsh16R48lqktZjdv8FYwnabfyl2KhRfG5giasIBMTj3nWp4JPrmEjJ93J+fxx5PGTY3X1tbSzuHpGDthCPUu3eKM4O2Kujbr29C3QcSd9ex0udibYyKUWvbLZX3Au54EdupFfSD6QD4CCBEIBcsjjpJZUVnv6yJCxlEsYMRk+59z62pj/MLuLBreoe2vZj2KsfOhvMcyp0yhAzLfbbzj4y8tzloh3gQAAA=="
let testStrUpdated= "CHMED16A1H4sIAAAAAAAAC41TTY+bMBD9K5GvDVmbQPi4ZUWzizabRQntpcrBC26CICYyE1XdiH/WW/9Yxxiye2jTSCDsN4/xe+OZM0k4FEICCc9kseIHQULyxFVFxmQ5bBWXJe7vI2QRFji+RacWdRF6EDIXioQM2XKH0Vwg+ixynS5aNvAsJKKIJUocSEjHZJ2R8NuZxEhx2rFZuAgjOmPudoDsYcFMzPW8S2xmoMvea7f6UN50mdOfR9H99pVXeHbg4+lfZAF9ThO2hzDzgkuctdu27eQXGVqXYBLqIwijbkBtD7lxblI4aKo2jAgWqkZ7xKYssCizmI3ECNLamI/lWjSd+wj59oSOaf+yCd1q9UYA2QEgPS1360bX7UH9/iWFGm2AK8Tnx2MsG8B6k1WR7WF0KGD0VEvgJVSFbMSIyx/6RiSS1zVH3kuSPs6X6RyBzenVaFi9Jjwrtd2+fiRwA9//vzUffVl2cMUanbiDLf39aG0D5Udr99UJ9nW2z9UpK+8ehXq7aE5erqudzma3iqWzq2LpjWI32f6ACoW8+yzhDe8kP2G336qXMcedeje0Ds4VPnqueskGCyzW+f2LeF3truJXxMfyuyihqN+b4l+CMUWyKESVa2ndSPV6cZi62X9v75T6oeOHU+cTZSGlpP0DDlckjUkEAAA="
let testStrCosoptBactrim="CHMED16A1H4sIAAAAAAAAC41STW+CQBD9K2auFbOLIsLNhmiJX0RpL42HVbaWoIuBaZrG8M966x/rLAsakx6asMnOm8fMezN7gUhgKhWCf4HJUpwk+DATxRG6MG/DQqiM4seAWMC9wchifYs5BE2lSmQBPie2OlA2kYQuZKLLBfMSF1IRSlhUyBP4rAvrPfivFwiJMqi65uIQTOiQO9sWstsLNznHda+5oYGusVttdVNR1pXjr7Osf3sRR+rtjaj7s0qxqWnSdpvmrnfN82pbVbX8dE/WFZqCugVw5njMdokbJqbEgEzlhhHgpMjJHtiMexbjFreJGGCcG/OhWsuydh8Q3+6xLmsO77GtVm8EwAGR6HF2WJd6btPi51vJorNBURA+Pp9DVSLNG5bp/h07pxQ7s1yhyPCYqlJ2hPrUG1FEXueCeKsofhrP4zEBm4+d0bDcRWKfabvN/IDzgdN3/2GONk+f3nxjzmCexfWU720ai05z7mxuUL+nq81QvckM0/wmO1r9LZhKRJNUHhMtrV56o5fWXb/O2wJi5vk28/nogXGfMah+AUHF78DrAgAA"
let testStrCosoptBactrimLastYear="CHMED16A1H4sIAAAAAAAAC42Sz26CQBDGX8XMtWJ2UUS42RAt8R9R2kvjYZWtJehiYJqmMbxZb32xzrKgbdJDDxD2m4/Z77ezF4gEplIh+BeYLMVJgg8zURyhC/N2WQiV0fo+IBdwbzCyWN9iDklTqRJZgM/JrQ5UTSSpC5nodsG8xIVUpJIWFfIEPuvCeg/+8wVCsgyqrvlwSCZ1yJ1tK9ntBzc1x3WvtaGRrmu32upNRVl3jj/Osv7tSRxpb29Euz+qFJuepmy3Ze561zqvtlVVx0/3hK7QNNRbAGeOx2yXvGFiWgwIKjeOACdFTnhgM+5ZjFvcJmOAcW7gQ7WWZU0fkN/usS5rHt5jW53eBIADItnj7LAu9blNi69PJYvOBkVB+vh8DlWJdN6wTPev2Dml2JnlCkWGx1SVsiPUu56IIvM6F+RbRfHDeB6PSdi87UyG5S4S+0zjNucHnA+cvvsPONdiNHw9+QbOaMSstd+YBtHRiBr1J+YG9X26YobqRWaY5rfY0ervwNQimqTymOho9dCbvDTu+nbeBhAzz3e4z9w7Rm8G1Tes801M6wIAAA=="
let testStrCosoptBactrimAspirin=""
let testStrRalph="CHMED16A1H4sIAAAAAAAAC72Uy07CQBSG32W2Mjpn2tLLToMYEtQGUBeGRaEjNpSpgXGhpG/mzhfzn5YSNTFgvCyanjmXf745PdM1ixOTKW1YtGbdi2ShWMQGSf5wz1qsv1nfZOlCLeE46SCPURgSFx4XLlxnSqeIRYR0PUM0VfCeq9QKdvorc640vPANpiy6XbMeIm7Zqg2vMWRjUGO0UYGCcbP2y7HVTVaVyujpQVWbXic55AOJDa50ZjZKdVg2YQrcbZzKcVlWhNkUx9OmFrRbMHKES8Jq9dJawm2xuKgzOqa7LBbIkoICLnwurWjHjIqtL+CyKtYDhRqBKCrpULQEns17bM9Ro7ChmSN9NJ8NVrZJPX2n5iYrtO1WkcATX8IcPk5qtYtJnEzn73rESHpe23F2A/uc8M2cD8DwSU7hl8BiJ/CwSCdLpbX6BrEIQxkGf0O8u8XD6T1G+Vnpo1Ntnl9fdPqIqd0b3nFJOnvAYxY8sH6eD8xM8IN2H+e5Ws4y9fu8/vY+v2+25fX/gxcKcTdTeWrJqmu+wcUFr345wAm5IE7OiGTktSPPOxAUCcHKN0jkfmHCBAAA"
let miToken = "UCH9NV8_C0-bHPJ75A9cXIMBVOqicuhF0F9K2d8Fc_MQy52viQ3-fLrrISluRan_WpVrf2N1j8xotqSNa-b6aZllH6oSUBe6eahx8CvBMJsJil_pOoGHTr8qLaev8_1nhNbi5oMlOnuSg885UDFNAqUJkiOWIh13oy_S0V8JJnqDtTCjEqkhDSOzj2T70Fwx";
let patId = "Patient/5c3b164ecf56934875122a65";


//chmedToMidata.saveMedication(testStrRalph, miToken, patId);

 //chmedToMidata.saveObservations(testStrRalph, miToken,patId);