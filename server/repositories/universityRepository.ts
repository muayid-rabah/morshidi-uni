import type { CourseSection, StudentProfile } from '../../src/types/student';
import type { CalendarState, GradeInput, UniEvent, UniEventType } from '../store';

export interface DeliveryEventRow {
  cursor: number;
  id: string;
  event_type: UniEventType;
  version: number;
  occurred_at: string;
  student_id: string | null;
  payload_json: string;
  idempotency_key: string;
  attempts: number;
}

export interface RegisterSectionsResult {
  event: UniEvent;
  duplicate: boolean;
  sections: CourseSection[];
  changedSections?: Array<{ id: string; enrolled: number }>;
}

export interface UpdateOfferingResult {
  section: Record<string, unknown> | null;
  event: UniEvent;
  duplicate: boolean;
}

export type OfferingAction = 'update' | 'open' | 'close' | 'fill';

export interface UniversityRepository {
  getCalendar(): Promise<CalendarState>;
  hasAcademicData(): Promise<boolean>;
  getAcademicDates(): Promise<Record<string, unknown>[]>;
  getStudent(studentId: string): Promise<StudentProfile | null>;
  getStudentRecord(studentId: string): Promise<Record<string, unknown> | null>;
  listStudents(): Promise<StudentProfile[]>;
  listCourses(): Promise<Record<string, unknown>[]>;
  getCourse(courseCode: string): Promise<Record<string, unknown> | null>;
  listOfferings(termCode?: string): Promise<Record<string, unknown>[]>;
  cursor(): Promise<number>;
  eventsSince(since: number, limit?: number): Promise<UniEvent[]>;
  deliveryBatch(): Promise<DeliveryEventRow[]>;

  postGrade(input: GradeInput): Promise<{ event: UniEvent; duplicate: boolean }>;
  createStudent(profile: StudentProfile, idempotencyKey?: string): Promise<UniEvent>;
  updateStudentPlan(studentId: string, studyPlan: string, idempotencyKey?: string): Promise<UniEvent>;
  updateStudentSchedule(
    studentId: string,
    sections: StudentProfile['currentRegisteredSections'],
    idempotencyKey?: string,
  ): Promise<UniEvent>;
  registerSections(studentId: string, sectionIds: string[], idempotencyKey?: string): Promise<RegisterSectionsResult>;
  setRegistration(
    open: boolean,
    start?: string | null,
    end?: string | null,
    idempotencyKey?: string,
  ): Promise<{ calendar: CalendarState; event: UniEvent }>;
  updateOffering(
    sectionId: string,
    patch: Record<string, unknown>,
    action: OfferingAction,
    idempotencyKey?: string,
  ): Promise<UpdateOfferingResult>;
  markDelivery(cursor: number, status: number | null, delivered: boolean): Promise<void>;
  close(): Promise<void>;
}
