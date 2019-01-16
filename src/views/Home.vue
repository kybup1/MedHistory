<template>
  <div>
    <div class="container">
        <div class="columns">
            <div class="column is-3 ">
                <aside class="menu is-hidden-mobile">
                    <p class="menu-label">
                        Patientenauswahl
                    </p>
                    <ul class="menu-list" v-if="patListLoaded">
                      <li v-for="patient in patList.entry" :key="patient.resource.id" v-on:click="selectPat(patient)"> 
                        <a href="#" :class="{'is-active': patient.resource.id == selected}" @click="selected = patient.resource.id"> {{patient.resource.name[0].given[0] +" "+patient.resource.name[0].family}}</a>
                      </li>
                    </ul>
                </aside>
            </div>
            <div class="column twothird">
                <nav class="breadcrumb" aria-label="breadcrumbs">
                    <ul>
                        <li class="is-active"><a href="../">Medikationshistorie</a></li>
                        <li><a href="../">Timeline</a></li>
                    </ul>
                </nav>
                <section class="hero is-info welcome is-small">
                    <div class="hero-body">
                        <div class="logo">
                          <img class="imgLogo" src="../assets/medLogoWhite.png">
                        </div>
                        <div class="logout">
                          <div>
                          <h2 v-if="practLoaded">Hallo {{pract.name[0].given[0] + " " + pract.name[0].family}}</h2>
                          <h2 v-else>Laden...</h2>
                          <button v-on:click="logout">Ausloggen</button>
                          </div>
                        </div>
                    </div>
                </section>
                <div class="columns">
                    <div class="column">
                        <div class="card events-card">
                            <div class="card-table">
                                <div v-if="medicationLoaded" class="content">
                                    <h4>{{ patName }} </h4>
                                    <p>{{ patBirthdate }} ( {{ patGender }} )</p> 
                                    <p>{{ patAdress }} / {{ patPhone }} </p>
                                    <p>Körpergrösse / Gewicht: {{ patHeight }} / {{ patWeight }} </p>
                                    <v-client-table :data="tableData" :columns="columns" :options="options"></v-client-table>
                                </div>
                                <div v-if="!medicationLoaded" class="content">
                                  <p>Bitte wählen Sie einen Patienten aus.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>

<script>

import $ from 'jquery';
import router from '../router.js'

