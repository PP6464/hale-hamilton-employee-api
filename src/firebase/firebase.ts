import admin from 'firebase-admin';
import { ConfigModule } from '@nestjs/config';

ConfigModule.forRoot();

const pk =
  '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC0JjJRzrm8iZ1Z\nqBNJyiDK8/yBEWRm/LpE5XrquCK4xZ1JzHQIGXJPp3YZMjlN2HxRWLhMc/weDvcJ\nYfxxKSMevxD5JfanNEh7/HIpZ85KRIwYDgwd2PqosFUQw3uOclUhln38bdL3FiyE\n/ckgEIbj12Ds4tHiiwIPZo5VS386MvFCmy/tGCUcjPJB0+DBZotu0tYwd/KHOKzl\nDmv+Xuq9xVbMXyFBW5RUvBp0VGpdN+LiFDHULC9hN5y9UO3QLVrFBoHkjdyZO4Jn\nNiQLMEWbo/d0yFusJF9hNYzqToxVsjw+HHCvRwIyYko6mifXHq1/0C9PoSEomUUj\nWMeggyWJAgMBAAECggEAROpjz5XkyfJfJoA8uLrBZsKFsx5jKV6/J0IejpJYfhTj\nAetb7AlICJ7IeAUVlOkfTcNB5cVtClaxPH6moueYztdK9/UE8Zv3qq69QYe7i//D\nFCSzj+uEoGmscRhHOQwV8x5uHdYpoWpzJ4EqosCPybOIGbb/kcmZxSh3hLu39RwJ\ni/ilPM+i249yIYs6fCj2l1BL6TFBR3L9WtVLp0FX5yOnq0q3a55Rtin28ngUDy5C\nkPvH3MYw8HUGlQ1RD+P7FkN+PhOqTv883edsfuSc6JC78ltcmKZ5vfj6dBFsoySO\n/oYlRiJwV0OmbQmCRzgNgXOmSQXbL69Xqj90zdeBfQKBgQDZMttJHXQApRtOBphj\nfFJfV9eAvikkIL0O6DttLm9iICyVC3ggpMv5136mbgvPRrgzrWBIyeK16TUh4Ecj\n0I8X21/VDZPcx3foeCZstfqhDG232lOZksonwwCogZ09xWZvIiIL9ofRaztWji0M\nSCNvZLXv/8z7zi8FNTUp1IP5GwKBgQDUVPUzbgZ6TvbjVeEhw909VVTPe8BWafOu\nGjRvGNUA/PjS6zPdEEuLNWiyF8Ee8JzZf1I7w5iAFs/AU/y6X6G+WdqVLM+pGc6r\n4iGcqJIv6DmP0e3m6Nlz2R3h6sBZx54HbGiiKyn+JQWgVaTBH1nz024P2B+qEfum\nmySTYOvKKwKBgAsqUx2CFxmFY07yhdjvZiiikmB65hCGYlGm3I8zSOSJdOFAkq9S\n6W1xh4A0vgSsxQFbE00Km83wLBwOtHmB2ilGzLleFlDOLDrWGluSS00GH4nI/m0x\nn5TFsH35E8U+JZLm9UsaJEc+tPExI92yw6eRTM0GoFn9cmtZHd+FnjcrAoGAIOAC\nkvLvF9LQEQTD9blgsNVcaz+K2RZQf11ZTvY2TI/earG19v1F5Qjg6+oXoZW5g0de\nURiIrRRbGDkowSZ7YYCCAmTMxi7Tu/MoJxxGfhpjhywGvKDCwlgUc10oaP4qLpYP\nYURznQDYbSm1d51GDSVoPhXFWUytfO86a4MvHr8CgYEAkGj+oDQ3JEfuxw2/CUbp\nJ23WSLGR/pjuV8jGgRmsPyYwwmzoWXC0AJGGHoU4MkO2mkK3kJB/HGrrOuwaWfig\nQAk8LA4u6MiCvXwhQm1v93vPpnEsESyf58UflEYQCQaOIC9k41dM36zf+DNLWVg+\nC7hkiGRjG4WzzuQfkyEQiSU=\n-----END PRIVATE KEY-----\n';

const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.SERVICE_ACCOUNT_PROJECT_ID,
    privateKey: pk,
    clientEmail: process.env.SERVICE_ACCOUNT_CLIENT_EMAIL,
  }),
});

export const fcm = admin.messaging(app);
export const firestore = admin.firestore(app);
export const auth = admin.auth(app);
