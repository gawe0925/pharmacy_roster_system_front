import zhCommon from './zh/common';
import zhDashboard from './zh/dashboard';
import zhStaff from './zh/staff';
import zhLeaveRequests from './zh/leaveRequests';
import zhLogin from './zh/login';
import zhPayRoll from './zh/payroll'
import zhRoster from './zh/roster'
import zhScheduling from './zh/scheduling'

import enCommon from './en/common';
import enDashboard from './en/dashboard';
import enStaff from './en/staff';
import enLeaveRequests from './en/leaveRequests';
import enLogin from './en/login';
import enPayRoll from './en/payroll'
import enRoster from './en/roster'
import enScheduling from './en/scheduling'

const translations = {
  zh: {
    ...zhCommon,
    ...zhDashboard,
    ...zhStaff,
    ...zhLeaveRequests,
    ...zhLogin,
    ...zhPayRoll,
    ...zhRoster,
    ...zhScheduling,
  },
  en: {
    ...enCommon,
    ...enDashboard,
    ...enStaff,
    ...enLeaveRequests,
    ...enLogin,
    ...enPayRoll,
    ...enRoster,
    ...enScheduling,
  }
};

export default translations;