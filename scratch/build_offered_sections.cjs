const fs = require('fs');
const path = require('path');
const courses = require('../src/data/courses_plan12.json');

// Instructors pool
const instructors = [
  'د. سامر العلي', 'د. نور حداد', 'د. رامي منصور', 'د. فيصل الزعبي',
  'د. سهى المجالي', 'د. محمود عبيدات', 'د. بلال السعدي', 'د. عماد النجار',
  'د. علاء الرواشدة', 'د. هبة القاسم', 'د. طارق بني حمد', 'د. خالد المصري',
  'د. رانية حداد', 'د. حسام النعيمي', 'م. أسامة التميمي', 'م. ليلى الشريف',
  'م. روان الخطيب', 'م. زيد الكردي', 'م. دانية المجالي', 'م. أحمد الصالح'
];

// Specific known Section 1 timings for demo students to guarantee 0 conflicts
const specificSec1Timings = {
  // Student 1 (Year 4)
  '1505468': { days: 'الخميس (مشروع - يوم واحد)', daysArray: ['الخميس'], startTime: '13:00', endTime: '15:00', room: 'مبنى IT - مختبر الذكاء الاصطناعي 1', instructor: 'د. سامر العلي' },
  '1505461': { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '09:00', endTime: '10:00', room: 'مبنى IT - قاعة IT-201', instructor: 'د. نور حداد' },
  '1505415': { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '11:00', endTime: '12:00', room: 'مبنى IT - مدرج الخوارزمي', instructor: 'د. رامي منصور' },
  '1505441': { days: 'ن ر', daysArray: ['الاثنين', 'الأربعاء'], startTime: '08:30', endTime: '10:00', room: 'مبنى IT - قاعة IT-101', instructor: 'د. خلدون القضاة' },
  '1505480': { days: 'ن ر', daysArray: ['الاثنين', 'الأربعاء'], startTime: '10:00', endTime: '11:30', room: 'مبنى IT - قاعة IT-102', instructor: 'د. بلال السعدي' },

  // Student 2 (Year 3) & Student 3
  '1505311': { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '10:00', endTime: '11:00', room: 'مبنى IT - مدرج الخوارزمي', instructor: 'د. سامر العلي' },
  '1501222': { days: 'ن ر', daysArray: ['الاثنين', 'الأربعاء'], startTime: '11:30', endTime: '13:00', room: 'مبنى IT - قاعة IT-203', instructor: 'د. عماد النجار' },
  '1501340': { days: 'ن ر', daysArray: ['الاثنين', 'الأربعاء'], startTime: '10:00', endTime: '11:30', room: 'مبنى IT - قاعة IT-101', instructor: 'د. نور حداد' },
  '1505223': { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '12:00', endTime: '13:00', room: 'مبنى IT - مختبر الذكاء الاصطناعي 2', instructor: 'م. أسامة التميمي' },
  '0200215': { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '08:00', endTime: '09:00', room: 'مبنى العلوم - قاعة 104', instructor: 'د. فيصل الزعبي' },

  // Student 3 (Omar)
  '1506180': { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '09:00', endTime: '10:00', room: 'مبنى IT - قاعة IT-201', instructor: 'د. رانية حداد' },
  '1506181': { days: 'الأربعاء (لاب - يوم واحد)', daysArray: ['الأربعاء'], startTime: '14:30', endTime: '16:30', room: 'مبنى IT - مختبر البرمجيات 1', instructor: 'م. ليلى الشريف' },
  '0200106': { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '11:00', endTime: '12:00', room: 'مبنى الآداب - قاعة 302', instructor: 'د. سهى المجالي' },

  // Student 4 (Sara)
  '1501221': { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '08:00', endTime: '09:00', room: 'مبنى IT - مدرج ابن الهيثم', instructor: 'د. بلال السعدي' },
  '0300220': { days: 'ن ر', daysArray: ['الاثنين', 'الأربعاء'], startTime: '08:30', endTime: '10:00', room: 'مبنى العلوم - قاعة 201', instructor: 'د. علاء الرواشدة' },
  '1505101': { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '10:00', endTime: '11:00', room: 'مبنى IT - قاعة IT-101', instructor: 'د. سامر العلي' },
  '1505201': { days: 'ن ر', daysArray: ['الاثنين', 'الأربعاء'], startTime: '11:30', endTime: '13:00', room: 'مبنى IT - قاعة IT-203', instructor: 'د. رامي منصور' },
  '0200104': { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '12:00', endTime: '13:00', room: 'مبنى الخوارزمي - قاعة 101', instructor: 'د. فيصل الزعبي' },
  '0200153': { days: 'الخميس (نشاط - يوم واحد)', daysArray: ['الخميس'], startTime: '13:00', endTime: '15:00', room: 'المجمع الرياضي والصحي', instructor: 'د. طارق بني حمد' },

  // Student 5 (Yousef)
  '1501110': { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '09:00', endTime: '10:00', room: 'مبنى IT - مدرج الخوارزمي', instructor: 'د. نور حداد' },
  '1501111': { days: 'الاثنين (لاب - يوم واحد)', daysArray: ['الاثنين'], startTime: '14:30', endTime: '16:30', room: 'مبنى IT - مختبر البرمجيات 2', instructor: 'م. أسامة التميمي' },
  '0300153': { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '08:00', endTime: '09:00', room: 'مبنى العلوم - قاعة 101', instructor: 'د. علاء الرواشدة' },
  '0200110': { days: 'ن ر', daysArray: ['الاثنين', 'الأربعاء'], startTime: '10:00', endTime: '11:30', room: 'مبنى الهاشمي - مدرج 1', instructor: 'د. خالد المصري' },
  '0200105': { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '11:00', endTime: '12:00', room: 'مبنى الآداب - قاعة 302', instructor: 'د. محمود عبيدات' },
  '0400202': { days: 'ن ر', daysArray: ['الاثنين', 'الأربعاء'], startTime: '13:00', endTime: '14:30', room: 'مبنى الخوارزمي - قاعة 104', instructor: 'د. هبة القاسم' }
};

