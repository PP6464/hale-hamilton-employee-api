import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { cloud_firestore, fcm } from '../firebase/firebase';
import { DocumentReference } from 'firebase-admin/lib/firestore';
import { firestore } from 'firebase-admin';
import FieldValue = firestore.FieldValue;

function customIsValidDate(date: string) {
  const regex = '^\\d{4}-\\d{2}-\\d{2}$';
  if (!date.match(regex)) return false;
  const d = new Date(date);
  const dNum = d.getTime();
  if (!dNum && dNum !== 0) return false;
  return d.toISOString().slice(0, 10) === date;
}

@Controller('shift')
export class ShiftController {
  @Delete('delete/:id')
  async deleteShift(@Param('id') id: string, @Query('admin') admin: string) {
    const shiftData = await cloud_firestore.doc(`shifts/${id}`).get();
    if (!shiftData.exists) return 'Shift does not exist.';
    const employee = await (
      shiftData.data()['employee'] as DocumentReference
    ).get();
    if (!employee.exists) return 'Employee of shift does not exist';
    const adminData = await cloud_firestore.doc(`users/${admin}`).get();
    if (!adminData.exists) return 'Admin does not exist';
    const admins = await cloud_firestore
      .collection('users')
      .where('isAdmin', '==', true)
      .get();
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
    await fcm.sendEachForMulticast({
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
    await fcm.sendEachForMulticast({
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
    const employee = await cloud_firestore
      .doc(`users/${shiftDetails.employee}`)
      .get();
    if (!employee.exists) return 'Employee does not exist';
    const adminData = await cloud_firestore.doc(`users/${admin}`).get();
    if (!adminData.exists) return 'Admin does not exist';
    if (!customIsValidDate(shiftDetails.date)) return 'Invalid date format';
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
    const admins = await cloud_firestore
      .collection('users')
      .where('isAdmin', '==', true)
      .get();
    await cloud_firestore.collection('notifications').add({
      users: admins.docs.map((e) => e.ref),
      title: 'Shift addition',
      body: `Employee ${employee.id} (Name: ${
        employee.data()['name']
      }, Email: ${employee.data()['email']}) has had ${
        shiftDetails.time === 'morning' ? 'a morning' : 'an evening'
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
      body: `You've been added to ${
        shiftDetails.time === 'morning' ? 'a morning' : 'an evening'
      } shift by an administrator on ${shiftDetails.date
        .split('-')
        .reverse()
        .join('/')}.`,
    });
    await fcm.sendEachForMulticast({
      tokens: admins.docs.flatMap((e) => e.data()['tokens'] as string[]),
      notification: {
        title: 'Shift addition',
        body: `Employee ${employee.id} (Name: ${
          employee.data()['name']
        }, Email: ${employee.data()['email']}) has had ${
          shiftDetails.time === 'morning' ? 'a morning' : 'an evening'
        } shift added at ${shiftDetails.date
          .split('-')
          .reverse()
          .join('/')} by administrator ${
          admins.docs.filter((e) => e.id === admin)[0].data()['name']
        }`,
      },
    });
    await fcm.sendEachForMulticast({
      tokens: employee.data()['tokens'],
      notification: {
        title: 'Shift addition',
        body: `You've been added to ${
          shiftDetails.time === 'morning' ? 'a morning' : 'an evening'
        } shift by an administrator on ${shiftDetails.date
          .split('-')
          .reverse()
          .join('/')}.`,
      },
    });
    return 'Shift added';
  }

  @Patch('update/:id')
  async updateShift(
    @Param('id') id: string,
    @Query('admin') admin: string,
    @Body() shiftDetails: ShiftDetails,
  ) {
    const employee = await cloud_firestore
      .doc(`users/${shiftDetails.employee}`)
      .get();
    if (!employee.exists) return 'Employee does not exist';
    const adminData = await cloud_firestore.doc(`users/${admin}`).get();
    if (!adminData.exists) return 'Admin does not exist';
    if (!customIsValidDate(shiftDetails.date)) return 'Invalid date format';
    const oldShift = await cloud_firestore.doc(`shifts/${id}`).get();
    if (!oldShift.exists) return 'Shift does not exist';
    await cloud_firestore.doc(`shifts/${id}`).set({
      employee: cloud_firestore.doc(`users/${shiftDetails.employee}`),
      time: shiftDetails.time,
      date: shiftDetails.date,
    });
    await cloud_firestore.doc(`shifts/${id}`).set({
      type: 'PATCH',
      shiftTime: shiftDetails.time,
      shiftDate: shiftDetails.date,
      oldTime: oldShift.data()['time'],
      oldDate: oldShift.data()['date'],
      administrator: cloud_firestore.doc(`users/${admin}`),
      employee: cloud_firestore.doc(`users/${shiftDetails.employee}`),
      timestamp: FieldValue.serverTimestamp(),
    });
    const admins = await cloud_firestore
      .collection('users')
      .where('isAdmin', '==', true)
      .get();
    await cloud_firestore.collection('notifications').add({
      users: admins.docs.map((e) => e.ref),
      title: 'Shift rescheduling',
      body: `Employee ${employee.id} (Name: ${
        employee.data()['name']
      }, Email: ${employee.data()['email']}) has had ${
        oldShift.data()['time'] === 'morning' ? 'a morning' : 'an evening'
      } shift at ${oldShift
        .data()
        ['date'].split('-')
        .reverse()
        .join('/')} rescheduled to ${
        shiftDetails.time === 'morning' ? 'a morning' : 'an evening'
      } shift by administrator ${
        admins.docs.filter((e) => e.id === admin)[0].data()['name']
      }`,
    });
    await cloud_firestore.collection('notifications').add({
      users: [employee.ref],
      title: 'Shift rescheduling',
      body: `Your ${
        oldShift.data()['time'] === 'morning' ? 'a morning' : 'an evening'
      } shift on ${oldShift
        .data()
        ['date'].split('-')
        .reverse()
        .join('/')} has been rescheduled to ${
        shiftDetails.time === 'morning' ? 'a morning' : 'an evening'
      } shift by an administrator on ${shiftDetails.date
        .split('-')
        .reverse()
        .join('/')}.`,
    });
    await fcm.sendEachForMulticast({
      tokens: admins.docs.flatMap((e) => e.data()['tokens'] as string[]),
      notification: {
        title: 'Shift rescheduling',
        body: `Employee ${employee.id} (Name: ${
          employee.data()['name']
        }, Email: ${employee.data()['email']}) has had a ${
          oldShift.data()['time']
        } shift at ${oldShift
          .data()
          ['date'].split('-')
          .reverse()
          .join('/')} rescheduled to ${
          shiftDetails.time === 'morning' ? 'a morning' : 'an evening'
        } shift by administrator ${
          admins.docs.filter((e) => e.id === admin)[0].data()['name']
        }`,
      },
    });
    await fcm.sendEachForMulticast({
      tokens: employee.data()['tokens'],
      notification: {
        title: 'Shift rescheduling',
        body: `Your ${
          oldShift.data()['time'] === 'morning' ? 'a morning' : 'an evening'
        } shift on ${oldShift
          .data()
          ['date'].split('-')
          .reverse()
          .join('/')} has been rescheduled to ${
          shiftDetails.time === 'morning' ? 'a morning' : 'an evening'
        } shift by an administrator on ${shiftDetails.date
          .split('-')
          .reverse()
          .join('/')}.`,
      },
    });
    return 'Shift rescheduled';
  }
}

interface ShiftDetails {
  employee: string;
  time: 'morning' | 'evening';
  date: string;
}
