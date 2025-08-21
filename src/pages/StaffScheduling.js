import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { staffShiftAPI, shiftAPI, memberAPI } from '../services/api';
import LanguageSwitch from '../components/LanguageSwitch';
import styles from '../styles/StaffScheduling.module.css';

const StaffScheduling = () => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [shifts, setShifts] = useState([]);
    const [shiftTypes, setShiftTypes] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [permissionError, setPermissionError] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showQuickAssignModal, setShowQuickAssignModal] = useState(false);
    const [showQuickCancelModal, setShowQuickCancelModal] = useState(false);
    const [editingShift, setEditingShift] = useState(null);
    const [assignData, setAssignData] = useState({
        staff: '',
        shift: '',
        shift_date: '',
        cover_shift: false,
        alternative_staff: ''
    });
    
    // 快速分配資料狀態
    const [quickAssignData, setQuickAssignData] = useState({
        staff: '',
        shift: '',
        selectedDates: []
    });

    // 快速取消資料狀態
    const [quickCancelData, setQuickCancelData] = useState({
        staff: '',
        shift: '',
        selectedDates: []
    });

    // 權限檢查
    const checkPermissions = () => {
        if (!user || (!user.is_staff && !user.is_superuser)) {
            setPermissionError(true);
            return false;
        }
        return true;
    };

    // 格式化日期為 YYYY-MM-DD
    const formatDateToString = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // 提取班次名稱（去除時間和細節資訊）
    const extractShiftName = (shiftData) => {
        if (!shiftData) return '';
        
        if (typeof shiftData === 'string') {
            return shiftData.includes('(') 
                ? shiftData.split('(')[0].trim() 
                : shiftData.trim();
        }
        
        if (typeof shiftData === 'number') {
            return '';
        }
        
        return String(shiftData);
    };

    // 獲取班次顯示名稱
    const getShiftDisplayName = (shift) => {
        if (shift.shift_display) {
            return extractShiftName(shift.shift_display);
        }
        if (shift.shift_name) {
            return extractShiftName(shift.shift_name);
        }
        if (typeof shift.shift === 'string') {
            return extractShiftName(shift.shift);
        }
        
        const shiftType = shiftTypes.find(type => type.id === shift.shift);
        return shiftType ? shiftType.shift_name : '未知班次';
    };

    // 根據班次名稱找到對應的時間資訊
    const getShiftDetails = (shiftName) => {
        const cleanShiftName = extractShiftName(shiftName);
        const shiftType = shiftTypes.find(type => type.shift_name === cleanShiftName);
        return shiftType || null;
    };

    // 獲取星期幾的名稱
    const getWeekdayName = (day) => {
        const weekdays = t('weekdaysShort');
        return weekdays[day];
    };

    // 修正：根據班次名稱判斷是否為週末班
    const isWeekendShift = (shiftId) => {
        const shift = shiftTypes.find(type => type.id === parseInt(shiftId));
        if (!shift) return false;
        
        // 如果後端有 is_weekend 欄位，優先使用
        if (shift.hasOwnProperty('is_weekend')) {
            return shift.is_weekend;
        }
        
        // 根據班次名稱判斷
        const shiftName = shift.shift_name.toLowerCase();
        return shiftName.includes('weekend') || 
               shiftName.includes('週末') || 
               shiftName.includes('假日') ||
               shiftName.includes('六日') ||
               shiftName.includes('休日');
    };

    // 修正：根據班次名稱判斷是否為平日班
    const isWeekdayShift = (shiftId) => {
        const shift = shiftTypes.find(type => type.id === parseInt(shiftId));
        if (!shift) return false;
        
        // 如果後端有 is_weekend 欄位，優先使用
        if (shift.hasOwnProperty('is_weekend')) {
            return !shift.is_weekend;
        }
        
        // 根據班次名稱判斷
        const shiftName = shift.shift_name.toLowerCase();
        const isWeekend = shiftName.includes('weekend') || 
                         shiftName.includes('週末') || 
                         shiftName.includes('假日') ||
                         shiftName.includes('六日') ||
                         shiftName.includes('休日');
        
        return !isWeekend || 
               shiftName.includes('weekday') || 
               shiftName.includes('平日') || 
               shiftName.includes('工作日');
    };

    // 修正：檢查日期是否可以選擇（基於班次類型）
    const canSelectDate = (dateStr, shiftId, isForCancel = false) => {
        if (!shiftId) return true;
        
        const date = new Date(dateStr);
        const dayOfWeek = date.getDay();
        const isWeekendDate = dayOfWeek === 0 || dayOfWeek === 6; // 0=週日, 6=週六
        
        // 如果是取消功能，需要檢查該日期是否已有對應班次
        if (isForCancel) {
            const hasShift = shifts.some(shift => 
                shift.shift_date === dateStr && 
                shift.shift === parseInt(shiftId)
            );
            if (!hasShift) return false;
        }
        
        // 檢查班次類型限制
        if (isWeekendShift(shiftId)) {
            return isWeekendDate; // 週末班只能選週末
        } else if (isWeekdayShift(shiftId)) {
            return !isWeekendDate; // 平日班只能選平日
        }
        
        return true; // 如果沒有特定限制，允許選擇
    };

    useEffect(() => {
        if (!checkPermissions()) {
            return;
        }
        loadData();
    }, [user]);

    useEffect(() => {
        if (checkPermissions()) {
            loadShifts();
        }
    }, [currentDate]);

    const loadData = async () => {
        try {
            setLoading(true);
            await Promise.all([
                loadShiftTypes(),
                loadStaff()
            ]);
        } catch (error) {
            console.error('載入資料失敗:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadShifts = async () => {
        try {
            const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            
            const response = await staffShiftAPI.list({
                start_date: formatDateToString(startDate),
                end_date: formatDateToString(endDate)
            });
            
            console.log('載入的班次原始資料:', response.data);
            
            setShifts(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('載入班次失敗:', error);
            setShifts([]);
        }
    };

    const loadShiftTypes = async () => {
        try {
            const response = await shiftAPI.list();
            setShiftTypes(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('載入班次類型失敗:', error);
            setShiftTypes([]);
        }
    };

    const loadStaff = async () => {
        try {
            console.log('開始載入員工資料...');
            const response = await memberAPI.list();
            console.log('API回應:', response);
            
            let staffData = [];
            if (response.data) {
                if (Array.isArray(response.data)) {
                    staffData = response.data;
                } else if (response.data.results && Array.isArray(response.data.results)) {
                    staffData = response.data.results;
                } else if (response.data.data && Array.isArray(response.data.data)) {
                    staffData = response.data.data;
                }
            }
            
            console.log('處理後的員工資料:', staffData);
            setStaff(staffData);
            
        } catch (error) {
            console.error('載入員工列表失敗:', error);
            console.error('錯誤詳情:', error.response?.data);
            setStaff([]);
        }
    };

    const handleAssignShift = async (e) => {
        e.preventDefault();
        if (!checkPermissions()) return;
        
        try {
            const submitData = {
                shift_date: assignData.shift_date,
                staff: parseInt(assignData.staff),
                shift: parseInt(assignData.shift),
                cover_shift: assignData.cover_shift,
                alternative_staff: assignData.cover_shift ? parseInt(assignData.alternative_staff) : null
            };

            console.log('發送的資料:', submitData);
            
            const response = await staffShiftAPI.create(submitData);
            console.log('成功回應:', response);
            
            alert(t('assignSuccess') || '分配成功');
            setShowAssignModal(false);
            resetAssignData();
            loadShifts();
        } catch (error) {
            console.error('完整錯誤物件:', error);
            console.error('錯誤回應資料:', error.response?.data);
            
            alert(t('assignFailed') || '分配失敗: ' + (error.response?.data?.detail || error.message));
        }
    };

    // 處理編輯班次
    const handleEditShift = async (e) => {
        e.preventDefault();
        if (!checkPermissions()) return;
        
        try {
            const submitData = {
                shift_date: assignData.shift_date,
                staff: parseInt(assignData.staff),
                shift: parseInt(assignData.shift),
                cover_shift: assignData.cover_shift,
                alternative_staff: assignData.cover_shift ? parseInt(assignData.alternative_staff) : null
            };

            console.log('更新資料:', submitData);
            
            const response = await staffShiftAPI.update(editingShift.id, submitData);
            console.log('更新成功:', response);
            
            alert(t('updateSuccess') || '更新成功');
            setShowEditModal(false);
            setEditingShift(null);
            resetAssignData();
            loadShifts();
        } catch (error) {
            console.error('更新失敗:', error);
            alert(t('updateFailed') || '更新失敗: ' + (error.response?.data?.detail || error.message));
        }
    };

    // 處理快速分配
    const handleQuickAssign = async (e) => {
        e.preventDefault();
        if (!checkPermissions()) return;
        
        try {
            const assignments = [];
            
            // 根據選擇的日期建立分配清單
            for (const dateStr of quickAssignData.selectedDates) {
                assignments.push({
                    shift_date: dateStr,
                    staff: parseInt(quickAssignData.staff),
                    shift: parseInt(quickAssignData.shift),
                    cover_shift: false,
                    alternative_staff: null
                });
            }
            
            console.log('批次分配資料:', assignments);
            
            // 批次建立班次
            const promises = assignments.map(assignment => 
                staffShiftAPI.create(assignment)
            );
            
            await Promise.all(promises);
            
            alert(t('quickAssignSuccess') || `成功分配 ${assignments.length} 個班次`);
            setShowQuickAssignModal(false);
            resetQuickAssignData();
            loadShifts();
        } catch (error) {
            console.error('快速分配失敗:', error);
            alert(t('quickAssignFailed') || '快速分配失敗: ' + (error.response?.data?.detail || error.message));
        }
    };

    // 處理快速取消
    const handleQuickCancel = async (e) => {
        e.preventDefault();
        if (!checkPermissions()) return;

        if (!window.confirm(t('confirmBatchCancel') || `確定要取消 ${quickCancelData.selectedDates.length} 個班次嗎？`)) {
            return;
        }

        try {
            const shiftsToDelete = [];

            // 依日期找到該員工的所有班次
            for (const dateStr of quickCancelData.selectedDates) {
                const shiftsOnDate = shifts.filter(shift =>
                    shift.shift_date === dateStr &&
                    shift.staff === parseInt(quickCancelData.staff)
                );
                shiftsToDelete.push(...shiftsOnDate.map(s => s.id));
            }

            // 如果沒有找到任何班次
            if (shiftsToDelete.length === 0) {
                alert(t('noShiftsFound') || '沒有找到可取消的班次');
                return;
            }

            // 批量刪除
            await Promise.all(
                shiftsToDelete.map(shiftId => staffShiftAPI.delete(shiftId))
            );

            alert(t('quickCancelSuccess') || `成功取消 ${shiftsToDelete.length} 個班次`);
            setShowQuickCancelModal(false);
            resetQuickCancelData();
            loadShifts(); // 重新載入班表
        } catch (error) {
            console.error('快速取消失敗:', error);
            alert(t('quickCancelFailed') || '快速取消失敗: ' + (error.response?.data?.detail || error.message));
        }
    };

    // 開啟編輯模態框
    const openEditModal = (shift) => {
        setEditingShift(shift);
        setAssignData({
            staff: shift.staff,
            shift: shift.shift,
            shift_date: shift.shift_date,
            cover_shift: shift.cover_shift || false,
            alternative_staff: shift.alternative_staff || ''
        });
        setShowEditModal(true);
    };

    const handleDeleteShift = async (shiftId) => {
        if (!checkPermissions()) return;
        
        if (!window.confirm(t('confirmDelete') || '確定要刪除嗎？')) {
            return;
        }

        try {
            await staffShiftAPI.delete(shiftId);
            alert(t('deleteSuccess') || '刪除成功');
            loadShifts();
        } catch (error) {
            console.error('刪除失敗:', error);
            alert(t('deleteFailed') || '刪除失敗');
        }
    };

    const resetAssignData = () => {
        setAssignData({
            staff: '',
            shift: '',
            shift_date: '',
            cover_shift: false,
            alternative_staff: ''
        });
    };

    // 重置快速分配資料
    const resetQuickAssignData = () => {
        setQuickAssignData({
            staff: '',
            shift: '',
            selectedDates: []
        });
    };

    // 重置快速取消資料
    const resetQuickCancelData = () => {
        setQuickCancelData({
            staff: '',
            shift: '',
            selectedDates: []
        });
    };

    // 切換日期選擇（支援班次類型限制和取消功能）
    const toggleDateSelection = (dateStr, isForCancel = false) => {
        const targetData = isForCancel ? quickCancelData : quickAssignData;
        const setTargetData = isForCancel ? setQuickCancelData : setQuickAssignData;
        
        // 檢查是否可以選擇這個日期
        if (!canSelectDate(dateStr, targetData.shift, isForCancel)) {
            return;
        }
        
        const newSelectedDates = targetData.selectedDates.includes(dateStr)
            ? targetData.selectedDates.filter(d => d !== dateStr)
            : [...targetData.selectedDates, dateStr];
            
        setTargetData({
            ...targetData,
            selectedDates: newSelectedDates
        });
    };

    const navigateMonth = (direction) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + direction);
        setCurrentDate(newDate);
    };

    const formatDisplayDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}/${month}`;
    };


    const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    const startWeekday = firstDay.getDay(); // 0=日 ... 6=六
    for (let i = 0; i < startWeekday; i++) {
        days.push({ date: null, fullDate: null, shifts: [] });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
        const curDate = new Date(year, month, d);
        const dayShifts = shifts.filter(s => s.shift_date === formatDateToString(curDate));
        days.push({ date: d, fullDate: curDate, shifts: dayShifts });
    }

    return days;
    };

    const formatTime = (timeString) => {
        if (!timeString) return '';
        return timeString.substring(0, 5);
    };

    // 權限錯誤頁面
    if (permissionError) {
        return React.createElement('div', { className: styles['permission-error'] },
            React.createElement('div', { className: styles['error-content'] },
                React.createElement('div', { className: styles['error-icon'] }, '🚫'),
                React.createElement('h2', null, t('accessDenied') || '訪問被拒絕'),
                React.createElement('p', null, t('noSchedulingPermission') || '您沒有權限訪問員工排班頁面。'),
                React.createElement('p', null, t('contactAdmin') || '如需訪問權限，請聯繫系統管理員。'),
                React.createElement('button', {
                    className: styles['btn-primary'],
                    onClick: () => navigate('/roster')
                }, t('backToRoster') || '返回班表')
            )
        );
    }

    // 載入中頁面
    if (loading) {
        return React.createElement('div', { className: `${styles['staff-scheduling']} ${styles.loading}` },
            React.createElement('div', { className: styles['loading-spinner'] }),
            React.createElement('p', null, t('loading') || '載入中...')
        );
    }

    return React.createElement('div', { className: styles['staff-scheduling'] },
        // 頁面標題
        React.createElement('div', { className: styles['page-header'] },
            React.createElement('div', { className: styles['header-content'] },
                React.createElement('div', { className: styles['title-section'] },
                    React.createElement('h1', { className: styles['page-title'] }, t('staffScheduling') || '員工排班')
                ),
                React.createElement('div', { className: styles['header-actions'] },
                    React.createElement(LanguageSwitch),
                    React.createElement('button', {
                        className: styles['btn-primary'],
                        onClick: () => setShowQuickAssignModal(true),
                        style: { marginRight: '8px' }
                    },
                        React.createElement('span', { className: styles['btn-icon'] }, '⚡'),
                        t('quickAssign') || '快速分配'
                    ),
                    React.createElement('button', {
                        className: styles['btn-primary'],
                        onClick: () => setShowQuickCancelModal(true),
                        style: { marginRight: '8px' }
                    },
                        React.createElement('span', { className: styles['btn-icon'] }, '🗑️'),
                        t('quickCancel') || '批量取消'
                    ),
                    React.createElement('button', {
                        className: styles['btn-primary'],
                        onClick: () => setShowAssignModal(true),
                        style: { marginRight: '8px' }
                    },
                        React.createElement('span', { className: styles['btn-icon'] }, '+'),
                        t('assignShift') || '分配班次'
                    ),
                    React.createElement('button', {
                        className: styles['btn-secondary'],
                        onClick: () => navigate('/shift-management'),
                        style: { marginRight: '8px' }
                    },
                        React.createElement('span', { className: styles['btn-icon'] }, '⚙️'),
                        t('shiftManagement') || '班次管理'
                    ),
                    React.createElement('button', {
                        className: styles['btn-secondary'],
                        onClick: () => navigate('/roster')
                    },
                        '← ' + (t('backToRoster') || '返回班表'),     
                    
                    ),
                    React.createElement('button', {
                        className: 'btn-secondary',
                        onClick: () => navigate('/dashboard')
                     },
                    '← ' + (t('backToDashboard') || '返回主頁')
                    )
                )
            )
        ),


        // 月份導航
        React.createElement('div', { className: styles['month-navigation'] },
            React.createElement('button', { onClick: () => navigateMonth(-1) }, '◀'),
            React.createElement('h2', null, formatDisplayDate(currentDate)),
            React.createElement('button', { onClick: () => navigateMonth(1) }, '▶')
        ),

        // 排班日曆
        React.createElement('div', { className: styles['scheduling-calendar'] },
            React.createElement('div', { className: styles['calendar-grid'] },
                ...generateCalendarDays().map((day, index) =>
                    React.createElement('div', { key: index, className: styles['calendar-day'] },
                        React.createElement('div', { className: styles['day-header'] },
                            React.createElement('span', { className: styles['day-number'] }, day.date),
                            React.createElement('span', { className: styles['day-weekday'] }, 
                                day.fullDate ? getWeekdayName(day.fullDate.getDay()) : ''
                            ),
                            React.createElement('button', {
                                className: styles['add-shift-btn'],
                                onClick: () => {
                                    setAssignData({
                                        ...assignData,
                                        shift_date: formatDateToString(day.fullDate)
                                    });
                                    setShowAssignModal(true);
                                },
                                title: t('addShift') || '新增班次'
                            }, '+')
                        ),
                        React.createElement('div', { className: styles['day-shifts'] },
                            ...day.shifts.map((shift, shiftIndex) =>
                                React.createElement('div', {
                                    key: shiftIndex,
                                    className: `${styles['shift-item']} ${shift.cover_shift ? styles['covered-shift'] : ''}`
                                },
                                    React.createElement('div', { className: styles['shift-info'] },
                                        React.createElement('span', { className: styles['shift-name'] },
                                            getShiftDisplayName(shift)
                                        ),
                                        React.createElement('span', { className: styles['staff-name'] },
                                            shift.cover_shift ? shift.alternative_staff_name : shift.staff_name
                                        ),
                                        shift.cover_shift && React.createElement('span', { className: styles['cover-indicator'] }, '🔄')
                                    ),
                                    React.createElement('div', { className: styles['shift-actions'] },
                                        React.createElement('button', {
                                            className: styles['btn-edit-small'],
                                            onClick: () => openEditModal(shift),
                                            title: t('edit') || '編輯'
                                        }, '✏️'),
                                        React.createElement('button', {
                                            className: styles['btn-delete-small'],
                                            onClick: () => handleDeleteShift(shift.id),
                                            title: t('delete') || '刪除'
                                        }, '🗑️')
                                    )
                                )
                            )
                        )
                    )
                )
            )
        ),

        // 班別說明區域
        React.createElement('div', { className: styles['shift-legend'] },
            React.createElement('h3', null, t('shiftDetails') || '班別詳細資訊'),
            React.createElement('div', { className: styles['legend-items'] },
                React.createElement('div', { className: styles['legend-item'] },
                    React.createElement('span', null, t('normalShift') || '一般班次')
                ),
                React.createElement('div', { className: styles['legend-item'] },
                    React.createElement('span', null, '🔄 ' + (t('coverShift') || '代班班次'))
                )
            ),
            React.createElement('div', { className: styles['shift-details-grid'] },
                ...shiftTypes.map((shiftType, index) =>
                    React.createElement('div', { key: index, className: styles['shift-detail-card'] },
                        React.createElement('h4', { className: styles['shift-detail-name'] }, shiftType.shift_name),
                        React.createElement('div', { className: styles['shift-detail-info'] },
                            React.createElement('span', { className: styles['shift-time'] },
                                `${formatTime(shiftType.start_time)} - ${formatTime(shiftType.end_time)}`
                            ),
                            React.createElement('span', { className: styles['shift-hours'] },
                                `工時: ${shiftType.daily_work_hours} 小時`
                            ),
                            React.createElement('span', { className: styles['shift-type-indicator'] },
                                isWeekendShift(shiftType.id) ? '🎯 週末班' : '💼 平日班'
                            )
                        )
                    )
                )
            )
        ),

        // 分配班次表單
        showAssignModal && React.createElement('div', { className: styles['modal-overlay'] },
            React.createElement('div', { className: styles['modal-content'] },
                React.createElement('div', { className: styles['modal-header'] },
                    React.createElement('h2', null, t('assignShift') || '分配班次'),
                    React.createElement('button', {
                        className: styles['modal-close'],
                        onClick: () => {
                            setShowAssignModal(false);
                            resetAssignData();
                        }
                    }, '✕')
                ),
                React.createElement('form', { onSubmit: handleAssignShift, className: styles['assign-form'] },
                    React.createElement('div', { className: styles['form-group'] },
                        React.createElement('label', { htmlFor: 'shift_date' }, (t('date') || '日期') + ' *'),
                        React.createElement('input', {
                            type: 'date',
                            id: 'shift_date',
                            value: assignData.shift_date,
                            onChange: (e) => setAssignData({...assignData, shift_date: e.target.value}),
                            required: true
                        })
                    ),
                    React.createElement('div', { className: styles['form-group'] },
                        React.createElement('label', { htmlFor: 'shift' }, (t('shiftType') || '班次類型') + ' *'),
                        React.createElement('select', {
                            id: 'shift',
                            value: assignData.shift,
                            onChange: (e) => setAssignData({...assignData, shift: e.target.value}),
                            required: true
                        },
                            React.createElement('option', { value: '' }, t('selectShift') || '請選擇班次'),
                            ...shiftTypes.map(shift =>
                                React.createElement('option', { key: shift.id, value: shift.id }, shift.shift_name)
                            )
                        )
                    ),
                    React.createElement('div', { className: styles['form-group'] },
                        React.createElement('label', { htmlFor: 'staff' }, (t('staff') || '員工') + ' *'),
                        React.createElement('select', {
                            id: 'staff',
                            value: assignData.staff,
                            onChange: (e) => setAssignData({...assignData, staff: e.target.value}),
                            required: true
                        },
                            React.createElement('option', { value: '' }, t('selectStaff') || '請選擇員工'),
                            ...staff.map(member =>
                                React.createElement('option', { key: member.id, value: member.id },
                                    `${member.first_name} ${member.last_name} (${member.email})`
                                )
                            )
                        )
                    ),
                    React.createElement('div', { className: styles['form-group'] },
                        React.createElement('div', { className: styles['checkbox-group'] },
                            React.createElement('input', {
                                type: 'checkbox',
                                id: 'cover_shift',
                                checked: assignData.cover_shift,
                                onChange: (e) => setAssignData({
                                    ...assignData, 
                                    cover_shift: e.target.checked,
                                    alternative_staff: e.target.checked ? assignData.alternative_staff : ''
                                })
                            }),
                            React.createElement('label', { htmlFor: 'cover_shift' }, t('isCoverShift') || '這是代班')
                        )
                    ),
                    assignData.cover_shift && React.createElement('div', { className: styles['form-group'] },
                        React.createElement('label', { htmlFor: 'alternative_staff' }, (t('originalStaff') || '原分配員工') + ' *'),
                        React.createElement('select', {
                            id: 'alternative_staff',
                            value: assignData.alternative_staff,
                            onChange: (e) => setAssignData({...assignData, alternative_staff: e.target.value}),
                            required: assignData.cover_shift
                        },
                            React.createElement('option', { value: '' }, t('selectOriginalStaff') || '請選擇原分配員工'),
                            ...staff.map(member =>
                                React.createElement('option', { key: member.id, value: member.id },
                                    `${member.first_name} ${member.last_name} (${member.email})`
                                )
                            )
                        )
                    ),
                    React.createElement('div', { className: styles['form-actions'] },
                        React.createElement('button', {
                            type: 'button',
                            className: styles['btn-cancel'],
                            onClick: () => {
                                setShowAssignModal(false);
                                resetAssignData();
                            }
                        }, t('cancel') || '取消'),
                        React.createElement('button', {
                            type: 'submit',
                            className: styles['btn-submit']
                        }, t('assign') || '分配')
                    )
                )
            )
        ),

        // 編輯班次表單
        showEditModal && React.createElement('div', { className: styles['modal-overlay'] },
            React.createElement('div', { className: styles['modal-content'] },
                React.createElement('div', { className: styles['modal-header'] },
                    React.createElement('h2', null, t('editShift') || '編輯班次'),
                    React.createElement('button', {
                        className: styles['modal-close'],
                        onClick: () => {
                            setShowEditModal(false);
                            setEditingShift(null);
                            resetAssignData();
                        }
                    }, '✕')
                ),
                React.createElement('form', { onSubmit: handleEditShift, className: styles['assign-form'] },
                    React.createElement('div', { className: styles['form-group'] },
                        React.createElement('label', { htmlFor: 'edit_shift_date' }, (t('date') || '日期') + ' *'),
                        React.createElement('input', {
                            type: 'date',
                            id: 'edit_shift_date',
                            value: assignData.shift_date,
                            onChange: (e) => setAssignData({...assignData, shift_date: e.target.value}),
                            required: true
                        })
                    ),
                    React.createElement('div', { className: styles['form-group'] },
                        React.createElement('label', { htmlFor: 'edit_shift' }, (t('shiftType') || '班次類型') + ' *'),
                        React.createElement('select', {
                            id: 'edit_shift',
                            value: assignData.shift,
                            onChange: (e) => setAssignData({...assignData, shift: e.target.value}),
                            required: true
                        },
                            React.createElement('option', { value: '' }, t('selectShift') || '請選擇班次'),
                            ...shiftTypes.map(shift =>
                                React.createElement('option', { key: shift.id, value: shift.id }, shift.shift_name)
                            )
                        )
                    ),
                    React.createElement('div', { className: styles['form-group'] },
                        React.createElement('label', { htmlFor: 'edit_staff' }, (t('staff') || '員工') + ' *'),
                        React.createElement('select', {
                            id: 'edit_staff',
                            value: assignData.staff,
                            onChange: (e) => setAssignData({...assignData, staff: e.target.value}),
                            required: true
                        },
                            React.createElement('option', { value: '' }, t('selectStaff') || '請選擇員工'),
                            ...staff.map(member =>
                                React.createElement('option', { key: member.id, value: member.id },
                                    `${member.first_name} ${member.last_name} (${member.email})`
                                )
                            )
                        )
                    ),
                    React.createElement('div', { className: styles['form-group'] },
                        React.createElement('div', { className: styles['checkbox-group'] },
                            React.createElement('input', {
                                type: 'checkbox',
                                id: 'edit_cover_shift',
                                checked: assignData.cover_shift,
                                onChange: (e) => setAssignData({
                                    ...assignData, 
                                    cover_shift: e.target.checked,
                                    alternative_staff: e.target.checked ? assignData.alternative_staff : ''
                                })
                            }),
                            React.createElement('label', { htmlFor: 'edit_cover_shift' }, t('isCoverShift') || '這是代班')
                        )
                    ),
                    assignData.cover_shift && React.createElement('div', { className: styles['form-group'] },
                        React.createElement('label', { htmlFor: 'edit_alternative_staff' }, (t('originalStaff') || '原分配員工') + ' *'),
                        React.createElement('select', {
                            id: 'edit_alternative_staff',
                            value: assignData.alternative_staff,
                            onChange: (e) => setAssignData({...assignData, alternative_staff: e.target.value}),
                            required: assignData.cover_shift
                        },
                            React.createElement('option', { value: '' }, t('selectOriginalStaff') || '請選擇原分配員工'),
                            ...staff.map(member =>
                                React.createElement('option', { key: member.id, value: member.id },
                                    `${member.first_name} ${member.last_name} (${member.email})`
                                )
                            )
                        )
                    ),
                    React.createElement('div', { className: styles['form-actions'] },
                        React.createElement('button', {
                            type: 'button',
                            className: styles['btn-cancel'],
                            onClick: () => {
                                setShowEditModal(false);
                                setEditingShift(null);
                                resetAssignData();
                            }
                        }, t('cancel') || '取消'),
                        React.createElement('button', {
                            type: 'submit',
                            className: styles['btn-submit']
                        }, t('update') || '更新')
                    )
                )
            )
        ),

        // 快速分配表單
        showQuickAssignModal && React.createElement('div', { className: styles['modal-overlay'] },
            React.createElement('div', { className: `${styles['modal-content']} ${styles['modal-medium']}` },
                React.createElement('div', { className: styles['modal-header'] },
                    React.createElement('h2', null, '⚡ ' + (t('quickAssign') || '快速分配班次')),
                    React.createElement('button', {
                        className: styles['modal-close'],
                        onClick: () => {
                            setShowQuickAssignModal(false);
                            resetQuickAssignData();
                        }
                    }, '✕')
                ),
                
                React.createElement('form', { onSubmit: handleQuickAssign, className: styles['quick-assign-form'] },
                    // 基本選項
                    React.createElement('div', { className: styles['basic-options'] },
                        React.createElement('div', { className: styles['form-group'] },
                            React.createElement('label', null, t('selectStaff') || '選擇員工'),
                            React.createElement('select', {
                                className: styles['form-select'],
                                value: quickAssignData.staff,
                                onChange: (e) => setQuickAssignData({...quickAssignData, staff: e.target.value}),
                                required: true
                            },
                                React.createElement('option', { value: '' }, t('chooseStaff') || '請選擇員工'),
                                ...staff.map(member =>
                                    React.createElement('option', { key: member.id, value: member.id },
                                        `${member.first_name} ${member.last_name}`
                                    )
                                )
                            )
                        ),
                        
                        React.createElement('div', { className: styles['form-group'] },
                            React.createElement('label', null, t('selectShift') || '選擇班次'),
                            React.createElement('select', {
                                className: styles['form-select'],
                                value: quickAssignData.shift,
                                onChange: (e) => {
                                    setQuickAssignData({
                                        ...quickAssignData, 
                                        shift: e.target.value,
                                        selectedDates: [] // 重置已選日期
                                    });
                                },
                                required: true
                            },
                                React.createElement('option', { value: '' }, t('chooseShift') || '請選擇班次'),
                                ...shiftTypes.map(shift =>
                                    React.createElement('option', { key: shift.id, value: shift.id }, 
                                        `${shift.shift_name} (${formatTime(shift.start_time)}-${formatTime(shift.end_time)})`
                                    )
                                )
                            )
                        )
                    ),

                    // 快速選擇按鈕（根據班次類型動態顯示）
                    quickAssignData.shift && React.createElement('div', { className: styles['quick-select-buttons'] },
                        React.createElement('h4', null, t('quickSelect') || '快速選擇：'),
                        React.createElement('div', { className: styles['button-group'] },
                            // 只顯示對應班次類型的快速選擇按鈕
                            isWeekdayShift(quickAssignData.shift) && React.createElement('button', {
                                type: 'button',
                                className: styles['quick-btn'],
                                onClick: () => {
                                    // 選擇本月所有工作日
                                    const days = generateCalendarDays();
                                    const weekdayDates = days
                                        .filter(day => {
                                            const dayOfWeek = day.fullDate.getDay();
                                            return dayOfWeek >= 1 && dayOfWeek <= 5; // 週一到週五
                                        })
                                        .filter(day => canSelectDate(formatDateToString(day.fullDate), quickAssignData.shift))
                                        .map(day => formatDateToString(day.fullDate));
                                    setQuickAssignData({...quickAssignData, selectedDates: weekdayDates});
                                }
                            }, '💼 ' + (t('weekdays') || '選擇全月工作日')),
                            
                            isWeekendShift(quickAssignData.shift) && React.createElement('button', {
                                type: 'button',
                                className: styles['quick-btn'],
                                onClick: () => {
                                    // 選擇本月所有週末
                                    const days = generateCalendarDays();
                                    const weekendDates = days
                                        .filter(day => {
                                            const dayOfWeek = day.fullDate.getDay();
                                            return dayOfWeek === 0 || dayOfWeek === 6; // 週六週日
                                        })
                                        .filter(day => canSelectDate(formatDateToString(day.fullDate), quickAssignData.shift))
                                        .map(day => formatDateToString(day.fullDate));
                                    setQuickAssignData({...quickAssignData, selectedDates: weekendDates});
                                }
                            }, '🎯 ' + (t('weekends') || '選擇全月週末')),
                            
                            React.createElement('button', {
                                type: 'button',
                                className: styles['quick-btn-clear'],
                                onClick: () => {
                                    setQuickAssignData({...quickAssignData, selectedDates: []});
                                }
                            }, '🗑️ ' + (t('clearAll') || '清空'))
                        )
                    ),
                    
                    // 小月曆選擇器
                    React.createElement('div', { className: styles['mini-calendar-section'] },
                        React.createElement('h4', null, 
                            t('selectDates') || '選擇日期' + 
                            (quickAssignData.selectedDates.length > 0 ? ` (已選 ${quickAssignData.selectedDates.length} 天)` : '') +
                            (quickAssignData.shift && isWeekendShift(quickAssignData.shift) ? ' - 僅週末可選' : '') +
                            (quickAssignData.shift && isWeekdayShift(quickAssignData.shift) ? ' - 僅工作日可選' : '')
                        ),
                        
                        // 月份導航
                        React.createElement('div', { className: styles['mini-month-nav'] },
                            React.createElement('button', { 
                                type: 'button',
                                onClick: () => navigateMonth(-1) 
                            }, '◀'),
                            React.createElement('span', { className: styles['mini-month-title'] }, 
                                formatDisplayDate(currentDate)
                            ),
                            React.createElement('button', { 
                                type: 'button',
                                onClick: () => navigateMonth(1) 
                            }, '▶')
                        ),
                        
                        // 星期標題
                        React.createElement('div', { className: styles['mini-calendar-weekdays'] },
                            ...t('weekdaysShort').map((day, i) =>
                            React.createElement('div', { key: i, className: styles['weekday-header'] }, day)
                            )
                        ),
                        
                        // 日期格子
                        React.createElement('div', { className: styles['mini-calendar-grid'] },
                            ...generateCalendarDays().map((day, index) => {
                                if (!day.fullDate) {
                                return React.createElement('div', { key: index, className: styles['empty-day'] });
                                }
                                const dateStr = formatDateToString(day.fullDate);
                                const isSelected = quickAssignData.selectedDates.includes(dateStr);
                                const hasConflict = quickAssignData.staff && quickAssignData.shift && 
                                    day.shifts.some(shift => 
                                        shift.staff === parseInt(quickAssignData.staff) && 
                                        shift.shift === parseInt(quickAssignData.shift)
                                    );
                                const isPastDate = day.fullDate < new Date().setHours(0,0,0,0);
                                const canSelect = canSelectDate(dateStr, quickAssignData.shift, false);
                                
                                return React.createElement('div', {
                                    key: index,
                                    className: `${styles['mini-day']} 
                                               ${isSelected ? styles['selected'] : ''} 
                                               ${hasConflict ? styles['conflict'] : ''} 
                                               ${isPastDate ? styles['past'] : ''}
                                               ${!canSelect && quickAssignData.shift ? styles['disabled'] : ''}`,
                                    onClick: () => {
                                        if (!hasConflict && !isPastDate && canSelect) {
                                            toggleDateSelection(dateStr, false);
                                        }
                                    },
                                    title: hasConflict ? t('alreadyAssigned') || '已有此班次' : 
                                           isPastDate ? t('pastDate') || '過去日期' :
                                           !canSelect && quickAssignData.shift ? 
                                               (isWeekendShift(quickAssignData.shift) ? '週末班僅能選擇週末' : '平日班僅能選擇工作日') : ''
                                },
                                    React.createElement('span', { className: styles['mini-day-number'] }, day.date),
                                    isSelected && React.createElement('span', { className: styles['selected-indicator'] }, '✓'),
                                    hasConflict && React.createElement('span', { className: styles['conflict-indicator'] }, '⚠️')
                                );
                            })
                        )
                    ),
                    
                    // 已選擇日期摘要
                    quickAssignData.selectedDates.length > 0 && 
                    React.createElement('div', { className: styles['selected-summary'] },
                        React.createElement('h5', null, t('selectedDates') || '已選擇的日期：'),
                        React.createElement('div', { className: styles['selected-dates-preview'] },
                            ...quickAssignData.selectedDates.slice(0, 5).map(dateStr => {
                                const date = new Date(dateStr);
                                return React.createElement('span', { 
                                    key: dateStr, 
                                    className: styles['date-chip'] 
                                }, `${date.getMonth() + 1}/${date.getDate()}`);
                            }),
                            quickAssignData.selectedDates.length > 5 && 
                            React.createElement('span', { className: styles['more-indicator'] }, 
                                `+${quickAssignData.selectedDates.length - 5}`
                            )
                        )
                    ),
                    
                    // 操作按鈕
                    React.createElement('div', { className: styles['form-actions'] },
                        React.createElement('button', {
                            type: 'button',
                            className: styles['btn-cancel'],
                            onClick: () => {
                                setShowQuickAssignModal(false);
                                resetQuickAssignData();
                            }
                        }, t('cancel') || '取消'),
                        
                        React.createElement('button', {
                            type: 'submit',
                            className: styles['btn-primary'],
                            disabled: !quickAssignData.staff || !quickAssignData.shift || quickAssignData.selectedDates.length === 0
                        }, 
                            t('batchAssign') || '批次分配' + 
                            ` (${quickAssignData.selectedDates.length} ${t('days') || '天'})`
                        )
                    )
                )
            )
        ),

        // 快速取消表單
        showQuickCancelModal && React.createElement(
        'div',
        { className: styles['modal-overlay'] },
        React.createElement(
            'div',
            { className: `${styles['modal-content']} ${styles['modal-medium']}` },
            
            // Modal Header
            React.createElement(
            'div',
            { className: styles['modal-header'] },
            React.createElement('h2', null, '🗑️ ' + (t('quickCancel') || '批量取消班次')),
            React.createElement(
                'button',
                {
                className: styles['modal-close'],
                onClick: () => {
                    setShowQuickCancelModal(false);
                    resetQuickCancelData();
                }
                },
                '✕'
            )
            ),

            // Form
            React.createElement(
            'form',
            { onSubmit: handleQuickCancel, className: styles['quick-assign-form'] },

            // 基本選項
            React.createElement(
                'div',
                { className: styles['basic-options'] },

                // 選擇員工
                React.createElement(
                'div',
                { className: styles['form-group'] },
                React.createElement('label', null, t('selectStaff') || '選擇員工'),
                React.createElement(
                    'select',
                    {
                    className: styles['form-select'],
                    value: quickCancelData.staff,
                    onChange: (e) => setQuickCancelData({ ...quickCancelData, staff: e.target.value }),
                    required: true
                    },
                    React.createElement('option', { value: '' }, t('chooseStaff') || '請選擇員工'),
                    staff.map(member =>
                    React.createElement(
                        'option',
                        { key: member.id, value: member.id },
                        `${member.first_name} ${member.last_name}`
                    )
                    )
                )
                ),
            ),

            // 快速選擇按鈕
            quickCancelData.staff && quickCancelData.shift && React.createElement(
                'div',
                { className: styles['quick-select-buttons'] },
                React.createElement('h4', null, t('quickSelect') || '快速選擇要取消的日期：'),
                React.createElement(
                'div',
                { className: styles['button-group'] },

                // 選擇所有已分配
                React.createElement(
                    'button',
                    {
                    type: 'button',
                    className: styles['quick-btn'],
                    onClick: () => {
                        const days = generateCalendarDays();
                        const assignedDates = days
                        .filter(day =>
                            day.shifts.some(shift =>
                            shift.staff === parseInt(quickCancelData.staff) &&
                            shift.shift === parseInt(quickCancelData.shift)
                            )
                        )
                        .map(day => formatDateToString(day.fullDate));
                        setQuickCancelData({ ...quickCancelData, selectedDates: assignedDates });
                    }
                    },
                    '📅 ' + (t('selectAllAssigned') || '選擇所有已分配日期')
                ),

                // 選擇工作日
                isWeekdayShift(quickCancelData.shift) && React.createElement(
                    'button',
                    {
                    type: 'button',
                    className: styles['quick-btn'],
                    onClick: () => {
                        const days = generateCalendarDays();
                        const weekdayDates = days
                        .filter(day => {
                            const dayOfWeek = day.fullDate.getDay();
                            return dayOfWeek >= 1 && dayOfWeek <= 5 &&
                            day.shifts.some(shift =>
                                shift.staff === parseInt(quickCancelData.staff) &&
                                shift.shift === parseInt(quickCancelData.shift)
                            );
                        })
                        .map(day => formatDateToString(day.fullDate));
                        setQuickCancelData({ ...quickCancelData, selectedDates: weekdayDates });
                    }
                    },
                    '💼 ' + (t('selectWeekdays') || '選擇工作日')
                ),

                // 選擇週末
                isWeekendShift(quickCancelData.shift) && React.createElement(
                    'button',
                    {
                    type: 'button',
                    className: styles['quick-btn'],
                    onClick: () => {
                        const days = generateCalendarDays();
                        const weekendDates = days
                        .filter(day => {
                            const dayOfWeek = day.fullDate.getDay();
                            return (dayOfWeek === 0 || dayOfWeek === 6) &&
                            day.shifts.some(shift =>
                                shift.staff === parseInt(quickCancelData.staff) &&
                                shift.shift === parseInt(quickCancelData.shift)
                            );
                        })
                        .map(day => formatDateToString(day.fullDate));
                        setQuickCancelData({ ...quickCancelData, selectedDates: weekendDates });
                    }
                    },
                    '🎯 ' + (t('selectWeekends') || '選擇週末')
                ),

                // 清空
                React.createElement(
                    'button',
                    {
                    type: 'button',
                    className: styles['quick-btn-clear'],
                    onClick: () => setQuickCancelData({ ...quickCancelData, selectedDates: [] })
                    },
                    '🗑️ ' + (t('clearAll') || '清空')
                )
                )
            ),

            // 小月曆
            React.createElement(
                'div',
                { className: styles['mini-calendar-section'] },
                React.createElement(
                'h4',
                null,
                t('selectDatesForCancel') || '選擇要取消的日期' +
                (quickCancelData.selectedDates.length > 0 ? ` (已選 ${quickCancelData.selectedDates.length} 天)` : '') +
                ' - 僅顯示已分配的班次'
                ),

                // 月份導航
                React.createElement(
                'div',
                { className: styles['mini-month-nav'] },
                React.createElement('button', { type: 'button', onClick: () => navigateMonth(-1) }, '◀'),
                React.createElement('span', { className: styles['mini-month-title'] }, formatDisplayDate(currentDate)),
                React.createElement('button', { type: 'button', onClick: () => navigateMonth(1) }, '▶')
                ),

                // 星期標題
                React.createElement(
                'div',
                { className: styles['mini-calendar-weekdays'] },
                ...t('weekdaysShort').map((day, i) =>
                    React.createElement('div', { key: day, className: styles['weekday-header'] }, day)
                )
                ),

            // 日期格子
            React.createElement(
            'div',
            { className: styles['mini-calendar-grid'] },
            ...generateCalendarDays().map((day, index) => {
                if (!day.date) {
                    return React.createElement('div', { key: index, className: styles['empty-day'] });
                }

                const dateStr = formatDateToString(day.fullDate);
                const isSelected = quickCancelData.selectedDates.includes(dateStr);
                const allShiftsForDay = quickCancelData.staff
                    ? day.shifts.filter(s => s.staff === parseInt(quickCancelData.staff))
                    : [];
                const hasAnyShift = allShiftsForDay.length > 0;
                const isPastDate = day.fullDate < new Date().setHours(0, 0, 0, 0);

                // 內部元素陣列 (確保只有一個 children array)
                const children = [
                    // 日期號碼
                    React.createElement('span', { key: 'num', className: styles['mini-day-number'] }, day.date),

                    // 如果有班次 → 縮寫容器
                    hasAnyShift &&
                        React.createElement(
                            'div',
                            { key: 'info', className: styles['mini-shift-info'] },
                            allShiftsForDay.map((shift, i) =>
                                React.createElement(
                                    'span',
                                    { key: 's'+i, className: styles['mini-shift-name'] },
                                    getShiftDisplayName(shift).substring(0, 2)
                                )
                            )
                        ),

                    // 選中標記
                    isSelected && React.createElement('span', { key: 'sel', className: styles['selected-indicator'] }, '✓')
                ].filter(Boolean); // 過濾掉 false/null

                // 返回單一格子
                return React.createElement(
                    'div',
                    {
                        key: index,
                        className: `${styles['mini-day']} ${isSelected ? styles['selected'] : ''} ${hasAnyShift ? styles['has-cancelable-shift'] : styles['no-shift']}`,
                        onClick: () => {
                            if (hasAnyShift) { // ✅ 過去日期也能選
                                const newDates = isSelected
                                    ? quickCancelData.selectedDates.filter(d => d !== dateStr)
                                    : [...quickCancelData.selectedDates, dateStr];
                                setQuickCancelData({ ...quickCancelData, selectedDates: newDates });
                            }
                        },
                        title: hasAnyShift
                            ? `已分配班次: ${allShiftsForDay.map(s => getShiftDisplayName(s)).join(', ')}`
                            : '此日期無排班'
                    },
                    children // 單一 children array
                );
            })
            ),


            // 已選日期摘要
            quickCancelData.selectedDates.length > 0 && React.createElement(
                'div',
                { className: styles['selected-summary'] },
                React.createElement('h5', null, t('selectedDatesForCancel') || '將要取消的日期：'),
                React.createElement(
                'div',
                { className: styles['selected-dates-preview'] },
                ...quickCancelData.selectedDates.slice(0, 5).map(dateStr => {
                    const date = new Date(dateStr);
                    return React.createElement(
                    'span',
                    { key: dateStr, className: `${styles['date-chip']} ${styles['cancel-chip']}` },
                    `${date.getMonth() + 1}/${date.getDate()}`
                    );
                }),
                quickCancelData.selectedDates.length > 5 && React.createElement(
                    'span',
                    { className: styles['more-indicator'] },
                    `+${quickCancelData.selectedDates.length - 5}`
                )
                )
            ),

            // 操作按鈕
            React.createElement(
                'div',
                { className: styles['form-actions'] },
                React.createElement(
                'button',
                {
                    type: 'button',
                    className: styles['btn-cancel'],
                    onClick: () => {
                    setShowQuickCancelModal(false);
                    resetQuickCancelData();
                    }
                },
                t('cancel') || '取消'
                ),
                React.createElement(
                    'button',
                    {
                        type: 'submit',
                        className: `${styles['btn-primary']} ${styles['btn-danger']}`,
                        disabled: !quickCancelData.staff || quickCancelData.selectedDates.length === 0
                    },
                    (t('batchCancel') || '批量取消') + ` (${quickCancelData.selectedDates.length} ${t('shifts') || '個班次'})`
                )
            )
            )
        )
        )
    )
)
};

export default StaffScheduling;