// Slots definition
const theorySlotsSunTueThu = [
  { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '08:00', endTime: '09:00' },
  { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '09:00', endTime: '10:00' },
  { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '10:00', endTime: '11:00' },
  { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '11:00', endTime: '12:00' },
  { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '12:00', endTime: '13:00' },
  { days: 'ح ث خ', daysArray: ['الأحد', 'الثلاثاء', 'الخميس'], startTime: '13:00', endTime: '14:00' }
];

const theorySlotsMonWed = [
  { days: 'ن ر', daysArray: ['الاثنين', 'الأربعاء'], startTime: '08:30', endTime: '10:00' },
  { days: 'ن ر', daysArray: ['الاثنين', 'الأربعاء'], startTime: '10:00', endTime: '11:30' },
  { days: 'ن ر', daysArray: ['الاثنين', 'الأربعاء'], startTime: '11:30', endTime: '13:00' },
  { days: 'ن ر', daysArray: ['الاثنين', 'الأربعاء'], startTime: '13:00', endTime: '14:30' },
  { days: 'ن ر', daysArray: ['الاثنين', 'الأربعاء'], startTime: '14:30', endTime: '16:00' }
];

const labSlots = [
  { days: 'الاثنين (لاب - يوم واحد)', daysArray: ['الاثنين'], startTime: '14:30', endTime: '16:30' },
  { days: 'الأربعاء (لاب - يوم واحد)', daysArray: ['الأربعاء'], startTime: '14:30', endTime: '16:30' },
  { days: 'الخميس (لاب - يوم واحد)', daysArray: ['الخميس'], startTime: '09:00', endTime: '11:00' },
  { days: 'الخميس (لاب - يوم واحد)', daysArray: ['الخميس'], startTime: '11:00', endTime: '13:00' },
  { days: 'الخميس (لاب - يوم واحد)', daysArray: ['الخميس'], startTime: '13:00', endTime: '15:00' },
  { days: 'الثلاثاء (لاب - يوم واحد)', daysArray: ['الثلاثاء'], startTime: '14:00', endTime: '16:00' }
];

const isLabCourse = (c) => c.credits === 1 || c.name.includes('مختبر') || c.learningType === 'عملي';

const allSections = [];

