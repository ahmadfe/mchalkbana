export type UserRole = 'admin' | 'school' | 'student' | 'guest';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  schoolId?: number;
  languagePref: 'sv' | 'en';
}

export interface School {
  id: number;
  name: string;
  address: string;
  contactEmail: string;
}

export type CourseType = 'Risk1' | 'Risk2';
export type VehicleType = 'Car' | 'Motorcycle';

export interface Course {
  id: number;
  titleSv: string;
  titleEn: string;
  description: string;
  type: CourseType;
  vehicle: VehicleType;
  price: number;
}

export interface Session {
  id: number;
  courseId: number;
  course?: Course;
  schoolId: number;
  school?: School;
  startTime: string;
  endTime: string;
  seatLimit: number;
  seatsAvailable: number;
}

export type BookingStatus = 'Pending' | 'Paid' | 'Canceled';

export interface Booking {
  id: number;
  sessionId: number;
  session?: Session;
  userId: number;
  bookingTime: string;
  status: BookingStatus;
}

export type PaymentStatus = 'Succeeded' | 'Failed' | 'Pending';
export type PaymentProvider = 'Stripe' | 'Swish' | 'ApplePay';

export interface Payment {
  id: number;
  bookingId: number;
  amount: number;
  provider: PaymentProvider;
  status: PaymentStatus;
  transactionId: string;
}
