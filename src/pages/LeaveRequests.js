import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { leaveRequestAPI, leaveBalanceAPI } from '../services/api';
import LanguageSwitch from '../components/LanguageSwitch';
import '../styles/LeaveRequests.css';
// 已移除未使用的 DateTimeSelector 匯入 [1]
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

  // 檢查用戶是否有請假權限
  const canAccessLeaveRequests = () => {
    return user?.position_type === 'full' || user?.position_type === 'part' || user?.position_type === 'admin';
  };

  // 檢查用戶是否可以審核請假
  const canReviewLeaveRequests = () => {
    return user?.is_staff === true;
  };

  // 檢查是否為自己的請假申請
  const isOwnRequest = (request) => {
    if (!user || !request) return false;
    const currentUserName = user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.name || user.username || user.email;
    return request.staff === currentUserName;
  };

  // 檢查是否可以取消請假申請
  const canCancelRequest = (request) => {
    if (!isOwnRequest(request)) return false;
    return request.status === 'pending' || request.status === 'approved';
  };

  // 檢查是否可以審核請假申請
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

  // 已移除未使用的 calculateLeaveHours 函式塊 [2, 3, 5, 6]

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
      console.error('載入請假餘額失敗:', error);
      setLeaveBalance({
        staff: user?.name || 'Unknown',
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
      if (createForm.leave_type === 'annual' || createForm.leave_type === 'sick') {
        const availableHours = getAvailableHours(createForm.leave_type);
        if (createForm.leave_hours > availableHours) {
          const leaveTypeName = createForm.leave_type === 'annual' ? t('leaveTypeAnnual') : t('leaveTypeSick');
          alert(`${leaveTypeName}${t('insufficientBalance') || '餘額不足'}！${t('availableHours') || '您可用時數'}：${availableHours} ${t('messageHours')}，${t('requestedHours') || '申請時數'}：${createForm.leave_hours} ${t('messageHours')}`);
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
      const today = new Date().toISOString().split('T');
      if (createForm.start_date < today) {
        alert(t('startDateCannotBeEarlier') || '開始日期不能早於今天');
        return;
      }
      if (createForm.leave_hours <= 0) {
        alert(t('leaveHoursMustBeGreaterThanZero') || '請假時數必須大於0');
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
      await leaveRequestAPI.update(requestId, { status: newStatus });
      await loadLeaveRequests();
      await loadLeaveBalance();
      setShowModal(false);
      setSelectedRequest(null);
    } catch (error) {
      alert(`${t('messageUpdateFailed')}: ${error.message}`);
    }
  };

  const handleCancelRequest = async (request) => {
    try {
      if (!window.confirm(t('confirmCancelRequest') || '確定要取消這個請假申請嗎？')) return;
      await leaveRequestAPI.update(request.id, { status: 'canceled' });
      await loadLeaveRequests();
      await loadLeaveBalance();
      alert(t('messageCancelSuccess') || '請假申請已取消');
    } catch (error) {
      alert(`${t('messageCancelFailed') || '取消失敗'}: ${error.response?.data?.message || error.message}`);
    }
  };

  const filteredRequests = leaveRequests.filter(request => {
    if (selectedStatus === 'all') return true;
    return request.status === selectedStatus;
  });

  const getLeaveBalanceInfo = () => {
    if (!leaveBalance) return { annual: { available: 0 }, sick: { available: 0 } };
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

  if (user && !canAccessLeaveRequests()) {
    return (
      <div className="leave-requests">
        <div className="page-header">
          <div className="header-content">
            <button className="btn-secondary" onClick={() => navigate('/dashboard')}>← {t('backToDashboard')}</button>
            <h1 className="page-title">{t('leaveRequestsTitle')}</h1>
            <LanguageSwitch />
          </div>
        </div>
        <div className="no-permission">
          <h3>{t('accessDenied') || '無法訪問'}</h3>
          <p>{t('leavePermissionMessage') || '只有正職員工和兼職員工可以使用請假功能'}</p>
          <button className="btn-primary" onClick={() => navigate('/dashboard')}>{t('backToDashboard')}</button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="leave-requests-loading"><div className="loading-spinner"></div><p>{t('messageLoading')}</p></div>;

  return (
    <div className="leave-requests">
      <div className="page-header">
        <div className="header-content">
          <div className="page-title-section">
            <h1 className="page-title">{t('leaveRequestsTitle')}</h1>
            <div className="user-info">
              <span className="user-label">{t('applicant')}：</span>
              <span className="user-name">{user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.name || t('unknownUser')}</span>
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
            <h3>{t('leaveTypeAnnual')}</h3>
            <div className="balance-value available">{leaveBalanceInfo.annual.available.toFixed(1)} {t('messageHours')}</div>
          </div>
          <div className="balance-card sick">
            <h3>{t('leaveTypeSick')}</h3>
            <div className="balance-value available">{leaveBalanceInfo.sick.available.toFixed(1)} {t('messageHours')}</div>
          </div>
        </div>
      </div>

      <div className="filters-section">
        <div className="filter-tabs">
          {['all', 'pending', 'approved', 'rejected'].map(key => (
            <button key={key} className={`filter-tab ${selectedStatus === key ? 'active' : ''}`} onClick={() => setSelectedStatus(key)}>
              {t(`${key}Applications`) || key} <span className="count-badge">{key === 'all' ? leaveRequests.length : leaveRequests.filter(r => r.status === key).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="requests-section">
        {filteredRequests.length === 0 ? (
          <div className="no-requests"><h3>{t('messageNoRequests')}</h3></div>
        ) : (
          <div className="requests-list">
            {filteredRequests.map((request, index) => (
              <div key={index} className="request-card">
                <div className="request-header">
                  <div className="employee-name">{request.staff || t('messageUnknownEmployee')}</div>
                  <span className={`status-badge ${request.status}`} style={{ backgroundColor: statusMap[request.status]?.color }}>{statusMap[request.status]?.label}</span>
                </div>
                <div className="request-details">
                  <p>{t('labelPeriod')}: {request.start_date} ~ {request.end_date} ({request.leave_hours} {t('messageHours')})</p>
                  {request.reason && <p>{t('labelReason')}: {request.reason}</p>}
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
                  <option value="personal">{t('leaveTypePersonal')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('labelStartDate')}:</label>
                <input type="date" value={createForm.start_date} onChange={(e) => handleCreateFormChange('start_date', e.target.value)} className="form-input" />
              </div>
              <div className="form-group">
                <label>{t('labelEndDate')}:</label>
                <input type="date" value={createForm.end_date} onChange={(e) => handleCreateFormChange('end_date', e.target.value)} className="form-input" />
              </div>
              {createForm.start_date === createForm.end_date && (
                <div className="form-group">
                  <label><input type="radio" checked={createForm.is_full_day} onChange={() => handleCreateFormChange('is_full_day', true)} /> {t('fullDayOption')}</label>
                  <label><input type="radio" checked={!createForm.is_full_day} onChange={() => handleCreateFormChange('is_full_day', false)} /> {t('specificTimeOption')}</label>
                </div>
              )}
              {!createForm.is_full_day && (
                <div className="form-group">
                  <select value={createForm.start_time} onChange={(e) => handleCreateFormChange('start_time', e.target.value)}>{getTimeOptions().map(t => <option key={t} value={t}>{t}</option>)}</select>
                  <select value={createForm.end_time} onChange={(e) => handleCreateFormChange('end_time', e.target.value)}>{getTimeOptions(createForm.start_time).map(t => <option key={t} value={t}>{t}</option>)}</select>
                </div>
              )}
              <div className="form-group">
                <label>{t('labelCalculatedHours')}: {createForm.leave_hours} {t('messageHours')}</label>
              </div>
              <div className="form-group">
                <textarea value={createForm.reason} onChange={(e) => handleCreateFormChange('reason', e.target.value)} placeholder={t('messagePlaceholderReason')} className="form-input" />
              </div>
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
            <h3>{t('modalReviewRequest')}</h3>
            <div className="modal-body">
              <p><strong>{t('labelEmployee')}:</strong> {selectedRequest.staff}</p>
              <p><strong>{t('labelLeaveType')}:</strong> {leaveTypeMap[selectedRequest.leave_type]}</p>
              <p><strong>{t('labelPeriod')}:</strong> {selectedRequest.start_date} ~ {selectedRequest.end_date}</p>
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