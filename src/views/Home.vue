<template>
  <div class="home">
    <div class="header">
      <h1>logged in as</h1>
      <h2 v-if="practLoaded">{{pract.name[0].given[0] + " " + pract.name[0].family}}</h2>
      <h2 v-else>Laden...</h2>
    </div>
    <button v-on:click="logout">Ausloggen</button>
    <div class="patList">
      <div v-if="patListLoaded">
        <ul>
          <li v-for="patient in patList.entry"
          v-on:click="selectPat(patient)"> 
            <a href="#">{{patient.resource.name[0].given[0] +" "+patient.resource.name[0].family}}</a>
          </li>
        </ul>
        <h3 v-if="patSelected">Patient: {{pat.name[0].given[0] + " " + pat.name[0].family}}</h3>

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
      oauth2:{},
      pract:{},
      practLoaded:false,
      authorized:false,
      patList:{},
      patListLoaded:false,
      pat:{},
      patSelected:false,
      observationList:{},
      observationLoaded:false,
      medicationList:{},
      medicationLoaded:false
    }
  },
  created () {
    if(localStorage.getItem("token")){
      this.authorized=true;
    } else {
      this.saveToken()
    }
    if(this.authorized==true){
      this.getPract();
      this.getPatList();
    }
  },
  beforeUpdate() {
    console.log(this.patSelected)
    if(this.authorized==true && this.practLoaded==false){
      this.getPract();
    }
    if(this.authorized==true && this.patListLoaded==false){
      this.getPatList();
    }
    if(this.authorized==true && this.patSelected==true && this.observationLoaded==false) {
      this.getObservations();
    }
    if(this.authorized==true && this.patSelected==true && this.medicationLoaded==false) {
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
        this.authorized=true;
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
        this.practLoaded=true;
        console.log(pract)
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
        this.observationLoaded=true;
        console.log(this.observationList)
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
        this.medicationLoaded=true;
        console.log(this.medicationList)
      }).catch(err => {
        this.checkLogin(err);
      })
    },

    selectPat(pat) {
      this.patSelected=true;
      this.pat=pat.resource;
      this.observationLoaded=false;
      this.medicationLoaded=false;
    },

    logout() {
      localStorage.clear();
      router.push("/");
    },

    checkLogin(err) {
      if(err.responseText == "Invalid token" || err.responseText=="unauthorized"){
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
    }
  }
}
</script>
