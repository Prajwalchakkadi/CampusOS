import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCvB0Cv4ZZUKQY_w6oJVLUQeWATXCSaYYc",
  authDomain: "campusos-20c47.firebaseapp.com",
  projectId: "campusos-20c47",
  messagingSenderId: "720894104346",
  appId: "1:720894104346:web:043883f9e260972e2452a3",
  measurementId: "G-G23E2CX20H"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("CampusOS Firebase connected successfully!");
