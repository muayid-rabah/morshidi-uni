import { StudentProfile, PlanCourse } from '../types/student';
import {
  planCourses,
  calculateStudentProgress,
  getRegistrationEligibility,
  getCourseStatusForStudent,
} from './academicEngine';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedActions?: { label: string; action: string }[];
}

export function generateAssistantResponse(
  question: string,
  student: StudentProfile
): string {
  const normalizedQ = question.trim().toLowerCase();
  const progress = calculateStudentProgress(student);

  // 1. "ما المواد التي أستطيع تسجيلها؟" / Eligible courses to register
  if (
    normalizedQ.includes('أستطيع تسجيلها') ||
    normalizedQ.includes('اقدر اسجل') ||
    normalizedQ.includes('المواد المتاحة للتسجيل') ||
    normalizedQ.includes('شو بنزل') ||
    normalizedQ.includes('شو انزل')
  ) {
    const eligibleCourses: PlanCourse[] = [];
    const reviewCourses: PlanCourse[] = [];

    for (const course of planCourses) {
      const eligibility = getRegistrationEligibility(course.code, student);
      if (eligibility.state === 'ELIGIBLE') {
        eligibleCourses.push(course);
      } else if (eligibility.state === 'REVIEW_REQUIRED') {
        reviewCourses.push(course);
      }
    }

    let response = `مرحباً يا **${student.name}**! بناءً على سجلك الأكاديمي المحدث في **خطة 12 (الذكاء الاصطناعي)** واستيفاء المتطلبات السابقة:\n\n`;
    response += `### 🟢 المواد المتاحة لك للتسجيل حالياً (${eligibleCourses.length} مادة):\n`;

    const topEligible = eligibleCourses.slice(0, 7);
    topEligible.forEach(c => {
      response += `- **${c.code}** - ${c.name} (${c.credits} ساعات) - *${c.group}*\n`;
    });

    if (eligibleCourses.length > 7) {
      response += `*...وغيرها ${eligibleCourses.length - 7} مادة متوفرة في صفحة التسجيل والمواد المطروحة.*\n\n`;
    }

    if (reviewCourses.length > 0) {
      response += `\n### ⚠️ مواد تتطلب مراجعة أكاديمية (${reviewCourses.length}):\n`;
      reviewCourses.forEach(c => {
        response += `- **${c.code}** - ${c.name}: ${c.reviewReason || 'تحتاج اعتماد معادلة المتطلب السابق مع المرشد الأكاديمي'}\n`;
      });
    }

    response += `\n💡 *ملاحظة تذكيرية:* الحد الأقصى للتسجيل هو **18 ساعة معتمدة**، ويُنصح بمراعاة تسلسل مواد التخصص.`;
    return response;
  }

  // 2. "كم ساعة بقيت لي؟" / "كم ساعة أنجزت؟" / Hours & Progress
  if (
    normalizedQ.includes('كم ساعة بقيت') ||
    normalizedQ.includes('كم ساعة باقي') ||
    normalizedQ.includes('ساعات متبقية') ||
    normalizedQ.includes('تخرجي') ||
    normalizedQ.includes('نسبة الانجاز')
  ) {
    return `تفاصيل تقدمك في الخطة الدراسية (132 ساعة إجمالية):\n\n` +
      `- **الساعات المنجزة بنجاح:** ${progress.totalCompletedHours} ساعة (${progress.completionPercentage}% من الخطة)\n` +
      `- **الساعات المسجلة حالياً:** ${progress.currentRegisteredHours} ساعة\n` +
      `- **الساعات المتبقية للتخرج:** **${progress.remainingHours} ساعة**\n\n` +
      `### توزيع الساعات المنجزة حسب المجموعات:\n` +
      `- متطلبات الجامعة الإجبارية: ${progress.groupCompletedHours['متطلبات الجامعة الإجبارية']} / 18 ساعة\n` +
      `- متطلبات الجامعة الاختيارية: ${progress.groupCompletedHours['متطلبات الجامعة الاختيارية']} / 9 ساعات\n` +
      `- متطلبات الكلية الإجبارية: ${progress.groupCompletedHours['متطلبات الكلية الإجبارية']} / 21 ساعة\n` +
      `- المتطلبات المساندة: ${progress.groupCompletedHours['المتطلبات المساندة']} / 12 ساعة\n` +
      `- متطلبات التخصص الإجبارية: ${progress.groupCompletedHours['متطلبات التخصص الإجبارية']} / 63 ساعة\n` +
      `- متطلبات التخصص الاختيارية: ${progress.groupCompletedHours['متطلبات التخصص الاختيارية']} / 9 ساعات`;
  }

  // 3. "ما المواد التي أنجزتها؟" / Completed courses
  if (
    normalizedQ.includes('المواد التي أنجزتها') ||
    normalizedQ.includes('المواد المنجزة') ||
    normalizedQ.includes('شو خلصت') ||
    normalizedQ.includes('المواد الناجح فيها')
  ) {
    if (student.completedCourses.length === 0) {
      return `أهلاً بك يا ${student.name}! أنت مسجل كطالب مستجد في عام ${student.admissionYear}، ولذلك لم تُنهِ أي فصول دراسية سابقة بعد. فصولك القادمة ستسجل لك المساقات المنجزة بعد رصد العلامات الرسمية.`;
    }

    const completedList = planCourses.filter(c => student.completedCourses.includes(c.code));
    let resp = `لقد أنجزت بنجاح **${student.completedCourses.length} مادة** بإجمالي **${progress.totalCompletedHours} ساعة معتمدة**:\n\n`;
    completedList.forEach(c => {
      resp += `- **${c.code}** - ${c.name} (${c.credits} ساعات)\n`;
    });
    return resp;
  }

  // 4. "شو جدولي يوم الأحد؟" / "جدول الأحد" / Daily schedule
  if (
    normalizedQ.includes('الأحد') ||
    normalizedQ.includes('الاثنين') ||
    normalizedQ.includes('الثلاثاء') ||
    normalizedQ.includes('الأربعاء') ||
    normalizedQ.includes('الخميس')
  ) {
    let day = 'الأحد';
    if (normalizedQ.includes('اثنين')) day = 'الاثنين';
    else if (normalizedQ.includes('ثلاثاء')) day = 'الثلاثاء';
    else if (normalizedQ.includes('اربعاء') || normalizedQ.includes('أربعاء')) day = 'الأربعاء';
    else if (normalizedQ.includes('خميس')) day = 'الخميس';

    const daySections = student.currentRegisteredSections.filter(sec =>
      sec.daysArray.includes(day as any)
    );

    if (daySections.length === 0) {
      return `ليس لديك أي محاضرات مسجلة يوم **${day}**! 🎉 يمكنك استغلال هذا الوقت للمذاكرة أو مراجعة المشاريع.`;
    }

    let resp = `جدول محاضراتك ليوم **${day}** (${daySections.length} محاضرة):\n\n`;
    daySections.sort((a, b) => a.startTime.localeCompare(b.startTime));
    daySections.forEach(s => {
      resp += `⏱️ **${s.startTime} - ${s.endTime}**\n` +
        `📚 **${s.courseName}** (شعبة ${s.sectionNumber})\n` +
        `👨‍🏫 المدرس: ${s.instructor}\n` +
        `📍 القاعة: ${s.room}\n\n`;
    });
    return resp;
  }

  // 5. "متى امتحاني القادم؟" / Next Exam
  if (
    normalizedQ.includes('امتحان') ||
    normalizedQ.includes('امتحاني القادم') ||
    normalizedQ.includes('الفاينل') ||
    normalizedQ.includes('الميد')
  ) {
    if (student.exams.length === 0) {
      return `لا توجد امتحانات مجدولة حالياً في سجلك.`;
    }

    const sortedExams = [...student.exams].sort((a, b) => a.date.localeCompare(b.date));
    const nextExam = sortedExams[0];

    let resp = `🔔 **أقرب امتحان لك:**\n` +
      `- **المادة:** ${nextExam.courseName} (${nextExam.courseCode})\n` +
      `- **النوع:** ${nextExam.examType}\n` +
      `- **الموعد:** ${nextExam.dayName} ${nextExam.date} الساعة ${nextExam.time}\n` +
      `- **القاعة:** ${nextExam.room}${nextExam.seatNumber ? ` | **المقعد:** ${nextExam.seatNumber}` : ''}\n\n` +
      `### جدول باقي الامتحانات المقررة:\n`;

    sortedExams.slice(1).forEach(e => {
      resp += `- **${e.courseName}**: ${e.dayName} ${e.date} (${e.time}) - قاعة ${e.room}\n`;
    });

    return resp;
  }

  // 6. "شو المواد المتبقية من متطلبات التخصص؟" / Major requirements remaining
  if (
    normalizedQ.includes('متطلبات التخصص') ||
    normalizedQ.includes('مواد التخصص') ||
    normalizedQ.includes('باقي تخصص')
  ) {
    const majorCourses = planCourses.filter(c => c.group === 'متطلبات التخصص الإجبارية');
    const remainingMajor = majorCourses.filter(c => !student.completedCourses.includes(c.code));

    let resp = `### متطلبات التخصص الإجبارية (المجموع: 63 ساعة):\n` +
      `- أنجزت منها: ${progress.groupCompletedHours['متطلبات التخصص الإجبارية']} ساعة\n` +
      `- المتبقي: ${63 - progress.groupCompletedHours['متطلبات التخصص الإجبارية']} ساعة\n\n` +
      `**المواد المتبقية (${remainingMajor.length} مادة):**\n`;

    remainingMajor.forEach(c => {
      const isReg = student.currentRegisteredSections.some(s => s.courseCode === c.code);
      const regStatus = isReg ? '*(مسجلة حالياً)*' : '';
      resp += `- **${c.code}** - ${c.name} (${c.credits} س.م) ${regStatus}\n`;
    });

    return resp;
  }

  // 7. "لماذا لا أستطيع تسجيل هذه المادة؟" / "ليش ما بقدر اسجل"
  if (
    normalizedQ.includes('لماذا لا أستطيع') ||
    normalizedQ.includes('ليش ما بقدر') ||
    normalizedQ.includes('غير مسموح') ||
    normalizedQ.includes('سبب عدم السماح')
  ) {
    // If student is Student 3 (Omar) and asks about Advanced ML or Image Processing
    if (student.profileType === 'review' || student.reviewCourses?.length) {
      return `📌 **توضيح أسباب عدم أهلية بعض المواد في خطتك:**\n\n` +
        `1. **1505320 - تعلم الآلة المتقدم:** المتطلب السابق المنشور هو (0300103, 1505311). رمز (0300103) غير موجود ضمن المتطلبات المساندة المعروضة كـ (0300104 للإحصاء والاحتمالات). حالة المادة هي **"تحتاج مراجعة"** بانتظار اعتماد قسم الذكاء الاصطناعي لمعادلة المساق.\n` +
        `2. **1505366 - معالجة الصور الرقمية:** المتطلب السابق المنشور هو (0301241, 1505101). رمز (0301241) غير متطابق مع (0301245 للجبر الخطي). يتطلب موافقة مرشدك الأكاديمي **${student.academicAdvisor}**.\n\n` +
        `*ملاحظة تنظيمية:* "مرشدي الذكي يشرح القرارات والقواعد ولا يعدل الأهلية الأكاديمية تلقائياً".`;
    }

    return `لكي تتمكن من تسجيل أي مادة دراسية، تطبق جامعة مرشدي القواعد الأكاديمية المحددة:\n` +
      `1. **اجتياز جميع المتطلبات السابقة** المنصوص عليها في خطة 12 الرسمية.\n` +
      `2. **عدم اجتياز المادة مسبقاً بنجاح** (إلا في حالات الإعادة لتحسين المعدل وفق اللوائح).\n` +
      `3. **عدم تجاوز الحد الأقصى للعبء الدراسي** (18 ساعة للفصل العادي).\n` +
      `4. **عدم وجود تعارض زمني** بين مواعيد المحاضرات المختارة.\n` +
      `يمكنك مراجعة حالة كل مادة في شاشة **"التسجيل"** لمعرفة السبب الدقيق المذكور بجانب كل مساق.`;
  }

  // 8. Financial status
  if (
    normalizedQ.includes('مالي') ||
    normalizedQ.includes('رسوم') ||
    normalizedQ.includes('رصيدي') ||
    normalizedQ.includes('دفع')
  ) {
    const fin = student.financialSummary;
    return `💼 **الملخص المالي لحسابك الأكاديمي:**\n\n` +
      `- **إجمالي الرسوم المستحقة:** ${fin.totalFees} د.أ\n` +
      `- **إجمالي الدفعات المسددة:** ${fin.totalPayments} د.أ\n` +
      `- **إجمالي الخصومات والمنح:** ${fin.totalDiscounts} د.أ\n` +
      `- **الرصيد الحالي المطالب به:** **${fin.currentBalance === 0 ? '0.00 د.أ (خالص الذمة)' : `${fin.currentBalance} د.أ (مستحق السداد)`}**\n\n` +
      `*يمكنك سداد الرسوم عبر خدمة إي فواتيركم أو مراجعة الدائرة المالية.*`;
  }

  // Default fallback answer
  return `أهلاً بك يا **${student.name}** في بوابة **مرشدي الذكي** الأكاديمية بجامعة مرشدي! 🎓\n\n` +
    `أنا مساعدك الأكاديمي القائم على القواعد المحددة لخطة **الذكاء الاصطناعي (خطة 12)**.\n` +
    `يمكنني إجابتك بدقة على:\n` +
    `- المواد المتاحة لك للتسجيل والتحقق من متطلباتها السابقة\n` +
    `- جدولك الدراسي اليومي والأسبوعي وأوقات المحاضرات والقاعات\n` +
    `- الساعات المتبقية والمنجزة ومعدلك الفصلي والتراكمي\n` +
    `- مواعيد امتحاناتك القادمة وأرقام المقاعد\n` +
    `- الاستفسارات المالية والرصيد الجامعي\n\n` +
    `*تذكر دائماً: مرشدي الذكي يشرح البيانات والقواعد التنظيمية المعتمدة، ولا يملك صلاحية تغيير الدرجات أو القرارات الأكاديمية الرسمية.*`;
}