courses.forEach((course, cIdx) => {
  const isLab = isLabCourse(course);
  
  for (let secNum = 1; secNum <= 3; secNum++) {
    const secId = `SEC-${course.code}-${secNum}`;
    let slot = null;
    let instructor = instructors[(cIdx * 3 + secNum) % instructors.length];
    let room = isLab ? `مبنى IT - مختبر ${((cIdx + secNum) % 4) + 1}` : `مبنى IT - قاعة IT-${100 + ((cIdx * 2 + secNum) % 15)}`;

    if (secNum === 1 && specificSec1Timings[course.code]) {
      const sp = specificSec1Timings[course.code];
      slot = { days: sp.days, daysArray: sp.daysArray, startTime: sp.startTime, endTime: sp.endTime };
      if (sp.room) room = sp.room;
      if (sp.instructor) instructor = sp.instructor;
    } else {
      if (isLab) {
        slot = labSlots[(cIdx + secNum * 2) % labSlots.length];
      } else {
        // Alternate between ح ث خ and ن ر
        if (secNum === 1) {
          slot = theorySlotsSunTueThu[cIdx % theorySlotsSunTueThu.length];
        } else if (secNum === 2) {
          slot = theorySlotsMonWed[cIdx % theorySlotsMonWed.length];
        } else {
          // Sec 3
          slot = (cIdx % 2 === 0) 
            ? theorySlotsSunTueThu[(cIdx + 3) % theorySlotsSunTueThu.length]
            : theorySlotsMonWed[(cIdx + 2) % theorySlotsMonWed.length];
        }
      }
    }

    const capacity = isLab ? 25 : 45;
    const enrolled = secNum === 2 && (cIdx % 5 === 0) ? capacity : Math.floor(capacity * 0.6 + (cIdx % 10));
    const status = enrolled >= capacity ? 'ممتلئة' : 'متاحة';

    allSections.push({
      id: secId,
      courseCode: course.code,
      courseName: course.name,
      sectionNumber: secNum,
      credits: course.credits,
      instructor,
      days: slot.days,
      daysArray: slot.daysArray,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room,
      capacity,
      enrolled,
      status
    });
  }
});

console.log('Total generated sections:', allSections.length);

// Conflict checker function
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function checkConflict(secA, secB) {
  if (secA.id === secB.id) return false;
  const hasCommonDay = secA.daysArray.some(d => secB.daysArray.includes(d));
  if (!hasCommonDay) return false;
  const startA = timeToMinutes(secA.startTime);
  const endA = timeToMinutes(secA.endTime);
  const startB = timeToMinutes(secB.startTime);
  const endB = timeToMinutes(secB.endTime);
  return Math.max(startA, startB) < Math.min(endA, endB);
}

// Test demo students current registered sections for conflicts
const demoStudentsDefs = [
  { name: 'أحمد', codes: ['1505468', '1505461', '1505415', '1505441', '1505480'] },
  { name: 'ليان', codes: ['1505311', '1501222', '1501340', '1505223', '0200215'] },
  { name: 'عمر', codes: ['1501222', '1501340', '1506180', '1506181', '0200106'] },
  { name: 'سارة', codes: ['1501221', '0300220', '1505101', '1505201', '0200104', '0200153'] },
  { name: 'يوسف', codes: ['1501110', '1501111', '0300153', '0200110', '0200105', '0400202'] }
];

let allOk = true;
demoStudentsDefs.forEach(student => {
  const secs = student.codes.map(c => allSections.find(s => s.id === `SEC-${c}-1`));
  for (let i = 0; i < secs.length; i++) {
    for (let j = i + 1; j < secs.length; j++) {
      if (!secs[i] || !secs[j]) {
        console.error('Missing section for student', student.name);
        allOk = false;
        continue;
      }
      if (checkConflict(secs[i], secs[j])) {
        console.error(`Conflict for ${student.name}: ${secs[i].courseName} (${secs[i].startTime}-${secs[i].endTime}) vs ${secs[j].courseName} (${secs[j].startTime}-${secs[j].endTime}) on ${secs[i].daysArray.filter(d => secs[j].daysArray.includes(d))}`);
        allOk = false;
      }
    }
  }
});

if (allOk) {
  console.log('✓ All 5 demo students have ZERO schedule conflicts in their current registered schedules!');
}

// Write to src/data/offeredSections.ts
const tsContent = `import { CourseSection } from '../types/student';

export const offeredCourseSections: CourseSection[] = ${JSON.stringify(allSections, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, '../src/data/offeredSections.ts'), tsContent, 'utf8');
console.log('Successfully wrote src/data/offeredSections.ts with', allSections.length, 'sections!');
