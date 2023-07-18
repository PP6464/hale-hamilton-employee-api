import { Body, Controller, Query, Put, Patch, Param } from '@nestjs/common';
import { firestore, auth, fcm } from '../firebase/firebase';

@Controller('auth')
export class AuthController {
  @Put('employee/new')
  async addNewEmployee(
    @Body() details: EmployeeDetails,
    @Query('by') by: string,
  ) {
    const adminBy = await firestore.doc(`users/${by}`).get();
    if (
      !adminBy.exists ||
      adminBy.data()?.['department'] !== details.department
    )
      return 'Invalid administrator';
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
}

interface EmployeeDetails {
  name: string;
  email: string;
  department: string;
  password: string;
}
