<template>
  <div>
  <header>
    <h3>MedHistory</h3>
  </header>

  <section>
  <nav>
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
    <p>Medikation: {{ medication }}</p>
    <p>Einnahme Morgen: {{ morning }}</p>
    <p>Einnahme Mittag: {{ noon }}</p>
    <p>Einnahme Abend: {{ evening }}</p>
    <p>Einnahme Nacht: {{ night }}</p>
    <p>Einheit: {{ unit }}</p>
    <p>Grund: {{ reason }}</p>
    <p>von: {{ startdate }}</p>
    <p>bis: {{ enddate }}</p>
    <p>Einnahmeart: {{ route }}</p>
  </article>
</section>

<footer>
  <p>Footer</p>
</footer>


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
      medication: "",
      morning: "",
      noon: "",
      evening: "",
      night: "",
      unit: "",
      startdate: "",
      enddate: "",
      reason: "",
      route: "",
      
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

    showMedication() {
      this.medication = this.medicationList.entry[0].resource.medicationCodeableConcept.coding[0].display;
      //this.morning = this.medicationList.entry[0].resource.dosage[0].timing.repeat.when[0]

      for (let i = 0; i < this.medicationList.entry[0].resource.dosage[0].timing.repeat.when.length; i++) {
        if(this.medicationList.entry[0].resource.dosage[0].timing.repeat.when[i] == "PCM") {
          this.morning = this.medicationList.entry[0].resource.dosage[0].doseQuantity.value;
        } else if (this.medicationList.entry[0].resource.dosage[0].timing.repeat.when[i] == "PCD") {
          this.noon = this.medicationList.entry[0].resource.dosage[0].doseQuantity.value;
        } else if (this.medicationList.entry[0].resource.dosage[0].timing.repeat.when[i] == "PCV") {
          this.evening = this.medicationList.entry[0].resource.dosage[0].doseQuantity.value;
        } else if (this.medicationList.entry[0].resource.dosage[0].timing.repeat.when[i] == "eruieren") {
          this.night = this.medicationList.entry[0].resource.dosage[0].doseQuantity.value;
        } 
        
      }
      this.unit = this.medicationList.entry[0].resource.dosage[0].doseQuantity.unit;
      this.startdate = this.medicationList.entry[0].resource.dosage[0].timing.repeat.boundsPeriod.start;
      this.enddate = this.medicationList.entry[0].resource.dosage[0].timing.repeat.boundsPeriod.end;
      this.reason = this.medicationList.entry[0].resource.reasonCode[0].text;
      this.route = this.medicationList.entry[0].resource.dosage[0].route.coding[0].display;
    }
  }
}
</script>

<style scoped>

* {
  box-sizing: border-box;
}

h3 {
  margin: 0;
}
/* Style the header */
header {
  background-color: #bbb;
  padding: 30px;
  text-align: center;
  font-size: 35px;
  color: white;
  height: 100px;
}

/* Create two columns/boxes that floats next to each other */
nav {
  float: left;
  width: 20%;
  height: 500px; /*height: 300px; /* only for demonstration, should be removed */
  background: #ccc;
  padding: 20px;
}

/* Style the list inside the menu */
nav ul {
  list-style-type: none;
  padding: 0;
}

article {
  float: left;
  padding: 20px;
  width: 80%;
  background-color: #f1f1f1;
  height: 500px; /* only for demonstration, should be removed */
}

/* Clear floats after the columns */
section:after {
  content: "";
  display: table;
  clear: both;
}

/* Style the footer */
footer {
  background-color: #bbb;
  padding: 10px;
  text-align: center;
  color: white;
}

/* Responsive layout - makes the two columns/boxes stack on top of each other instead of next to each other, on small screens */
@media (max-width: 600px) {
  nav, article {
    width: 100%;
    height: auto;
  }
}
</style>

