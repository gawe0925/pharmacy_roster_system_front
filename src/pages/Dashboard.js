import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import LanguageSwitch from '../components/LanguageSwitch';
import { staffShiftAPI, shiftAPI } from '../services/api';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const { t } = useLanguage();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [todayShifts, setTodayShifts] = useState([]);
  const [shiftTypes, setShiftTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  console.log('翻譯測試:', t('coveringFor'), t('employee'), t('todayRoster'));

  // 檢查用戶是否有請假權限
  const canAccessLeaveRequests = () => {
    return user?.position_type === 'full' || user?.position_type === 'part' || user?.position_type === 'admin';
  };

  // 檢查用戶是否有管理權限 (staff/superuser)
  const hasManagementPermission = () => {
    return user?.is_manager === true || user?.is_superuser === true;
  };

  // 檢查用戶是否可以訪問薪資查詢 (所有員工都可以查看自己的薪資)
  const canAccessPayroll = () => {
    return true; // 所有登入的用戶都可以查看薪資
  };

  // 格式化日期為 YYYY-MM-DD
  const formatDateToString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 格式化日期為 YYYY/MM/DD
  const formatDisplayDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  // 格式化時間顯示
  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  // 班別翻譯函數 - 使用翻譯文本系統
  const getTranslatedShiftName = (shiftName) => {
    if (!shiftName) return '';
    
    // 根據班別名稱直接從翻譯文本獲取
    // 這裡假設翻譯文本的key是駝峰命名法
    const lowerShiftName = shiftName.toLowerCase().replace(/\s+/g, '');
    
    // 嘗試不同的翻譯key格式
    const possibleKeys = [
      shiftName, // 原始名稱
      lowerShiftName, // 小寫無空格
      `shift_${lowerShiftName}`, // 加前綴
      // 特定班別的映射
      shiftName === '早班' ? 'morningShift' : null,
      shiftName === '中班' ? 'middleShift' : null,
      shiftName === '晚班' ? 'afternoonShift' : null,
      shiftName === '週末早班' ? 'weekendMorning' : null,
      shiftName === '週末中班' ? 'weekendMidday' : null,
      shiftName === '週末幫手A' ? 'weekendHelperA' : null,
      shiftName === '週末幫手B' ? 'weekendHelperB' : null,
      shiftName === '週末班' ? 'weekendShift' : null,
      shiftName === 'Morning Shift' ? 'morningShift' : null,
      shiftName === 'Middle Shift' ? 'middleShift' : null,
      shiftName === 'Afternoon Shift' ? 'afternoonShift' : null,
      shiftName === 'Weekend Morning' ? 'weekendMorning' : null,
      shiftName === 'Weekend Midday' ? 'weekendMidday' : null,
      shiftName === 'Weekend Helper A' ? 'weekendHelperA' : null,
      shiftName === 'Weekend Helper B' ? 'weekendHelperB' : null,
      shiftName === 'Weekend Shift' ? 'weekendShift' : null
    ].filter(Boolean);

    // 嘗試每個可能的key，找到第一個有翻譯的
    for (const key of possibleKeys) {
      const translation = t(key);
      if (translation && translation !== key) {
        return translation;
      }
    }

    // 如果都沒有翻譯，返回原始名稱
    return shiftName;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // 獲取今天的日期字符串
        const today = formatDateToString(new Date());
        console.log('Loading shifts for today:', today);
        
        // 同時載入班次類型和今日班次
        const [shiftTypesRes, shiftsRes] = await Promise.all([
          shiftAPI.list(),
          staffShiftAPI.list({
            start_date: today,
            end_date: today
          })
        ]);

        // 設定班次類型
        setShiftTypes(shiftTypesRes.data.results || shiftTypesRes.data || []);

        const allShifts = shiftsRes.data.results || shiftsRes.data || [];
        // console.log('All shifts received:', allShifts);
        
        // 過濾出今天的班次（雙重確保）
        const todayShiftsOnly = allShifts.filter(shift => shift.shift_date === today);
        console.log('Today shifts filtered:', todayShiftsOnly);
        
        setTodayShifts(todayShiftsOnly);
        
      } catch (error) {
        console.error('載入今日班次失敗:', error);
        setTodayShifts([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // 獲取班次時間信息
  const getShiftTimeInfo = (shiftId, shiftName) => {
    // 先用 shift_name 直接找
    const shiftType = shiftTypes.find(type => 
      type.shift_name === shiftName || type.id === shiftId
    );
    
    if (shiftType) {
      console.log('shiftTypes state:', shiftTypes);
      console.log('todayShifts state:', todayShifts);
      return {
        startTime: formatTime(shiftType.start_time),
        endTime: formatTime(shiftType.end_time),
        shiftName: shiftType.shift_name
      };
    }
    
    return {
      startTime: '',
      endTime: '',
      shiftName: shiftName || String(shiftId)
    };
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>{t('loading') || '載入中...'}</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* 頭部區域 */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="welcome-section">
            <h1 className="welcome-title">
              {t('welcomeMessage') || '歡迎回來'}，{user?.first_name || user?.username}
            </h1>
          </div>
          
          <div className="header-actions">
            <LanguageSwitch />
            <button className="logout-btn" onClick={logout}>
              {t('logout') || '登出'}
            </button>
          </div>
        </div>
      </div>

      {/* 快速操作區域 - 根據權限顯示不同按鈕 */}
      <div className="content-section">
        <h2 className="section-title">{t('quickActions') || '快速操作'}</h2>
        
        <div className="actions-grid">
          {/* 班表 - 所有用戶都可以查看 */}
          <button 
            className="action-btn"
            onClick={() => navigate('/roster')}
          >
            <span className="action-icon">🗓️</span>
            <span>{t('roster') || '班表'}</span>
          </button>

          {/* 員工排班 - 只有staff和superuser可以訪問 */}
          {hasManagementPermission() && (
            <button 
              className="action-btn"
              onClick={() => navigate('/staff-scheduling')}
            >
              <span className="action-icon">📋</span>
              <span>{t('staffScheduling') || '員工排班'}</span>
            </button>
          )}

          {/* 班次管理 - 只有staff和superuser可以訪問 */}
          {hasManagementPermission() && (
            <button 
              className="action-btn"
              onClick={() => navigate('/shift-management')}
            >
              <span className="action-icon">⚙️</span>
              <span>{t('shiftManagement') || '班次管理'}</span>
            </button>
          )}
          
          {/* 員工列表 vs 個人資料 - 根據權限顯示不同內容 */}
          <button 
            className="action-btn"
            onClick={() => navigate('/staff')}
          >
            <span className="action-icon">
              {hasManagementPermission() ? '👥' : '👤'}
            </span>
            <span>
              {hasManagementPermission() 
                ? (t('staffList') || '員工列表')
                : (t('myProfile') || '個人資料')
              }
            </span>
          </button>
          
          {/* 請假管理 - 正職和兼職員工才顯示 */}
          {canAccessLeaveRequests() && (
            <button 
              className="action-btn"
              onClick={() => navigate('/leave-requests')}
            >
              <span className="action-icon">📄</span>
              <span>{t('leaveRequests') || '請假管理'}</span>
            </button>
          )}
          
          {/* 薪資查詢 - 所有員工都可以訪問 */}
          {canAccessPayroll() && (
            <button 
              className="action-btn"
              onClick={() => navigate('/payroll')}
            >
              <span className="action-icon">💰</span>
              <span>{t('payroll') || '薪資查詢'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 今日班次預覽 - 改為表格樣式 */}
      <div className="content-section">
        <h2 className="section-title">
          {formatDisplayDate(new Date())} {t('todayRoster') || '今日班表'}
        </h2>
        
        {todayShifts.length > 0 ? (
          <div className="shifts-table-container">
            {/* 表格標題 */}
            <div className="shifts-table-header">
              <div className="header-cell staff-name">{t('staffName') || '員工姓名'}</div>
              <div className="header-cell shift-type">{t('shiftType') || '班別'}</div>
              <div className="header-cell shift-time">{t('shiftTime') || '時間'}</div>
            </div>
            
            {/* 表格內容 */}
            <div className="shifts-table-body">
              {todayShifts.map((shift, index) => {
                const timeInfo = getShiftTimeInfo(shift.shift, shift.shift_name);
                
                // 獲取實際工作人員
                const getActualWorker = (shift) => {
                  if (shift.cover_shift) {
                    return {
                      name: shift.alternative_staff_name,
                      originalStaff: shift.staff_name,
                      isCover: true
                    };
                  } else {
                    return {
                      name: shift.staff_name,
                      originalStaff: null,
                      isCover: false
                    };
                  }
                };

                const worker = getActualWorker(shift);

                return (
                  <div key={shift.id || index} className="shifts-table-row">
                    {/* 員工姓名 */}
                    <div className="table-cell staff-name">
                      <span className="staff-name-text">
                        {worker.name || t('employee') || '員工'}
                      </span>
                      {worker.isCover && (
                        <>
                          {/* <span className="cover-indicator" title={`${t('coveringFor') || '代班'}: ${worker.originalStaff}`}>
                            🔄
                          </span> */}
                          <div className="cover-info">
                            {t('coveringFor') || '代班'} {worker.originalStaff}
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* 班別 - 使用翻譯系統 */}
                    <div className="table-cell shift-type">
                      {getTranslatedShiftName(timeInfo.shiftName)}
                    </div>
                    
                    {/* 時間 */}
                    <div className="table-cell shift-time">
                      {timeInfo.startTime && timeInfo.endTime 
                        ? `${timeInfo.startTime} ~ ${timeInfo.endTime}`
                        : (t('timeNotSet') || '時間未設定')
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="no-shifts">
            <div className="no-shifts-icon">📅</div>
            <div className="no-shifts-text">
              {t('noShiftsToday') || '今日沒有排班'}
            </div>
            <div className="no-shifts-subtitle">
              {t('checkBackTomorrow') || '明天再回來看看吧！'}
            </div>
            {hasManagementPermission() && (
              <button 
                className="add-shift-btn"
                onClick={() => navigate('/staff-scheduling')}
              >
                {t('addShift') || '新增排班'}
              </button>
            )}
          </div>
        )}
        
        {/* 查看完整班表的按鈕 */}
        <div className="view-full-roster">
          <button 
            className="view-roster-btn"
            onClick={() => navigate('/roster')}
          >
            {t('viewFullRoster') || '完整班表'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;