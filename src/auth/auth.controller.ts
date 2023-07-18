import { Body, Controller, Query, Put, Patch, Param, Delete } from '@nestjs/common';
import { firestore, auth, fcm } from '../firebase/firebase';
import { FieldValue } from 'firebase-admin/firestore';

@Controller('auth')
export class AuthController {
  @Put('employee/new')
  async addNewEmployee(
    @Body() details: EmployeeDetails,
    @Query('by') by: string,
  ) {
    const adminBy = await firestore.doc(`users/${by}`).get();
    console.log(details);
    console.log(details['department']);
    console.log(details.department);
    console.log(adminBy.data()['department']);
    if (
      !adminBy.exists ||
      adminBy.data()?.['department'] !== details.department
    )
      return 'Invalid administrator';
    const userAlreadyExistsCheck = await firestore.collection('users').where('email', '==', details.email).get();
    if (userAlreadyExistsCheck.docs.length > 0) {
      return 'Employee already exists';
    }
    const user = await auth.createUser({
      displayName: details.name,
      photoURL:
        'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
      email: details.email,
      password: details.password,
    });
    await firestore.doc(`users/${user.uid}`).set({
      name: details.name,
      userName: details.name,
      email: details.email,
      isAdmin: false,
      department: details.department,
    });
  }

  @Patch('employee/:uid/change')
  async resetPassword(
    @Param('uid') uid: string,
    @Query('pwd') pwd: string,
  ) {
    const user = await firestore.doc(`users/${uid}`).get();
    if (!user.exists || user.data()['isAdmin']) return 'Employee is invalid';
    if (pwd.length < 10) return 'Password must have at least 10 characters';
    await auth.updateUser(uid, {
      password: pwd,
    });
    await firestore.collection('notifications').add({
      users: [user.ref],
      title: 'Password reset',
      body: `Your password has been reset to ${pwd} by your department administrator`,
      time: FieldValue.serverTimestamp(),
    });
    try {
      await fcm.sendEachForMulticast({
        tokens: user.data()['tokens'],
        notification: {
          title: 'Password reset',
          body: `Your password has been reset to ${pwd} by your department administrator`,
        }
      });
    } catch {
      return 'Notification sending failed but update completed';
    }
  }

  @Delete('employee/:uid')
  async deleteEmployee(
    @Param('uid') uid: string,
    @Query('by') by: string,
  ) {
    const user = await firestore.doc(`users/${uid}`).get();
    const adminBy = await firestore.doc(`users/${by}`).get();
    if (!user.exists || user.data()['isAdmin']) return 'Invalid user';
    if (!adminBy.exists || !adminBy.data()['isAdmin']) return 'Invalid admin';
    const shifts = await firestore.collection('shifts').where('employee', '==', user.ref).get();
    for (let shift of shifts.docs) {
      await shift.ref.delete();
    }
    const admins = await firestore.collection('users').where('isAdmin', '==', true).get();
    await firestore.collection('notifications').add({
      users: admins.docs.map((e) => e.ref),
      title: 'Employee account deletion',
      body: `Employee ${uid} (Name: ${user.data()['name']}, Email: ${user.data()['email']}) has had their account deleted by administrator ${adminBy.data()['name']}`,
      time: FieldValue.serverTimestamp(),
    });
    await auth.deleteUser(uid);
    await user.ref.delete();
    try {
      await fcm.sendEachForMulticast({
        tokens: admins.docs.flatMap((e) => e.data()['tokens']),
        notification: {
          title: 'Employee account deletion',
          body: `Employee ${uid} (Name: ${user.data()['name']}, Email: ${user.data()['email']}) has had their account deleted by administrator ${adminBy.data()['name']}`,
        }
      });
    } catch {
      return 'Notification sending failed but update completed';
    }
    return 'Employee account deleted';
  }
}

interface EmployeeDetails {
  name: string;
  email: string;
  department: string;
  password: string;
}
