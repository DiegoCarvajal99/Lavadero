import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCfMzNRNY9UvJLsc0jQjW4QbumWM_-xEJI",
  authDomain: "lavadero-pro-tech.firebaseapp.com",
  projectId: "lavadero-pro-tech",
  storageBucket: "lavadero-pro-tech.firebasestorage.app",
  messagingSenderId: "172651264596",
  appId: "1:172651264596:web:375aba4186343ca0714bc1"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
