import type { WorkOrderPriority, WorkOrderStatus } from './client';

type SupportedLocale = 'tr' | 'en' | 'ar';

export type WorkOrdersCopy = {
  pageTitle: string;
  subtitle: string;
  createButton: string;
  refreshButton: string;
  searchPlaceholder: string;
  allStatuses: string;
  allPriorities: string;
  includeClosed: string;
  onlyOpen: string;
  previousPage: string;
  nextPage: string;
  emptyTitle: string;
  emptyDescription: string;
  loadError: string;
  summary: {
    total: string;
    open: string;
    inProgress: string;
    blocked: string;
    overdue: string;
    dueToday: string;
    completionRate7d: string;
    avgResolutionHours: string;
  };
  table: {
    title: string;
    id: string;
    status: string;
    priority: string;
    dueAt: string;
    assignee: string;
    checklist: string;
    comments: string;
    actions: string;
    details: string;
    noAssignee: string;
    noDueDate: string;
  };
  detail: {
    back: string;
    metadata: string;
    description: string;
    checklist: string;
    comments: string;
    commentPlaceholder: string;
    addComment: string;
    updateStatus: string;
    assignTo: string;
    unassigned: string;
    saveChanges: string;
    noComments: string;
    notFound: string;
  };
  form: {
    title: string;
    description: string;
    category: string;
    priority: string;
    dueAt: string;
    location: string;
    assetTag: string;
    estimatedMinutes: string;
    actualMinutes: string;
    assignedTo: string;
    checklist: string;
    checklistHint: string;
    cancel: string;
    submit: string;
    titleRequired: string;
  };
  statusLabels: Record<WorkOrderStatus, string>;
  priorityLabels: Record<WorkOrderPriority, string>;
  toast: {
    created: string;
    updated: string;
    checklistUpdated: string;
    commentAdded: string;
    genericError: string;
  };
};

