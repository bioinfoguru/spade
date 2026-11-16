import { createRouter, createWebHashHistory } from 'vue-router';
import HomePage from './views/HomePage.vue';
import ContactPage from './views/ContactPage.vue';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/contact', name: 'contact', component: ContactPage },
  ],
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash, behavior: 'smooth' };
    return { top: 0, behavior: 'smooth' };
  },
});
