import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { wageAPI, memberAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import LanguageSwitch from '../components/LanguageSwitch';
import '../styles/Payroll.css';

const Payroll = () => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const navigate = useNavigate();
    
    // 狀態管理
    const [loading, setLoading] = useState(false);
    const [searchType, setSearchType] = useState('period');
    const [searchParams, setSearchParams] = useState({
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        duration: 'week',
        staff_id: ''
    });
    const [payrollData, setPayrollData] = useState({
        shift_detail: [],
        total_salary: 0,
        search_period: '',
        days: 0
    });
    const [members, setMembers] = useState([]);
    const [error, setError] = useState('');
    
    // 新增：可用日期範圍狀態
    const [availableDateRange, setAvailableDateRange] = useState({
        min: '',
        max: ''
    });

    // 權限檢查
    const canAccessPayroll = () => {
        return user?.is_manager === true || user?.position_type === 'admin';
    };

    // 檢查是否為超級用戶（只有超級用戶可以選擇員工）
    const isSuperUser = () => {
        return user?.is_superuser === true;
    };

    // 檢查是否為一般管理員
    const isAdmin = () => {
        return user?.is_manager === true || user?.position_type === 'admin';
    };

    // 載入員工列表
    const loadMembers = async () => {
        if (!isSuperUser()) return;
        
        try {
            const response = await memberAPI.list();
            setMembers(response.data.results || response.data || []);
        } catch (error) {
            console.error('載入員工列表失敗:', error);
        }
    };

    // 使用已知的有效日期進行查詢
    const fetchAvailableDateRange = async () => {
        try {
            const response = await wageAPI.list({
                start_date: '1900-01-01',
                end_date: '2099-12-31'
            });
            
            const data = response.data;
            
            if (data.valid_date_from && data.valid_date_til) {
                setAvailableDateRange({
                    min: data.valid_date_from,
                    max: data.valid_date_til
                });
                
                // 設置開始日期為 valid_date_from
                setSearchParams(prev => ({
                    ...prev,
                    start_date: data.valid_date_from
                }));
            }
        } catch (error) {
            console.error('獲取日期範圍失敗:', error);
        }
    };

    // 修正計算結束日期的邏輯
    const calculateEndDate = (startDate, duration) => {
        if (!startDate) return '';
        
        const start = new Date(startDate);
        let end = new Date(start);
        
        switch (duration) {
            case 'week':
                end.setDate(start.getDate() + 7);
                break;
            case 'fort':
                end.setDate(start.getDate() + 14);
                break;
            case 'month':
                end.setMonth(start.getMonth() + 1);
                end.setDate(start.getDate() - 1);
                break;
            default:
                return '';
        }
        
        return end.toISOString().split('T')[0];
    };

    // 當搜尋類型為區間時，自動計算結束日期
    useEffect(() => {
        if (searchType === 'period' && searchParams.start_date && searchParams.duration) {
            const endDate = calculateEndDate(searchParams.start_date, searchParams.duration);
            setSearchParams(prev => ({ ...prev, end_date: endDate }));
        }
    }, [searchParams.start_date, searchParams.duration, searchType]);

    // 重置搜尋參數當切換搜尋類型時
    const handleSearchTypeChange = (newType) => {
        setSearchType(newType);
        setError('');
        
        if (newType === 'custom') {
            setSearchParams(prev => ({ ...prev, end_date: '' }));
        }
    };

    // 處理員工選擇變更
    const handleStaffChange = (staffId) => {
        setSearchParams(prev => ({
            ...prev,
            staff_id: staffId
        }));
    };

    // 驗證搜尋參數
    const validateSearchParams = () => {
        if (!searchParams.start_date) {
            setError(t('pleaseSelectStartDate') || '請選擇開始日期');
            return false;
        }

        if (searchType === 'custom' && !searchParams.end_date) {
            setError(t('pleaseSelectEndDate') || '請選擇結束日期');
            return false;
        }

        if (searchParams.end_date && searchParams.start_date > searchParams.end_date) {
            setError(t('startDateMustBeBeforeEndDate') || '開始日期必須早於結束日期');
            return false;
        }

        // 檢查日期是否在可用範圍內
        if (availableDateRange.min && searchParams.start_date < availableDateRange.min) {
            setError(t('startDateTooEarly') || '開始日期過早，沒有可用數據');
            return false;
        }

        if (availableDateRange.max && searchParams.start_date > availableDateRange.max) {
            setError(t('startDateTooLate') || '開始日期過晚，沒有可用數據');
            return false;
        }

        return true;
    };

    // 搜尋薪資數據
    const handleSearch = async () => {
        if (!validateSearchParams()) {
            return;
        }

        setLoading(true);
        setError('');

        try {
            const params = {
                start_date: searchParams.start_date,
                end_date: searchParams.end_date
            };

            // 如果是超級用戶且選擇了特定員工
            if (isSuperUser() && searchParams.staff_id) {
                params.staff_id = searchParams.staff_id;
            }

            if (searchType === 'period') {
                params.duration = searchParams.duration;
            }
            
            const response = await wageAPI.list(params);
            const data = response.data;

            // 檢查是否有 message 欄位（表示沒有資料）
            if (data.messsage || data.message) {
                // 沒有資料的情況：不要更新日期範圍，保持原有限制
                setPayrollData({
                    shift_detail: [],
                    total_salary: 0,
                    search_period: data.search_period || '',
                    days: 0
                });
                setError('');
            } else {
                // 只有在有實際數據時才更新日期範圍
                if (data.valid_date_from && data.valid_date_til) {
                    setAvailableDateRange({
                        min: data.valid_date_from,
                        max: data.valid_date_til
                    });
                }

                // 處理有資料的情況
                let totalSalary = 0;
                let days = 0;
                let shiftDetail = [];

                if (data) {
                    const salaryKeys = Object.keys(data).filter(key => 
                        key.includes('salary') && typeof data[key] === 'number'
                    );
                    
                    if (salaryKeys.length > 0) {
                        totalSalary = data[salaryKeys[0]];
                        const dayMatch = salaryKeys[0].match(/(\d+)/);
                        days = dayMatch ? parseInt(dayMatch[1]) : 0;
                    }

                    shiftDetail = data.shift_detail || [];
                    if (!Array.isArray(shiftDetail)) {
                        shiftDetail = [];
                    }
                }

                // 格式化搜尋期間顯示
                const formatDate = (dateStr) => {
                    return dateStr.replace(/-/g, '/');
                };
                
                const formattedPeriod = `${formatDate(searchParams.start_date)} ~ ${formatDate(searchParams.end_date)}`;

                setPayrollData({
                    shift_detail: shiftDetail,
                    total_salary: totalSalary,
                    search_period: formattedPeriod,
                    days: days
                });
            }

        } catch (error) {
            console.error('搜尋薪資數據失敗:', error);
            
            // 清除之前的資料
            setPayrollData({
                shift_detail: [],
                total_salary: 0,
                search_period: '',
                days: 0
            });
            
            let errorMessage = t('loadPayrollDataFailed') || '載入薪資數據失敗';
            
            if (error.response) {
                if (error.response.status === 404) {
                    errorMessage = t('noDataFound') || '未找到相關數據';
                } else if (error.response.status === 403) {
                    errorMessage = t('noPermission') || '沒有權限訪問';
                } else if (error.response.data?.message) {
                    errorMessage += `: ${error.response.data.message}`;
                }
            } else if (error.message) {
                errorMessage += `: ${error.message}`;
            }
            
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // 導出功能
    const exportToCSV = () => {
        if (!payrollData.shift_detail || payrollData.shift_detail.length === 0) {
            alert(t('noDataToExport') || '沒有數據可供導出');
            return;
        }

        try {
            const headers = [
                t('employee') || '員工',
                t('shiftDate') || '班次日期',
                t('shiftType') || '班次類型',
                t('salary') || '薪資',
                t('payDate') || '發薪日期'
            ];
            
            const csvRows = [
                headers.join(','),
                ...payrollData.shift_detail.map(item => {
                    const { shiftDate, shiftType } = parseShiftInfo(item);
                    return [
                        `"${item.staff || ''}"`,
                        `"${shiftDate}"`,
                        `"${shiftType}"`,
                        `"${item.salary || 0}"`,
                        `"${item.pay_date || (t('notSet') || '未設定')}"`
                    ].join(',');
                })
            ];

            const csvContent = csvRows.join('\n');
            const BOM = '\uFEFF';
            const blob = new Blob([BOM + csvContent], { 
                type: 'text/csv;charset=utf-8;' 
            });
            
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            
            const filename = `payroll_${searchParams.start_date}_${searchParams.end_date}_${new Date().getTime()}.csv`;
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error('導出失敗:', error);
            alert(t('exportFailed') || '導出失敗，請稍後再試');
        }
    };

    // 改進的班次信息解析
    const parseShiftInfo = (record) => {
        let shiftDate = '';
        let shiftType = '';
        
        // 如果有單獨的 shift_date 欄位
        if (record.shift_date) {
            shiftDate = record.shift_date;
        }
        
        // 解析完整的 shift 信息
        if (record.shift) {
            const shiftInfo = record.shift;
            
            // 解析格式：shift_date: 2025-06-07 - Weekend Helper A (10:00–15:00, Break 15 Minutes)
            if (shiftInfo.includes('shift_date: ') && shiftInfo.includes(' - ')) {
                const parts = shiftInfo.split(' - ');
                
                // 提取日期部分（如果 shift_date 不存在）
                if (!shiftDate && parts[0].includes('shift_date: ')) {
                    const dateStr = parts[0].replace('shift_date: ', '').trim();
                    // 將 2025-06-07 轉換為 2025/06/07
                    shiftDate = dateStr.replace(/-/g, '/');
                }
                
                // 提取班次類型部分（保留括號內容）
                if (parts.length > 1) {
                    shiftType = parts.slice(1).join(' - ').trim();
                }
            }
        }
        
        return {
            shiftDate: shiftDate || (t('noDate') || '無日期'),
            shiftType: shiftType || (t('noShiftType') || '無班次資訊')
        };
    };

    // 格式化薪資顯示
    const formatSalary = (salary) => {
        const amount = parseFloat(salary || 0);
        return `$${amount.toLocaleString('zh-TW', { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 2 
        })}`;
    };


    // 初始化數據載入
    useEffect(() => {
        if (user) {
            loadMembers();
            fetchAvailableDateRange(); // 載入可用日期範圍
        }
    }, [user]);

    // 權限檢查
    if (user && !canAccessPayroll()) {
        return (
            <div className="payroll">
                <div className="page-header">
                    <div className="header-content">
                        <div className="page-title-section">
                            <h1 className="page-title">
                                <span className="title-icon">💰</span>
                                {t('payrollQuery') || '薪資查詢'}
                            </h1>
                        </div>
                        <div className="header-actions">
                            <LanguageSwitch />
                            <button 
                                className="btn-secondary"
                                onClick={() => navigate('/dashboard')}
                            >
                                ← {t('backToDashboard') || '返回主頁'}
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="no-permission">
                    <div className="no-permission-icon">🚫</div>
                    <h3>{t('accessDenied') || '無法訪問'}</h3>
                    <p>{t('payrollPermissionMessage') || '只有管理員可以查看薪資資訊'}</p>
                    <button 
                        className="btn-secondary"
                        onClick={() => navigate('/dashboard')}
                    >
                        {t('backToDashboard') || '返回主頁'}
                    </button>
                </div>
            </div>
        );
    }

    // 載入狀態
    if (loading) {
        return (
            <div className="payroll-loading">
                <div className="loading-spinner"></div>
                <p>{t('messageLoading') || '載入中...'}</p>
            </div>
        );
    }

    return (
        <div 
            className="payroll" 
            data-search-type={searchType}
            data-is-superuser={isSuperUser()}
        >

            {/* 頁面標題區域 */}
            <div className="page-header">
                <div className="header-content">
                    <div className="page-title-section">
                        <h1 className="page-title">
                            <span className="title-icon">💰</span>
                            {t('payrollQuery') || '薪資查詢'}
                        </h1>
                        {!isSuperUser() && (
                            <div className="user-info">
                                <span className="user-label">{t('currentUser') || '當前用戶'}：</span>
                                <span className="user-name">
                                    {user?.first_name && user?.last_name 
                                        ? `${user.first_name} ${user.last_name}`
                                        : user?.name || user?.username || user?.email || (t('unknownUser') || '未知用戶')
                                    }
                                </span>
                            </div>
                        )}
                    </div>
                    
                    <div className="header-actions">
                        <LanguageSwitch />
                        <button 
                            className="btn-secondary"
                            onClick={() => navigate('/dashboard')}
                        >
                            ← {t('backToDashboard') || '返回主頁'}
                        </button>
                    </div>
                </div>
            </div>

            {/* 搜尋區域 */}
            <div className="search-section">
                <div className="search-container">
                    {/* 搜尋類型選擇器 */}
                    <div className="search-type-tabs">
                        <div className="tab-buttons">
                            <button
                                className={`tab-button ${searchType === 'period' ? 'active' : ''}`}
                                onClick={() => handleSearchTypeChange('period')}
                            >
                                <span className="tab-icon">📅</span>
                                <span className="tab-text">{t('periodSearch') || '區間搜尋'}</span>
                            </button>
                            <button
                                className={`tab-button ${searchType === 'custom' ? 'active' : ''}`}
                                onClick={() => handleSearchTypeChange('custom')}
                            >
                                <span className="tab-icon">📝</span>
                                <span className="tab-text">{t('customSearch') || '自訂搜尋'}</span>
                            </button>
                        </div>
                    </div>

                    {/* 搜尋表單 */}
                    <div className="search-form-wrapper">
                        <form className="search-form" onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
                            {/* 員工選擇（如果是超級用戶） */}
                            {isSuperUser() && (
                                <div className="employee-select-container">
                                    <label className="field-label">
                                        {t('selectEmployee') || '選擇員工'}
                                    </label>
                                    <select
                                        value={searchParams.staff_id}
                                        onChange={(e) => handleStaffChange(e.target.value)}
                                        className="field-input select-input"
                                    >
                                        <option value="">{t('allEmployees') || '所有員工'}</option>
                                        {members.map(member => (
                                            <option key={member.id} value={member.id}>
                                                {member.first_name && member.last_name 
                                                    ? `${member.first_name} ${member.last_name}`
                                                    : member.name || member.username || `員工 ${member.id}`
                                                }
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* 固定大小的日期選擇容器 */}
                            <div className="date-fields-container">
                                {/* 開始日期 */}
                                <div className="date-field">
                                    <label className="field-label">
                                        {t('startDate') || '開始日期'}
                                    </label>
                                    <input
                                        type="date"
                                        value={searchParams.start_date}
                                        min={availableDateRange.min}
                                        max={availableDateRange.max}
                                        onChange={(e) => setSearchParams(prev => ({
                                            ...prev,
                                            start_date: e.target.value
                                        }))}
                                        className="field-input date-input"
                                        required
                                    />
                                </div>

                                {/* 動態欄位：期間或結束日期 */}
                                <div className="date-field">
                                    <label className="field-label">
                                        {searchType === 'period' 
                                            ? (t('duration') || '期間')
                                            : (t('endDate') || '結束日期')
                                        }
                                    </label>
                                    {searchType === 'period' ? (
                                        <select
                                            value={searchParams.duration}
                                            onChange={(e) => setSearchParams(prev => ({
                                                ...prev,
                                                duration: e.target.value
                                            }))}
                                            className="field-input select-input"
                                        >
                                            <option value="week">{t('week') || '一週'}</option>
                                            <option value="fort">{t('fortnight') || '兩週'}</option>
                                            <option value="month">{t('month') || '一個月'}</option>
                                        </select>
                                    ) : (
                                        <input
                                            type="date"
                                            value={searchParams.end_date}
                                            min={Math.max(searchParams.start_date || availableDateRange.min, availableDateRange.min)}
                                            max={availableDateRange.max}
                                            onChange={(e) => setSearchParams(prev => ({
                                                ...prev,
                                                end_date: e.target.value
                                            }))}
                                            className="field-input date-input"
                                            required
                                        />
                                    )}
                                </div>

                                {/* 計算結果顯示（僅限區間搜尋） */}
                                <div className="date-field calculated-field">
                                    {searchType === 'period' && searchParams.end_date ? (
                                        <>
                                            <label className="field-label">
                                                {t('calculatedEndDate') || '計算結束日期'}
                                            </label>
                                            <input
                                                type="date"
                                                value={searchParams.end_date}
                                                readOnly
                                                className="field-input date-input readonly-input"
                                            />
                                            <div className="field-hint">
                                                {t('autoCalculated') || '自動計算'}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="field-placeholder"></div>
                                    )}
                                </div>
                            </div>

                            {/* 錯誤訊息 */}
                            {error && (
                                <div className="form-error">
                                    <span className="error-icon">⚠️</span>
                                    <span className="error-text">{error}</span>
                                </div>
                            )}

                            {/* 搜尋按鈕 */}
                            <div className="search-button-container">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="search-submit-btn"
                                >
                                    {loading ? (
                                        <>
                                            <span className="btn-spinner"></span>
                                            <span className="btn-text">{t('searching') || '搜尋中...'}</span>
                                        </>
                                    ) : (
                                        <span className="btn-text">{t('search') || '開始搜尋'}</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* 結果區域 */}
            {payrollData.shift_detail.length > 0 && (
                <div className="results-section">
                    {/* 統計摘要 */}
                    <div className="summary-cards">
                        <div className="summary-card">
                            <div className="summary-header">
                                <span className="summary-icon">📅</span>
                                <h3>{t('totalDays') || '總天數'}</h3>
                            </div>
                            <div className="summary-content">
                                <div className="summary-number">{payrollData.days}</div>
                                <div className="summary-label">{t('workDays') || '工作天'}</div>
                            </div>
                        </div>

                        <div className="summary-card">
                            <div className="summary-header">
                                <span className="summary-icon">👥</span>
                                <h3>{t('totalRecords') || '總記錄數'}</h3>
                            </div>
                            <div className="summary-content">
                                <div className="summary-number">{payrollData.shift_detail.length}</div>
                                <div className="summary-label">{t('payrollRecords') || '薪資記錄'}</div>
                            </div>
                        </div>

                        <div className="summary-card highlight">
                            <div className="summary-header">
                                <span className="summary-icon">💰</span>
                                <h3>{t('totalSalary') || '總薪資'}</h3>
                            </div>
                            <div className="summary-content">
                                <div className="summary-number">
                                    {formatSalary(payrollData.total_salary)}
                                </div>
                                <div className="summary-label">{t('totalAmount') || '總金額'}</div>
                            </div>
                        </div>
                    </div>

                    {/* 操作按鈕 */}
                    <div className="actions-bar">
                        <div className="period-info">
                            <span className="period-label">{t('searchPeriod') || '搜尋期間'}：</span>
                            <span className="period-text">{payrollData.search_period}</span>
                        </div>
                        <button onClick={exportToCSV} className="export-btn">
                            <span className="export-icon">📊</span>
                            {t('exportCSV') || '導出 CSV'}
                        </button>
                    </div>

                    {/* 詳細列表 - 使用卡片佈局 */}
                    <div className="payroll-cards-container">
                        {payrollData.shift_detail.map((record, index) => {
                            const { shiftDate, shiftType } = parseShiftInfo(record);
                            return (
                                <div key={`payroll-${index}-${record.staff || 'unknown'}`} className="payroll-card">
                                    <div className="card-header">
                                        <div className="employee-info">
                                            <div className="employee-avatar">
                                                {record.staff ? record.staff.charAt(0).toUpperCase() : '?'}
                                            </div>
                                            <div className="employee-details">
                                                <h3 className="employee-name">
                                                    {record.staff || (t('unknown') || '未知員工')}
                                                </h3>
                                            </div>
                                        </div>
                                        <div className="salary-display">
                                            <div className="salary-amount">
                                                {formatSalary(record.salary)}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="card-body">
                                        {/* 班次日期 */}
                                        <div className="shift-date-info">
                                            <div className="detail-row">
                                                <span className="detail-label">{t('shiftDate') || '班次日期'}</span>
                                                <span className="detail-value shift-date-value">
                                                    {shiftDate}
                                                </span>
                                            </div>
                                        </div>

                                        {/* 班次類型 */}
                                        <div className="shift-type-info">
                                            <div className="detail-row">
                                                <span className="detail-label">{t('shiftType') || '班次類型'}</span>
                                                <span className="detail-value shift-type-value">
                                                    {shiftType}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {/* 發薪狀態 */}
                                        <div className="pay-status">
                                            <div className="detail-row">
                                                <span className="detail-label">{t('paymentStatus') || '發薪狀態'}</span>
                                                <span className={`detail-value pay-date ${record.pay_date ? 'paid' : 'unpaid'}`}>
                                                    {record.pay_date ? (
                                                        <>
                                                            <span className="status-icon">✅</span>
                                                            {new Date(record.pay_date).toLocaleDateString('zh-TW')}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="status-icon">⏳</span>
                                                            {t('notPaid') || '未發薪'}
                                                        </>
                                                    )}
                                                </span>
                                            </div>
                                        </div>

                                        {/* 額外資訊 */}
                                        {record.hours && (
                                            <div className="additional-info">
                                                <div className="detail-row">
                                                    <span className="detail-label">{t('workHours') || '工作時數'}</span>
                                                    <span className="detail-value">
                                                        {record.hours} {t('hours') || '小時'}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {record.overtime_hours && parseFloat(record.overtime_hours) > 0 && (
                                            <div className="overtime-info">
                                                <div className="detail-row">
                                                    <span className="detail-label">{t('overtimeHours') || '加班時數'}</span>
                                                    <span className="detail-value">
                                                        {record.overtime_hours} {t('hours') || '小時'}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {record.notes && (
                                            <div className="notes-info">
                                                <div className="detail-row">
                                                    <span className="detail-label">{t('notes') || '備註'}</span>
                                                    <span className="detail-value">
                                                        {record.notes}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 空狀態 */}
            {!loading && payrollData.shift_detail.length === 0 && searchParams.start_date && (
                <div className="no-results">
                    <div className="no-results-icon">📊</div>
                    <h3 className="no-results-title">{t('noPayrollData') || '沒有薪資數據'}</h3>
                    <p className="no-results-description">
                        {t('noPayrollDescription') || '在所選期間內沒有找到薪資記錄，請嘗試調整搜尋條件'}
                    </p>
                </div>
            )}

            {/* 初始狀態 - 尚未搜尋 */}
            {!loading && payrollData.shift_detail.length === 0 && !searchParams.start_date && (
                <div className="welcome-state">
                    <div className="welcome-icon">💰</div>
                    <h3 className="welcome-title">{t('welcomeToPayroll') || '歡迎使用薪資查詢系統'}</h3>
                    <p className="welcome-description">
                        {t('payrollWelcomeDesc') || '請選擇搜尋條件來查看薪資記錄'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default Payroll;