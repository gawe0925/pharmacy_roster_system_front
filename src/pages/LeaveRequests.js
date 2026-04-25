import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { leaveRequestAPI, leaveBalanceAPI } from '../services/api';
import LanguageSwitch from '../components/LanguageSwitch';
import '../styles/LeaveRequests.css';
// 僅移除未使用的 DateTimeSelector 匯入，避免 Vercel 報錯 [1]
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LeaveRequests = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();

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

  const canAccessLeaveRequests = () => {
    return user?.position_type === 'full' || user?.position_type === 'part' || user?.position_type === 'admin';
  };

  const canReviewLeaveRequests = () => {
    return user?.is_staff === true;
  };

  const isOwnRequest = (request) => {
    if (!user || !request) return false;
    // 嚴格比對用戶姓名邏輯 [2]
    const currentUserName = user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.name || user.username || user.email;
    return request.staff === currentUserName;
  };

  const canCancelRequest = (request) => {
    if (!isOwnRequest(request)) return false;
    return request.status === 'pending' || request.status === 'approved';
  };

  const canReviewRequest = (request) => {
    if (!canReviewLeaveRequests()) return false;
    if (isOwnRequest(request)) return false; 
    return request.status === 'pending';
  };

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
      case 'annual': return parseFloat(leaveBalance.available_annual_leave_hours || 0); [3]
      case 'sick': return parseFloat(leaveBalance.available_sick_leave_hours || 0); [3]
      default: return 0;
    }
  };

  const getRemainingHours = (leaveType, deductHours) => {
    const available = getAvailableHours(leaveType);
    return Math.max(0, available - deductHours);
  };

  // 保留原始時數計算函式 [3-6]
  const calculateLeaveHours = (startDate, endDate, isFullDay = true, startTime = '', endTime = '') => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const isSameDay = start.toDateString() === end.toDateString();
    if (isSameDay) {
      if (isFullDay) return 8;
      if (!startTime || !endTime) return 0;
      const startDateTime = new Date(`${startDate}T${startTime}`);
      const endDateTime = new Date(`${endDate}T${endTime}`);
      if (startDateTime >= endDateTime) return 0;
      const diffInHours = (endDateTime - startDateTime) / (1000 * 60 * 60);
      return Math.round(diffInHours * 100) / 100;
    } else {
      let totalHours = 0;
      const currentDate = new Date(start);
      while (currentDate <= end) {
        if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) { totalHours += 8; }
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

  const handleCreateFormChange = (field, value) => {
    const updatedForm = { ...createForm, [field]: value };
    if (field === 'start_date' || field === 'end_date') {
      updatedForm.start_time = '';
      updatedForm.end_time = '';
      updatedForm.is_full_day = true;
    }
    if (field === 'start_date') {
      const today = new Date().toISOString().split('T');
      if (value < today) {
        alert(t('cannotSelectPastDate') || '不能選擇過去的日期');
        return;
      }
    }
    if (field === 'is_full_day') {
      updatedForm.start_time = '';
      updatedForm.end_time = '';
    }
    // 重新計算時數邏輯（保留原始寫法）[7-9]
    if (updatedForm.start_date && updatedForm.end_date) {
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
          if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) { totalHours += 8; }
          currentDate.setDate(currentDate.getDate() + 1);
        }
        updatedForm.leave_hours = totalHours;
      }
    } else {
      updatedForm.leave_hours = 0;
    }
    setCreateForm(updatedForm);
  };

  const loadLeaveBalance = async () => {
    try {
      const response = await leaveBalanceAPI.get();
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
      setLeaveBalance({ staff: user?.name || 'Unknown', available_annual_leave_hours: '0.00', available_sick_leave_hours: '0.00' });
    }
  };

  const handleCreateLeaveRequest = async () => {
    try {
      if (!createForm.leave_type || !createForm.start_date || !createForm.end_date) {
        alert(t('messageAllFieldsRequired') || '請填寫所有必填欄位');
        return;
      }
      if (createForm.leave_type === 'annual' || createForm.leave_type === 'sick') {
        const availableHours = getAvailableHours(createForm.leave_type);
        if (createForm.leave_hours > availableHours) {
          const leaveTypeName = createForm.leave_type === 'annual' ? t('leaveTypeAnnual') : t('leaveTypeSick');
          alert(`${leaveTypeName}${t('insufficientBalance')}！${t('availableHours')}：${availableHours}, ${t('requestedHours')}：${createForm.leave_hours}`);
          return;
        }
      }
      const isSameDay = createForm.start_date === createForm.end_date;
      if (isSameDay && !createForm.is_full_day && (!createForm.start_time || !createForm.end_time)) {
        alert(t('pleaseSelectStartEndTime') || '請選擇時間');
        return;
      }
      const submitData = { ...createForm };
      if (isSameDay && !createForm.is_full_day) {
        submitData.start_date = `${createForm.start_date}T${createForm.start_time}`;
        submitData.end_date = `${createForm.end_date}T${createForm.end_time}`;
      }
      await leaveRequestAPI.create(submitData);
      setCreateForm({ leave_type: '', start_date: '', end_date: '', reason: '', leave_hours: 0, is_full_day: true, start_time: '', end_time: '' });
      setShowCreateModal(false);
      await loadLeaveRequests();
      await loadLeaveBalance();
      alert(t('messageCreateSuccess'));
    } catch (error) {
      alert(`${t('messageCreateFailed')}: ${error.message}`);
    }
  };

  const loadLeaveRequests = async () => {
    try {
      setLoading(true);
      const response = await leaveRequestAPI.list();
      setLeaveRequests(response.data.results || response.data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (requestId, newStatus) => {
    try {
      await leaveRequestAPI.update(requestId, { status: newStatus });
      await loadLeaveRequests();
      await loadLeaveBalance();
      setShowModal(false);
    } catch (error) {
      alert(`${t('messageUpdateFailed')}: ${error.message}`);
    }
  };

  const handleCancelRequest = async (request) => {
    if (!window.confirm(t('confirmCancelRequest'))) return;
    try {
      await leaveRequestAPI.update(request.id, { status: 'canceled' });
      await loadLeaveRequests();
      await loadLeaveBalance();
      alert(t('messageCancelSuccess'));
    } catch (error) {
      alert(t('messageCancelFailed'));
    }
  };

  const filteredRequests = leaveRequests.filter(r => selectedStatus === 'all' || r.status === selectedStatus);
  const leaveBalanceInfo = getLeaveBalanceInfo();

  function getLeaveBalanceInfo() {
    if (!leaveBalance) return { annual: { available: 0 }, sick: { available: 0 } };
    return {
      annual: { available: parseFloat(leaveBalance.available_annual_leave_hours || 0) },
      sick: { available: parseFloat(leaveBalance.available_sick_leave_hours || 0) }
    };
  }

  useEffect(() => {
    if (user) {
      if (!canAccessLeaveRequests()) {
        alert(t('noLeavePermission'));
        navigate('/dashboard');
        return;
      }
      Promise.all([loadLeaveRequests(), loadLeaveBalance()]);
    }
  }, [user, navigate]);

  if (loading) return <div className="leave-requests-loading"><div className="loading-spinner"></div><p>{t('messageLoading')}</p></div>;

  return (
    <div className="leave-requests">
      {/* 恢復所有 Icon 與詳細的使用者判斷邏輯 [10-12] */}
      <div className="page-header">
        <div className="header-content">
          <div className="page-title-section">
            <h1 className="page-title">
              <span className="title-icon">📋</span>
              {t('leaveRequestsTitle')}
            </h1>
            <div className="user-info">
              <span className="user-label">{t('applicant')}：</span>
              <span className="user-name">
                {user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user?.name || user?.username || user?.email || t('unknownUser') || '未知用戶'
                }
              </span>
            </div>
          </div>
          <div className="header-actions">
            <LanguageSwitch />
            <button className="create-btn" onClick={() => setShowCreateModal(true)}>➕ {t('actionCreateLeave')}</button>
            <button className="btn-secondary" onClick={() => navigate('/dashboard')}>← {t('backToDashboard')}</button>
          </div>
        </div>
      </div>

      <div className="leave-balance-section">
        <div className="balance-cards">
          <div className="balance-card annual">
            <div className="balance-header"><span className="balance-icon">🏖️</span><h3>{t('leaveTypeAnnual')}</h3></div>
            <div className="balance-item"><span className="balance-label">{t('availableHours')}：</span><span className="balance-value available">{leaveBalanceInfo.annual.available.toFixed(1)} {t('messageHours')}</span></div>
          </div>
          <div className="balance-card sick">
            <div className="balance-header"><span className="balance-icon">🤒</span><h3>{t('leaveTypeSick')}</h3></div>
            <div className="balance-item"><span className="balance-label">{t('availableHours')}：</span><span className="balance-value available">{leaveBalanceInfo.sick.available.toFixed(1)} {t('messageHours')}</span></div>
          </div>
        </div>
      </div>

      <div className="filters-section">
        <div className="filter-tabs">
          {[{ key: 'all', label: t('allApplications') }, { key: 'pending', label: t('pendingApplications') }, { key: 'approved', label: t('approvedApplications') }, { key: 'rejected', label: t('rejectedApplications') }].map(({ key, label }) => (
            <button key={key} className={`filter-tab ${selectedStatus === key ? 'active' : ''}`} onClick={() => setSelectedStatus(key)}>
              {label} <span className="count-badge">{key === 'all' ? leaveRequests.length : leaveRequests.filter(r => r.status === key).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="requests-section">
        {filteredRequests.length === 0 ? (
          <div className="no-requests"><div className="no-requests-icon">📝</div><h3>{t('messageNoRequests')}</h3></div>
        ) : (
          <div className="requests-list">
            {filteredRequests.map((request, index) => (
              <div key={index} className="request-card">
                <div className="request-header">
                  <div className="employee-info">
                    <div className="employee-avatar">{request.staff ? request.staff.toUpperCase() : '?'}</div>
                    <div className="employee-details"><h3 className="employee-name">{request.staff || t('messageUnknownEmployee')}</h3></div>
                  </div>
                  <span className={`status-badge ${request.status}`} style={{ backgroundColor: statusMap[request.status]?.color }}>{statusMap[request.status]?.label}</span>
                </div>
                <div className="request-content">
                  <div className="detail-row"><span className="detail-label">{t('labelPeriod')}:</span><span className="detail-value">{request.start_date} ~ {request.end_date}</span></div>
                  <div className="detail-row"><span className="detail-label">{t('labelHours')}:</span><span className="detail-value">{request.leave_hours} {t('messageHours')}</span></div>
                </div>
                <div className="request-actions">
                  {canReviewRequest(request) && <button className="action-btn review-btn" onClick={() => { setSelectedRequest(request); setShowModal(true); }}>📋 {t('actionReview')}</button>}
                  {canCancelRequest(request) && <button className="action-btn cancel-btn" onClick={() => handleCancelRequest(request)}>❌ {t('actionCancelRequest')}</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content create-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{t('modalCreateLeave')}</h3></div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t('labelLeaveType')}:</label>
                <select value={createForm.leave_type} onChange={(e) => handleCreateFormChange('leave_type', e.target.value)} className="form-input">
                  <option value="">{t('messagePleaseSelect')}</option>
                  <option value="annual">{t('leaveTypeAnnual')}</option>
                  <option value="sick">{t('leaveTypeSick')}</option>
                </select>
              </div>
              {/* 恢復詳細的計算餘額顯示區塊 [13-18] */}
              {(createForm.leave_type === 'annual' || createForm.leave_type === 'sick') && (
                <div className="leave-balance-info">
                  <div className="balance-display">
                    <span className="balance-icon">{createForm.leave_type === 'annual' ? '🏖️' : '🤒'}</span>
                    <span className="balance-type">{t('currentlyAvailable')}：{getAvailableHours(createForm.leave_type).toFixed(1)} {t('messageHours')}</span>
                  </div>
                  {createForm.leave_hours > 0 && (
                    <div className="balance-calculation">
                      <div className="calculation-row"><span>{t('thisApplication')}：</span><span>-{createForm.leave_hours.toFixed(1)}</span></div>
                      <div className="calculation-row result"><span>{t('remainingAfterApplication')}：</span><span className={getRemainingHours(createForm.leave_type, createForm.leave_hours) < 0 ? 'insufficient' : ''}>{getRemainingHours(createForm.leave_type, createForm.leave_hours).toFixed(1)}</span></div>
                    </div>
                  )}
                </div>
              )}
              <div className="form-group"><label>{t('labelStartDate')}:</label><input type="date" value={createForm.start_date} onChange={(e) => handleCreateFormChange('start_date', e.target.value)} className="form-input" /></div>
              <div className="form-group"><label>{t('labelEndDate')}:</label><input type="date" value={createForm.end_date} onChange={(e) => handleCreateFormChange('end_date', e.target.value)} className="form-input" /></div>
              {/* 同一天時間選擇邏輯 [19-27] */}
              {createForm.start_date && createForm.end_date && createForm.start_date === createForm.end_date && (
                <div className="same-day-options">
                  <label><input type="radio" checked={createForm.is_full_day} onChange={() => handleCreateFormChange('is_full_day', true)} /> {t('fullDayOption')}</label>
                  <label><input type="radio" checked={!createForm.is_full_day} onChange={() => handleCreateFormChange('is_full_day', false)} /> {t('specificTimeOption')}</label>
                  {!createForm.is_full_day && (
                    <div className="time-selects">
                      <select value={createForm.start_time} onChange={(e) => handleCreateFormChange('start_time', e.target.value)}>{getTimeOptions().map(time => <option key={time} value={time}>{time}</option>)}</select>
                      <select value={createForm.end_time} onChange={(e) => handleCreateFormChange('end_time', e.target.value)}>{getTimeOptions(createForm.start_time).map(time => <option key={time} value={time}>{time}</option>)}</select>
                    </div>
                  )}
                </div>
              )}
              <div className="form-group"><strong>{t('labelCalculatedHours')}: {createForm.leave_hours} {t('messageHours')}</strong></div>
              <div className="form-group"><textarea value={createForm.reason} onChange={(e) => handleCreateFormChange('reason', e.target.value)} placeholder={t('messagePlaceholderReason')} className="form-input" rows="3" /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-success" onClick={handleCreateLeaveRequest}>✅ {t('actionSubmit')}</button>
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>{t('actionCancel')}</button>
            </div>
          </div>
        </div>
      )}

      {showModal && selectedRequest && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{t('modalReviewRequest')}</h3></div>
            <div className="modal-body">
              <p><strong>{t('labelEmployee')}:</strong> {selectedRequest.staff}</p>
              <p><strong>{t('labelLeaveType')}:</strong> {leaveTypeMap[selectedRequest.leave_type]}</p>
              <p><strong>{t('labelPeriod')}:</strong> {selectedRequest.start_date} ~ {selectedRequest.end_date}</p>
              <p><strong>{t('labelHours')}:</strong> {selectedRequest.leave_hours}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-success" onClick={() => handleStatusChange(selectedRequest.id, 'approved')}>✅ {t('actionApprove')}</button>
              <button className="btn btn-danger" onClick={() => handleStatusChange(selectedRequest.id, 'rejected')}>❌ {t('actionReject')}</button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('actionCancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveRequests;