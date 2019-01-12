<template>
  <div>
  <header>
    <h3>MedHistory</h3>
  </header>

  <section>
  <nav class="main">
    <div class="patList">
      <div v-if="patListLoaded">
        <ul>
          <li v-for="patient in patList.entry" :key="patient.resource.id" v-on:click="selectPat(patient)"> 
            <a href="#">{{patient.resource.name[0].given[0] +" "+patient.resource.name[0].family}}</a>
          </li>
        </ul>
        <h3 v-if="patSelected">Patient: {{pat.name[0].given[0] + " " + pat.name[0].family}}</h3>

      </div>
    </div>
  </nav>
  <article>
    <h2>{{ patName }} </h2>
    <p>{{ patBirthdate }} ( {{ patGender }} )</p> 
    <p>{{ patAdress }} / {{ patPhone }} </p>
    <p>Körpergrösse / Gewicht: {{ patHeight }} / {{ patWeight }} </p>
    <v-client-table :data="tableData" :columns="columns" :options="options"></v-client-table>
  </article>
</section>

    <div class="home">
      <div class="header">
        <h1>Eingeloggt als: </h1>
        <h2 v-if="practLoaded">{{pract.name[0].given[0] + " " + pract.name[0].family}}</h2>
        <h2 v-else>Laden...</h2>
      </div>
      <button v-on:click="logout">Ausloggen</button>
    </div>


  </div>
</template>

<script>

import $ from 'jquery';
import router from '../router.js'

