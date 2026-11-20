import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyAUpa-fB_19rJikt32YrfLxZD5MUJbEf9o",
  authDomain: "suzika-call-pic.firebaseapp.com",
  projectId: "suzika-call-pic",
  storageBucket: "suzika-call-pic.firebasestorage.app",
  messagingSenderId: "234829978977",
  appId: "1:234829978977:web:e818627a428c5b1b03b920",
  measurementId: "G-PXPLE27797"
};

// Initialize Firebase safely
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

// Firestore collections references
export const photosCollection = collection(db, 'photos');
export const videosCollection = collection(db, 'videos');
export const videoFilesCollection = collection(db, 'videoFiles');
export const videoChunksCollection = collection(db, 'videoChunks');
export const commentsCollection = collection(db, 'comments');
export const messagesCollection = collection(db, 'adminMessages');
export const configDoc = doc(db, 'settings', 'bannerConfig');

export { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  writeBatch
};
