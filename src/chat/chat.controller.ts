import {
  Controller,
  Delete,
  Patch,
  Put,
  Query,
  Body,
  Param,
} from '@nestjs/common';
import { cloud_firestore, fcm } from '../firebase/firebase';
import firebase from 'firebase-admin';
import DocumentSnapshot = firebase.firestore.DocumentSnapshot;
import DocumentReference = firebase.firestore.DocumentReference;
import FieldValue = firebase.firestore.FieldValue;

@Controller('chat')
export class ChatController {
  @Put('group/new')
  async newGroup(
    @Query('name') name: string,
    @Query('desc') desc: string,
    @Body() members: string[],
  ) {
    const membersData: DocumentSnapshot[] = [];
    for (let i = 0; i < members['members'].length; i++) {
      const member = await cloud_firestore
        .doc(`users/${members['members'][i]}`)
        .get();
      if (!member.exists) {
        return 'One of the members does not exist';
      } else {
        membersData.push(member);
      }
    }
    await cloud_firestore.collection('groups').add({
      name: name,
      desc: desc,
      users: membersData.map((e) => e.ref),
    });
    await cloud_firestore.collection('notifications').add({
      users: membersData.map((e) => e.ref),
      title: 'Addition into new group',
      body: `You have been added to a new group called ${name} (Description: ${desc})`,
      time: FieldValue.serverTimestamp(),
    });
    await fcm.sendEachForMulticast({
      tokens: membersData.flatMap((e) => e.data()['tokens']),
      notification: {
        title: 'Addition into new group',
        body: `You have been added to a new group called ${name} (Description: ${desc})`,
      },
    });
  }

  @Patch('group/:id/change')
  async changeGroupUsers(
    @Param('id') id: string,
    @Query('type') type: 'add' | 'remove',
    @Query('user') user: string,
    @Query('by') by: string,
  ) {
    const group = await cloud_firestore.doc(`groups/${id}`).get();
    if (!group.exists) return 'Group does not exist';
    const userChanged = await cloud_firestore.doc(`users/${user}`).get();
    if (
      !userChanged.exists ||
      ((group.data()['users'] as DocumentReference[])
        .map((e) => e.path)
        .includes(userChanged.ref.path) &&
        type === 'add') ||
      (!(group.data()['users'] as DocumentReference[])
        .map((e) => e.path)
        .includes(userChanged.ref.path) &&
        type === 'remove')
    )
      return 'User is invalid';
    const userBy = await cloud_firestore.doc(`users/${by}`).get();
    if (!userBy.exists || group.data()['users'].includes(userBy.ref))
      return 'User by is invalid';
    await group.ref.update({
      users:
        type === 'add'
          ? FieldValue.arrayUnion(userChanged.ref)
          : FieldValue.arrayRemove(userChanged.ref),
    });
    await cloud_firestore.collection('notifications').add({
      users: (group.data()['users'] as DocumentReference[]).filter(
        (e) => e.id !== userChanged.id,
      ),
      title: `${
        type === 'add' ? 'Addition of user to' : 'Removal of user from'
      } group`,
      body:
        type === 'add'
          ? `Welcome ${userChanged.data()['name']} to the group ${
              group.data()['name']
            }`
          : `${userChanged.data()['name']} was removed from the group ${
              group.data()['name']
            }`,
      time: FieldValue.serverTimestamp(),
    });
    await cloud_firestore.collection('notifications').add({
      users: [userChanged.ref],
      title: `${type === 'add' ? 'Addition to' : 'Removal from'} group`,
      body: `You have been ${
        type === 'add' ? 'added to' : 'removed from'
      } group ${group.data()['name']}`,
      time: FieldValue.serverTimestamp(),
    });
    await fcm.sendEachForMulticast({
      tokens: [],
      notification: {
        title: `${type === 'add' ? 'Addition' : 'Removal'} of user from group`,
        body:
          type === 'add'
            ? `Welcome ${userChanged.data()['name']} to the group ${
                group.data()['name']
              }`
            : `${userChanged.data()['name']} was removed from the group ${
                group.data()['name']
              }`,
      },
    });
  }

  @Delete('group/:id')
  async deleteGroup(@Param('id') id: string, @Query('by') by: string) {
    const group = await cloud_firestore.doc(`groups/${id}`).get();
    if (!group.exists) return 'Group does not exist';
    const userBy = await cloud_firestore.doc(`users/${by}`).get();
    if (
      !userBy.exists ||
      !group
        .data()
        ['users'].map((e) => e.path)
        .includes(userBy.ref.path)
    )
      return 'User by is invalid';
    await group.ref.delete();
    await cloud_firestore.collection('notifications').add({
      users: group.data()['users'],
      title: 'Deletion of group',
      body: `The group ${group.data()['name']} has been deleted by ${
        userBy.data()['name']
      }`,
      time: FieldValue.serverTimestamp(),
    });
  }

  @Put('group/:id/message')
  async newGroupMessage(
    @Param('id') id: string,
    @Query('text') text: string,
    @Query('uid') uid: string,
  ) {
    const group = await cloud_firestore.doc(`groups/${id}`).get();
    if (!group.exists) return 'Group does not exist';
    const user = await cloud_firestore.doc(`users/${uid}`).get();
    if (
      !user.exists ||
      !group
        .data()
        ['users'].map((e) => e.path)
        .includes(user.ref.path)
    )
      return 'User is invalid';
    await group.ref.collection('messages').add({
      text: text,
      user: user.ref,
      time: FieldValue.serverTimestamp(),
    });
    await cloud_firestore.collection('notifications').add({
      users: group.data()['users'],
      title: `${user.data()['name']}@${group.data()['name']}`,
      body: text,
      time: FieldValue.serverTimestamp(),
    });
    await fcm.sendEachForMulticast({
      tokens: group.data()['users'].flatMap((e) => e.data()['tokens']),
      notification: {
        title: `${user.data()['name']}@${group.data()['name']}`,
        body: text,
      },
    });
  }

  @Put('message')
  async newMessage(@Body() msg: Message) {
    const userFrom = await cloud_firestore.doc(`users/${msg.from}`).get();
    if (!userFrom.exists) return 'User from does not exist';
    const userTo = await cloud_firestore.doc(`users/${msg.to}`).get();
    if (!userTo.exists) return 'User to does not exist';
    const chatDocCheck = (
      await cloud_firestore
        .collection('121')
        .where('users', 'array-contains', userFrom.ref)
        .get()
    ).docs.filter((e) =>
      e
        .data()
        ['users'].map((e) => e.id)
        .includes(userTo.id),
    );
    const chatDocID = [msg.from, msg.to].sort().join();
    await cloud_firestore.collection(`121/${chatDocID}/messages`).add({
      from: userFrom.ref,
      to: userTo.ref,
      time: FieldValue.serverTimestamp(),
      text: msg.text,
    });
    await fcm.sendEachForMulticast({
      tokens: userTo.data()['tokens'],
      notification: {
        title: `New message from ${userFrom.data()['name']}`,
        body: msg.text,
      },
    });
  }
}

interface Message {
  from: string;
  to: string;
  text: string;
}
