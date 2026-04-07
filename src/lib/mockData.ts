import type { Course, School, Session, Booking, User } from './types';

export const mockSchools: School[] = [
  { id: 1, name: 'Uppsala Halkbana', address: 'Industrigatan 12, 753 30 Uppsala', contactEmail: 'info@uppsalahalkbana.se' },
  { id: 2, name: 'Uppsala Trafikcenter', address: 'Storgatan 5, 753 20 Uppsala', contactEmail: 'kontakt@uppsalatrafikcenter.se' },
];

export const mockCourses: Course[] = [
  {
    id: 1,
    titleSv: 'Risk 1 – Bil',
    titleEn: 'Risk 1 – Car',
    description: 'Teoretisk utbildning om alkohol, droger och trötthet i trafiken.',
    type: 'Risk1',
    vehicle: 'Car',
    behorighet: 'B',
    price: 1500,
  },
  {
    id: 2,
    titleSv: 'Risk 2 – Bil',
    titleEn: 'Risk 2 – Car',
    description: 'Praktisk körning på halkbana – lär dig hantera bilen i svåra vägförhållanden.',
    type: 'Risk2',
    vehicle: 'Car',
    behorighet: 'B',
    price: 2500,
  },
  {
    id: 3,
    titleSv: 'Risk 1 – Motorcykel',
    titleEn: 'Risk 1 – Motorcycle',
    description: 'Teoretisk riskutbildning för motorcykelförare.',
    type: 'Risk1',
    vehicle: 'Motorcycle',
    behorighet: 'A',
    price: 1500,
  },
  {
    id: 4,
    titleSv: 'Risk 2 – Motorcykel',
    titleEn: 'Risk 2 – Motorcycle',
    description: 'Praktisk körning på halkbana för motorcykelförare.',
    type: 'Risk2',
    vehicle: 'Motorcycle',
    behorighet: 'A',
    price: 2800,
  },
];

export const mockSessions: Session[] = [
  {
    id: 1,
    courseId: 1,
    course: mockCourses[0],
    schoolId: 1,
    school: mockSchools[0],
    startTime: '2026-04-10T09:00:00',
    endTime: '2026-04-10T12:00:00',
    seatLimit: 20,
    seatsAvailable: 8,
    visibility: 'public',
  },
  {
    id: 2,
    courseId: 2,
    course: mockCourses[1],
    schoolId: 1,
    school: mockSchools[0],
    startTime: '2026-04-12T10:00:00',
    endTime: '2026-04-12T16:00:00',
    seatLimit: 15,
    seatsAvailable: 3,
    visibility: 'public',
  },
  {
    id: 3,
    courseId: 3,
    course: mockCourses[2],
    schoolId: 2,
    school: mockSchools[1],
    startTime: '2026-04-15T13:00:00',
    endTime: '2026-04-15T17:00:00',
    seatLimit: 12,
    seatsAvailable: 0,
    visibility: 'public',
  },
  {
    id: 4,
    courseId: 4,
    course: mockCourses[3],
    schoolId: 1,
    school: mockSchools[0],
    startTime: '2026-04-18T08:00:00',
    endTime: '2026-04-18T14:00:00',
    seatLimit: 10,
    seatsAvailable: 6,
    visibility: 'public',
  },
  {
    id: 5,
    courseId: 1,
    course: mockCourses[0],
    schoolId: 2,
    school: mockSchools[1],
    startTime: '2026-04-22T09:00:00',
    endTime: '2026-04-22T12:00:00',
    seatLimit: 20,
    seatsAvailable: 15,
    visibility: 'public',
  },
  {
    id: 6,
    courseId: 2,
    course: mockCourses[1],
    schoolId: 2,
    school: mockSchools[1],
    startTime: '2026-04-25T10:00:00',
    endTime: '2026-04-25T16:00:00',
    seatLimit: 15,
    seatsAvailable: 11,
    visibility: 'public',
  },
];

export const mockUser: User = {
  id: 42,
  name: 'Anna Svensson',
  email: 'anna@example.se',
  role: 'student',
  languagePref: 'sv',
};

export const mockBookings: Booking[] = [
  {
    id: 101,
    sessionId: 1,
    session: mockSessions[0],
    userId: 42,
    bookingTime: '2026-03-20T14:32:00',
    status: 'Paid',
  },
  {
    id: 102,
    sessionId: 2,
    session: mockSessions[1],
    userId: 42,
    bookingTime: '2026-03-21T09:15:00',
    status: 'Paid',
  },
];

export const adminStats = {
  totalBookings: 247,
  revenue: 512300,
  upcomingSessions: 14,
  totalStudents: 198,
};
