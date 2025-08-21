import React, { useState, useEffect } from 'react';
import '../styles/DateTimeSelector.css';

const DateTimeSelector = ({ value, onChange, label, minDateTime }) => {
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [isFullDay, setIsFullDay] = useState(true);

    // 從 value 中解析日期和時間
    useEffect(() => {
        if (value) {
            if (value.length === 10 && !value.includes('T')) {
                setSelectedDate(value);
                setSelectedTime('');
                setIsFullDay(true);
            } else {
                const date = new Date(value);
                const dateStr = date.toISOString().split('T')[0];
                const timeStr = date.getHours().toString().padStart(2, '0') + ':00';
                setSelectedDate(dateStr);
                setSelectedTime(timeStr);
                setIsFullDay(false);
            }
        } else {
            setSelectedDate('');
            setSelectedTime('');
            setIsFullDay(true);
        }
    }, [value]);

    // 判斷是否為假日（週六週日）
    const isWeekend = (dateString) => {
        const date = new Date(dateString);
        const day = date.getDay();
        return day === 0 || day === 6;
    };

    // 獲取可選時間列表（只有平日）
    const getAvailableHours = (dateString) => {
        if (!dateString || isWeekend(dateString)) return [];
        
        const startHour = 8;
        const endHour = 20; // 平日營業到20:00
        
        let actualStartHour = startHour;
        if (minDateTime && !isFullDay) {
            const minDate = new Date(minDateTime);
            const selectedDateObj = new Date(dateString);
            
            if (selectedDateObj.toDateString() === minDate.toDateString()) {
                const minHour = minDate.getHours();
                const adjustedMinHour = minDate.getMinutes() > 0 ? minHour + 1 : minHour;
                actualStartHour = Math.max(startHour, adjustedMinHour);
            }
        }
        
        const hours = [];
        for (let hour = actualStartHour; hour <= endHour; hour++) {
            const timeStr = hour.toString().padStart(2, '0') + ':00';
            hours.push({
                value: timeStr,
                label: timeStr,
                disabled: false
            });
        }
        
        return hours;
    };

    // 處理整天切換
    const handleFullDayToggle = (checked) => {
        setIsFullDay(checked);
        
        if (checked) {
            setSelectedTime('');
            if (selectedDate && !isWeekend(selectedDate)) {
                onChange(selectedDate);
            }
        } else {
            if (selectedDate && !isWeekend(selectedDate)) {
                const availableHours = getAvailableHours(selectedDate);
                if (availableHours.length > 0) {
                    const firstHour = availableHours[0].value;
                    setSelectedTime(firstHour);
                    onChange(`${selectedDate}T${firstHour}`);
                } else {
                    onChange('');
                }
            }
        }
    };

    // 處理日期變更
    const handleDateChange = (newDate) => {
        // 檢查是否為週末
        if (isWeekend(newDate)) {
            alert('正職員工假日不用上班，請選擇平日日期');
            return;
        }

        if (minDateTime && !isFullDay) {
            const minDate = new Date(minDateTime);
            const selectedDateObj = new Date(newDate);
            
            if (selectedDateObj < minDate.setHours(0, 0, 0, 0)) {
                alert('結束日期不能早於開始日期');
                return;
            }
        }

        setSelectedDate(newDate);
        
        if (isFullDay) {
            onChange(newDate);
        } else {
            if (selectedTime) {
                const newDateTime = `${newDate}T${selectedTime}`;
                if (isValidDateTime(newDateTime)) {
                    onChange(newDateTime);
                } else {
                    const availableHours = getAvailableHours(newDate);
                    if (availableHours.length > 0) {
                        const firstHour = availableHours[0].value;
                        setSelectedTime(firstHour);
                        onChange(`${newDate}T${firstHour}`);
                    } else {
                        setSelectedTime('');
                        onChange('');
                    }
                }
            } else {
                const availableHours = getAvailableHours(newDate);
                if (availableHours.length > 0) {
                    const firstHour = availableHours[0].value;
                    setSelectedTime(firstHour);
                    onChange(`${newDate}T${firstHour}`);
                }
            }
        }
    };

    // 處理時間變更
    const handleTimeChange = (newTime) => {
        if (selectedDate && newTime) {
            const newDateTime = `${selectedDate}T${newTime}`;
            
            if (isValidDateTime(newDateTime)) {
                setSelectedTime(newTime);
                onChange(newDateTime);
            } else {
                alert('結束時間不能早於開始時間');
                return;
            }
        }
    };

    // 驗證日期時間是否有效
    const isValidDateTime = (dateTimeString) => {
        if (!minDateTime) return true;
        
        if (minDateTime.length === 10 && !minDateTime.includes('T')) {
            const selectedDate = dateTimeString.split('T')[0];
            return selectedDate >= minDateTime;
        }
        
        const selectedDateTime = new Date(dateTimeString);
        const minDateTimeObj = new Date(minDateTime);
        
        return selectedDateTime >= minDateTimeObj;
    };

    // 獲取最小日期（排除週末）
    const getMinDate = () => {
        const today = new Date().toISOString().split('T')[0];
        
        if (minDateTime) {
            let minDate;
            if (minDateTime.length === 10 && !minDateTime.includes('T')) {
                minDate = minDateTime;
            } else {
                minDate = new Date(minDateTime).toISOString().split('T')[0];
            }
            return minDate > today ? minDate : today;
        }
        
        return today;
    };

    const availableHours = getAvailableHours(selectedDate);

    return React.createElement('div', { className: 'datetime-selector' },
        React.createElement('label', { className: 'datetime-label' }, label),
        
        React.createElement('div', { className: 'datetime-inputs' },
            // 日期選擇
            React.createElement('div', { className: 'date-input-container' },
                React.createElement('input', {
                    type: 'date',
                    value: selectedDate,
                    onChange: (e) => handleDateChange(e.target.value),
                    min: getMinDate(),
                    className: 'date-input'
                }),
                React.createElement('div', { className: 'input-icon' }, '📅')
            ),

            // 整天/具體時間切換
            React.createElement('div', { className: 'time-mode-container' },
                React.createElement('div', { className: 'time-mode-toggle' },
                    React.createElement('label', { className: 'toggle-option' },
                        React.createElement('input', {
                            type: 'radio',
                            name: `time-mode-${label}`,
                            checked: isFullDay,
                            onChange: () => handleFullDayToggle(true),
                            disabled: !selectedDate || isWeekend(selectedDate)
                        }),
                        ' 整天 (8小時)'
                    ),
                    React.createElement('label', { className: 'toggle-option' },
                        React.createElement('input', {
                            type: 'radio',
                            name: `time-mode-${label}`,
                            checked: !isFullDay,
                            onChange: () => handleFullDayToggle(false),
                            disabled: !selectedDate || isWeekend(selectedDate)
                        }),
                        ' 指定時間'
                    )
                )
            ),

            // 時間選擇（只在非整天模式顯示）
            !isFullDay && React.createElement('div', { className: 'time-input-container' },
                React.createElement('select', {
                    value: selectedTime,
                    onChange: (e) => handleTimeChange(e.target.value),
                    className: 'time-input',
                    disabled: !selectedDate || isWeekend(selectedDate)
                },
                    React.createElement('option', { value: '' }, '選擇時間'),
                    ...availableHours.map(hour => 
                        React.createElement('option', {
                            key: hour.value,
                            value: hour.value,
                            disabled: hour.disabled
                        }, hour.label)
                    )
                ),
                React.createElement('div', { className: 'input-icon' }, '🕐')
            )
        ),

        // 時間資訊提示
        selectedDate && React.createElement('div', { className: 'time-info-hint' },
            isWeekend(selectedDate) ? 
                '⚠️ 正職員工假日不用上班，請選擇平日' :
                (isFullDay ? 
                    '整天請假 (平日 8小時)' : 
                    '平日營業時間：08:00 - 20:00'
                )
        )
    );
};

export default DateTimeSelector;