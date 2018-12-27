<template>
  <div class="home">
    <div class="header">
      <h1>logged in as</h1>
      <h2 v-if="practLoaded">{{pract.name[0].given[0] + " " + pract.name[0].family}}</h2>
      <h2 v-else>Laden...</h2>
    </div>
    <div class="patList">
      <div v-if="patListLoaded">
        <ul>
          <li v-for="pat in patList.entry"
          v-on:click="selectPat(pat)"> 
            <a href="#">{{pat.resource.name[0].given[0] +" "+pat.resource.name[0].family}}</a>
          </li>
        </ul>

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
      patId:null,
      patSelected:false
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
  updated () {
    if(this.authorized==true && this.practLoaded==false){
      this.getPract();
    }
    if(this.authorized==true && this.patListLoaded==false){
      this.getPatList();
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
        console.log(res)
        localStorage.clear()
        localStorage.setItem("token",res.access_token);
        localStorage.setItem("id",res.patient);
        this.authorized=true
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
        console.log(err)
        if(err.responseText == "Invalid token"){
          localStorage.clear()
          router.push("/")
        }
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
        console.log(err)
        if(err.responseText == "Invalid token"){
          localStorage.clear()
          router.push("/")
        }
      })
    },

    selectPat(pat) {
      console.log(pat);
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
