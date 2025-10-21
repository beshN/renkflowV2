export type OrderStatus = "pending" | "paint-send" | "in-progress" | "ready"

export type Department = "cam" | "pergola" | "makasli" | "aluminyum-tavan" | "servis"

export interface OrderFile {
  id: string
  name: string
  type: "pdf" | "image" | "excel"
  url: string
  uploadedAt: Date
}

export interface OrderComment {
  id: string
  text: string
  author: string
  createdAt: Date
}

export interface OrderActivity {
  id: string
  action: string
  user: string
  timestamp: Date
}

export interface OrderSpecification {
  label: string
  value: string
}

export interface Order {
  id: string
  orderId: string
  customerName: string
  customerPhone?: string
  projectName?: string
  productType: string
  quantity: string
  status: OrderStatus
  department: Department
  notes?: string
  statusNotes?: string
  statusDate?: Date
  paintSendDate?: Date
  paintReturnDate?: Date
  assemblyRequired?: boolean
  createdAt: Date
  updatedAt: Date
  deliveryDate?: Date
  orderDate?: Date
  photos?: string[]
  files?: OrderFile[]
  comments?: OrderComment[]
  activities?: OrderActivity[]
  specifications?: OrderSpecification[]
  priority?: "low" | "normal" | "high" | "urgent"
  assignedTo?: string
  estimatedCompletionDate?: Date
  actualCompletionDate?: Date
  materialCost?: number
  laborCost?: number
  totalCost?: number
  paymentStatus?: "unpaid" | "partial" | "paid"
  paymentMethod?: string
  shippingAddress?: string
  trackingNumber?: string
  manufacturingSteps?: string[]
}