export default {
  data () {
    return {
      // Highlighting of selected patient
      selected: undefined,
      oauth2: {},
      // information about the logged in practitioner
      pract: {},
      // Boolean if the practitioner is loaded or not
      practLoaded: false,
      // Boolean if it is a token in the localStorage
      authorized: false,
      // All patients that belong to the loggin in practitioner
      patList: {},
      // Boolean if the patientlist is loaded or not
      patListLoaded: false,
      // Selected patient information
      pat: {},
      // Loaded observations from the selected patient
      observationList: {},
      // All medicationStatements loaded in this variable
      medicationList: {},
      // Boolean if the medication is already loaded (for the display)
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
      // Columns for the table
      columns: ['medikament', 'gtin', 'morgen', 'mittag','abend','nacht', 'einheit', 'startdatum', 'enddatum','anleitung', 'grund'],
      // Array with all the medication
      tableData: [],
      // Options for the table
      options: {
        filterable: false,
      },
      temp: Object,
      
    }
  },
  // Checks if it is a token in the localStorage and starts the requests for practitioner and patientList
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

  methods : {
    // Saving the token 
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
        this.getPract();
        this.getPatList();
      }).catch(err => {
        console.log(err)
      })
    },

    // Request for the logged in practitioner 
    // Returns the information about the practitioner
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
      }).catch(err => {
        this.checkLogin(err);
      })
    },

    // Loading of all patients
    // return: Array with all patients
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
        this.patListLoaded = true;
      }).catch(err => {
        this.checkLogin(err);
      })
    },

    // Loading of all observations of a selected patient
    // return: All observations in an array
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
        this.showObservation();
      }).catch(err => {
        this.checkLogin(err);
      })
    },

    // Loading of all medicationStatements of a selected patient
    // Return: Array with all medication
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
        this.showMedication();
      }).catch(err => {
        this.checkLogin(err);
      })
    },

    // Is executed when you click on a patient. 
    selectPat(pat) {
      // Resetting the table and the view
      this.tableData = [];
      this.medicationLoaded = false;
      // Setting of the selected patient
      this.pat = pat.resource;

      // Requets of all information
      this.getObservations();
      this.getMedication();

      // Setting of the labels with the patient information
      this.patName = this.pat.name[0].given[0] + " " + this.pat.name[0].family;
      this.patAdress = this.pat.address[0].line[0] + ", " + this.pat.address[0].postalCode + " " + this.pat.address[0].city;
      this.patBirthdate = this.pat.birthDate;
      this.patGender = this.pat.gender;
      // eMail and phone are in the same array
      for (let i = 0; i < this.pat.telecom.length; i++) {
        if(this.pat.telecom[i].system == 'phone') {
          this.patPhone = this.pat.telecom[i].value;
        }
      }
      
    },

    // Logout and redirect to login page
    logout() {
      localStorage.clear();
      router.push("/");
    },

    // Checks if the token is invalid or expired. If so, then redirect to login page
    checkLogin(err) {
      console.log("error: " + err)
      if(err.responseText == "Invalid token" || err.responseText=="Invalid or expired authToken."){
        localStorage.clear()
        router.push("/")
      }
    },

    // Getting the right url parameter
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

    // Proceeding of the requested observatons
    showObservation() {
      if(this.observationList.entry) {
        for (let i = 0; i < this.observationList.entry.length; i++) {
          if(this.observationList.entry[i].resource.meta.profile[0] == "http://hl7.org/fhir/bodyweight") {
            this.patWeight = this.observationList.entry[i].resource.valueQuantity.value;
            this.patWeight += (" " + this.observationList.entry[i].resource.valueQuantity.unit);
          } else if (this.observationList.entry[i].resource.meta.profile[0] == "http://hl7.org/fhir/bodyheight") {
            this.patHeight = this.observationList.entry[i].resource.valueQuantity.value;
            this.patHeight += (" " + this.observationList.entry[i].resource.valueQuantity.unit);
          }
        }
      }
    },

    // Proceeding of the requested medications
    showMedication() {
      if(this.medicationList.entry) {

        // looping through all entries
        for (let i = 0; i < this.medicationList.entry.length; i++) {
          let medication = this.medicationList.entry[i].resource.medicationCodeableConcept.coding[0].display;
          let gtin = this.medicationList.entry[i].resource.medicationCodeableConcept.coding[0].code;
                
          let morning = "-";
          let noon = "-";
          let evening = "-";
          let night = "-";
          let unit = '';
          let startdate = '';
          let enddate = '';

          // In some cases (false cases) there is no dosage object
          if(this.medicationList.entry[i].resource.dosage) {
            for (let j = 0; j < this.medicationList.entry[i].resource.dosage.length; j++) {
              for (let k = 0; k < this.medicationList.entry[i].resource.dosage[j].timing.repeat.when.length; k++) {
                // PCM = morning, PCD = noon, PCV = evening, HS = night
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
            unit = this.medicationList.entry[i].resource.dosage[0].doseQuantity.unit;
            startdate = this.medicationList.entry[i].resource.dosage[0].timing.repeat.boundsPeriod.start;
            enddate = this.medicationList.entry[i].resource.dosage[0].timing.repeat.boundsPeriod.end;
          }

          let note = '';
          if(this.medicationList.entry[i].resource.note) {
            note = this.medicationList.entry[i].resource.note[0].text;
          }
          let reason = this.medicationList.entry[i].resource.reasonCode[0].text;
          // Additional information about how to intake the medication
          let route = ""; //this.medicationList.entry[i].resource.dosage[0].route.coding[0].display;

          let temp = new this.medi(medication,gtin,morning,noon,evening,night,unit,startdate,enddate,note,route,reason);
          this.tableData.push(temp);
        }
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
      this.startdatum = startdate;
      this.enddatum = enddate;
      this.einnahmeart = route;
      this.anleitung = note;
      this.grund = reason;
    },
  }
}
</script>