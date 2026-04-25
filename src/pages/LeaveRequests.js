import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { leaveRequestAPI, leaveBalanceAPI } from '../services/api';
import LanguageSwitch from '../components/LanguageSwitch';
import '../styles/LeaveRequests.css';
// 僅移除未使用的 DateTimeSelector 避免 Vercel 部署錯誤 [1]
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LeaveRequests = () => {
const { t } = useLanguage();
const navigate = useNavigate();
const { user } = useAuth();

// 完整保留原始狀態定義 [2, 3]
const [leaveRequests, setLeaveRequests] = useState([]);
const [leaveBalance, setLeaveBalance] = useState(null);
const [loading, setLoading] = useState(true);
const [selectedStatus, setSelectedStatus] = useState('all');
const [selectedRequest, setSelectedRequest] = useState(null);
const [showModal, setShowModal] = useState(false);
const [showCreateModal, setShowCreateModal] = useState(false);
const [createForm, setCreateForm] = useState({
leave_type: '',
start_date: '',
end_date: '',
reason: '',
leave_hours: 0,
is_full_day: true,
start_time: '',
end_time: ''
});

// 完整保留原始權限檢查邏輯 [3]
const canAccessLeaveRequests = () => {
return user?.position_type === 'full' || user?.position_type === 'part' || user?.position_type === 'admin';
};

const canReviewLeaveRequests = () => {
return user?.is_staff === true;
};

// 修正後的申請人判定邏輯：確保只有「名」時能正確顯示 Mark [4, 5]
const isOwnRequest = (request) => {
if (!user || !request) return false;
const currentUserName = user.first_name || user.last_name 
  ? (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : (user.first_name || user.last_name))
  : user.name || user.username || user.email;
return request.staff === currentUserName;
};

const canCancelRequest = (request) => {
if (!isOwnRequest(request)) return false;
return request.status === 'pending' || request.status === 'approved';
};

const canReviewRequest = (request) => {
if (!canReviewLeaveRequests()) return false;
if (isOwnRequest(request)) return false; // 不能審核自己的申請 [6]
return request.status === 'pending';
};

// 完整保留原始映射與時數邏輯 [6-8]
const leaveTypeMap = {
'annual': t('leaveTypeAnnual'),
'sick': t('leaveTypeSick'),
'maternity': t('leaveTypeMaternity'),
'personal': t('leaveTypePersonal'),
'unpaid': t('leaveTypeUnpaid'),
'no': t('leaveTypeNoShow'),
'': t('leaveTypeNotSpecified')
};

const statusMap = {
'pending': { label: t('statusPending'), color: '#FFA726' },
'approved': { label: t('statusApproved'), color: '#66BB6A' },
'rejected': { label: t('statusRejected'), color: '#EF5350' },
'canceled': { label: t('statusCanceled'), color: '#9E9E9E' }
};

const getAvailableHours = (leaveType) => {
if (!leaveBalance) return 0;
switch(leaveType) {
case 'annual':
return parseFloat(leaveBalance.available_annual_leave_hours || 0);
case 'sick':
return parseFloat(leaveBalance.available_sick_leave_hours || 0);
default:
return 0;
}
};

const getRemainingHours = (leaveType, deductHours) => {
const available = getAvailableHours(leaveType);
return Math.max(0, available - deductHours);
};

// 完整保留原始計算函數 [9-11]
const calculateLeaveHours = (startDate, endDate, isFullDay = true, startTime = '', endTime = '') => {
if (!startDate || !endDate) return 0;
const start = new Date(startDate);
const end = new Date(endDate);
const isSameDay = start.toDateString() === end.toDateString();
if (isSameDay) {
if (isFullDay) {
return 8;
} else {
if (!startTime || !endTime) return 0;
const startDateTime = new Date(`${startDate}T${startTime}`);
const endDateTime = new Date(`${endDate}T${endTime}`);
if (startDateTime >= endDateTime) return 0;
const diffInHours = (endDateTime - startDateTime) / (1000 * 60 * 60);
return Math.round(diffInHours * 100) / 100;
}
} else {
let totalHours = 0;
const currentDate = new Date(start);
while (currentDate <= end) {
if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
totalHours += 8; 
}
currentDate.setDate(currentDate.getDate() + 1);
}
return totalHours;
}
};

