import { Body, Controller, Query, Put } from '@nestjs/common';
import { firestore } from '../firebase/firebase';
import { auth } from '../firebase/firebase';

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
}

interface EmployeeDetails {
  name: string;
  email: string;
  department: string;
  password: string;
}
