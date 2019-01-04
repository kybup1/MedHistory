<template>
  <div class="about">
    <h1>Login MedHistory</h1>
    <button v-on:click="login()">Einloggen via Midata</button>
  </div>
</template>

<script>
import $ from 'jquery';

export default {
  data () {
    return {
      oauth2: {
        clientId: "MedHistory",
        secret: null,
        serviceUri: "https://test.midata.coop/fhir/",
        redirectUri: "http://localhost:8080/home",
        conformanceUri: "https://test.midata.coop/fhir/metadata",
        scope: ["practitioner/ *.read", "launch"],
        state: Math.round(Math.random() * 100000000).toString()
      }

    }
  },
  methods: {
    login(){
      var oauth2 = this.oauth2;
      $.get(this.oauth2.conformanceUri, function(r) {
        let authUri = "";
        let tokenUri = "";
        const smartExtenstion = r.rest[0].security.extension[0].extension;
        smartExtenstion.forEach(function(element) {
          if(element.url === "authorize") {
            authUri = element.valueUri;
          } else if(element.url === "token") {
            tokenUri = element.valueUri;
          }
        });

        sessionStorage[oauth2.state] = JSON.stringify({
          oauth2: oauth2,
          tokenUri: tokenUri
        });

        window.location.href = authUri + "?" +
        "response_type=code&" +
        "client_id=" + encodeURIComponent(oauth2.clientId) + "&" +
        "scope=" + encodeURIComponent(oauth2.scope) + "&" + 
        "redirect_uri=" + encodeURIComponent(oauth2.redirectUri) + "&" +
         "aud=" + encodeURIComponent(oauth2.serviceUri) + "&" +
         "state=" + oauth2.state;
        }, "json");
      }

    }
  }

</script>