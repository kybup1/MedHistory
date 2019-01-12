import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import jquery from 'jquery'
import {ClientTable} from 'vue-tables-2';

Vue.config.productionTip = false

new Vue({
  router,
  store,
  jquery,
  render: h => h(App)
}).$mount('#app')

Vue.use(ClientTable, {}, false, 'bulma');
