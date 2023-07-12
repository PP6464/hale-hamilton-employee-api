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
  async newGroup(@Query('name') name: string, @Body() members: string[]) {}

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
