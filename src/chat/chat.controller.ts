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
import { DocumentReference, FieldValue } from 'firebase-admin/lib/firestore';

@Controller('chat')
export class ChatController {
  @Put('group/new')
  async newGroup(@Query('name') name: string, @Body() members: string[]) {
    const membersData: any[] = [];
    for (let i = 0; i < members.length; i++) {
      const member = await cloud_firestore.doc(`users/${members[i]}`).get();
      if (!member.exists) {
        return 'One of the members does not exist';
      } else {
        membersData.push(member);
      }
    }
    await cloud_firestore.collection('groups').add({
      name: name,
      users: membersData.map((e) => e.ref),
    });
    await cloud_firestore.collection('notifications').add({
      users: members.map((e) => cloud_firestore.doc(`users/${e}`)),
      title: 'Addition into new group',
      body: `You have been added to a new group called ${name}`,
      time: FieldValue.serverTimestamp(),
    });
    await fcm.sendEachForMulticast({
      tokens: membersData.flatMap((e) => e.data()['tokens']),
      notification: {
        title: 'Addition into new group',
        body: `You have been added to a new group called ${name}`,
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
      ((group.data()['users'] as DocumentReference[]).includes(
        userChanged.ref,
      ) &&
        type === 'add') ||
      (!(group.data()['users'] as DocumentReference[]).includes(
        userChanged.ref,
      ) &&
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
    if (!userBy.exists || !group.data()['users'].includes(userBy.ref))
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
    if (!user.exists || !group.data()['users'].includes(user.ref))
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
  async newMessage(
    @Query('text') text: string,
    @Query('from') _userFrom: string,
    @Query('to') _userTo: string,
  ) {
    const userFrom = await cloud_firestore.doc(`users/${_userFrom}`).get();
    if (!userFrom.exists) return 'User from does not exist';
    const userTo = await cloud_firestore.doc(`users/${_userTo}`).get();
    if (!userTo.exists) return 'User to does not exist';
    await cloud_firestore.collection('messages').add({
      from: userFrom.ref,
      to: userTo.ref,
      time: FieldValue.serverTimestamp(),
      text: text,
    });
    await fcm.sendEachForMulticast({
      tokens: userTo.data()['tokens'],
      notification: {
        title: `New message from ${userFrom.data()['name']}`,
        body: text,
      },
    });
  }
}
