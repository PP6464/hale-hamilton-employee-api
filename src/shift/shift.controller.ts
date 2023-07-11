import { Body, Controller, Delete, Param, Put, Query } from '@nestjs/common';
import { cloud_firestore, fcm } from '../firebase/firebase';
import { DocumentReference } from 'firebase-admin/lib/firestore';
import { firestore } from 'firebase-admin';
import FieldValue = firestore.FieldValue;

@Controller('shift')
export class ShiftController {
  @Delete('delete/:id')
  async deleteShift(@Param('id') id: string, @Query('admin') admin: string) {
    const shiftData = await cloud_firestore.doc(`shifts/${id}`).get();
    const admins = await cloud_firestore
      .collection('users')
      .where('isAdmin', '==', true)
      .get();
    const employee = await (
      shiftData.data()['employee'] as DocumentReference
    ).get();
    await cloud_firestore.collection('changes').add({
      type: 'DELETE',
      employee: employee.ref,
      administrator: admins.docs.filter((e) => e.id === admin)[0].ref,
      shiftDate: shiftData.data()['date'],
      shiftTime: shiftData.data()['time'],
      timeStamp: FieldValue.serverTimestamp(),
    });
    await shiftData.ref.delete();
    await cloud_firestore.collection('notifications').add({
      users: admins.docs.map((e) => e.ref),
      title: 'Shift deletion',
      body: `Shift of employee ${employee.id} (Name: ${
        employee.data()['name']
      }, Email: ${employee.data()['email']}) at ${shiftData
        .data()
        ['date'].split('-')
        .reverse()
        .join('/')} in the ${
        shiftData.data()['time']
      } has been deleted by administrator ${
        admins.docs.filter((e) => e.id === admin)[0].data()['name']
      }`,
      time: FieldValue.serverTimestamp(),
    });
    await cloud_firestore.collection('notifications').add({
      users: [employee.ref],
      title: 'Shift deletion',
      body: `Your shift in the ${shiftData.data()['time']} at ${shiftData
        .data()
        ['date'].split('-')
        .reverse()
        .join(
          '/',
        )} has been deleted by an administrator. Enjoy one less shift of work! 👍`,
      time: FieldValue.serverTimestamp(),
    });
    await fcm.sendMulticast({
      tokens: admins.docs.map((e) => e.data()['tokens']).flatMap((e) => e),
      notification: {
        title: 'Shift deletion',
        body: `Shift of employee ${employee.id} (Name: ${
          employee.data()['name']
        }, Email: ${employee.data()['email']}) at ${shiftData
          .data()
          ['date'].split('-')
          .reverse()
          .join('/')} in the ${
          shiftData.data()['time']
        } has been deleted by administrator ${
          admins.docs.filter((e) => e.id === admin)[0].data()['name']
        }`,
      },
    });
    await fcm.sendMulticast({
      tokens: employee.data()['tokens'],
      notification: {
        title: 'Shift deletion',
        body: `Your shift in the ${shiftData.data()['time']} at ${shiftData
          .data()
          ['date'].split('-')
          .reverse()
          .join(
            '/',
          )} has been deleted by an administrator. Enjoy one less shift of work! 👍`,
      },
    });
    return 'Shift deleted';
  }

  @Put('add')
  async addShift(
    @Query('admin') admin: string,
    @Body() shiftDetails: ShiftDetails,
  ) {
    await cloud_firestore.collection('shifts').add({
      employee: cloud_firestore.doc(`users/${shiftDetails.employee}`),
      time: shiftDetails.time,
      date: shiftDetails.date,
    });
    await cloud_firestore.collection('changes').add({
      type: 'PUT',
      shiftTime: shiftDetails.time,
      shiftDate: shiftDetails.date,
      administrator: cloud_firestore.doc(`users/${admin}`),
      employee: cloud_firestore.doc(`users/${shiftDetails.employee}`),
      timestamp: FieldValue.serverTimestamp(),
    });
    const employee = await cloud_firestore
      .doc(`users/${shiftDetails.employee}`)
      .get();
    const admins = await cloud_firestore
      .collection('users')
      .where('isAdmin', '==', true)
      .get();
    await cloud_firestore.collection('notifications').add({
      users: admins.docs.map((e) => e.ref),
      title: 'Shift addition',
      body: `Employee ${employee.id} (Name: ${
        employee.data()['name']
      }, Email: ${employee.data()['email']}) has had a ${
        shiftDetails.time
      } shift added at ${shiftDetails.date
        .split('-')
        .reverse()
        .join('/')} by administrator ${
        admins.docs.filter((e) => e.id === admin)[0].data()['name']
      }`,
    });
    await cloud_firestore.collection('notifications').add({
      users: [employee.ref],
      title: 'Shift addition',
      body: `You've been added to a ${
        shiftDetails.time
      } shift by an administrator on ${shiftDetails.date
        .split('-')
        .reverse()
        .join('/')}.`,
    });
    await fcm.sendMulticast({
      tokens: admins.docs.flatMap((e) => e.data()['tokens'] as string[]),
      notification: {
        title: 'Shift addition',
        body: `Employee ${employee.id} (Name: ${
          employee.data()['name']
        }, Email: ${employee.data()['email']}) has had a ${
          shiftDetails.time
        } shift added at ${shiftDetails.date
          .split('-')
          .reverse()
          .join('/')} by administrator ${
          admins.docs.filter((e) => e.id === admin)[0].data()['name']
        }`,
      },
    });
    await fcm.sendMulticast({
      tokens: employee.data()['tokens'],
      notification: {
        title: 'Shift addition',
        body: `You've been added to a ${
          shiftDetails.time
        } shift by an administrator on ${shiftDetails.date
          .split('-')
          .reverse()
          .join('/')}.`,
      },
    });
    return 'Shift added';
  }
}

interface ShiftDetails {
  employee: string;
  time: string;
  date: string;
}
