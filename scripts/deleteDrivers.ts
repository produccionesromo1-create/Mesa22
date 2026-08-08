import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

async function deleteAllDrivers() {
  console.log('Initializing Firebase...');
  const app = initializeApp(firebaseConfig);
  const db = (firebaseConfig as any).firestoreDatabaseId 
    ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
    : getFirestore(app);

  console.log('Fetching all documents from "drivers" collection...');
  const querySnapshot = await getDocs(collection(db, 'drivers'));
  
  console.log(`Found ${querySnapshot.size} driver document(s).`);

  let count = 0;
  for (const documentSnap of querySnapshot.docs) {
    console.log(`Deleting driver ID: ${documentSnap.id} (${documentSnap.data()?.name || 'no name'})...`);
    await deleteDoc(doc(db, 'drivers', documentSnap.id));
    count++;
  }

  console.log(`Successfully deleted ${count} driver(s) from Firestore!`);
  process.exit(0);
}

deleteAllDrivers().catch((err) => {
  console.error('Error deleting drivers:', err);
  process.exit(1);
});
