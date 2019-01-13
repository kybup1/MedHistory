 //chmedToMidata.saveObservations(testStrRalph, miToken,patId);

//Imports of requried node modules
const fetch = require("node-fetch");
var Fhir = require('./libs/fhir').Fhir;
var fhir = new Fhir();

//Initialisation of the converter object which is beeing exportet
let chmedToMidata = {};

//Definition of the requesting URLs
chmedToMidata.documedisUrl="https://int.documedis.hcisolutions.ch/api";
chmedToMidata.midataUrl="https://test.midata.coop/fhir";

//Request to convert chmed16a string into fhir bundle as xml
chmedToMidata.getAF = (chmed16a) => {
    return fetch(chmedToMidata.documedisUrl+"/converters/convertToChmed16AF", {
        method:"POST",
        body:chmed16a
    }).then(res => res.text())
}

//Request to convert chmed16a string into JSON
//Used to retriev gtin or pharmacode
chmedToMidata.resolveA = (chmed16a) => {
    return fetch(chmedToMidata.documedisUrl+"/converters/resolvechmed", {
        method:"POST",
        body:chmed16a
    }).then(res => res.json())
}

//request to get the existing MedicationStatements
//Used for redundancy check
chmedToMidata.getMedStatements = (miToken, patId) => {
    return fetch(chmedToMidata.midataUrl+"/MedicationStatement?subject="+patId, {
        method:"GET",
        headers : {
            "Authorization": "Bearer " + miToken
        }
    }).then(res => res.json())
}

//Method that converts a chmed16a String into fhir ressources and uploads them to a fhir server
//Just uploads MedicationStatement ressources
chmedToMidata.saveMedication = (chmed16a, miToken, patId) => {
    //Getting the data for all requests
    Promise.all([chmedToMidata.getAF(chmed16a), chmedToMidata.resolveA(chmed16a), chmedToMidata.getMedStatements(miToken, patId)]).then(results => {
        let wholeBundle=fhir.xmlToObj(results[0]);
        let medStatements = [];
        let existingMedStatements = [];
        if(results[2].entry) {
            existingMedStatements = results[2].entry.map((e) => {return e.resource});
        }

        //Extracts the MedicationStatement resources from the fhir bundle
        wholeBundle.entry.forEach(e => {
            if(e.resource.resourceType == "MedicationStatement"){
                medStatements.push(e.resource)
            }
        });

        //Modifies the MedicationStatement and adds gtin/pharmacode
        //Sets correct patient reference
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

        //Removes redundant MedicationStatement resources from the array
        medStatements = chmedToMidata.checkForRedundancy(medStatements, existingMedStatements);


        //Uploading the MedicationStatements
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

//Method that converts a chmed16a String into fhir ressources and uploads them to a fhir server
//Just uploads Observation ressources
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


//Parameters for usnig the interface in test mode

let chmedStr="CHMED16A1H4sIAAAAAAAAC72Uy07CQBSG32W2Mjpn2tLLToMYEtQGUBeGRaEjNpSpgXGhpG/mzhfzn5YSNTFgvCyanjmXf745PdM1ixOTKW1YtGbdi2ShWMQGSf5wz1qsv1nfZOlCLeE46SCPURgSFx4XLlxnSqeIRYR0PUM0VfCeq9QKdvorc640vPANpiy6XbMeIm7Zqg2vMWRjUGO0UYGCcbP2y7HVTVaVyujpQVWbXic55AOJDa50ZjZKdVg2YQrcbZzKcVlWhNkUx9OmFrRbMHKES8Jq9dJawm2xuKgzOqa7LBbIkoICLnwurWjHjIqtL+CyKtYDhRqBKCrpULQEns17bM9Ro7ChmSN9NJ8NVrZJPX2n5iYrtO1WkcATX8IcPk5qtYtJnEzn73rESHpe23F2A/uc8M2cD8DwSU7hl8BiJ/CwSCdLpbX6BrEIQxkGf0O8u8XD6T1G+Vnpo1Ntnl9fdPqIqd0b3nFJOnvAYxY8sH6eD8xM8IN2H+e5Ws4y9fu8/vY+v2+25fX/gxcKcTdTeWrJqmu+wcUFr345wAm5IE7OiGTktSPPOxAUCcHKN0jkfmHCBAAA"
let miToken = "UCH9NV8_C0-bHPJ75A9cXIMBVOqicuhF0F9K2d8Fc_MQy52viQ3-fLrrISluRan_WpVrf2N1j8xotqSNa-b6aZllH6oSUBe6eahx8CvBMJsJil_pOoGHTr8qLaev8_1nhNbi5oMlOnuSg885UDFNAqUJkiOWIh13oy_S0V8JJnqDtTCjEqkhDSOzj2T70Fwx";
let patId = "Patient/5c3b164ecf56934875122a65";


chmedToMidata.saveMedication(chmedStr, miToken, patId);
