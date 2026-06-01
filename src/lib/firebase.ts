import { initializeApp, getApps } from "firebase/app";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

export const firebaseConfig = {
  apiKey: "AIzaSyC5oXVQI26DzreGmvLrxxsu_v2ywUMI4BI",
  authDomain: "elearning-codebreakers.firebaseapp.com",
  projectId: "elearning-codebreakers",
  storageBucket: "elearning-codebreakers.firebasestorage.app",
  messagingSenderId: "846950310805",
  appId: "1:846950310805:web:093f504a1c7a50b70d4c9c",
};

export const VAPID_KEY =
  "BF-_dTdnWHlSSs7WX7aYVUo5H1buEohx0EyJ5R5N8ZUPByjQSLK_txo4s5ug0CE8kMNOx2UDnhaBP6UcPJmhfHI";

export const firebaseApp =
  getApps()[0] ?? initializeApp(firebaseConfig);

let _messaging: Messaging | null = null;
export async function getMessagingSafe(): Promise<Messaging | null> {
  if (_messaging) return _messaging;
  try {
    if (!(await isSupported())) return null;
    _messaging = getMessaging(firebaseApp);
    return _messaging;
  } catch {
    return null;
  }
}