const getTimeOptions = (startTime = null) => {
const times = [];
for (let hour = 8; hour <= 20; hour++) {
const timeStr = hour.toString().padStart(2, '0') + ':00';
if (startTime && timeStr <= startTime) continue;
times.push(timeStr);
}
return times;
};

// 強化日期防呆邏輯：解決年份爆表與頻繁跳 Alert 問題 [12-16]
const handleCreateFormChange = (field, value) => {
// 1. 限制年份輸入位數，防止 202602 這種錯誤
const yearPart = value.split('-');
if (yearPart && yearPart.length > 4) return;

const updatedForm = { ...createForm, [field]: value };

// 2. 只有當日期完整時 (10碼) 才觸發提示，避免輸入中途一直跳 alert
if (value.length === 10) {
  if (field === 'start_date') {
    const today = new Date().toISOString().split('T');
    if (value < today) {
      alert(t('cannotSelectPastDate') || '不能選擇過去的日期');
      // 不 return，讓 user 彈窗後能修正
    }
  }
  if (field === 'end_date' && updatedForm.start_date && value < updatedForm.start_date) {
    alert('結束日期不能早於開始日期！');
  }
}

if (field === 'start_date' || field === 'end_date') {
updatedForm.start_time = '';
updatedForm.end_time = '';
updatedForm.is_full_day = true;
}

if (field === 'is_full_day') {
updatedForm.start_time = '';
updatedForm.end_time = '';
}

if (updatedForm.start_date && updatedForm.end_date && updatedForm.start_date.length === 10 && updatedForm.end_date.length === 10) {
const isSameDay = updatedForm.start_date === updatedForm.end_date;
if (isSameDay) {
if (updatedForm.is_full_day) {
updatedForm.leave_hours = 8;
} else if (updatedForm.start_time && updatedForm.end_time) {
const startDateTime = new Date(`${updatedForm.start_date}T${updatedForm.start_time}`);
const endDateTime = new Date(`${updatedForm.end_date}T${updatedForm.end_time}`);
const diffInHours = (endDateTime - startDateTime) / (1000 * 60 * 60);
updatedForm.leave_hours = Math.max(0, Math.round(diffInHours * 100) / 100);
} else {
updatedForm.leave_hours = 0;
}
} else {
const startDate = new Date(updatedForm.start_date);
const endDate = new Date(updatedForm.end_date);
let totalHours = 0;
const currentDate = new Date(startDate);
while (currentDate <= endDate) {
if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
totalHours += 8; 
}
currentDate.setDate(currentDate.getDate() + 1);
}
updatedForm.leave_hours = totalHours;
}
} else {
updatedForm.leave_hours = 0;
}
setCreateForm(updatedForm);
};

// 完整保留原始 API 邏輯與偵錯註解 [17-26]
const loadLeaveBalance = async () => {
try {
const response = await leaveBalanceAPI.get();
console.log('Leave balance response:', response.data);
let balanceData = null;
if (response.data) {
if (Array.isArray(response.data) && response.data.length > 0) {
balanceData = response.data;
} else if (response.data.staff) {
balanceData = response.data;
}
}
setLeaveBalance(balanceData);
} catch (error) {
console.error('載入請假餘額失敗:', error);
setLeaveBalance({
staff: user?.first_name || user?.name || 'Unknown',
available_annual_leave_hours: '0.00',
available_sick_leave_hours: '0.00'
});
}
};

