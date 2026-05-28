import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  addDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from './firebase';

export interface AdvisorMember {
  uid: string;
  name: string;
  role: string;
  profileImageUrl?: string;
}

const ROOM_DOC = doc(db, 'advisorGroupRooms', 'main');

export async function ensureAdvisorRoomMembership(advisorId: string): Promise<void> {
  const snap = await getDoc(ROOM_DOC);
  if (!snap.exists()) {
    await setDoc(ROOM_DOC, {
      roomName: 'Advisor Collaboration Room',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      participants: [advisorId],
    });
  } else {
    await updateDoc(ROOM_DOC, {
      participants: arrayUnion(advisorId),
      updatedAt: serverTimestamp(),
    });
  }
}

export interface AdvisorRoomMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderPhotoUrl?: string;
  text: string;
  createdAt: any;
  messageType: string;
}

export function listenToAdvisorRoomMessages(
  callback: (messages: AdvisorRoomMessage[]) => void
): () => void {
  const messagesQuery = query(
    collection(db, 'advisorGroupRooms', 'main', 'messages'),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(messagesQuery, (snapshot) => {
    const msgs: AdvisorRoomMessage[] = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AdvisorRoomMessage, 'id'>),
    }));
    callback(msgs);
  });
}

export function listenToAdvisorRoomMembers(
  callback: (members: AdvisorMember[]) => void
): () => void {
  return onSnapshot(collection(db, 'advisors'), (snapshot) => {
    const members: AdvisorMember[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        name: data.name ?? '',
        role: data.role ?? '',
        profileImageUrl: data.profileImageUrl ?? '',
      };
    });
    callback(members);
  });
}

export async function sendAdvisorRoomMessage(
  advisorId: string,
  advisorName: string,
  advisorRole: string,
  text: string,
  senderPhotoUrl?: string
): Promise<void> {
  await addDoc(collection(db, 'advisorGroupRooms', 'main', 'messages'), {
    senderId: advisorId,
    senderName: advisorName,
    senderRole: advisorRole,
    senderPhotoUrl: senderPhotoUrl ?? '',
    text,
    createdAt: serverTimestamp(),
    messageType: 'text',
  });

  await updateDoc(ROOM_DOC, { updatedAt: serverTimestamp() });
}
