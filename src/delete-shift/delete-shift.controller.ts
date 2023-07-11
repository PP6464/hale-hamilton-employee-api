import { Controller, Delete, Param, Query } from '@nestjs/common';
import { cloud_firestore, fcm } from '../firebase/firebase';
import { DocumentReference } from 'firebase-admin/lib/firestore';

@Controller('delete-shift')
export class DeleteShiftController {
  @Delete('/:id')
  async deleteShift(@Param('id') id: string, @Query('admin') admin: string) {
    const shiftData = await cloud_firestore.doc(`shifts/${id}`).get();
    const admins = await cloud_firestore
      .collection('users')
      .where('isAdmin', '==', true)
      .get();
    const employee = await (
      shiftData.data()['employee'] as DocumentReference
    ).get();
    await shiftData.ref.delete();
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
          )} has been deleted by an administrator. Enjoy one less shift of work!`,
      },
    });
  }
}
