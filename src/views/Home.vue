<template>
  <div class="home">
    <h1>logged in as</h1>
    <button v-on:click=getPract>load Practitioner</button>

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
      authorized:false
    }
  },
  created () {
    if(localStorage.getItem("token")){
      this.authorized=true
    } else {
      this.saveToken()
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
      }).catch(err => {
        console.log(err)
      })
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
