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

export type CourseType = 'Risk1' | 'Risk2' | 'Combo' | 'AM' | 'Intro' | 'Other' | (string & {});
export type VehicleType = 'Car' | 'Motorcycle' | 'Moped' | 'Other';

export interface Course {
  id: number;
  titleSv: string;
  titleEn: string;
  description: string;
  type: CourseType;
  vehicle: VehicleType;
  behorighet: string;
  price: number;
  location: string;
  receiptMessage?: string;
}

export interface SessionSchoolAllocation {
  schoolUserId: number;
  allocatedSeats: number;
  schoolUser?: { name: string };
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
  visibility: string;
  receiptMessage?: string;
  comboRisk1SessionId?: number | null;
  comboRisk2SessionId?: number | null;
  comboRisk1Session?: { id: number; startTime: string; endTime: string; course?: { titleSv: string; titleEn: string } } | null;
  comboRisk2Session?: { id: number; startTime: string; endTime: string; course?: { titleSv: string; titleEn: string } } | null;
  assignedSchoolUsers?: { id: number; name: string }[];
  schoolAllocations?: SessionSchoolAllocation[];
  myAllocation?: number | null;
}

export type BookingStatus = 'Pending' | 'Paid' | 'Canceled' | 'Confirmed';

export interface Booking {
  id: number;
  sessionId: number;
  session?: Session;
  userId?: number | null;
  user?: { name: string; email: string } | null;
  guestName?: string | null;
  personnummer?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  bookingTime: string;
  status: BookingStatus;
  bookedByRole?: string;
  bookedBySchoolUserId?: number | null;
  bookedBySchoolUser?: { name: string } | null;
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
