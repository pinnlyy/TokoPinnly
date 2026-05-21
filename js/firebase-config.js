// Firebase Firestore modular v10 untuk HTML biasa / GitHub Pages

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDIBcb79rnjiFa8PeY2pr7PLUmq0rwMZ9M",
  authDomain: "toko-pinnly.firebaseapp.com",
  projectId: "toko-pinnly",
  storageBucket: "toko-pinnly.firebasestorage.app",
  messagingSenderId: "584864083851",
  appId: "1:584864083851:web:2cad56d4e78d675c3c898e",
  measurementId: "G-N4491QXPL4"
};

export const isFirebaseConfigured = true;
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
