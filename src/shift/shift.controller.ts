import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Put,
  Post,
  Query,
} from '@nestjs/common';
import { cloud_firestore, fcm } from '../firebase/firebase';
import { DocumentReference } from 'firebase-admin/lib/firestore';
import { firestore } from 'firebase-admin';
import FieldValue = firestore.FieldValue;

function isValidDateYYYYMMDD(date: string) {
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
      timestamp: FieldValue.serverTimestamp(),
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
      } has been deleted by administrator ${adminData.data()['name']}`,
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
      tokens: admins.docs.flatMap((e) => e.data()['tokens']),
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
    if (!isValidDateYYYYMMDD(shiftDetails.date)) return 'Invalid date format';
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
      time: FieldValue.serverTimestamp(),
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
      time: FieldValue.serverTimestamp(),
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
    const oldShift = await cloud_firestore.doc(`shifts/${id}`).get();
    if (!oldShift.exists) return 'Shift does not exist';
    const employee = await cloud_firestore
      .doc(`users/${shiftDetails.employee}`)
      .get();
    if (
      !employee.exists ||
      employee.ref.path !== oldShift.data()['employee'].path
    )
      return 'Employee is invalid';
    const adminData = await cloud_firestore.doc(`users/${admin}`).get();
    if (!adminData.exists) return 'Admin does not exist';
    if (!isValidDateYYYYMMDD(shiftDetails.date)) return 'Invalid date format';
    await cloud_firestore.doc(`shifts/${id}`).set({
      employee: cloud_firestore.doc(`users/${shiftDetails.employee}`),
      time: shiftDetails.time,
      date: shiftDetails.date,
    });
    await cloud_firestore.collection(`changes`).add({
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
      time: FieldValue.serverTimestamp(),
    });
    await cloud_firestore.collection('notifications').add({
      users: [employee.ref],
      title: 'Shift rescheduling',
      body: `Your ${oldShift.data()['time']} shift on ${oldShift
        .data()
        ['date'].split('-')
        .reverse()
        .join('/')} has been rescheduled to ${
        shiftDetails.time === 'morning' ? 'a morning' : 'an evening'
      } shift on ${shiftDetails.date
        .split('-')
        .reverse()
        .join('/')} by an administrator.`,
      time: FieldValue.serverTimestamp(),
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
        body: `Your ${oldShift.data()['time']} shift on ${oldShift
          .data()
          ['date'].split('-')
          .reverse()
          .join('/')} has been rescheduled to ${
          shiftDetails.time === 'morning' ? 'a morning' : 'an evening'
        } shift on ${shiftDetails.date
          .split('-')
          .reverse()
          .join('/')} by an administrator.`,
      },
    });
    return 'Shift rescheduled';
  }

  @Post('request/update/:id')
  async requestShiftUpdate(
    @Param('id') id: string,
    @Body() shiftDetails: ShiftDetails,
  ) {
    const shift = await cloud_firestore.doc(`shifts/${id}`).get();
    if (!shift.exists) return 'Shift does not exist';
    if (!isValidDateYYYYMMDD(shiftDetails.date))
      return 'Shift date format is not valid';
    const employee = await cloud_firestore
      .doc(`users/${shiftDetails.employee}`)
      .get();
    if (!employee.exists || employee.ref.path !== shift.data()['employee'].path)
      return 'Employee is invalid';
    const admins = await cloud_firestore
      .collection('users')
      .where('isAdmin', '==', true)
      .get();
    await cloud_firestore.collection('notifications').add({
      users: admins.docs.map((e) => e.ref),
      title: 'Shift reschedule request',
      body: `Employee ${employee.id} (Name: ${
        employee.data()['name']
      }, Email: ${employee.data()['email']}) has requested to have their ${
        shift.data()['time']
      } shift on ${shift
        .data()
        ['date'].split('-')
        .reverse()
        .join('/')} rescheduled to be in the ${
        shiftDetails.time
      } on ${shiftDetails.date.split('-').reverse().join('/')}`,
      time: FieldValue.serverTimestamp(),
    });
    await fcm.sendEachForMulticast({
      tokens: admins.docs.flatMap((e) => e.data()['tokens']),
      notification: {
        title: 'Shift reschedule request',
        body: `Employee ${employee.id} (Name: ${
          employee.data()['name']
        }, Email: ${employee.data()['email']}) has requested to have their ${
          shift.data()['time']
        } shift on ${shift
          .data()
          ['date'].split('-')
          .reverse()
          .join('/')} rescheduled to be in the ${
          shiftDetails.time
        } on ${shiftDetails.date.split('-').reverse().join('/')}`,
      },
    });
    return 'Shift request sent';
  }

  @Post('request/add')
  async requestNewShift(@Body() shiftDetails: ShiftDetails) {
    const employee = await cloud_firestore
      .doc(`users/${shiftDetails.employee}`)
      .get();
    if (!employee.exists) return 'Employee is invalid';
    if (!isValidDateYYYYMMDD(shiftDetails.date))
      return 'Date format is invalid';
    const admins = await cloud_firestore
      .collection('users')
      .where('isAdmin', '==', true)
      .get();
    await cloud_firestore.collection('notifications').add({
      users: admins.docs.map((e) => e.ref),
      title: 'Shift addition request',
      body: `Employee ${employee.id} (Name: ${
        employee.data()['name']
      }, Email: ${employee.data()['email']}) has requested a new ${
        shiftDetails.time
      } shift on ${shiftDetails.date.split('-').reverse().join('/')}`,
      time: FieldValue.serverTimestamp(),
    });
    await fcm.sendEachForMulticast({
      tokens: admins.docs.flatMap((e) => e.data()['tokens']),
      notification: {
        title: 'Shift addition request',
        body: `Employee ${employee.id} (Name: ${
          employee.data()['name']
        }, Email: ${employee.data()['email']}) has requested a new ${
          shiftDetails.time
        } shift on ${shiftDetails.date.split('-').reverse().join('/')}`,
      },
    });
  }

  @Post('request/delete/:id')
  async requestDeleteShift(@Param('id') id: string, @Query('by') by: string) {
    const shift = await cloud_firestore.doc(`shifts/${id}`).get();
    if (!shift.exists) return 'Shift does not exist';
    const employeeBy = await cloud_firestore.doc(`users/${by}`).get();
    if (
      !employeeBy.exists ||
      employeeBy.ref.path !== shift.data()['employee'].path
    )
      return 'Employee is invalid';
    const admins = await cloud_firestore
      .collection('users')
      .where('isAdmin', '==', true)
      .get();
    await cloud_firestore.collection('notifications').add({
      users: admins.docs.map((e) => e.ref),
      title: 'Shift deletion request',
      body: `Employee ${employeeBy.id} (Name: ${
        employeeBy.data()['name']
      }, Email: ${employeeBy.data()['email']}) has requested to delete their ${
        shift.data()['time']
      } shift on ${shift.data()['date'].split('-').reverse().join('/')}`,
      time: FieldValue.serverTimestamp(),
    });
    await fcm.sendEachForMulticast({
      tokens: admins.docs.flatMap((e) => e.data()['tokens']),
      notification: {
        title: 'Shift deletion request',
        body: `Employee ${employeeBy.id} (Name: ${
          employeeBy.data()['name']
        }, Email: ${
          employeeBy.data()['email']
        }) has requested to delete their ${
          shift.data()['time']
        } shift on ${shift.data()['date'].split('-').reverse().join('/')}`,
      },
    });
  }
}

interface ShiftDetails {
  employee: string;
  time: 'morning' | 'evening';
  date: string;
}