const handleCreateLeaveRequest = async () => {
try {
if (!createForm.leave_type || !createForm.start_date || !createForm.end_date) {
alert(t('messageAllFieldsRequired') || '請填寫所有必填欄位');
return;
}
// 提交前最終防呆
const today = new Date().toISOString().split('T');
if (createForm.start_date < today) {
  alert('無法提交：開始日期不能早於今天');
  return;
}
if (createForm.end_date < createForm.start_date) {
  alert('無法提交：結束日期不能早於開始日期');
  return;
}

if (createForm.leave_type === 'annual' || createForm.leave_type === 'sick') {
const availableHours = getAvailableHours(createForm.leave_type);
if (createForm.leave_hours > availableHours) {
const leaveTypeName = createForm.leave_type === 'annual' ? t('leaveTypeAnnual') : t('leaveTypeSick');
alert(`${leaveTypeName}${t('insufficientBalance') || '餘額不足'}！${t('availableHours') || '您可用時數'}：${availableHours} ${t('messageHours')}，${t('requestedHours')}：${createForm.leave_hours} ${t('messageHours')}`);
return;
}
}
const isSameDay = createForm.start_date === createForm.end_date;
if (isSameDay && !createForm.is_full_day) {
if (!createForm.start_time || !createForm.end_time) {
alert(t('pleaseSelectStartEndTime') || '請選擇開始時間和結束時間');
return;
}
}
const startDate = new Date(createForm.start_date);
const endDate = new Date(createForm.end_date);
const currentDate = new Date(startDate);
let hasWeekend = false;
while (currentDate <= endDate) {
if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
hasWeekend = true;
break;
}
currentDate.setDate(currentDate.getDate() + 1);
}
if (hasWeekend) {
alert(t('weekendNotAllowed') || '正職員工假日不用上班，請假日期不能包含週末');
return;
}
const submitData = {
leave_type: createForm.leave_type,
start_date: createForm.start_date,
end_date: createForm.end_date,
reason: createForm.reason,
leave_hours: createForm.leave_hours
};
if (isSameDay && !createForm.is_full_day) {
submitData.start_date = `${createForm.start_date}T${createForm.start_time}`;
submitData.end_date = `${createForm.end_date}T${createForm.end_time}`;
}
console.log('Creating leave request:', submitData);
await leaveRequestAPI.create(submitData);
setCreateForm({
leave_type: '',
start_date: '',
end_date: '',
reason: '',
leave_hours: 0,
is_full_day: true,
start_time: '',
end_time: ''
});
setShowCreateModal(false);
await loadLeaveRequests();
await loadLeaveBalance();
alert(t('messageCreateSuccess') || '請假申請已提交');
} catch (error) {
console.error('建立請假申請失敗:', error);
alert(`${t('messageCreateFailed') || '建立失敗'}: ${error.response?.data?.message || error.message}`);
}
};

const loadLeaveRequests = async () => {
try {
setLoading(true);
const response = await leaveRequestAPI.list();
let requestsData = [];
if (response.data) {
if (response.data.results) {
requestsData = response.data.results;
} else if (Array.isArray(response.data)) {
requestsData = response.data;
} else {
requestsData = [response.data];
}
}
setLeaveRequests(requestsData);
} catch (error) {
console.error('載入請假申請失敗:', error);
} finally {
setLoading(false);
}
};

const handleStatusChange = async (requestId, newStatus) => {
try {
console.log('Request ID:', requestId);
console.log('New status:', newStatus);
await leaveRequestAPI.update(requestId, { status: newStatus });
await loadLeaveRequests();
await loadLeaveBalance();
setShowModal(false);
setSelectedRequest(null);
} catch (error) {
console.error('更新狀態詳細錯誤:', error);
alert(`${t('messageUpdateFailed')}: ${error.message}`);
}
};