export const mockOrders: Order[] = [
  {
    id: "1",
    orderId: "ORD-2024-001",
    customerName: "Ahmet Yılmaz",
    customerPhone: "+90 532 123 4567",
    projectName: "Yeni Ev Projesi",
    productType: "Metal Kapı",
    quantity: "5",
    status: "in-progress",
    department: "cam",
    notes: "Özel ölçü, beyaz renk",
    statusNotes: "Boyama işlemi bekleniyor",
    statusDate: new Date("2024-01-18"),
    paintSendDate: new Date("2024-01-20"),
    paintReturnDate: new Date("2024-01-25"),
    assemblyRequired: true,
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-20"),
    deliveryDate: new Date("2024-02-01"),
    orderDate: new Date("2024-01-15"),
    priority: "high",
    assignedTo: "Ali Demir",
    estimatedCompletionDate: new Date("2024-01-30"),
    materialCost: 15000,
    laborCost: 5000,
    totalCost: 20000,
    paymentStatus: "partial",
    paymentMethod: "Banka Transferi",
    shippingAddress: "İstanbul, Kadıköy",
    photos: ["/metal-door-manufacturing.jpg"],
    specifications: [
      { label: "Genişlik", value: "90 cm" },
      { label: "Yükseklik", value: "210 cm" },
      { label: "Kalınlık", value: "5 cm" },
      { label: "Renk", value: "Beyaz RAL 9016" },
      { label: "Malzeme", value: "Galvaniz Çelik" },
    ],
    files: [
      {
        id: "f1",
        name: "teknik-cizim.pdf",
        type: "pdf",
        url: "/pdf-document.png",
        uploadedAt: new Date("2024-01-15"),
      },
      {
        id: "f2",
        name: "olcu-listesi.xlsx",
        type: "excel",
        url: "/excel-spreadsheet.png",
        uploadedAt: new Date("2024-01-16"),
      },
    ],
    comments: [
      {
        id: "c1",
        text: "Müşteri beyaz renk istedi, RAL 9016 kodu ile boyama yapılacak",
        author: "Mehmet Çelik",
        createdAt: new Date("2024-01-15"),
      },
      {
        id: "c2",
        text: "Ölçüler onaylandı, üretime başlandı",
        author: "Ali Demir",
        createdAt: new Date("2024-01-18"),
      },
    ],
    activities: [
      { id: "a1", action: "Sipariş oluşturuldu", user: "Sistem", timestamp: new Date("2024-01-15") },
      { id: "a2", action: "Durum güncellendi: Devam Ediyor", user: "Ali Demir", timestamp: new Date("2024-01-18") },
      { id: "a3", action: "Dosya eklendi: teknik-cizim.pdf", user: "Mehmet Çelik", timestamp: new Date("2024-01-15") },
    ],
    manufacturingSteps: ["Malzeme Hazırlama", "Boyama İşlemi", "Montaj"],
  },
  {
    id: "2",
    orderId: "ORD-2024-002",
    customerName: "Mehmet Demir",
    customerPhone: "+90 533 234 5678",
    projectName: "İş Yeri Projesi",
    productType: "Pencere Çerçevesi",
    quantity: "10",
    status: "pending",
    department: "cam",
    notes: "Standart ölçü",
    statusNotes: "Beklemede",
    statusDate: new Date("2024-01-18"),
    assemblyRequired: false,
    createdAt: new Date("2024-01-18"),
    updatedAt: new Date("2024-01-18"),
    deliveryDate: new Date("2024-02-05"),
    orderDate: new Date("2024-01-18"),
    priority: "normal",
    assignedTo: "Mehmet Çelik",
    estimatedCompletionDate: new Date("2024-02-03"),
    materialCost: 8000,
    laborCost: 2000,
    totalCost: 10000,
    paymentStatus: "unpaid",
    shippingAddress: "Ankara, Çankaya",
    photos: [],
    specifications: [
      { label: "Genişlik", value: "120 cm" },
      { label: "Yükseklik", value: "150 cm" },
      { label: "Cam Tipi", value: "Çift Cam" },
      { label: "Renk", value: "Beyaz" },
    ],
    files: [],
    comments: [],
    activities: [{ id: "a1", action: "Sipariş oluşturuldu", user: "Sistem", timestamp: new Date("2024-01-18") }],
    manufacturingSteps: ["Malzeme Hazırlama", "Üretim"],
  },
  {
    id: "3",
    orderId: "ORD-2024-003",
    customerName: "Ayşe Kaya",
    customerPhone: "+90 534 345 6789",
    projectName: "Binaların Yenilenmesi",
    productType: "Balkon Korkuluğu",
    quantity: "3",
    status: "ready",
    department: "makasli",
    notes: "Siyah renk, paslanmaz çelik",
    statusNotes: "Montaj tamamlandı",
    statusDate: new Date("2024-01-17"),
    assemblyRequired: true,
    createdAt: new Date("2024-01-10"),
    updatedAt: new Date("2024-01-17"),
    deliveryDate: new Date("2024-01-20"),
    orderDate: new Date("2024-01-10"),
    priority: "urgent",
    assignedTo: "Fatma Yıldız",
    estimatedCompletionDate: new Date("2024-01-17"),
    actualCompletionDate: new Date("2024-01-17"),
    materialCost: 12000,
    laborCost: 4000,
    totalCost: 16000,
    paymentStatus: "paid",
    paymentMethod: "Nakit",
    shippingAddress: "İzmir, Bornova",
    trackingNumber: "TRK-2024-003",
    photos: ["/balcony-railing-black-steel.jpg", "/balcony-railing-installation.jpg"],
    specifications: [
      { label: "Uzunluk", value: "6 metre" },
      { label: "Yükseklik", value: "110 cm" },
      { label: "Malzeme", value: "Paslanmaz Çelik 304" },
      { label: "Renk", value: "Siyah Mat" },
    ],
    files: [
      {
        id: "f1",
        name: "montaj-plani.pdf",
        type: "pdf",
        url: "/pdf-document.png",
        uploadedAt: new Date("2024-01-10"),
      },
    ],
    comments: [
      {
        id: "c1",
        text: "Montaj tamamlandı, müşteri memnun",
        author: "Fatma Yıldız",
        createdAt: new Date("2024-01-17"),
      },
    ],
    activities: [
      { id: "a1", action: "Sipariş oluşturuldu", user: "Sistem", timestamp: new Date("2024-01-10") },
      { id: "a2", action: "Durum güncellendi: Devam Ediyor", user: "Ali Demir", timestamp: new Date("2024-01-12") },
      { id: "a3", action: "Durum güncellendi: Tamamlandı", user: "Fatma Yıldız", timestamp: new Date("2024-01-17") },
    ],
    manufacturingSteps: ["Malzeme Hazırlama", "Montaj"],
  },
  {
    id: "4",
    orderId: "ORD-2024-004",
    customerName: "Fatma Şahin",
    customerPhone: "+90 535 456 7890",
    projectName: "Konforlu Ev",
    productType: "Merdiven Korkuluğu",
    quantity: "2",
    status: "in-progress",
    department: "makasli",
    notes: "Ahşap detaylı",
    statusNotes: "Üretime devam",
    statusDate: new Date("2024-01-19"),
    assemblyRequired: true,
    createdAt: new Date("2024-01-12"),
    updatedAt: new Date("2024-01-19"),
    deliveryDate: new Date("2024-01-28"),
    orderDate: new Date("2024-01-12"),
    priority: "high",
    assignedTo: "Ali Demir",
    estimatedCompletionDate: new Date("2024-01-26"),
    materialCost: 9000,
    laborCost: 3500,
    totalCost: 12500,
    paymentStatus: "partial",
    paymentMethod: "Kredi Kartı",
    shippingAddress: "Bursa, Nilüfer",
    photos: ["/wooden-stair-railing.jpg"],
    specifications: [
      { label: "Uzunluk", value: "8 metre" },
      { label: "Yükseklik", value: "95 cm" },
      { label: "Malzeme", value: "Metal + Ahşap" },
      { label: "Ahşap Tipi", value: "Meşe" },
    ],
    files: [],
    comments: [],
    activities: [
      { id: "a1", action: "Sipariş oluşturuldu", user: "Sistem", timestamp: new Date("2024-01-12") },
      { id: "a2", action: "Durum güncellendi: Devam Ediyor", user: "Ali Demir", timestamp: new Date("2024-01-15") },
    ],
    manufacturingSteps: ["Malzeme Hazırlama", "Üretim"],
  },
  {
    id: "5",
    orderId: "ORD-2024-005",
    customerName: "Ali Öztürk",
    customerPhone: "+90 536 567 8901",
    projectName: "Güvenli Ev",
    productType: "Garaj Kapısı",
    quantity: "1",
    status: "ready",
    department: "cam",
    notes: "Otomatik açılır kapanır sistem",
    statusNotes: "Teslim edildi",
    statusDate: new Date("2024-01-15"),
    paintSendDate: new Date("2024-01-16"),
    paintReturnDate: new Date("2024-01-21"),
    assemblyRequired: true,
    createdAt: new Date("2024-01-05"),
    updatedAt: new Date("2024-01-15"),
    deliveryDate: new Date("2024-01-15"),
    orderDate: new Date("2024-01-05"),
    priority: "normal",
    assignedTo: "Mehmet Çelik",
    estimatedCompletionDate: new Date("2024-01-14"),
    actualCompletionDate: new Date("2024-01-14"),
    materialCost: 18000,
    laborCost: 7000,
    totalCost: 25000,
    paymentStatus: "paid",
    paymentMethod: "Banka Transferi",
    shippingAddress: "Antalya, Muratpaşa",
    trackingNumber: "TRK-2024-005",
    photos: ["/automatic-garage-door.jpg"],
    specifications: [
      { label: "Genişlik", value: "300 cm" },
      { label: "Yükseklik", value: "220 cm" },
      { label: "Sistem", value: "Otomatik Motor" },
      { label: "Renk", value: "Antrasit Gri" },
    ],
    files: [
      {
        id: "f1",
        name: "motor-kullanim-kilavuzu.pdf",
        type: "pdf",
        url: "/pdf-manual.jpg",
        uploadedAt: new Date("2024-01-15"),
      },
    ],
    comments: [
      {
        id: "c1",
        text: "Teslim edildi ve motor kurulumu yapıldı",
        author: "Mehmet Çelik",
        createdAt: new Date("2024-01-15"),
      },
    ],
    activities: [
      { id: "a1", action: "Sipariş oluşturuldu", user: "Sistem", timestamp: new Date("2024-01-05") },
      { id: "a2", action: "Durum güncellendi: Devam Ediyor", user: "Ali Demir", timestamp: new Date("2024-01-08") },
      { id: "a3", action: "Durum güncellendi: Tamamlandı", user: "Ali Demir", timestamp: new Date("2024-01-14") },
      { id: "a4", action: "Durum güncellendi: Teslim Edildi", user: "Mehmet Çelik", timestamp: new Date("2024-01-15") },
    ],
    manufacturingSteps: ["Malzeme Hazırlama", "Boyama İşlemi", "Montaj", "Teslim"],
  },
  {
    id: "6",
    orderId: "ORD-2024-006",
    customerName: "Zeynep Arslan",
    customerPhone: "+90 537 678 9012",
    projectName: "Harika Bahçe",
    productType: "Bahçe Kapısı",
    quantity: "2",
    status: "pending",
    department: "pergola",
    notes: "Dekoratif desenli",
    statusNotes: "Beklemede",
    statusDate: new Date("2024-01-20"),
    assemblyRequired: false,
    createdAt: new Date("2024-01-20"),
    updatedAt: new Date("2024-01-20"),
    deliveryDate: new Date("2024-02-10"),
    orderDate: new Date("2024-01-20"),
    priority: "low",
    assignedTo: "Fatma Yıldız",
    estimatedCompletionDate: new Date("2024-02-08"),
    materialCost: 6000,
    laborCost: 2000,
    totalCost: 8000,
    paymentStatus: "unpaid",
    shippingAddress: "Adana, Seyhan",
    photos: [],
    specifications: [
      { label: "Genişlik", value: "100 cm" },
      { label: "Yükseklik", value: "180 cm" },
      { label: "Desen", value: "Klasik Süsleme" },
      { label: "Renk", value: "Siyah" },
    ],
    files: [],
    comments: [],
    activities: [{ id: "a1", action: "Sipariş oluşturuldu", user: "Sistem", timestamp: new Date("2024-01-20") }],
    manufacturingSteps: ["Malzeme Hazırlama"],
  },
]
