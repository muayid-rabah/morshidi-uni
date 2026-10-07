import type { StudentProfile } from '../../src/types/student';
import { UniversityStore, type GradeInput } from '../store';
import type {
  OfferingAction,
  RegisterSectionsResult,
  UniversityRepository,
  UpdateOfferingResult,
} from './universityRepository';

/** Async adapter around the unchanged synchronous SQLite rollback implementation. */
export class SQLiteUniversityRepository implements UniversityRepository {
  constructor(readonly store: UniversityStore) {}

  getCalendar() { return Promise.resolve(this.store.getCalendar()); }
  hasAcademicData() { return Promise.resolve(this.store.hasAcademicData()); }
  getAcademicDates() { return Promise.resolve(this.store.getAcademicDates()); }
  getStudent(studentId: string) { return Promise.resolve(this.store.getStudent(studentId)); }
  getStudentRecord(studentId: string) { return Promise.resolve(this.store.getStudentRecord(studentId)); }
  listStudents() { return Promise.resolve(this.store.listStudents()); }
  listCourses() { return Promise.resolve(this.store.listCourses()); }
  getCourse(courseCode: string) { return Promise.resolve(this.store.getCourse(courseCode)); }
  listOfferings(termCode?: string) { return Promise.resolve(this.store.listOfferings(termCode)); }
  cursor() { return Promise.resolve(this.store.cursor()); }
  eventsSince(since: number, limit = 250) { return Promise.resolve(this.store.eventsSince(since, limit)); }
  deliveryBatch() { return Promise.resolve(this.store.deliveryBatch()); }

  async postGrade(input: GradeInput) { return this.store.postGrade(input); }
  async createStudent(profile: StudentProfile, idempotencyKey?: string) {
    return this.store.createStudent(profile, idempotencyKey);
  }
  async updateStudentPlan(studentId: string, studyPlan: string, idempotencyKey?: string) {
    return this.store.updateStudentPlan(studentId, studyPlan, idempotencyKey);
  }
  async updateStudentSchedule(
    studentId: string,
    sections: StudentProfile['currentRegisteredSections'],
    idempotencyKey?: string,
  ) {
    return this.store.updateStudentSchedule(studentId, sections, idempotencyKey);
  }
  async registerSections(
    studentId: string,
    sectionIds: string[],
    idempotencyKey?: string,
  ): Promise<RegisterSectionsResult> {
    return this.store.registerSections(studentId, sectionIds, idempotencyKey);
  }
  async setRegistration(open: boolean, start?: string | null, end?: string | null, idempotencyKey?: string) {
    return this.store.setRegistration(open, start, end, idempotencyKey);
  }
  async updateOffering(
    sectionId: string,
    patch: Record<string, unknown>,
    action: OfferingAction,
    idempotencyKey?: string,
  ): Promise<UpdateOfferingResult> {
    return this.store.updateOffering(sectionId, patch, action, idempotencyKey);
  }
  async markDelivery(cursor: number, status: number | null, delivered: boolean) {
    this.store.markDelivery(cursor, status, delivered);
  }
  async close() { this.store.close(); }
}