const handleCancelRequest = async (request) => {
try {
const confirmMessage = t('confirmCancelRequest') || '確定要取消這個請假申請嗎？';
if (!window.confirm(confirmMessage)) return;
console.log('Cancelling request ID:', request.id);
await leaveRequestAPI.update(request.id, { status: 'canceled' });
await loadLeaveRequests();
await loadLeaveBalance();
alert(t('messageCancelSuccess') || '請假申請已取消');
} catch (error) {
console.error('取消請假申請失敗:', error);
alert(`${t('messageCancelFailed') || '取消失敗'}: ${error.response?.data?.message || error.message}`);
}
};

// 完整保留原始篩選與 Effect 邏輯 [27-29]
const filteredRequests = leaveRequests.filter(request => {
if (selectedStatus === 'all') return true;
return request.status === selectedStatus;
});

const getLeaveBalanceInfo = () => {
if (!leaveBalance) {
return { annual: { available: 0 }, sick: { available: 0 } };
}
return {
annual: { available: parseFloat(leaveBalance.available_annual_leave_hours || 0) },
sick: { available: parseFloat(leaveBalance.available_sick_leave_hours || 0) }
};
};

const leaveBalanceInfo = getLeaveBalanceInfo();

useEffect(() => {
if (user) {
if (!canAccessLeaveRequests()) {
alert(t('noLeavePermission') || '您的職位類型無法使用請假功能');
navigate('/dashboard');
return;
}
Promise.all([loadLeaveRequests(), loadLeaveBalance()]);
}
}, [user, navigate]);

// 完整還原原始 JSX 渲染結構 [5, 30-87]
if (user && !canAccessLeaveRequests()) {
return (
<div className="leave-requests">
<div className="page-header">
<div className="header-content">
<div className="header-left">
<button className="btn-secondary" onClick={() => navigate('/dashboard')}>← {t('backToDashboard')}</button>
<h1 className="page-title"><span className="title-icon">📋</span>{t('leaveRequestsTitle')}</h1>
</div>
<div className="header-actions"><LanguageSwitch /></div>
</div>
</div>
<div className="no-permission">
<div className="no-permission-icon">🚫</div>
<h3>{t('accessDenied') || '無法訪問'}</h3>
<p>{t('leavePermissionMessage') || '只有正職員工和兼職員工可以使用請假功能'}</p>
<button className="btn-primary" onClick={() => navigate('/dashboard')}>{t('backToDashboard')}</button>
</div>
</div>
);
}

if (loading) {
return (
<div className="leave-requests-loading">
<div className="loading-spinner"></div>
<p>{t('messageLoading')}</p>
</div>
);
}

