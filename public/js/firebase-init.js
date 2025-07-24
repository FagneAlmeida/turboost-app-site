// =================================================================
// ARQUIVO DE INICIALIZAÇÃO CENTRAL DO FIREBASE
// =================================================================
// Este é o ÚNICO local onde a configuração do Firebase deve existir.
// =================================================================

const firebaseConfig = {
  apiKey: "AIzaSyDt0ibeS-mTPQrVRHNM-7j0Kp2B-rT9vhQ",
  authDomain: "turboost-site-oficial.firebaseapp.com",
  projectId: "turboost-site-oficial",
  storageBucket: "turboost-site-oficial.firebasestorage.app",
  messagingSenderId: "729763816750",
  appId: "1:729763816750:web:636549c1aed8aa6ce046bf"
};

// Inicializa o Firebase e torna as variáveis acessíveis globalmente nos outros scripts
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

console.log("Firebase inicializado para o projeto:", firebaseConfig.projectId);
