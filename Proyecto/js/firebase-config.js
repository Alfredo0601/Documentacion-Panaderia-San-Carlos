import { initializeApp } from
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";

import { getAuth } from
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

import { getFirestore } from
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAksH3gaB2oc5PEgsgeRodZRQaW2E2fy-E",
    authDomain: "panaderiasc-1ee88.firebaseapp.com",
    projectId: "panaderiasc-1ee88",
    storageBucket: "panaderiasc-1ee88.firebasestorage.app",
    messagingSenderId: "891654026664",
    appId: "1:891654026664:web:05090c78081965547f199d",
    measurementId: "G-7WMN4H21PJ"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);