import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { db } from '../../lib/db';
import type { Employee, SalaryStructure, Payslip } from '@newbal/shared';
import {
  Users2,
  Plus,
  Printer,
  CheckCircle2,
  Calendar,
  X,
  Check,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const PayrollView: React.FC = () => {
  const { activeCompany, triggerRefresh, refreshKey } = useApp();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [activeTab, setActiveTab] = useState<'EMPLOYEES' | 'PAYROLL_RUN' | 'PAYSLIPS'>('EMPLOYEES');
  const [isNewEmpModalOpen, setIsNewEmpModalOpen] = useState(false);

  // New Employee Form
  const [empCode, setEmpCode] = useState('');
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [basicSalary, setBasicSalary] = useState(50000);
  const [hra, setHra] = useState(20000);
  const [specialAllowance, setSpecialAllowance] = useState(10000);
  const [pan, setPan] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [uanPf, setUanPf] = useState('');

  const [payrollSuccessMessage, setPayrollSuccessMessage] = useState('');

  useEffect(() => {
    if (!activeCompany) return;

    async function loadPayroll() {
      const emps = await db.employees.where('companyId').equals(activeCompany!.id).toArray();
      const sals = await db.salaryStructures.toArray();
      const slips = await db.payslips.toArray();

      setEmployees(emps);
      setSalaryStructures(sals);
      setPayslips(slips);
    }
    loadPayroll();
  }, [activeCompany, refreshKey]);

  // Handle Create Employee
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !activeCompany) return;

    const empId = `emp-${Date.now()}`;
    const newEmp: Employee = {
      id: empId,
      companyId: activeCompany.id,
      employeeCode: empCode || `EMP${employees.length + 101}`,
      name,
      designation,
      department,
      dateOfJoining: new Date().toISOString().split('T')[0],
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@${activeCompany.email.split('@')[1] || 'company.in'}`,
      phone: '+91 98000 00000',
      pan: pan || undefined,
      bankAccount: bankAccount || undefined,
      uanPf: uanPf || undefined,
      status: 'ACTIVE',
    };

    const newSalary: SalaryStructure = {
      id: `sal-${Date.now()}`,
      employeeId: empId,
      effectiveFrom: '2024-04-01',
      basicSalary: Number(basicSalary),
      hra: Number(hra),
      conveyanceAllowance: 3000,
      specialAllowance: Number(specialAllowance),
      medicalAllowance: 1250,
      pfDeductionRate: 12,
      esiDeductionRate: 0,
      professionalTax: 200,
      tdsMonthly: 2500,
    };

    await db.employees.add(newEmp);
    await db.salaryStructures.add(newSalary);

    triggerRefresh();
    setIsNewEmpModalOpen(false);
    setName('');
    setEmpCode('');
  };

  // Run Monthly Payroll
  const handleProcessPayroll = async () => {
    try {
      if (employees.length === 0 || !activeCompany) return;

      const generatedPayslips: Payslip[] = [];
      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;

      for (const emp of employees) {
        const sal = salaryStructures.find((s) => s.employeeId === emp.id) || {
          basicSalary: 50000,
          hra: 20000,
          conveyanceAllowance: 3000,
          specialAllowance: 10000,
          pfDeductionRate: 12,
          professionalTax: 200,
          tdsMonthly: 2000,
        };

        const gross = sal.basicSalary + sal.hra + sal.conveyanceAllowance + sal.specialAllowance;
        const pf = (sal.basicSalary * 12) / 100;
        const pt = sal.professionalTax || 200;
        const tds = sal.tdsMonthly || 0;
        const deductions = pf + pt + tds;
        const net = gross - deductions;

        totalGross += gross;
        totalDeductions += deductions;
        totalNet += net;

        const slip: Payslip = {
          id: `pslip-${emp.id}-${Date.now()}`,
          payrollRunId: `prun-${Date.now()}`,
          employeeId: emp.id,
          employeeName: emp.name,
          employeeCode: emp.employeeCode,
          department: emp.department,
          month: 'May 2024',
          presentDays: 31,
          totalDaysInMonth: 31,
          basic: sal.basicSalary,
          hra: sal.hra,
          conveyance: sal.conveyanceAllowance,
          specialAllowance: sal.specialAllowance,
          grossEarnings: gross,
          pfEmployee: pf,
          esiEmployee: 0,
          profTax: pt,
          tds,
          totalDeductions: deductions,
          netSalary: net,
          status: 'PAID',
        };

        generatedPayslips.push(slip);
      }

      await db.payslips.bulkAdd(generatedPayslips);

      // Auto-post Salary Journal Voucher to accounting books
      const salLedger = (await db.ledgers.toArray()).find((l) => l.name.includes('Salaries')) || (await db.ledgers.toArray())[0];
      const bankLedger = (await db.ledgers.toArray()).find((l) => l.isBankOrCash) || (await db.ledgers.toArray())[0];

      await db.vouchers.add({
        id: `vch-sal-${Date.now()}`,
        companyId: activeCompany.id,
        voucherNumber: `SAL/24-25/${String(Date.now()).slice(-3)}`,
        voucherType: 'PAYMENT',
        date: new Date().toISOString().split('T')[0],
        narration: `Being salary processed for May 2024 for ${employees.length} employees`,
        grandTotal: totalNet,
        entries: [
          { ledgerId: salLedger.id, ledgerName: salLedger.name, amount: totalGross, type: 'DR' },
          { ledgerId: bankLedger.id, ledgerName: bankLedger.name, amount: totalNet, type: 'CR' },
        ],
        status: 'POSTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setPayrollSuccessMessage(
        `Successfully processed May 2024 payroll for ${employees.length} staff! Total payout: ₹${totalNet.toLocaleString(
          'en-IN'
        )}. Auto-posted to books.`
      );
      triggerRefresh();
      setTimeout(() => setPayrollSuccessMessage(''), 7000);
    } catch (err) {
      console.error(err);
      alert('Error processing payroll');
    }
  };

  // Download PDF Payslip
  const handleDownloadPayslipPDF = (slip: Payslip) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(16, 185, 129);
    doc.text(activeCompany?.name || 'Company', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('PAYSLIP FOR THE MONTH OF MAY 2024', 14, 27);

    doc.setDrawColor(200);
    doc.line(14, 32, 196, 32);

    doc.setFontSize(9);
    doc.setTextColor(30);
    doc.text(`Employee Code: ${slip.employeeCode}`, 14, 40);
    doc.text(`Employee Name: ${slip.employeeName}`, 14, 46);
    doc.text(`Department: ${slip.department}`, 14, 52);
    doc.text(`Present Days: ${slip.presentDays} / ${slip.totalDaysInMonth}`, 140, 40);
    doc.text(`Status: Paid via Direct Bank Transfer`, 140, 46);

    autoTable(doc, {
      startY: 60,
      head: [['Earnings', 'Amount (₹)', 'Deductions', 'Amount (₹)']],
      body: [
        ['Basic Salary', `₹${slip.basic.toLocaleString('en-IN')}`, 'Provident Fund (PF 12%)', `₹${slip.pfEmployee.toLocaleString('en-IN')}`],
        ['HRA', `₹${slip.hra.toLocaleString('en-IN')}`, 'Professional Tax (PT)', `₹${slip.profTax.toLocaleString('en-IN')}`],
        ['Conveyance Allowance', `₹${slip.conveyance.toLocaleString('en-IN')}`, 'TDS / Income Tax', `₹${slip.tds.toLocaleString('en-IN')}`],
        ['Special Allowance', `₹${slip.specialAllowance.toLocaleString('en-IN')}`, '', ''],
        [
          'Total Gross Earnings',
          `₹${slip.grossEarnings.toLocaleString('en-IN')}`,
          'Total Deductions',
          `₹${slip.totalDeductions.toLocaleString('en-IN')}`,
        ],
      ],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
      styles: { fontSize: 9 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Net Take-Home Salary: ₹${slip.netSalary.toLocaleString('en-IN')}`, 14, finalY);

    doc.save(`Payslip_${slip.employeeCode}_May2024.pdf`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center space-x-2">
            <Users2 className="w-6 h-6 text-emerald-400" />
            <span>Payroll & Human Resources</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Salary structure, PF, ESI, TDS, and automated payslip generation for {activeCompany?.name}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setIsNewEmpModalOpen(true)}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-700 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
          <button
            onClick={handleProcessPayroll}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition shadow-md shadow-emerald-950/40"
          >
            <Calendar className="w-4 h-4" />
            <span>Process Monthly Payroll</span>
          </button>
        </div>
      </div>

      {payrollSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{payrollSuccessMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('EMPLOYEES')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'EMPLOYEES'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Staff Master ({employees.length})
        </button>
        <button
          onClick={() => setActiveTab('PAYSLIPS')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'PAYSLIPS'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Generated Payslips ({payslips.length})
        </button>
      </div>

      {/* Tab: EMPLOYEES */}
      {activeTab === 'EMPLOYEES' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-medium">Emp Code</th>
                  <th className="py-3 px-4 font-medium">Employee Name</th>
                  <th className="py-3 px-4 font-medium">Department & Role</th>
                  <th className="py-3 px-4 font-medium">UAN PF</th>
                  <th className="py-3 px-4 font-medium text-right">Basic Salary</th>
                  <th className="py-3 px-4 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {employees.map((emp) => {
                  const sal = salaryStructures.find((s) => s.employeeId === emp.id);
                  return (
                    <tr key={emp.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-200">{emp.employeeCode}</td>
                      <td className="py-3.5 px-4 font-sans font-medium text-slate-100">
                        <div>{emp.name}</div>
                        <span className="text-[10px] text-slate-400 font-mono">{emp.email}</span>
                      </td>
                      <td className="py-3.5 px-4 font-sans text-slate-300">
                        <div>{emp.department}</div>
                        <span className="text-[10px] text-slate-400">{emp.designation}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{emp.uanPf || 'N/A'}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                        ₹{(sal?.basicSalary || 50000).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-center font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold">
                          {emp.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: PAYSLIPS */}
      {activeTab === 'PAYSLIPS' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-mono text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-sans">
                <tr>
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Employee Name</th>
                  <th className="py-3 px-4 text-right">Gross Earnings</th>
                  <th className="py-3 px-4 text-right">Deductions</th>
                  <th className="py-3 px-4 text-right">Net Take Home</th>
                  <th className="py-3 px-4 text-center">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {payslips.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500 font-sans">
                      No payslips generated yet. Click "Process Monthly Payroll" above.
                    </td>
                  </tr>
                ) : (
                  payslips.map((ps) => (
                    <tr key={ps.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 text-slate-400 font-sans">{ps.month}</td>
                      <td className="py-3.5 px-4 text-slate-200">{ps.employeeCode}</td>
                      <td className="py-3.5 px-4 font-sans text-slate-100 font-medium">{ps.employeeName}</td>
                      <td className="py-3.5 px-4 text-right text-slate-300">
                        ₹{ps.grossEarnings.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-right text-rose-400">
                        ₹{ps.totalDeductions.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                        ₹{ps.netSalary.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleDownloadPayslipPDF(ps)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 transition"
                          title="Download Official PDF Payslip"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Employee Modal */}
      {isNewEmpModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">Add New Employee Master</h3>
              <button
                onClick={() => setIsNewEmpModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Employee Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram Malhotra"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Employee Code</label>
                  <input
                    type="text"
                    placeholder="EMP103"
                    value={empCode}
                    onChange={(e) => setEmpCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Finance">Finance & Accounts</option>
                    <option value="Operations">Operations</option>
                    <option value="Sales">Sales & Marketing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Developer"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Basic Monthly (₹)</label>
                  <input
                    type="number"
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">HRA (₹)</label>
                  <input
                    type="number"
                    value={hra}
                    onChange={(e) => setHra(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Special Allow. (₹)</label>
                  <input
                    type="number"
                    value={specialAllowance}
                    onChange={(e) => setSpecialAllowance(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">UAN PF Number</label>
                  <input
                    type="text"
                    placeholder="100987654323"
                    value={uanPf}
                    onChange={(e) => setUanPf(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Bank Account</label>
                  <input
                    type="text"
                    placeholder="Account Number"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewEmpModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 shadow-md shadow-emerald-950/40"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Employee</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