const copy: Record<SupportedLocale, WorkOrdersCopy> = {
  tr: {
    pageTitle: 'İş Emirleri',
    subtitle: 'Üretim, bakım ve ofis operasyonlarını tek akıştan yönetin.',
    createButton: 'Yeni İş Emri',
    refreshButton: 'Yenile',
    searchPlaceholder: 'Başlık, açıklama veya varlık etiketi ara...',
    allStatuses: 'Tüm Durumlar',
    allPriorities: 'Tüm Öncelikler',
    includeClosed: 'Kapalı kayıtları dahil et',
    onlyOpen: 'Açık işleri göster',
    previousPage: 'Önceki',
    nextPage: 'Sonraki',
    emptyTitle: 'Kayıt bulunamadı',
    emptyDescription: 'Filtreleri temizleyip tekrar deneyin veya yeni iş emri oluşturun.',
    loadError: 'Veriler yüklenirken bir hata oluştu.',
    summary: {
      total: 'Toplam İş Emri',
      open: 'Açık',
      inProgress: 'Devam Eden',
      blocked: 'Bloklanan',
      overdue: 'Geciken',
      dueToday: 'Bugün Biten',
      completionRate7d: '7 Gün Tamamlama',
      avgResolutionHours: '30 Gün Ort. Çözüm (saat)',
    },
    table: {
      title: 'Başlık',
      id: 'ID',
      status: 'Durum',
      priority: 'Öncelik',
      dueAt: 'Termin',
      assignee: 'Atanan',
      checklist: 'Kontrol',
      comments: 'Yorum',
      actions: 'Aksiyon',
      details: 'Detay',
      noAssignee: 'Atanmadı',
      noDueDate: 'Termin yok',
    },
    detail: {
      back: 'İş Emirlerine Dön',
      metadata: 'İş Emri Bilgileri',
      description: 'Açıklama',
      checklist: 'Kontrol Listesi',
      comments: 'Yorumlar',
      commentPlaceholder: 'Operasyon notu ekleyin...',
      addComment: 'Yorum Ekle',
      updateStatus: 'Durum',
      assignTo: 'Atanan Kullanıcı',
      unassigned: 'Atanmamış',
      saveChanges: 'Değişiklikleri Kaydet',
      noComments: 'Henüz yorum yok.',
      notFound: 'İş emri bulunamadı.',
    },
    form: {
      title: 'Başlık',
      description: 'Açıklama',
      category: 'Kategori',
      priority: 'Öncelik',
      dueAt: 'Termin Tarihi',
      location: 'Lokasyon',
      assetTag: 'Varlık Etiketi',
      estimatedMinutes: 'Tahmini Süre (dk)',
      actualMinutes: 'Gerçekleşen Süre (dk)',
      assignedTo: 'Atanan',
      checklist: 'Kontrol Listesi',
      checklistHint: 'Her satıra bir madde yazın.',
      cancel: 'İptal',
      submit: 'Oluştur',
      titleRequired: 'Başlık zorunludur.',
    },
    statusLabels: {
      open: 'Açık',
      in_progress: 'Devam Ediyor',
      blocked: 'Bloklu',
      done: 'Tamamlandı',
      cancelled: 'İptal',
    },
    priorityLabels: {
      low: 'Düşük',
      medium: 'Orta',
      high: 'Yüksek',
      critical: 'Kritik',
    },
    toast: {
      created: 'İş emri oluşturuldu.',
      updated: 'İş emri güncellendi.',
      checklistUpdated: 'Kontrol maddesi güncellendi.',
      commentAdded: 'Yorum eklendi.',
      genericError: 'İşlem sırasında hata oluştu.',
    },
  },
  en: {
    pageTitle: 'Work Orders',
    subtitle: 'Run production, maintenance, and office operations in one flow.',
    createButton: 'New Work Order',
    refreshButton: 'Refresh',
    searchPlaceholder: 'Search by title, description, or asset tag...',
    allStatuses: 'All Statuses',
    allPriorities: 'All Priorities',
    includeClosed: 'Include closed records',
    onlyOpen: 'Show open only',
    previousPage: 'Previous',
    nextPage: 'Next',
    emptyTitle: 'No records found',
    emptyDescription: 'Clear filters and try again, or create a new work order.',
    loadError: 'An error occurred while loading data.',
    summary: {
      total: 'Total Work Orders',
      open: 'Open',
      inProgress: 'In Progress',
      blocked: 'Blocked',
      overdue: 'Overdue',
      dueToday: 'Due Today',
      completionRate7d: '7d Completion',
      avgResolutionHours: '30d Avg Resolve (h)',
    },
    table: {
      title: 'Title',
      id: 'ID',
      status: 'Status',
      priority: 'Priority',
      dueAt: 'Due',
      assignee: 'Assignee',
      checklist: 'Checklist',
      comments: 'Comments',
      actions: 'Actions',
      details: 'Details',
      noAssignee: 'Unassigned',
      noDueDate: 'No due date',
    },
    detail: {
      back: 'Back to Work Orders',
      metadata: 'Work Order Details',
      description: 'Description',
      checklist: 'Checklist',
      comments: 'Comments',
      commentPlaceholder: 'Add an operational note...',
      addComment: 'Add Comment',
      updateStatus: 'Status',
      assignTo: 'Assigned User',
      unassigned: 'Unassigned',
      saveChanges: 'Save Changes',
      noComments: 'No comments yet.',
      notFound: 'Work order not found.',
    },
    form: {
      title: 'Title',
      description: 'Description',
      category: 'Category',
      priority: 'Priority',
      dueAt: 'Due Date',
      location: 'Location',
      assetTag: 'Asset Tag',
      estimatedMinutes: 'Estimated Time (min)',
      actualMinutes: 'Actual Time (min)',
      assignedTo: 'Assignee',
      checklist: 'Checklist',
      checklistHint: 'Use one item per line.',
      cancel: 'Cancel',
      submit: 'Create',
      titleRequired: 'Title is required.',
    },
    statusLabels: {
      open: 'Open',
      in_progress: 'In Progress',
      blocked: 'Blocked',
      done: 'Done',
      cancelled: 'Cancelled',
    },
    priorityLabels: {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      critical: 'Critical',
    },
    toast: {
      created: 'Work order created.',
      updated: 'Work order updated.',
      checklistUpdated: 'Checklist item updated.',
      commentAdded: 'Comment added.',
      genericError: 'An error occurred while processing.',
    },
  },
  ar: {
    pageTitle: 'أوامر العمل',
    subtitle: 'إدارة الإنتاج والصيانة وعمليات المكتب ضمن تدفق واحد.',
    createButton: 'أمر عمل جديد',
    refreshButton: 'تحديث',
    searchPlaceholder: 'ابحث بالعنوان أو الوصف أو رمز الأصل...',
    allStatuses: 'كل الحالات',
    allPriorities: 'كل الأولويات',
    includeClosed: 'تضمين السجلات المغلقة',
    onlyOpen: 'عرض المفتوح فقط',
    previousPage: 'السابق',
    nextPage: 'التالي',
    emptyTitle: 'لا توجد نتائج',
    emptyDescription: 'امسح الفلاتر أو أنشئ أمر عمل جديد.',
    loadError: 'حدث خطأ أثناء تحميل البيانات.',
    summary: {
      total: 'إجمالي أوامر العمل',
      open: 'مفتوح',
      inProgress: 'قيد التنفيذ',
      blocked: 'متعطل',
      overdue: 'متأخر',
      dueToday: 'يستحق اليوم',
      completionRate7d: 'إنجاز 7 أيام',
      avgResolutionHours: 'متوسط الحل 30 يوم (س)',
    },
    table: {
      title: 'العنوان',
      id: 'المعرف',
      status: 'الحالة',
      priority: 'الأولوية',
      dueAt: 'الموعد',
      assignee: 'المكلّف',
      checklist: 'قائمة التحقق',
      comments: 'التعليقات',
      actions: 'الإجراءات',
      details: 'التفاصيل',
      noAssignee: 'غير مكلّف',
      noDueDate: 'بدون موعد',
    },
    detail: {
      back: 'الرجوع لأوامر العمل',
      metadata: 'تفاصيل أمر العمل',
      description: 'الوصف',
      checklist: 'قائمة التحقق',
      comments: 'التعليقات',
      commentPlaceholder: 'أضف ملاحظة تشغيلية...',
      addComment: 'إضافة تعليق',
      updateStatus: 'الحالة',
      assignTo: 'المستخدم المكلّف',
      unassigned: 'غير مكلّف',
      saveChanges: 'حفظ التغييرات',
      noComments: 'لا توجد تعليقات بعد.',
      notFound: 'لم يتم العثور على أمر العمل.',
    },
    form: {
      title: 'العنوان',
      description: 'الوصف',
      category: 'الفئة',
      priority: 'الأولوية',
      dueAt: 'تاريخ الاستحقاق',
      location: 'الموقع',
      assetTag: 'رمز الأصل',
      estimatedMinutes: 'الوقت المتوقع (دقيقة)',
      actualMinutes: 'الوقت الفعلي (دقيقة)',
      assignedTo: 'المكلّف',
      checklist: 'قائمة التحقق',
      checklistHint: 'اكتب بندًا في كل سطر.',
      cancel: 'إلغاء',
      submit: 'إنشاء',
      titleRequired: 'العنوان مطلوب.',
    },
    statusLabels: {
      open: 'مفتوح',
      in_progress: 'قيد التنفيذ',
      blocked: 'متعطل',
      done: 'مكتمل',
      cancelled: 'ملغي',
    },
    priorityLabels: {
      low: 'منخفض',
      medium: 'متوسط',
      high: 'مرتفع',
      critical: 'حرج',
    },
    toast: {
      created: 'تم إنشاء أمر العمل.',
      updated: 'تم تحديث أمر العمل.',
      checklistUpdated: 'تم تحديث بند قائمة التحقق.',
      commentAdded: 'تمت إضافة التعليق.',
      genericError: 'حدث خطأ أثناء التنفيذ.',
    },
  },
};

function normalizeLocale(locale?: string): SupportedLocale {
  if (!locale) return 'tr';
  const normalized = locale.toLowerCase();
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('ar')) return 'ar';
  return 'tr';
}

export function getWorkOrdersCopy(locale?: string): WorkOrdersCopy {
  return copy[normalizeLocale(locale)];
}
