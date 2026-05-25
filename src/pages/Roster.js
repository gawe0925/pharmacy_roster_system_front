import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import LanguageSwitch from '../components/LanguageSwitch';
import { staffShiftAPI, shiftAPI } from '../services/api';
import styles from '../styles/Roster.module.css';

const Roster = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [shifts, setShifts] = useState([]);
  const [shiftTypes, setShiftTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month');
  const [availableDateRange, setAvailableDateRange] = useState({ min: null, max: null });

  // 權限檢查
  const hasManagementPermission = () => user && (user.is_manager || user.is_superuser);

  // 日期工具
  const pad2 = (n) => String(n).padStart(2, '0');
  const formatDateToString = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const createDateFromString = (dateString) => {
    if (!dateString) return new Date();
    const [y, m, d] = dateString.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const formatDisplayDate = (date) => `${date.getFullYear()}/${pad2(date.getMonth() + 1)}`;

  // 週區間顯示（依據目前 currentDate 的那一週）
  const getWeekDisplay = (date) => {
    const startOfWeek = getStartDate();
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const som = new Date(startOfMonth);
    const day = som.getDay();
    const diff = som.getDate() - day + (day === 0 ? -6 : 1);
    som.setDate(diff);
    const weekNumber = Math.ceil((startOfWeek - som) / (7 * 24 * 60 * 60 * 1000)) + 1;
    return `${formatDisplayDate(date)} Week ${Math.max(1, weekNumber)}`;
  };

  const formatTime = (hhmmss) => (hhmmss ? hhmmss.substring(0, 5) : '');
  const calculateBreakTime = (workHours) => (workHours >= 7 ? 30 : workHours >= 4 ? 15 : 0);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (availableDateRange.min && availableDateRange.max) {
      loadShifts();
    }
  }, [currentDate, viewMode, availableDateRange]);

  // 一次性載入：班次類型 + 日期範圍
  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadShiftTypes(), loadAvailableDateRange()]);
    } catch (e) {
      console.error('載入資料失敗:', e);
    } finally {
      setLoading(false);
    }
  };

  // 載入所有班次類型（用於 id->name/time/hours 對應）
  const loadShiftTypes = async () => {
    try {
      const res = await shiftAPI.list({ page_size: 1000 });
      setShiftTypes(res.data.results || res.data || []);
    } catch (e) {
      console.error('載入班次類型失敗:', e);
      setShiftTypes([]);
    }
  };

  // 載入資料可用日期範圍（用 staffshift 全量決定 min/max，並把 currentDate 設成最新月份）
  const loadAvailableDateRange = async () => {
    try {
      const response = await staffShiftAPI.list({ page_size: 1000 });
      const allShifts = response.data.results || response.data || [];
      if (allShifts.length > 0) {
        const dates = allShifts.map((s) => s.shift_date).sort();
        const minDate = createDateFromString(dates[0]);
        const maxDate = createDateFromString(dates[dates.length - 1]);
        setAvailableDateRange({ min: minDate, max: maxDate });
        setCurrentDate(new Date(maxDate.getFullYear(), maxDate.getMonth(), 1));
      } else {
        const now = new Date();
        setAvailableDateRange({ min: now, max: now });
        setCurrentDate(now);
      }
    } catch (e) {
      console.error('載入日期範圍失敗:', e);
      const now = new Date();
      setAvailableDateRange({ min: now, max: now });
      setCurrentDate(now);
    }
  };

  // 依目前視圖載入當期區間班表
  const loadShifts = async () => {
    const startDate = getStartDate();
    const endDate = getEndDate();
    const response = await staffShiftAPI.list({
      start_date: formatDateToString(startDate),
      end_date: formatDateToString(endDate),
      page_size: 1000
    });
    const shiftsData = response.data.results || response.data || [];
    setShifts(shiftsData);
    return response;
  };

  // 月/週區間
  const getStartDate = () => {
    if (viewMode === 'week') {
      const s = new Date(currentDate);
      const day = s.getDay();
      const diff = s.getDate() - day + (day === 0 ? -6 : 1);
      s.setDate(diff);
      return s;
    }
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  };

  const getEndDate = () => {
    if (viewMode === 'week') {
      const e = new Date(getStartDate());
      e.setDate(e.getDate() + 6);
      return e;
    }
    return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  };

  // 依日期取該日班次
  const getShiftsByDate = (date) => {
    const dateStr = formatDateToString(date);
    return shifts.filter((s) => s.shift_date === dateStr);
  };

  // 顯示名稱翻譯（保留你的語系鍵）
  const getShiftTypeTranslation = (shiftName) => {
    const map = {
      'Morning Shift': t('morningShift'),
      'Middle Shift': t('middleShift'),
      'Afternoon Shift': t('afternoonShift'),
      'Weekend Morning': t('weekendMorning'),
      'Weekend Midday': t('weekendMidday'),
      'Weekend Helper A': t('weekendHelperA'),
      'Weekend Helper B': t('weekendHelperB')
    };
    return map[shiftName] || shiftName;
  };

  // ——— 完全吃後端：shift id → shift object / name / 時間 ———
  const resolveShift = (shiftIdOrName) => {
    // 1) 後端常態：staffshift.shift = 數字 id
    if (typeof shiftIdOrName === 'number') {
      const st = shiftTypes.find((x) => x.id === shiftIdOrName);
      return { shiftType: st || null, shiftName: st?.shift_name || '' };
    }
    // 2) 若後端額外給 shift_name（兼容）
    if (typeof shiftIdOrName === 'string') {
      const st = shiftTypes.find((x) => x.shift_name === shiftIdOrName);
      return { shiftType: st || null, shiftName: shiftIdOrName };
    }
    return { shiftType: null, shiftName: '' };
  };

  // 你的「原本縮寫」規則（注意順序：週末類型要先比對）
  const getShiftAbbrByName = (name) => {
    if (!name) return 'S';
    if (name.includes('Weekend Helper A')) return 'WA';
    if (name.includes('Weekend Helper B')) return 'WB';
    if (name.includes('Weekend Midday') || name.includes('Weekend Middle')) return 'WD';
    if (name.includes('Weekend Morning')) return 'M'; // 你原始表是週末早班也顯示 M
    if (name.includes('Afternoon')) return 'N';
    if (name.includes('Middle')) return 'A';
    if (name.includes('Morning')) return 'M';
    if (name.includes('Weekend')) return 'W';
    return name.substring(0, 2) || 'S';
  };

  // 回傳班別的 CSS 類別（顏色交給 CSS）
  const getShiftClassKeyByName = (name) => {
    if (!name) return 'shift-default';
    if (name.includes('Weekend Helper A')) return 'shift-wa';
    if (name.includes('Weekend Helper B')) return 'shift-wb';
    if (name.includes('Weekend Midday') || name.includes('Weekend Middle')) return 'shift-wd';
    if (name.includes('Weekend Morning')) return 'shift-wm';
    if (name.includes('Afternoon')) return 'shift-n';
    if (name.includes('Middle')) return 'shift-a';
    if (name.includes('Morning')) return 'shift-m';
    if (name.includes('Weekend')) return 'shift-w';
    return 'shift-default';
  };

  // 最終給畫面的班別資訊（完全不含 inline style）
  const getShiftInfo = (shiftIdOrName) => {
    const { shiftType, shiftName } = resolveShift(shiftIdOrName);

    const nameForLabel = shiftType ? shiftType.shift_name : shiftName;
    const abbr = getShiftAbbrByName(nameForLabel);
    const classKey = getShiftClassKeyByName(nameForLabel);

    const hours = shiftType?.daily_work_hours ?? '';
    const breakMin = typeof hours === 'number' ? calculateBreakTime(hours) : 0;
    const desc = shiftType
      ? `${formatTime(shiftType.start_time)}–${formatTime(shiftType.end_time)}, ${t('total') || '共'} : ${hours} ${t('hrs') || '小時'}${breakMin > 0 ? `, ${t('break') || '休息'} ${breakMin} ${t('min') || '分鐘'}` : ''}`
      : nameForLabel;

    return {
      short: abbr,
      label: getShiftTypeTranslation(nameForLabel),
      description: desc,
      classKey,         // 拿去加在 className 上
      shiftType: shiftType || null
    };
  };

  // 圖例需要：把所有 shiftTypes 都轉成顯示資訊（用 classKey，不用 inline style）
  const getAllShiftTypes = () => {
    return shiftTypes
      .map((st) => {
        const info = getShiftInfo(st.id);
        const hours = st.daily_work_hours;
        const breakMin = calculateBreakTime(hours);
        return {
          short: info.short,
          label: getShiftTypeTranslation(st.shift_name),
          description: `${formatTime(st.start_time)}~${formatTime(st.end_time)}, ${t('total') || '共'} : ${hours} ${t('hrs') || '小時'}${breakMin > 0 ? `, ${t('break') || '休息'} ${breakMin} ${t('min') || '分鐘'}` : ''}`,
          classKey: info.classKey,
          sortOrder: getShiftSortOrder(st.shift_name)
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  };

  // 班次排序
  const getShiftSortOrder = (shiftName) => {
    if (shiftName.includes('Morning') && !shiftName.includes('Weekend')) return 1;
    if (shiftName.includes('Middle')) return 2;
    if (shiftName.includes('Afternoon')) return 3;
    if (shiftName.includes('Weekend Morning')) return 4;
    if (shiftName.includes('Weekend Midday') || shiftName.includes('Weekend Middle')) return 5;
    if (shiftName.includes('Weekend Helper A')) return 6;
    if (shiftName.includes('Weekend Helper B')) return 7;
    if (shiftName.includes('Weekend')) return 8;
    return 9;
  };

  // 取時間範圍（id 或 name 都可）
  const extractTime = (shiftIdOrName) => {
    const { shiftType } = resolveShift(shiftIdOrName);
    return shiftType ? `${formatTime(shiftType.start_time)} - ${formatTime(shiftType.end_time)}` : '';
  };

  // 是否我的班
  const isMyShift = (shift) => {
    if (shift.cover_shift) {
      return shift.alternative_staff === user?.id;
    }
    return shift.staff === user?.id;
  };

  // 取得實際上班人員
  const getActualWorker = (shift) => {
    if (shift.cover_shift) {
      return {
        id: shift.alternative_staff,
        name: shift.alternative_staff_name,
        originalStaff: shift.staff_name
      };
    }
    return {
      id: shift.staff,
      name: shift.staff_name,
      originalStaff: null
    };
  };

  // 導航
  const navigateDate = (direction) => {
    if (!availableDateRange.min || !availableDateRange.max) return;
    const newDate = new Date(currentDate);

    if (viewMode === 'week') newDate.setDate(newDate.getDate() + direction * 7);
    else newDate.setMonth(newDate.getMonth() + direction);

    if (viewMode === 'month') {
      const s = new Date(newDate.getFullYear(), newDate.getMonth(), 1);
      const e = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0);
      if (e < availableDateRange.min || s > availableDateRange.max) return;
    } else {
      const ws = new Date(newDate);
      const day = ws.getDay();
      const diff = ws.getDate() - day + (day === 0 ? -6 : 1);
      ws.setDate(diff);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      if (we < availableDateRange.min || ws > availableDateRange.max) return;
    }
    setCurrentDate(newDate);
  };

  const canNavigate = (direction) => {
    if (!availableDateRange.min || !availableDateRange.max) return false;
    const testDate = new Date(currentDate);

    if (viewMode === 'week') {
      testDate.setDate(testDate.getDate() + direction * 7);
      const ws = new Date(testDate);
      const day = ws.getDay();
      const diff = ws.getDate() - day + (day === 0 ? -6 : 1);
      ws.setDate(diff);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      return !(we < availableDateRange.min || ws > availableDateRange.max);
    } else {
      testDate.setMonth(testDate.getMonth() + direction);
      const ms = new Date(testDate.getFullYear(), testDate.getMonth(), 1);
      const me = new Date(testDate.getFullYear(), testDate.getMonth() + 1, 0);
      return !(me < availableDateRange.min || ms > availableDateRange.max);
    }
  };

  // CSV 匯出（完全用後端資料 + shiftTypes 對應）
  const exportToCSV = () => {
    if (shifts.length === 0) {
      alert(t('noDataToExport') || '沒有數據可導出');
      return;
    }

    const headers = [
      t('date') || '日期',
      t('actualWorker') || '實際上班人員',
      t('shift') || '班次',
      t('time') || '時間',
      t('workHours') || '工作時數',
      t('coverShift') || '代班',
      t('originalStaff') || '原分配人員'
    ];

    const csvData = shifts.map((shift) => {
      const actualWorker = getActualWorker(shift);
      const { shiftType, shiftName } = resolveShift(shift.shift ?? shift.shift_name);
      const timeInfo = shiftType ? `${formatTime(shiftType.start_time)} - ${formatTime(shiftType.end_time)}` : '';
      const workHours = shiftType ? shiftType.daily_work_hours : '';
      return [
        shift.shift_date,
        actualWorker.name,
        shiftName || '',
        timeInfo,
        workHours,
        shift.cover_shift ? (t('yes') || '是') : (t('no') || '否'),
        shift.cover_shift ? actualWorker.originalStaff : actualWorker.originalStaff || actualWorker.name
      ];
    });

    const csvContent = [
      headers.join(','),
      ...csvData.map((row) =>
        row
          .map((cell) => (typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell))
          .join(',')
      )
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);

    const periodText = viewMode === 'month' ? formatDisplayDate(currentDate) : getWeekDisplay(currentDate);
    link.setAttribute('download', `班表_${periodText.replace(/\s/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 主要畫面：月/週共用的 Calendar View
  const renderCalendarView = () => {
    const startDate = getStartDate();
    const endDate = getEndDate();
    const days = [];
    const currentDay = new Date(startDate);

    if (viewMode === 'month') {
      const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
      for (let i = startDay - 1; i >= 0; i--) {
        const prevDate = new Date(firstDay);
        prevDate.setDate(prevDate.getDate() - i - 1);
        days.push({ date: prevDate, isCurrentMonth: false, shifts: [] });
      }
    }

    while (currentDay <= endDate) {
      days.push({
        date: new Date(currentDay),
        isCurrentMonth: viewMode === 'week' || currentDay.getMonth() === currentDate.getMonth(),
        shifts: getShiftsByDate(currentDay)
      });
      currentDay.setDate(currentDay.getDate() + 1);
    }

    if (viewMode === 'month') {
      const remaining = 42 - days.length;
      for (let i = 1; i <= remaining; i++) {
        const nextDate = new Date(endDate);
        nextDate.setDate(nextDate.getDate() + i);
        days.push({ date: nextDate, isCurrentMonth: false, shifts: [] });
      }
    }

    return (
      <div className={`${styles['calendar-grid']} ${styles[viewMode]}`}>
        {viewMode === 'month' && (
          <div className={styles['month-indicator']}>{formatDisplayDate(currentDate)}</div>
        )}

        <div className={styles['weekday-headers']}>
          {[
            t('monday') || '週一',
            t('tuesday') || '週二',
            t('wednesday') || '週三',
            t('thursday') || '週四',
            t('friday') || '週五',
            t('saturday') || '週六',
            t('sunday') || '週日'
          ].map((d) => (
            <div key={d} className={styles['weekday-header']}>
              {d}
            </div>
          ))}
        </div>

        <div className={styles['days-grid']}>
          {days.map((day, index) => {
            const isToday =
              formatDateToString(day.date) === formatDateToString(new Date());
            const myShifts = day.shifts.filter((s) => isMyShift(s));

            return (
              <div
                key={index}
                className={`${styles['day-cell']} ${!day.isCurrentMonth ? styles['other-month'] : ''} ${isToday ? styles.today : ''}`}
              >
                <div className={styles['day-number']}>
                  {day.date.getDate()}
                  {myShifts.length > 0 && <div className={styles['my-shift-indicator']}>★</div>}
                </div>

                <div className={styles['day-shifts']}>
                  {day.shifts.slice(0, 3).map((shift, i) => {
                    const { shiftName } = resolveShift(shift.shift ?? shift.shift_name);
                    const info = getShiftInfo(shift.shift ?? shift.shift_name);
                    const isMine = isMyShift(shift);
                    const actualWorker = getActualWorker(shift);

                    return (
                      <div
                        key={i}
                        className={`${styles['shift-item']} ${styles[info.classKey] || ''} ${isMine ? styles['my-shift'] : ''} ${shift.cover_shift ? styles['covered-shift'] : ''}`}
                        title={
                          shift.cover_shift
                            ? `${info.description} - ${actualWorker.name} (代班 ${actualWorker.originalStaff})`
                            : `${info.description} - ${actualWorker.name}`
                        }
                      >
                        <span className={styles['shift-type-badge']}>{info.short}</span>
                        <span className={styles['shift-staff-name']}>{actualWorker.name}</span>
                        {shift.cover_shift && (
                          <span className={styles['cover-indicator']}>
                            <span className={styles['cover-icon']}>🔄</span>
                            <span className={styles['original-staff']}>{actualWorker.originalStaff}</span>
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {day.shifts.length > 3 && (
                    <div className={styles['more-shifts']}>+{day.shifts.length - 3}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 列表視圖
  const renderListView = () => {
    const grouped = {};
    shifts.forEach((s) => {
      if (!grouped[s.shift_date]) grouped[s.shift_date] = [];
      grouped[s.shift_date].push(s);
    });
    const sortedDates = Object.keys(grouped).sort();

    return (
      <div className={styles['list-view']}>
        {sortedDates.map((date) => {
          const dayShifts = grouped[date];
          const dateObj = createDateFromString(date);
          const isToday = formatDateToString(dateObj) === formatDateToString(new Date());

          return (
            <div key={date} className={`${styles['date-section']} ${isToday ? styles.today : ''}`}>
              <div className={styles['date-header']}>
                <h3 className={styles['date-title']}>
                  {dateObj.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' })}
                  {isToday && <span className={styles['today-badge']}>{t('today') || '今天'}</span>}
                </h3>
              </div>

              <div className={styles['shifts-list']}>
                {dayShifts.map((shift) => {
                  const info = getShiftInfo(shift.shift ?? shift.shift_name);
                  const timeInfo = extractTime(shift.shift ?? shift.shift_name);
                  const isMine = isMyShift(shift);
                  const actualWorker = getActualWorker(shift);

                  return (
                    <div
                      key={shift.id}
                      className={`${styles['shift-card']} ${isMine ? styles['my-shift'] : ''} ${shift.cover_shift ? styles['covered-shift'] : ''}`}
                    >
                      <div className={`${styles['shift-badge']} ${styles[info.classKey] || ''}`}>
                        <span className={styles['shift-type-badge']}>{info.short}</span>
                        <span>{info.label}</span>
                      </div>

                      <div className={styles['shift-details']}>
                        <div className={styles['shift-staff']}>
                          <span className={styles['staff-name']}>{actualWorker.name}</span>
                          {isMine && <span className={styles['my-badge']}>{t('me') || '我'}</span>}
                        </div>
                        <div className={styles['shift-time']}>{timeInfo}</div>
                        <div className={styles['shift-name']}>{resolveShift(shift.shift ?? shift.shift_name).shiftName}</div>
                        {info.shiftType && (
                          <div className={styles['work-hours']}>
                            {t('workHours') || '工作時數'}: {info.shiftType.daily_work_hours}h
                          </div>
                        )}

                        {shift.cover_shift && (
                          <div className={styles['cover-info']}>
                            <span className={styles['cover-label']}>🔄 {t('coveringFor') || '代班：'}</span>
                            <span className={styles['original-staff']}>{actualWorker.originalStaff}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`${styles['shift-schedule']} ${styles.loading}`}>
        <div className={styles['loading-spinner']}></div>
        <p>{t('loading') || '載入中...'}</p>
      </div>
    );
  }

  return (
    <div className={styles['shift-schedule']}>
      {/* 頁面標題 */}
      <div className={styles['page-header']}>
        <div className={styles['header-content']}>
          <div className={styles['title-section']}>
            <h1 className={styles['page-title']}>{t('shiftSchedule') || '班表'}</h1>
            {user && (
              <div className={styles['user-info']}>
                <span className={styles['welcome-text']}>{t('welcome') || '歡迎'}, </span>
                <span className={styles['user-name']}>{user.first_name || user.username}</span>
              </div>
            )}
          </div>

          <div className={styles['header-actions']}>
            <LanguageSwitch />

            {hasManagementPermission() && (
              <>
                <button
                  className={styles['btn-primary']}
                  onClick={() => navigate('/staff-scheduling')}
                >
                  <span className={styles['btn-icon']}>📋</span>
                  {t('staffScheduling') || '員工排班'}
                </button>

                <button
                  className={styles['btn-secondary']}
                  onClick={() => navigate('/shift-management')}
                >
                  <span className={styles['btn-icon']}>⚙️</span>
                  {t('shiftManagement') || '班次管理'}
                </button>
              </>
            )}

            <button
              className={styles['btn-export']}
              onClick={exportToCSV}
              disabled={shifts.length === 0}
            >
              <span className={styles['btn-icon']}>📋</span>
              {t('exportCSV') || '導出 CSV'}
            </button>

            <button 
                className="btn-secondary"
                onClick={() => navigate('/dashboard')}
            >
                ← {t('backToDashboard')}
            </button>
          </div>
        </div>
      </div>

      {/* 導航控制 */}
      <div className={styles['navigation-section']}>
        <div className={styles['date-navigation']}>
          <button
            className={`${styles['nav-btn']} ${!canNavigate(-1) ? styles.disabled : ''}`}
            onClick={() => navigateDate(-1)}
            disabled={!canNavigate(-1)}
          >
            <span>◀</span>
          </button>

          <div className={styles['current-period']}>
            {viewMode === 'month' ? <h2>{formatDisplayDate(currentDate)}</h2> : <h2>{getWeekDisplay(currentDate)}</h2>}
          </div>

          <button
            className={`${styles['nav-btn']} ${!canNavigate(1) ? styles.disabled : ''}`}
            onClick={() => navigateDate(1)}
            disabled={!canNavigate(1)}
          >
            <span>▶</span>
          </button>
        </div>

        <div className={styles['right-controls']}>
          <div className={styles['view-toggle']}>
            <button
              className={`${styles['toggle-btn']} ${viewMode === 'month' ? styles.active : ''}`}
              onClick={() => setViewMode('month')}
            >
              <span className={styles['btn-icon']}>📅</span>
              {t('monthView') || '月視圖'}
            </button>
            <button
              className={`${styles['toggle-btn']} ${viewMode === 'week' ? styles.active : ''}`}
              onClick={() => setViewMode('week')}
            >
              <span className={styles['btn-icon']}>📊</span>
              {t('weekView') || '週視圖'}
            </button>
          </div>
        </div>
      </div>

      {/* 內容 */}
      <div className={styles['schedule-content']}>
        <div className={styles['legend-notice']}>
          <span className={styles['legend-notice-icon']}>ℹ️</span>
          <span>{t('legendNotice') || '班次說明請參考下方圖例'}</span>
        </div>

        {shifts.length === 0 ? (
          <div className={styles['no-shifts']}>
            <div className={styles['no-shifts-icon']}>📅</div>
            <p>{t('noShiftsInPeriod') || '此期間沒有排班'}</p>
            {hasManagementPermission() && (
              <button
                className={styles['btn-primary']}
                onClick={() => navigate('/staff-scheduling')}
              >
                <span className={styles['btn-icon']}>+</span>
                {t('startScheduling') || '開始排班'}
              </button>
            )}
            {shiftTypes.length === 0 && (
              <p className={styles['no-shift-types-warning']}>
                {t('noShiftTypesLoaded') || '無法載入班次類型資料'}
              </p>
            )}
          </div>
        ) : viewMode === 'month' ? (
          renderCalendarView()
        ) : viewMode === 'week' ? (
          renderCalendarView()
        ) : (
          renderListView()
        )}
      </div>

      {/* 圖例 */}
      <div className={styles['legend-section']}>
        <h3 className={styles['legend-title']}>{t('legend') || '圖例說明'}</h3>
        <div className={styles['legend-content']}>
          {/* 左側：班次類型 */}
          <div className={styles['legend-group']}>
            <div className={styles['shift-types-section']}>
              <h4>{t('shiftTypes') || '班次類型'}</h4>
              {shiftTypes.length > 0 ? (
                <div className={styles['shift-types-grid']}>
                  {getAllShiftTypes().map((st, idx) => (
                    <div key={idx} className={styles['shift-type-item']}>
                      <div className={`${styles['shift-type-sample']} ${styles[st.classKey] || ''}`}>
                        {st.short}
                      </div>
                      <div className={styles['shift-type-info']}>
                        <div className={styles['shift-type-name']}>{st.label}</div>
                        <div className={styles['shift-type-desc']}>{st.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles['no-shift-types']}>
                  <p>{t('loadingShiftTypes') || '載入班次類型中...'}</p>
                </div>
              )}
            </div>
          </div>

          {/* 右側：狀態標記說明 */}
          <div className={styles['legend-group']}>
            <div className={styles['status-section']}>
              <h4>{t('statusIndicators') || '狀態標記'}</h4>
              <div className={styles['status-items']}>
                <div className={styles['legend-item']}>
                  <div className={`${styles['legend-sample']} ${styles['my-shift-sample']}`}></div>
                  <span>{t('myShiftExplanation') || '我的班次 - 高亮顯示你被分配的班次'}</span>
                </div>
                <div className={styles['legend-item']}>
                  <span className={`${styles['legend-icon']} ${styles['cover-sample']}`}>🔄</span>
                  <span>{t('coverShiftExplanation') || '代班 - 顯示實際上班人員代班原分配人員'}</span>
                </div>
                <div className={styles['legend-item']}>
                  <div className={styles['legend-star']}>★</div>
                  <span>{t('hasMyShiftExplanation') || '有我的班次 - 該日期有你的排班'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>      
    </div>
  );
};

export default Roster;