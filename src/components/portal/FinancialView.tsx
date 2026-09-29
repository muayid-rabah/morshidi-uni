import React, { useState } from 'react';
import { useStudent } from '../../context/StudentContext';
import {
  Wallet,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  Printer,
  ShieldCheck,
  Building,
  CheckCircle2,
  X
} from 'lucide-react';

export const FinancialView: React.FC = () => {
  const { activeStudent, showToast } = useStudent();
  const summary = activeStudent.financialSummary;
  const transactions = activeStudent.transactions;

  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState(summary.currentBalance > 0 ? summary.currentBalance : 100);

  const handleSimulatePayment = () => {
    setShowPayModal(false);
    showToast(`تم استلام حركة الدفع التجريبية بنجاح بقيمة ${payAmount} د.أ (محاكاة داخل النظام)`, 'success');
  };

  return (
    <div className="space-y-6 animate-fade-in text-right">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6 text-univ-800" />
            <span>كشف الحساب المالي والرسوم الجامعية</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            سجل الحركات المالية المعتمدة بالدينار الأردني (د.أ) للطالب {activeStudent.name}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {summary.currentBalance > 0 && (
            <button
              onClick={() => setShowPayModal(true)}
              className="px-4 py-2 rounded-xl bg-univ-800 hover:bg-univ-900 text-white font-bold text-xs shadow-soft transition-colors flex items-center gap-1.5"
            >
              <CreditCard className="w-4 h-4" />
              <span>دفع إلكتروني تجريبي</span>
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-univ-900 transition-colors shadow-xs"
            title="طباعة كشف الحساب"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Synthetic Demo Notice */}
      <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200/80 text-slate-700 text-xs flex items-center gap-2.5">
        <ShieldCheck className="w-4 h-4 text-univ-700 shrink-0" />
        <span>
          جميع المعلومات المالية المعروضة هي <strong>بيانات افتراضية وتجريبية</strong> لأغراض العرض والتطوير داخل نظام مرشدي ولا تشكل التزاماً مالياً حقيقياً.
        </span>
      </div>

      {/* 5 Required Financial Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        
        {/* الرصيد السابق */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <span className="text-xs font-semibold text-slate-500 block mb-1">الرصيد السابق</span>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {summary.previousBalance.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">د.أ</span>
          </div>
          <span className="text-[11px] text-slate-400">مدور من الفصل السابق</span>
        </div>

        {/* إجمالي الرسوم */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <span className="text-xs font-semibold text-slate-500 block mb-1">إجمالي الرسوم</span>
          <div className="text-2xl font-bold text-rose-700 font-mono">
            {summary.totalFees.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">د.أ</span>
          </div>
          <span className="text-[11px] text-rose-600 font-medium">رسوم ساعات وتسجيل</span>
        </div>

        {/* إجمالي الدفعات */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <span className="text-xs font-semibold text-slate-500 block mb-1">إجمالي الدفعات</span>
          <div className="text-2xl font-bold text-emerald-700 font-mono">
            {summary.totalPayments.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">د.أ</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">مسددة للمالية</span>
        </div>

        {/* إجمالي الخصومات */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <span className="text-xs font-semibold text-slate-500 block mb-1">إجمالي الخصومات</span>
          <div className="text-2xl font-bold text-teal-700 font-mono">
            {summary.totalDiscounts.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">د.أ</span>
          </div>
          <span className="text-[11px] text-teal-600 font-medium">منح وخصومات تفوق</span>
        </div>

        {/* الرصيد الحالي */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft col-span-2 sm:col-span-1">
          <span className="text-xs font-semibold text-slate-500 block mb-1">الرصيد الحالي</span>
          <div className={`text-2xl font-bold font-mono ${summary.currentBalance > 0 ? 'text-amber-600' : 'text-univ-800'}`}>
            {summary.currentBalance.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">د.أ</span>
          </div>
          <span className="text-[11px] font-semibold">
            {summary.currentBalance === 0 ? (
              <span className="text-emerald-700">خالص الذمة المالية</span>
            ) : (
              <span className="text-amber-700">مستحق السداد</span>
            )}
          </span>
        </div>

      </div>

      {/* Transaction Table Required by Prompt */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-soft overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-univ-700" />
            <h3 className="text-sm font-bold text-slate-900">
              سجل الحركات المالية المفصلة (Statement of Account)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            العملة: دينار أردني (JOD / د.أ)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-slate-50/40 text-slate-600 font-semibold border-b border-slate-200 text-xs">
              <tr>
                <th className="py-3.5 px-4">التاريخ</th>
                <th className="py-3.5 px-4 font-mono">المرجع</th>
                <th className="py-3.5 px-4">البيان</th>
                <th className="py-3.5 px-4 text-center">مدين (د.أ)</th>
                <th className="py-3.5 px-4 text-center">دائن (د.أ)</th>
                <th className="py-3.5 px-4 text-center font-bold">الرصيد (د.أ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    لا توجد حركات مالية مسجلة بعد.
                  </td>
                </tr>
              ) : (
                transactions.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-700 text-xs">
                      {t.date}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 text-xs">
                      {t.reference}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {t.statement}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-rose-700">
                      {t.debit > 0 ? t.debit.toFixed(2) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-emerald-700">
                      {t.credit > 0 ? t.credit.toFixed(2) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900 text-sm">
                      {t.balance.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Demo Electronic Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in text-right">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-elevated border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-univ-800" />
                <h3 className="text-base font-bold text-slate-900">سداد الرسوم عبر إي فواتيركم (تجريبي)</h3>
              </div>
              <button
                onClick={() => setShowPayModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
              هذه شاشة محاكاة لعمليات السداد التجريبية داخل نظام مرشدي. لن يتم خصم أي أموال حقيقية.
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                المبلغ المراد سداده (د.أ):
              </label>
              <input
                type="number"
                value={payAmount}
                onChange={e => setPayAmount(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-univ-600/20"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>المفوتر:</span>
                <strong className="text-slate-800">جامعة مرشدي</strong>
              </div>
              <div className="flex justify-between">
                <span>الرقم المالي للطالب:</span>
                <strong className="font-mono text-slate-800">{activeStudent.universityId}</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowPayModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleSimulatePayment}
                className="px-5 py-2 rounded-xl bg-univ-800 hover:bg-univ-900 text-white font-bold text-xs shadow-soft transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>إتمام الدفع التجريبي</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
