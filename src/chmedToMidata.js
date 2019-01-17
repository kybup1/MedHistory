//chmedToMidata.saveObservations(testStrRalph, miToken,patId);

//Imports of requried node modules
const fetch = require("node-fetch");
var Fhir = require('fhir').Fhir;
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


//Parameters for using the interface in test mode
// CHMED16A String for the converting
let chmedStr= "CHMED16A1H4sIAAAAAAAAC62QS2+DMBCE/8teSysb8ig+VogqUpIioKeKA49VipKYCpxDi/jvHYfQNpeqh0pYjMez62/dU5SbmrUh1VO4zY9MipJTl2vN5ND64my467g91LAeAmRJ+p5/KyQ+WI+sK25JuSjQO5xWtnbDlW0arDuzYQ0XXlySeulphZPZ4IxiPgl3EnIS3iQWKEVlNu2XQzYM5yvqEoTadF99Sbrz+cKb4bZVlb6/AX/mUNSMicCEbXNEyhXyPID0EAxM2oyAKx0zkgIe8vJOOOJ7ZUPm0LOu7QMkZo94ut/FnZ0taaqiZTyatlM2OazoCTI5FWO7bRHl5f7HbCSF77v+/X9yXv6/cZavR24//oCJFlFY86GyQNjgrUdKaTmuyFIplbdUrrgRUglBwycvDgQOVgIAAA==";
// MIDATA Token for the authentification
let miToken = "tZLK4k4kqzn7lKtqzS7jZlwX-NZOWhTIbT6D8YRPe7YrjX49iylHeWManO5hnJCOMMDwbd5bkM7Z3eMoDG9ssyatodo4cXUbDC0L7GoHTTiGNzgALFbnXiQiG_0hzZgaIdtNxqAleY-K3FztSCbWUQNGFEjMD6s2cGRMR5axHk_7p2qe_Nn9fz4hnkjui3-A";
// PatientID from MIDATA (is needed for the import)
let patId = "Patient/5c3a50cbbcbc873680735900";


chmedToMidata.saveMedication(chmedStr, miToken, patId);
