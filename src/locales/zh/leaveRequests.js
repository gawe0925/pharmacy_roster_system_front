export default {
  // 頁面標題
  leaveRequestsTitle: '請假管理',

  // 請假類型
  leaveTypeAnnual: '年假',
  leaveTypeSick: '病假',
  leaveTypeMaternity: '產假',
  leaveTypePersonal: '事假',
  leaveTypeUnpaid: '無薪假',
  leaveTypeNoShow: '缺勤',
  leaveTypeNotSpecified: '未指定',

  // 多天請假相關
  multiDayLeave: '多天請假',
  multiDayLeaveDesc: '系統將自動計算工作日天數（跳過週末）',
  
  // 時間選項
  fullDayOption: '整天 (8小時)',
  specificTimeOption: '指定時間',
  selectTime: '選擇時間',
  
  // 其他補充
  wholeDayLeave: '整天',
  specifyTime: '指定時間',
  workingDaysOnly: '僅計算工作日（跳過週末）',
  
  // 日期選擇提示
  selectStartTime: '選擇開始時間',
  selectEndTime: '選擇結束時間',

  // 狀態
  statusPending: '待審核',
  statusApproved: '已批准',
  statusRejected: '已拒絕',
  statusCanceled: '已取消',

  // 篩選器
  filterAll: '全部',

  // 標籤
  labelEmployee: '員工',
  labelLeaveType: '請假類型',
  labelPeriod: '請假期間',
  labelHours: '請假時數',
  labelReason: '請假原因',
  labelAppliedOn: '申請時間',
  labelReviewedBy: '審核者',
  labelStartDate: '開始日期',
  labelEndDate: '結束日期',
  labelStartDateTime: '開始時間',
  labelEndDateTime: '結束時間',
  labelTimeOption: '時間選項',
  labelStartTime: '開始時間',
  labelEndTime: '結束時間',
  labelCalculatedHours: '計算時數',
  labelOptional: '選填',

  // 操作按鈕
  actionReview: '審核',
  actionApprove: '批准',
  actionReject: '拒絕',
  actionCancel: '取消',
  actionCreateLeave: '新增請假',
  actionSubmit: '提交',
  backToDashboard: '返回主頁',

  // 模態框
  modalReviewRequest: '審核請假申請',
  modalCreateLeave: '新增請假申請',

  // 訊息
  messageLoading: '載入中...',
  messageNoRequests: '沒有找到請假申請',
  messageNoRequestsDesc: '目前沒有符合篩選條件的請假申請',
  messageUpdateFailed: '更新失敗',
  messageUnknownEmployee: '未知員工',
  messageNotSpecified: '未指定',
  messageHours: '小時',
  messagePleaseSelect: '請選擇',
  messagePlaceholderReason: '請輸入請假原因...',
  messageAllFieldsRequired: '請填寫所有必填欄位',
  messageInvalidDateRange: '結束時間必須晚於開始時間',
  messageCreateSuccess: '請假申請已提交',
  messageCreateFailed: '建立失敗',

  // 權限相關
  accessDenied: '無法訪問',
  noLeavePermission: '無請假權限',
  leavePermissionMessage: '只有正職員工和兼職員工可以使用請假功能',

  // 審核相關
  pendingReview: '等待主管審核',


  actionCancelRequest: '取消申請',
  confirmCancelRequest: '確定要取消這個請假申請嗎？',
  messageCancelSuccess: '請假申請已取消',
  messageCancelFailed: '取消失敗',
  cannotReviewOwnRequest: '您無法審核自己的申請',

  // 其他常用詞彙
  applicant: '申請人',
  reviewDate: '審核日期',

  availableHours: '可用時數',
  allApplications: '全部申請',
  pendingApplications: '待審核',
  approvedApplications: '已批准',
  rejectedApplications: '已拒絕',
  currentlyAvailable: '目前可用',
  thisApplication: '本次申請',
  remainingAfterApplication: '申請後剩餘',
  insufficientBalance: '餘額不足，無法提交申請',
  requestedHours: '申請時數',
  
  // 取消相關
  actionCancelRequest: '取消申請',
  confirmCancelRequest: '確定要取消這個請假申請嗎？',
  messageCancelSuccess: '請假申請已取消',
  messageCancelFailed: '取消失敗',
  
  // 其他
  unknownUser: '未知用戶',
  selectTime: '選擇時間',
  fullDayOption: '整天 (8小時)',
  specificTimeOption: '指定時間',
  multiDayLeave: '多天請假',
  multiDayLeaveDesc: '系統將自動計算工作日天數（跳過週末）',
  
  // 警告訊息
  cannotSelectPastDate: '不能選擇過去的日期',
  pleaseSelectStartEndTime: '請選擇開始時間和結束時間',
  weekendNotAllowed: '正職員工假日不用上班，請假日期不能包含週末',
  startDateCannotBeEarlier: '開始日期不能早於今天',
  leaveHoursMustBeGreaterThanZero: '請假時數必須大於0',

  labelStatus: '申請狀態',
  statusPending: '待審核',
  statusApproved: '已批准',
  statusRejected: '已拒絕',
  statusCanceled: '已取消',
  pendingApplications: '待審核申請',
  approvedApplications: '已批准申請',
  rejectedApplications: '已拒絕申請',
  canceledApplications: '已取消申請',
};