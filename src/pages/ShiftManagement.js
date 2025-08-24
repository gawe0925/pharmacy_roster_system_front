import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { shiftAPI } from '../services/api';
import LanguageSwitch from '../components/LanguageSwitch';
import '../styles/ShiftManagement.css';

const ShiftManagement = () => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const navigate = useNavigate();

    // 生成24小時時間選項
    const generateTimeOptions = () => {
        const options = [];
        for (let hour = 0; hour < 24; hour++) {
            for (let minute of [0, 30]) {
                const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                options.push(timeString);
            }
        }
        return options;
    };

    // 計算工作時數
    const calculateWorkHours = (startTime, endTime) => {
        if (!startTime || !endTime) return 0;
        
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);
        
        let totalMinutes = 0;
        if (endHour < startHour || (endHour === startHour && endMinute <= startMinute)) {
            // 跨天計算
            totalMinutes = (24 - startHour) * 60 - startMinute + endHour * 60 + endMinute;
        } else {
            totalMinutes = (endHour - startHour) * 60 + (endMinute - startMinute);
        }
        
        return Number((totalMinutes / 60).toFixed(2));
    };

    // 生成有效的結束時間小時選項（不能早於開始時間）
    const getValidEndHourOptions = (startTime) => {
        if (!startTime) return hourOptions;
        
        const [startHour] = startTime.split(':').map(Number);
        const validHours = [];
        
        // 從開始小時到23點都是有效的
        for (let hour = startHour; hour < 24; hour++) {
            validHours.push(hour.toString().padStart(2, '0'));
        }
        
        return validHours;
    };

    // 生成有效的結束時間分鐘選項
    const getValidEndMinuteOptions = (startTime, endHour) => {
        if (!startTime) return minuteOptions;
        
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const endHourNum = parseInt(endHour);
        
        // 如果結束小時大於開始小時，所有分鐘都有效
        return minuteOptions;
    };

    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingShift, setEditingShift] = useState(null);
    const [permissionError, setPermissionError] = useState(false);

    const timeOptions = useMemo(() => generateTimeOptions(), []);
    const hourOptions = useMemo(() =>
        Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0')),
        []
    );
    // const minuteOptions = useMemo(() => ['00', '15', '30', '45'], []);
    const minuteOptions = useMemo(() => ['00', '30',], []);

    const [formData, setFormData] = useState({
        shift_name: '',
        start_time: '',
        end_time: '',
        daily_work_hours: '',
        description: ''
    });

    // 監聽開始和結束時間變化，自動計算工作時數
    useEffect(() => {
        if (formData.start_time && formData.end_time) {
            const workHours = calculateWorkHours(formData.start_time, formData.end_time);
            setFormData(prev => ({
                ...prev,
                daily_work_hours: workHours
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                daily_work_hours: ''
            }));
        }
    }, [formData.start_time, formData.end_time]);

    // 權限檢查
    const checkPermissions = useCallback(() => {
        if (!user || (!user.is_staff && !user.is_superuser)) {
            setPermissionError(true);
            return false;
        }
        return true;
    }, [user]);

    const loadShifts = useCallback(async () => {
        try {
            setLoading(true);
            const response = await shiftAPI.list();
            setShifts(response.data.results || response.data || []);
        } catch (error) {
            console.error('載入班次失敗:', error);
            alert(t('loadError') || '載入失敗');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!checkPermissions()) {
            return;
        }
        loadShifts();
    }, [checkPermissions, loadShifts]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!checkPermissions()) return;

        try {
            if (editingShift) {
                await shiftAPI.update(editingShift.id, formData);
                alert(t('updateSuccess') || '更新成功');
            } else {
                await shiftAPI.create(formData);
                alert(t('createSuccess') || '新增成功');
            }
            setShowForm(false);
            setEditingShift(null);
            resetForm();
            loadShifts();
        } catch (error) {
            console.error('操作失敗:', error);
            alert(t('operationFailed') || '操作失敗');
        }
    };

    const handleEdit = (shift) => {
        if (!checkPermissions()) return;
        setEditingShift(shift);
        setFormData({
            shift_name: shift.shift_name,
            start_time: shift.start_time,
            end_time: shift.end_time,
            daily_work_hours: shift.daily_work_hours,
            description: shift.description || ''
        });
        setShowForm(true);
    };

    const handleDelete = async (shiftId) => {
        if (!checkPermissions()) return;
        
        if (!window.confirm(t('confirmDelete') || '確定要刪除嗎？')) {
            return;
        }

        try {
            await shiftAPI.delete(shiftId);
            alert(t('deleteSuccess') || '刪除成功');
            loadShifts();
        } catch (error) {
            console.error('刪除失敗:', error);
            alert(t('deleteFailed') || '刪除失敗');
        }
    };

    const resetForm = () => {
        setFormData({
            shift_name: '',
            start_time: '',
            end_time: '',
            daily_work_hours: '',
            description: ''
        });
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingShift(null);
        resetForm();
    };

    // 渲染時間下拉選擇器
    const renderTimeSelect = (type, value, onChange) => {
        const options = type === 'hour' ? hourOptions : minuteOptions;
        return (
            <select
                value={value}
                onChange={onChange}
                className="time-select"
            >
                <option value="">{t('select') || '選擇'}</option>
                {options.map(option => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>
        );
    };

    const formatTime = (timeString) => {
        if (!timeString) return '';
        return timeString.substring(0, 5);
    };

    // 權限錯誤頁面
    const renderPermissionError = () => {
        return React.createElement('div', { className: 'permission-error' },
            React.createElement('div', { className: 'error-content' },
                React.createElement('div', { className: 'error-icon' }, '🚫'),
                React.createElement('h2', null, t('accessDenied') || '訪問被拒絕'),
                React.createElement('p', null, t('noPermissionMessage') || '您沒有權限訪問班次管理頁面。'),
                React.createElement('p', null, t('contactAdmin') || '如需訪問權限，請聯繫系統管理員。'),
                React.createElement('button', {
                    className: 'btn-primary',
                    onClick: () => navigate('/roster')
                }, t('backToRoster') || '返回班表')
            )
        );
    };

    // 載入中頁面
    const renderLoading = () => {
        return React.createElement('div', { className: 'shift-management loading' },
            React.createElement('div', { className: 'loading-spinner' }),
            React.createElement('p', null, t('loading') || '載入中...')
        );
    };

    // 主要頁面標題
    const renderPageHeader = () => {
        return React.createElement('div', { className: 'page-header' },
            React.createElement('div', { className: 'header-content' },
                React.createElement('div', { className: 'title-section' },
                    React.createElement('h1', { className: 'page-title' },
                        t('shiftManagement') || '班次管理')
                ),
                React.createElement('div', { className: 'header-actions' },
                    React.createElement(LanguageSwitch),
                    React.createElement('button', {
                        className: 'btn-secondary',
                        onClick: () => setShowForm(true),
                        style: { marginRight: '8px' }
                    },
                        React.createElement('span', { className: 'btn-icon' }, '+'),
                        t('addNewShift') || '新增班次'
                    ),
                    React.createElement('button', {
                        className: 'btn-secondary',
                        onClick: () => navigate('/staff-scheduling'),
                        style: { marginRight: '8px' }
                    },
                        (t('staffScheduling') || '員工排班') + ' →'
                    ),
                    React.createElement('button', {
                        className: 'btn-secondary',
                        onClick: () => navigate('/roster')
                    },
                        '← ' + (t('backToRoster') || '返回班表')
                    ),
                    React.createElement('button', {
                        className: 'btn-secondary',
                        onClick: () => navigate('/dashboard')
                     },
                    '← ' + (t('backToDashboard') || '返回主頁')
                    )
                )
            )
        );
    };

    // 班次卡片
    const renderShiftCard = (shift) => {
        return React.createElement('div', {
            key: shift.id,
            className: 'shift-card'
        },
            React.createElement('div', { className: 'shift-header' },
                React.createElement('h3', { className: 'shift-name' }, shift.shift_name),
                React.createElement('div', { className: 'shift-actions' },
                    React.createElement('button', {
                        className: 'btn-edit',
                        onClick: () => handleEdit(shift),
                        title: t('edit') || '編輯'
                    }, '✏️'),
                    React.createElement('button', {
                        className: 'btn-delete',
                        onClick: () => handleDelete(shift.id),
                        title: t('delete') || '刪除'
                    }, '🗑️')
                )
            ),
            React.createElement('div', { className: 'shift-details' },
                React.createElement('div', { className: 'detail-row' },
                    React.createElement('span', { className: 'detail-label' },
                        (t('workTime') || '工作時間') + ':'),
                    React.createElement('span', { className: 'detail-value' },
                        formatTime(shift.start_time) + ' - ' + formatTime(shift.end_time))
                ),
                React.createElement('div', { className: 'detail-row' },
                    React.createElement('span', { className: 'detail-label' },
                        (t('workHours') || '工作時數') + ':'),
                    React.createElement('span', { className: 'detail-value' },
                        shift.daily_work_hours + ' ' + (t('hours') || '小時'))
                ),
                shift.description && React.createElement('div', { className: 'detail-row' },
                    React.createElement('span', { className: 'detail-label' },
                        (t('shiftDescription') || '說明') + ':'),
                    React.createElement('span', { className: 'detail-value' }, shift.description)
                )
            )
        );
    };

    // 班次列表
    const renderShiftsList = () => {
        if (shifts.length === 0) {
            return React.createElement('div', { className: 'no-shifts' },
                React.createElement('div', { className: 'no-shifts-icon' }, '📋'),
                React.createElement('p', null, t('noShifts') || '尚無班次資料'),
                React.createElement('button', {
                    className: 'btn-primary',
                    onClick: () => setShowForm(true)
                }, t('addFirstShift') || '新增第一個班次')
            );
        }

        return React.createElement('div', { className: 'shifts-grid' },
            shifts.map(shift => renderShiftCard(shift))
        );
    };

    // 表單
    const renderForm = () => {
        if (!showForm) return null;

        // 時間選擇的渲染函數 - 根據開始時間過濾結束時間選項
        const renderEndTimeSelect = (type, value, onChange) => {
            let options = [];
            
            if (type === 'hour') {
                // 結束時間的小時選項：從開始時間的小時開始到23
                options = getValidEndHourOptions(formData.start_time);
            } else {
                // 結束時間的分鐘選項：根據當前選中的結束小時決定
                const currentEndHour = formData.end_time ? formData.end_time.split(':')[0] : '';
                options = getValidEndMinuteOptions(formData.start_time, currentEndHour);
            }
            
            return (
                <select
                    value={value}
                    onChange={onChange}
                    className="time-select"
                >
                    {options.map(option => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            );
        };

        // 時間表單組
        const renderTimeFormGroup = () => {
            const getTimeValue = (timeString, part) => {
                if (!timeString) return '';
                const parts = timeString.split(':');
                return parts[part === 'hour' ? 0 : 1] || '';
            };

            return (
                <div className="time-select-container">
                    <div className="time-group">
                        <label className="time-label">{t('startTime') || '開始時間'} *</label>
                        <div className="time-inputs">
                            {renderTimeSelect(
                                'hour',
                                getTimeValue(formData.start_time, 'hour'),
                                (e) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        start_time: e.target.value ? `${e.target.value}:00` : ''
                                    }));
                                }
                            )}
                            <span className="time-separator">:</span>
                            {renderTimeSelect(
                                'minute',
                                getTimeValue(formData.start_time, 'minute'),
                                (e) => {
                                    const hour = getTimeValue(formData.start_time, 'hour');
                                    setFormData(prev => ({
                                        ...prev,
                                        start_time: `${hour}:${e.target.value}`
                                    }));
                                }
                            )}
                        </div>
                    </div>
                    
                    <div className="time-group">
                        <label className="time-label">{t('endTime') || '結束時間'} *</label>
                        <div className="time-inputs">
                            {renderEndTimeSelect(
                                'hour',
                                getTimeValue(formData.end_time, 'hour'),
                                (e) => {
                                    const minute = getTimeValue(formData.end_time, 'minute');
                                    const selectedHour = e.target.value;
                                    
                                    if (selectedHour) {
                                        setFormData(prev => ({
                                            ...prev,
                                            end_time: `${selectedHour}:00`
                                        }));
                                    } else {
                                        setFormData(prev => ({
                                            ...prev,
                                            end_time: ''
                                        }));
                                    }
                                }
                            )}
                            <span className="time-separator">:</span>
                            {renderEndTimeSelect(
                                'minute',
                                getTimeValue(formData.end_time, 'minute'),
                                (e) => {
                                    const hour = getTimeValue(formData.end_time, 'hour');
                                    setFormData(prev => ({
                                        ...prev,
                                        end_time: `${hour}:${e.target.value}`
                                    }));
                                }
                            )}
                        </div>
                    </div>
                </div>
            );
        };

        return (
            <div className="modal-overlay">
                <div className="modal-content">
                    <div className="modal-header">
                        <h2>
                            {editingShift ? (t('editShift') || '編輯班次') : (t('addNewShift') || '新增班次')}
                        </h2>
                        <button className="modal-close" onClick={handleCancel}>✕</button>
                    </div>
                    <form onSubmit={handleSubmit} className="shift-form">
                        <div className="form-group">
                            <label htmlFor="shift_name">{t('shiftName') || '班次名稱'} *</label>
                            <input
                                type="text"
                                id="shift_name"
                                value={formData.shift_name}
                                onChange={(e) => setFormData({...formData, shift_name: e.target.value})}
                                required
                                placeholder={t('enterShiftName') || '請輸入班次名稱'}
                            />
                        </div>

                        {/* 新的時間選擇組 */}
                        {renderTimeFormGroup()}

                        <div className="form-group">
                            <label htmlFor="daily_work_hours">{t('dailyWorkHours') || '每日工作時數'}</label>
                            <input
                                type="number"
                                id="daily_work_hours"
                                value={formData.daily_work_hours}
                                readOnly
                                className="read-only-input"
                                step="0.01"
                            />
                            <small className="form-help-text">
                                {t('autoCalculated') || '根據開始和結束時間自動計算'}
                            </small>
                        </div>

                        <div className="form-group">
                            <label htmlFor="description">{t('shiftDescription') || '說明'}</label>
                            <textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                placeholder={t('enterDescription') || '請輸入班次說明（選填）'}
                                rows={3}
                            />
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn-cancel"
                                onClick={handleCancel}
                            >
                                {t('cancel') || '取消'}
                            </button>
                            <button
                                type="submit"
                                className="btn-submit"
                            >
                                {editingShift ? (t('update') || '更新') : (t('createShift') || '新增')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    // 主渲染函數
    if (permissionError) {
        return renderPermissionError();
    }

    if (loading) {
        return renderLoading();
    }

    return React.createElement('div', { className: 'shift-management' },
        renderPageHeader(),
        React.createElement('div', { className: 'shifts-container' },
            renderShiftsList()
        ),
        renderForm()
    );
};

export default ShiftManagement;