export default {
  data () {
    return {
      oauth2: {},
      pract: {},
      practLoaded: false,
      authorized: false,
      patList: {},
      patListLoaded: false,
      pat: {},
      patSelected: false,
      observationList: {},
      observationLoaded: false,
      medicationList: {},
      medicationLoaded: false,
      // Patient Data <<
      patName: "",
      patBirthdate: "",
      patAdress: "",
      patGender: "",
      patPhone: "",
      // >>
      // from the observations
      patHeight: "",
      patWeight: "",
      // >>
      // from the medicationStatements  <<
      medication: "",
      morning: "-",
      noon: "-",
      evening: "-",
      night: "-",
      unit: "",
      startdate: "",
      enddate: "",
      reason: "",
      route: "",
      // >>
      columns: ['medikament', 'gtin', 'morgen', 'mittag','abend','nacht', 'einheit', 'von', 'bis','anleitung', 'grund'],
      tableData: [],
      options: {
        filterable: false,
      },
      temp: Object,
      
    }
  },
  created () {
    if(localStorage.getItem("token")){
      this.authorized = true;
    } else {
      this.saveToken()
    }
    if(this.authorized == true){
      this.getPract();
      this.getPatList();
    }
  },

  beforeUpdate() {
    console.log("patSelected: " + this.patSelected)
    if(this.authorized == true && this.practLoaded == false){
      this.getPract();
    }
    if(this.authorized == true && this.patListLoaded == false){
      this.getPatList();
    }
    if(this.authorized == true && this.patSelected == true && this.observationLoaded == false) {
      this.getObservations();
    }
    if(this.authorized == true && this.patSelected == true && this.medicationLoaded == false) {
      this.getMedication();
    }
  },

  methods : {
    saveToken() {
      var state = this.getUrlParameter("state");
      var code = this.getUrlParameter("code");

      var params = JSON.parse(sessionStorage[state]);
      var tokenUri = params.tokenUri;
      this.oauth2 = params.oauth2;
      
      $.ajax({
        url: tokenUri,
        type: 'POST',
        data: {
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: this.oauth2.redirectUri,
          client_id: "MedHistory"
        }
      }).done(res => {
        localStorage.clear()
        localStorage.setItem("token",res.access_token);
        localStorage.setItem("id",res.patient);
        this.authorized = true;
        this.$forceUpdate();
      }).catch(err => {
        console.log(err)
      })
    },

    getPract() {
      const token = localStorage.getItem("token");
      const id = localStorage.getItem("id")
      const url = "https://test.midata.coop/fhir/Practitioner/" + id;

      $.ajax({
        url: url,
        type: "GET",
        dataType: "json",
        headers: {
          "Authorization": "Bearer " + token
        },
      }).done(pract => {
        this.pract = pract;
        this.practLoaded = true;
        console.log("pract: " + pract)
      }).catch(err => {
        this.checkLogin(err);
      })
    },

    getPatList() {
      const token = localStorage.getItem("token");
      
      const url = "https://test.midata.coop/fhir/Patient";

      $.ajax({
        url: url,
        type: "GET",
        dataType: "json",
        headers: {
          "Authorization": "Bearer " + token
        },
      }).done(patList => {
        this.patList = patList;
        this.patListLoaded=true;
      }).catch(err => {
        this.checkLogin(err);
      })
    },

    getObservations() {
      const token = localStorage.getItem("token");
      
      const url = "https://test.midata.coop/fhir/Observation?subject="+this.pat.id;

      $.ajax({
        url: url,
        type: "GET",
        dataType: "json",
        headers: {
          "Authorization": "Bearer " + token
        },
      }).done(observationList => {
        this.observationList = observationList;
        this.observationLoaded = true;
        console.log("observationList: " + this.observationList)
        this.showObservation();
      }).catch(err => {
        this.checkLogin(err);
      })
    },

    getMedication() {
      const token = localStorage.getItem("token");
      
      const url = "https://test.midata.coop/fhir/MedicationStatement?subject="+this.pat.id;

      $.ajax({
        url: url,
        type: "GET",
        dataType: "json",
        headers: {
          "Authorization": "Bearer " + token
        },
      }).done(medicationList => {
        this.medicationList = medicationList;
        this.medicationLoaded = true;
        console.log("medicationList: " + this.medicationList)
        this.showMedication();
      }).catch(err => {
        this.checkLogin(err);
      })
    },

    selectPat(pat) {
      this.patSelected = true;
      this.pat = pat.resource;
      this.observationLoaded = false;
      this.medicationLoaded = false;

      this.patName = this.pat.name[0].given[0] + " " + this.pat.name[0].family;
      this.patAdress = this.pat.address[0].line[0] + ", " + this.pat.address[0].postalCode + " " + this.pat.address[0].city;
      this.patBirthdate = this.pat.birthDate;
      this.patGender = this.pat.gender;
      for (let i = 0; i < this.pat.telecom.length; i++) {
        if(this.pat.telecom[i].system == 'phone') {
          this.patPhone = this.pat.telecom[i].value;
        }
      }
      
    },

    logout() {
      localStorage.clear();
      router.push("/");
    },

    checkLogin(err) {
      console.log("error: " + err)
      if(err.responseText == "Invalid token" || err.responseText=="Invalid or expired authToken."){
        localStorage.clear()
        router.push("/")
      }
    },

    getUrlParameter(sParam) {
      var sPageURL = window.location.search.substring(1);
      var sURLVariables = sPageURL.split('&');
      for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) {
          var res = sParameterName[1].replace(/\+/g, '%20');
          return decodeURIComponent(res);
        } 
      }
    },

    showObservation() {
      for (let i = 0; i < this.observationList.entry.length; i++) {
        if(this.observationList.entry[i].resource.meta.profile[0] == "http://hl7.org/fhir/bodyweight") {
          this.patWeight = this.observationList.entry[i].resource.valueQuantity.value;
          this.patWeight += (" " + this.observationList.entry[i].resource.valueQuantity.unit);
        } else if (this.observationList.entry[i].resource.meta.profile[0] == "http://hl7.org/fhir/bodyheight") {
          this.patHeight = this.observationList.entry[i].resource.valueQuantity.value;
          this.patHeight += (" " + this.observationList.entry[i].resource.valueQuantity.unit);
        }
        
      }
    },

    showMedication() {
      for (let i = 0; i < this.medicationList.entry.length; i++) {
        let medication = this.medicationList.entry[i].resource.medicationCodeableConcept.coding[0].display;
        let gtin = this.medicationList.entry[i].resource.medicationCodeableConcept.coding[0].code;
              
        let morning = "-";
        let noon = "-";
        let evening = "-";
        let night = "-";

        for (let j = 0; j < this.medicationList.entry[i].resource.dosage.length; j++) {
          for (let k = 0; k < this.medicationList.entry[i].resource.dosage[j].timing.repeat.when.length; k++) {
            if(this.medicationList.entry[i].resource.dosage[j].timing.repeat.when[k] == "PCM") {
              morning = this.medicationList.entry[i].resource.dosage[j].doseQuantity.value;
            } else if (this.medicationList.entry[i].resource.dosage[j].timing.repeat.when[k] == "PCD") {
              noon = this.medicationList.entry[i].resource.dosage[j].doseQuantity.value;
            } else if (this.medicationList.entry[i].resource.dosage[j].timing.repeat.when[k] == "PCV") {
              evening = this.medicationList.entry[i].resource.dosage[j].doseQuantity.value;
            } else if (this.medicationList.entry[i].resource.dosage[j].timing.repeat.when[k] == "HS") {
              night = this.medicationList.entry[i].resource.dosage[j].doseQuantity.value;
            } 
          }
        }

        let unit = this.medicationList.entry[i].resource.dosage[0].doseQuantity.unit;
        let startdate = this.medicationList.entry[i].resource.dosage[0].timing.repeat.boundsPeriod.start;
        let enddate = this.medicationList.entry[i].resource.dosage[0].timing.repeat.boundsPeriod.end;
        let note = '';
        if(this.medicationList.entry[i].resource.note) {
          note = this.medicationList.entry[i].resource.note[0].text;
        }
        let reason = this.medicationList.entry[i].resource.reasonCode[0].text;
        let route = this.medicationList.entry[i].resource.dosage[0].route.coding[0].display;

        let temp = new this.medi(medication,gtin,morning,noon,evening,night,unit,startdate,enddate,note,route,reason);
        this.tableData.push(temp);
        
      }
     
    },

    medi(medicament,gtin,morning,noon,evening,night,unit,startdate,enddate,note,route,reason){
      this.medikament = medicament;
      this.gtin = gtin;
      this.morgen = morning;
      this.mittag = noon;
      this.abend = evening;
      this.nacht = night;
      this.einheit = unit;
      this.von = startdate;
      this.bis = enddate;
      this.einnahmeart = route;
      this.anleitung = note;
      this.grund = reason;
    },
  }
}
</script>