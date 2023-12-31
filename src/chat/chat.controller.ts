import {
  Controller,
  Delete,
  Patch,
  Put,
  Query,
  Body,
  Param,
} from '@nestjs/common';
import { firestore, fcm } from '../firebase/firebase';
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
      const member = await firestore
        .doc(`users/${members['members'][i]}`)
        .get();
      if (!member.exists) {
        return 'One of the members does not exist';
      } else {
        membersData.push(member);
      }
    }
    await firestore.collection('groups').add({
      name: name,
      desc: desc,
      users: membersData.map((e) => e.ref),
    });
    await firestore.collection('notifications').add({
      users: membersData.map((e) => e.ref),
      title: 'Addition into new group',
      body: `You have been added to a new group called ${name} (Description: ${desc})`,
      time: FieldValue.serverTimestamp(),
    });
    try {
        await fcm.sendEachForMulticast({
        tokens: membersData.flatMap((e) => e.data()['tokens']),
        notification: {
          title: 'Addition into new group',
          body: `You have been added to a new group called ${name} (Description: ${desc})`,
        },
      });
    } catch {
      return 'Notification sending failed but update completed';
    }
    return 'Group addition has been completed';
  }

  @Patch('group/:id/edit')
  async editGroup(
    @Param('id') id: string,
    @Query('by') by: string,
    @Body() changes: GroupChanges,
  ) {
    const group = await firestore.doc(`groups/${id}`).get();
    if (!group.exists) return 'Group does not exist';
    const userBy = await firestore.doc(`users/${by}`).get();
    if (
      !userBy.exists ||
      !group
        .data()
        ['users'].map((e) => e.id)
        .includes(by)
    )
      return 'User is invalid';
    await group.ref.update({ ...changes });
    if (changes.name !== group.data()['name']) {
      await firestore.collection('notifications').add({
        users: group.data()['users'],
        title: 'Group modification',
        body: `Group ${group.data()['name']} has been renamed to ${
          changes.name
        }`,
        time: FieldValue.serverTimestamp(),
      });
      try {
        await fcm.sendEachForMulticast({
          tokens: group.data()['users'].flatMap((e) => e.data()['tokens']),
          notification: {
            title: 'Group modification',
            body: `Group ${group.data()['name']} has been renamed to ${
              changes.name
            }`,
          },
        });
      } catch {}
    }
    if (changes.desc !== group.data()['desc']) {
      await firestore.collection('notifications').add({
        users: group.data()['users'],
        title: 'Group modification',
        body: `Group ${
          group.data()['name']
        } has had its description changed to ${changes.desc}`,
        time: FieldValue.serverTimestamp(),
      });
      try {
        await fcm.sendEachForMulticast({
          tokens: group.data()['users'].flatMap((e) => e.data()['tokens']),
          notification: {
            title: 'Group modification',
            body: `Group ${
              group.data()['name']
            } has had its description changed to ${changes.desc}`,
          },
        });
      } catch {}
    }
  }

  @Patch('group/:id/change')
  async changeGroupUsers(
    @Param('id') id: string,
    @Query('type') type: 'add' | 'remove',
    @Query('user') user: string,
    @Query('by') by: string,
  ) {
    const group = await firestore.doc(`groups/${id}`).get();
    if (!group.exists) return 'Group does not exist';
    const userChanged = await firestore.doc(`users/${user}`).get();
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
    const userBy = await firestore.doc(`users/${by}`).get();
    if (!userBy.exists || group.data()['users'].includes(userBy.ref))
      return 'User by is invalid';
    await group.ref.update({
      users:
        type === 'add'
          ? FieldValue.arrayUnion(userChanged.ref)
          : FieldValue.arrayRemove(userChanged.ref),
    });
    await firestore.collection('notifications').add({
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
    await firestore.collection('notifications').add({
      users: [userChanged.ref],
      title: `${type === 'add' ? 'Addition to' : 'Removal from'} group`,
      body: `You have been ${
        type === 'add' ? 'added to' : 'removed from'
      } group ${group.data()['name']}`,
      time: FieldValue.serverTimestamp(),
    });
    try {
      await fcm.sendEachForMulticast({
        tokens: group.data()['users'].flatMap((e) => e.data()['tokens']),
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
    } catch {
      return 'Notification sending failed but update completed';
    }
    return 'User was removed from group';
  }

  @Delete('group/:id')
  async deleteGroup(@Param('id') id: string, @Query('by') by: string) {
    const group = await firestore.doc(`groups/${id}`).get();
    if (!group.exists) return 'Group does not exist';
    const userBy = await firestore.doc(`users/${by}`).get();
    if (
      !userBy.exists ||
      !group
        .data()
        ['users'].map((e) => e.path)
        .includes(userBy.ref.path)
    )
      return 'User by is invalid';
    await group.ref.delete();
    await firestore.collection('notifications').add({
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
    const group = await firestore.doc(`groups/${id}`).get();
    if (!group.exists) return 'Group does not exist';
    const user = await firestore.doc(`users/${uid}`).get();
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
    await firestore.collection('notifications').add({
      users: group.data()['users'],
      title: `${user.data()['name']}@${group.data()['name']}`,
      body: text,
      time: FieldValue.serverTimestamp(),
    });
    try {
      await fcm.sendEachForMulticast({
        tokens: group.data()['users'].flatMap((e) => e.data()['tokens']),
        notification: {
          title: `${user.data()['name']}@${group.data()['name']}`,
          body: text,
        },
      });
    } catch {
      return 'Notification sending failed but update completed';
    }
    return 'Message sent';
  }

  @Put('message')
  async newMessage(@Body() msg: Message) {
    const userFrom = await firestore.doc(`users/${msg.from}`).get();
    if (!userFrom.exists) return 'User from does not exist';
    const userTo = await firestore.doc(`users/${msg.to}`).get();
    if (!userTo.exists) return 'User to does not exist';
    const chatDocID = [msg.from, msg.to].sort().join();
    await firestore.collection(`121/${chatDocID}/messages`).add({
      from: userFrom.ref,
      to: userTo.ref,
      time: FieldValue.serverTimestamp(),
      text: msg.text,
    });
    await firestore.collection('notifications').add({
      users: [userTo.ref],
      title: `New message from ${userFrom.data()['name']}`,
      message: msg.text,
      time: FieldValue.serverTimestamp(),
    });
    try {  
      await fcm.sendEachForMulticast({
        tokens: userTo.data()['tokens'],
        notification: {
          title: `New message from ${userFrom.data()['name']}`,
          body: msg.text,
        },
      });
    } catch {
      return 'Notification sending failed but update completed';
    }
    return 'Message sent';
  }
}

interface Message {
  from: string;
  to: string;
  text: string;
}

interface GroupChanges {
  name: string;
  desc: string;
}