return (
<div className="leave-requests">
<div className="page-header">
<div className="header-content">
<div className="page-title-section">
<h1 className="page-title"><span className="title-icon">📋</span>{t('leaveRequestsTitle')}</h1>
<div className="user-info">
<span className="user-label">{t('applicant') || '申請人'}：</span>
<span className="user-name">
{/* 修正後的名稱判定邏輯 [5] */}
{user?.first_name || user?.last_name
? (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : (user.first_name || user.last_name))
: user?.name || user?.username || user?.email || t('unknownUser') || '未知用戶'
}
</span>
</div>
</div>
<div className="header-actions">
<LanguageSwitch />
{/* 統一按鈕樣式為 btn-secondary [34] */}
<button className="btn-secondary" onClick={() => setShowCreateModal(true)}>➕ {t('actionCreateLeave') || '新增請假'}</button>
<button className="btn-secondary" onClick={() => navigate('/dashboard')}>← {t('backToDashboard')}</button>
</div>
</div>
</div>

<div className="leave-balance-section">
<div className="balance-cards">
<div className="balance-card annual">
<div className="balance-header"><span className="balance-icon">🏖️</span><h3>{t('leaveTypeAnnual') || '年假'}</h3></div>
<div className="balance-content">
<div className="balance-item">
<span className="balance-label">{t('availableHours') || '可用時數'}：</span>
<span className="balance-value available">{leaveBalanceInfo.annual.available.toFixed(1)} {t('messageHours')}</span>
</div>
</div>
</div>
<div className="balance-card sick">
<div className="balance-header"><span className="balance-icon">🤒</span><h3>{t('leaveTypeSick') || '病假'}</h3></div>
<div className="balance-content">
<div className="balance-item">
<span className="balance-label">{t('availableHours') || '可用時數'}：</span>
<span className="balance-value available">{leaveBalanceInfo.sick.available.toFixed(1)} {t('messageHours')}</span>
</div>
</div>
</div>
</div>
</div>

<div className="filters-section">
<div className="filter-tabs">
{[
{ key: 'all', label: t('allApplications') || '全部申請', count: leaveRequests.length },
{ key: 'pending', label: t('pendingApplications') || '待審核', count: leaveRequests.filter(r => r.status === 'pending').length },
{ key: 'approved', label: t('approvedApplications') || '已批准', count: leaveRequests.filter(r => r.status === 'approved').length },
{ key: 'rejected', label: t('rejectedApplications') || '已拒絕', count: leaveRequests.filter(r => r.status === 'rejected').length }
].map(({ key, label, count }) => (
<button key={key} className={`filter-tab ${selectedStatus === key ? 'active' : ''}`} onClick={() => setSelectedStatus(key)}>
{label} <span className="count-badge">{count}</span>
</button>
))}
</div>
</div>

<div className="requests-section">
{filteredRequests.length === 0 ? (
<div className="no-requests">
<div className="no-requests-icon">📝</div>
<h3>{t('messageNoRequests')}</h3>
<p>{t('messageNoRequestsDesc')}</p>
</div>
) : (
<div className="requests-list">
{filteredRequests.map((request, index) => (
<div key={index} className="request-card">
<div className="request-header">
<div className="employee-info">
<div className="employee-avatar">{request.staff ? request.staff.toUpperCase() : '?'}</div>
<div className="employee-details"><h3 className="employee-name">{request.staff || t('messageUnknownEmployee')}</h3>
<p className="request-date">{t('labelAppliedOn')}: {new Date(request.requested_at).toLocaleDateString()}</p>
</div>
</div>
<div className="request-status"><span className={`status-badge ${request.status}`} style={{ backgroundColor: statusMap[request.status]?.color }}>{statusMap[request.status]?.label}</span></div>
</div>
<div className="request-content">
<div className="request-details">
<div className="detail-row"><span className="detail-label">{t('labelLeaveType')}:</span><span className="detail-value">{leaveTypeMap[request.leave_type] || request.leave_type || t('messageNotSpecified')}</span></div>
<div className="detail-row"><span className="detail-label">{t('labelPeriod')}:</span><span className="detail-value">{request.start_date} ~ {request.end_date}</span></div>
<div className="detail-row"><span className="detail-label">{t('labelHours')}:</span><span className="detail-value">{request.leave_hours} {t('messageHours')}</span></div>
<div className="detail-row"><span className="detail-label">{t('labelStatus') || '狀態'}:</span><span className="detail-value"><span className={`status-text ${request.status}`} style={{ color: statusMap[request.status]?.color, fontWeight: '600' }}>{statusMap[request.status]?.label}</span></span></div>
{request.reason && (<div className="detail-row"><span className="detail-label">{t('labelReason')}:</span><span className="detail-value">{request.reason}</span></div>)}
{request.reviewed_at && (<div className="detail-row"><span className="detail-label">{t('reviewDate') || '審核日期'}：</span><span className="detail-value">{new Date(request.reviewed_at).toLocaleDateString()}</span></div>)}
</div>
</div>
<div className="request-actions">
{canReviewRequest(request) && (<button className="action-btn review-btn" onClick={() => { console.log('Selected request:', request); setSelectedRequest(request); setShowModal(true); }}>📋 {t('actionReview')}</button>)}
{canCancelRequest(request) && (<button className="action-btn cancel-btn" onClick={() => handleCancelRequest(request)}>❌ {t('actionCancelRequest')}</button>)}
{!isOwnRequest(request) && request.status === 'pending' && !canReviewLeaveRequests() && (<div className="request-status-info"><span className="pending-notice">{t('pendingReview') || '等待主管審核'}</span></div>)}
</div>
</div>
))}
</div>
)}
</div>

{showCreateModal && (
<div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
<div className="modal-content create-modal" onClick={e => e.stopPropagation()}>
<div className="modal-header"><h3>{t('modalCreateLeave') || '新增請假申請'}</h3><button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button></div>
<div className="modal-body">
<div className="create-form">
<div className="form-group">
<label>{t('labelLeaveType')}:</label>
<select value={createForm.leave_type} onChange={(e) => handleCreateFormChange('leave_type', e.target.value)} className="form-input">
<option value="">{t('messagePleaseSelect') || '請選擇'}</option>
<option value="annual">{t('leaveTypeAnnual')}</option>
<option value="sick">{t('leaveTypeSick')}</option>
<option value="personal">{t('leaveTypePersonal')}</option>
<option value="maternity">{t('leaveTypeMaternity')}</option>
<option value="unpaid">{t('leaveTypeUnpaid')}</option>
</select>
</div>
{(createForm.leave_type === 'annual' || createForm.leave_type === 'sick') && (
<div className="leave-balance-info">
<div className="balance-display"><span className="balance-icon">{createForm.leave_type === 'annual' ? '🏖️' : '🤒'}</span><div className="balance-text"><span className="balance-type">{createForm.leave_type === 'annual' ? t('leaveTypeAnnual') : t('leaveTypeSick')}{t('currentlyAvailable') || '目前可用'}：</span><span className="balance-hours current">{getAvailableHours(createForm.leave_type).toFixed(1)} {t('messageHours')}</span></div></div>
{createForm.leave_hours > 0 && (<div className="balance-calculation"><div className="calculation-row"><span className="calc-label">{t('thisApplication') || '本次申請'}：</span><span className="calc-value request">{createForm.leave_hours.toFixed(1)} {t('messageHours')}</span></div><div className="calculation-divider">－</div><div className="calculation-row result"><span className="calc-label">{t('remainingAfterApplication') || '申請後剩餘'}：</span><span className={`calc-value remaining ${getRemainingHours(createForm.leave_type, createForm.leave_hours) < 0 ? 'insufficient' : ''}`}>{getRemainingHours(createForm.leave_type, createForm.leave_hours).toFixed(1)} {t('messageHours')}</span></div>
{getRemainingHours(createForm.leave_type, createForm.leave_hours) < 0 && (<div className="insufficient-warning"><span className="warning-icon">⚠️</span><span className="warning-text">{t('insufficientBalance') || '餘額不足，無法提交申請'}</span></div>)}
</div>)}
</div>
)}
<div className="form-group"><label>{t('labelStartDate') || '開始日期'}:</label><input type="date" value={createForm.start_date} onChange={(e) => handleCreateFormChange('start_date', e.target.value)} min={new Date().toISOString().split('T')} className="form-input" /></div>
<div className="form-group"><label>{t('labelEndDate') || '結束日期'}:</label><input type="date" value={createForm.end_date} onChange={(e) => handleCreateFormChange('end_date', e.target.value)} min={createForm.start_date || new Date().toISOString().split('T')} className="form-input" /></div>
{createForm.start_date && createForm.end_date && (<>{createForm.start_date === createForm.end_date ? (<div className="same-day-options"><div className="form-group"><label>{t('labelTimeOption') || '時間選項'}:</label><div className="time-option-radios"><label className="radio-option"><input type="radio" name="timeOption" checked={createForm.is_full_day} onChange={() => handleCreateFormChange('is_full_day', true)} />{t('fullDayOption') || '整天 (8小時)'}</label><label className="radio-option"><input type="radio" name="timeOption" checked={!createForm.is_full_day} onChange={() => handleCreateFormChange('is_full_day', false)} />{t('specificTimeOption') || '指定時間'}</label></div></div>{!createForm.is_full_day && (<><div className="form-group"><label>{t('labelStartTime') || '開始時間'}:</label><select value={createForm.start_time} onChange={(e) => handleCreateFormChange('start_time', e.target.value)} className="form-input"><option value="">{t('selectTime') || '選擇時間'}</option>{getTimeOptions().map(time => (<option key={time} value={time}>{time}</option>))}</select></div><div className="form-group"><label>{t('labelEndTime') || '結束時間'}:</label><select value={createForm.end_time} onChange={(e) => handleCreateFormChange('end_time', e.target.value)} className="form-input"><option value="">{t('selectTime') || '選擇時間'}</option>{getTimeOptions(createForm.start_time).map(time => (<option key={time} value={time}>{time}</option>))}</select></div></>)}</div>) : (<div className="multi-day-info"><div className="info-box"><span className="info-icon">📅</span><div className="info-content"><div className="info-title">{t('multiDayLeave') || '多天請假'}</div><div className="info-desc">{t('multiDayLeaveDesc') || '系統將自動計算工作日天數（跳過週末）'}</div></div></div></div>)}</>)}
<div className="form-group"><label>{t('labelCalculatedHours') || '計算時數'}:</label><div className="calculated-hours">{createForm.leave_hours} {t('messageHours')}</div></div>
<div className="form-group"><label>{t('labelReason')} ({t('labelOptional') || '選填'}):</label><textarea value={createForm.reason} onChange={(e) => handleCreateFormChange('reason', e.target.value)} className="form-input" rows="3" placeholder={t('messagePlaceholderReason') || '請輸入請假原因...'} /></div>
</div>
</div>
<div className="modal-footer">
{/* 統一按鈕樣式為 btn-secondary [81] */}
<button className="btn-secondary" onClick={handleCreateLeaveRequest}>✅ {t('actionSubmit') || '提交'}</button>
<button className="btn-secondary" onClick={() => setShowCreateModal(false)}>{t('actionCancel')}</button>
</div>
</div>
</div>
)}

{showModal && selectedRequest && (
<div className="modal-overlay" onClick={() => setShowModal(false)}>
<div className="modal-content" onClick={e => e.stopPropagation()}>
<div className="modal-header"><h3>{t('modalReviewRequest')}</h3><button className="modal-close" onClick={() => setShowModal(false)}>×</button></div>
<div className="modal-body">
<div className="review-info">
<p><strong>{t('labelEmployee')}:</strong> {selectedRequest.staff}</p>
<p><strong>{t('labelLeaveType')}:</strong> {leaveTypeMap[selectedRequest.leave_type]}</p>
<p><strong>{t('labelPeriod')}:</strong> {selectedRequest.start_date} ~ {selectedRequest.end_date}</p>
<p><strong>{t('labelHours')}:</strong> {selectedRequest.leave_hours} {t('messageHours')}</p>
{selectedRequest.reason && (<p><strong>{t('labelReason')}:</strong> {selectedRequest.reason}</p>)}
</div>
</div>
<div className="modal-footer">
<button className="btn btn-success" onClick={() => handleStatusChange(selectedRequest.id, 'approved')}>✅ {t('actionApprove')}</button>
<button className="btn btn-danger" onClick={() => handleStatusChange(selectedRequest.id, 'rejected')}>❌ {t('actionReject')}</button>
<button className="btn-secondary" onClick={() => setShowModal(false)}>{t('actionCancel')}</button>
</div>
</div>
</div>
)}
</div>
);
};
export default LeaveRequests;