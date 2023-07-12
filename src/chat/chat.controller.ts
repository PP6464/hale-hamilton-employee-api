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
import { FieldValue } from 'firebase-admin/lib/firestore';

@Controller('chat')
export class ChatController {
  @Put('group/new')
  async newGroup(@Query('name') name: string, @Body() members: string[]) {
    const membersData = [];
    for (let i = 0; i < members.length; i++) {
      const member = await cloud_firestore.doc(`users/${members[i]}`).get();
      if (!member.exists) return 'One of the members does not exist';
      else membersData.concat(member);
    }
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
  async updateGroup(
    @Param('id') id: string,
    @Query('type') type: 'add' | 'remove',
    @Query('user') user: string,
    @Query('by') by: string,
  ) {}

  @Delete('group/:id')
  async deleteGroup(@Param('id') id: string, @Query('by') by: string) {}

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
