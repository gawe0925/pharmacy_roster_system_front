import React, { useState, useEffect } from 'react';
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
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingShift, setEditingShift] = useState(null);
    const [permissionError, setPermissionError] = useState(false);
    const [formData, setFormData] = useState({
        shift_name: '',
        start_time: '',
        end_time: '',
        daily_work_hours: '',
        description: ''
    });

    // 權限檢查
    const checkPermissions = () => {
        if (!user || (!user.is_staff && !user.is_superuser)) {
            setPermissionError(true);
            return false;
        }
        return true;
    };

    useEffect(() => {
        if (!checkPermissions()) {
            return;
        }
        loadShifts();
    }, [user]);

    const loadShifts = async () => {
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
    };

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
                        className: 'btn-primary',
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
                        (t('description') || '說明') + ':'),
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

        return React.createElement('div', { className: 'modal-overlay' },
            React.createElement('div', { className: 'modal-content' },
                React.createElement('div', { className: 'modal-header' },
                    React.createElement('h2', null,
                        editingShift ? (t('editShift') || '編輯班次') : (t('addNewShift') || '新增班次')
                    ),
                    React.createElement('button', {
                        className: 'modal-close',
                        onClick: handleCancel
                    }, '✕')
                ),
                React.createElement('form', {
                    onSubmit: handleSubmit,
                    className: 'shift-form'
                },
                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', { htmlFor: 'shift_name' },
                            (t('shiftName') || '班次名稱') + ' *'),
                        React.createElement('input', {
                            type: 'text',
                            id: 'shift_name',
                            value: formData.shift_name,
                            onChange: (e) => setFormData({...formData, shift_name: e.target.value}),
                            required: true,
                            placeholder: t('enterShiftName') || '請輸入班次名稱'
                        })
                    ),
                    React.createElement('div', { className: 'form-row' },
                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', { htmlFor: 'start_time' },
                                (t('startTime') || '開始時間') + ' *'),
                            React.createElement('input', {
                                type: 'time',
                                id: 'start_time',
                                value: formData.start_time,
                                onChange: (e) => setFormData({...formData, start_time: e.target.value}),
                                required: true
                            })
                        ),
                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', { htmlFor: 'end_time' },
                                (t('endTime') || '結束時間') + ' *'),
                            React.createElement('input', {
                                type: 'time',
                                id: 'end_time',
                                value: formData.end_time,
                                onChange: (e) => setFormData({...formData, end_time: e.target.value}),
                                required: true
                            })
                        )
                    ),
                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', { htmlFor: 'daily_work_hours' },
                            (t('dailyWorkHours') || '每日工作時數') + ' *'),
                        React.createElement('input', {
                            type: 'number',
                            id: 'daily_work_hours',
                            value: formData.daily_work_hours,
                            onChange: (e) => setFormData({...formData, daily_work_hours: e.target.value}),
                            required: true,
                            min: '0',
                            max: '24',
                            step: '0.5',
                            placeholder: '8'
                        })
                    ),
                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', { htmlFor: 'description' },
                            t('description') || '說明'),
                        React.createElement('textarea', {
                            id: 'description',
                            value: formData.description,
                            onChange: (e) => setFormData({...formData, description: e.target.value}),
                            placeholder: t('enterDescription') || '請輸入班次說明（選填）',
                            rows: 3
                        })
                    ),
                    React.createElement('div', { className: 'form-actions' },
                        React.createElement('button', {
                            type: 'button',
                            className: 'btn-cancel',
                            onClick: handleCancel
                        }, t('cancel') || '取消'),
                        React.createElement('button', {
                            type: 'submit',
                            className: 'btn-submit'
                        }, editingShift ? (t('update') || '更新') : (t('create') || '新增'))
                    )
                )
            )
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