import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { NewOrderFormData } from '@/lib/types';
import { toast } from 'sonner';
import Image from 'next/image';
import { useAuth } from '@/lib/context/AuthContext';
import { TEMPLATE_BY_KEY, DEFAULT_TEMPLATE_KEY, TemplateKey } from '@/lib/config/templates';

interface NewOrderFormProps {
  onSubmit: (data: FormData) => Promise<void>;
  initialData?: NewOrderFormData;
}

interface FormErrors {
  customerName?: string;
  email?: string;
  phone?: string;
  productName?: string;
  quantity?: string;
  totalAmount?: string;
}

export function NewOrderForm({ onSubmit, initialData }: NewOrderFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [formData, setFormData] = useState<NewOrderFormData>(initialData || {
    customerName: '',
    email: '',
    phone: '',
    productName: '',
    quantity: 1,
    totalAmount: 0,
    currency: '₺',
    deliveryDate: '',
    notes: '',
  });
  
  const [department, setDepartment] = useState<string>('');
  
  const [files, setFiles] = useState<{ id: string, file: File }[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const template = useMemo(() => {
    const key = (user?.templateKey as TemplateKey) || DEFAULT_TEMPLATE_KEY;
    return TEMPLATE_BY_KEY[key] || TEMPLATE_BY_KEY[DEFAULT_TEMPLATE_KEY];
  }, [user?.templateKey]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Required fields
    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Müşteri adı gereklidir';
    }

    if (!formData.productName.trim()) {
      newErrors.productName = 'Ürün adı gereklidir';
    }

    if (formData.quantity < 1) {
      newErrors.quantity = 'Miktar en az 1 olmalıdır';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Lütfen zorunlu alanları doldurunuz.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Sipariş oluşturuluyor...');

    try {
      const data = new FormData();
      data.append('customerName', formData.customerName);
      if (formData.email) data.append('email', formData.email);
      if (formData.phone) data.append('phone', formData.phone);
      data.append('productName', formData.productName);
      data.append('quantity', formData.quantity.toString());
      if (formData.totalAmount) data.append('totalAmount', formData.totalAmount.toString());
      data.append('currency', formData.currency);
      data.append('deliveryDate', formData.deliveryDate || '');
      if (formData.notes) data.append('notes', formData.notes);
      if (department) data.append('department', department);
      
      files.forEach(({ file }) => {
        data.append('files', file);
      });

      await onSubmit(data);
      toast.success('Sipariş başarıyla oluşturuldu!', { id: toastId });
    } catch (error) {
      toast.error('Sipariş oluşturulurken bir hata oluştu.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'quantity' || name === 'totalAmount' ? parseFloat(value) || 0 : value,
    }));
    
    // Clear error when user types
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer Information */}
      <Card>
        <CardHeader>
          <CardTitle>Müşteri Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                Müşteri Adı *
              </label>
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                required
                className={`w-full rounded-lg border ${
                  errors.customerName 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-border-light dark:border-border-dark focus:ring-primary/50'
                } bg-background-light dark:bg-background-dark px-4 py-2 text-text-light dark:text-text-dark focus:outline-none focus:ring-2 transition-all`}
                placeholder="Örn: Ahmet Yılmaz"
              />
              {errors.customerName && (
                <p className="mt-1 text-sm text-red-500">{errors.customerName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                E-posta
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 py-2 text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="ahmet@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                Telefon
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 py-2 text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="+90 5XX XXX XX XX"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Details */}
      <Card>
        <CardHeader>
          <CardTitle>{template.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                {template.productLabel} *
              </label>
              <input
                type="text"
                name="productName"
                value={formData.productName}
                onChange={handleChange}
                required
                className={`w-full rounded-lg border ${
                  errors.productName 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-border-light dark:border-border-dark focus:ring-primary/50'
                } bg-background-light dark:bg-background-dark px-4 py-2 text-text-light dark:text-text-dark focus:outline-none focus:ring-2 transition-all`}
                placeholder={template.productPlaceholder}
              />
              {errors.productName && (
                <p className="mt-1 text-sm text-red-500">{errors.productName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                {template.quantityLabel} *
              </label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                min="1"
                required
                className="w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 py-2 text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                {template.deliveryLabel}
              </label>
              <input
                type="date"
                name="deliveryDate"
                value={formData.deliveryDate}
                onChange={handleChange}
                className="w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 py-2 text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                {template.departmentLabel}
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 py-2 text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              >
                <option value="">Seçiniz</option>
                {template.departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                {template.totalLabel.replace('(TL)', `(${formData.currency})`)} *
              </label>
              <input
                type="number"
                name="totalAmount"
                value={formData.totalAmount}
                onChange={handleChange}
                min="0"
                step="0.01"
                required
                className="w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 py-2 text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>
          </div>
          {/* Document Attachment */}
          <div className="md:col-span-2 border-t border-border-light dark:border-border-dark pt-6 mt-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Belge Ekleme
            </h3>
            {/* Document Upload */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                Belgeler (Teknik Çizim, Sözleşme vb.)
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-border-light dark:border-border-dark border-dashed rounded-lg hover:bg-card-light dark:hover:bg-card-dark transition-colors relative group">
                <div className="space-y-1 text-center">
                  <span className="material-symbols-outlined text-4xl text-subtle-light dark:text-subtle-dark group-hover:text-primary transition-colors">
                    cloud_upload
                  </span>
                  <div className="flex text-sm text-subtle-light dark:text-subtle-dark">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer rounded-md font-medium text-primary hover:text-primary/80 focus-within:outline-none"
                    >
                      <span>Dosya Yükle</span>
                      <input 
                        id="file-upload" 
                        name="file-upload" 
                        type="file" 
                        className="sr-only" 
                        multiple
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const selectedFiles = e.target.files;
                          if (selectedFiles && selectedFiles.length > 0) {
                            const newFiles = Array.from(selectedFiles).map(file => ({
                              id: Math.random().toString(36).substr(2, 9),
                              file
                            }));
                            setFiles(prev => [...prev, ...newFiles]);
                            toast.success(`${newFiles.length} dosya eklendi`);
                          }
                        }}
                      />
                    </label>
                    <p className="pl-1">veya sürükleyip bırakın</p>
                  </div>
                  <p className="text-xs text-subtle-light dark:text-subtle-dark">
                    {template.documentHint} · PNG, JPG, PDF (max. 10MB)
                  </p>
                </div>
              </div>
              
              {/* File Preview List */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((fileItem) => (
                    <div key={fileItem.id} className="flex items-center justify-between p-3 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg animate-in-fade">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary">description</span>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-text-light dark:text-text-dark">
                            {fileItem.file.name}
                          </span>
                          <span className="text-xs text-subtle-light dark:text-subtle-dark">
                            {(fileItem.file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFiles(prev => prev.filter(f => f.id !== fileItem.id));
                          toast.info('Dosya kaldırıldı');
                        }}
                        className="text-subtle-light dark:text-subtle-dark hover:text-red-500 transition-colors"
                      >
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-2 mt-4">
              <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                {template.notesLabel}
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 py-2 text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="Sipariş ile ilgili özel notlar..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Sipariş Özeti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-text-light dark:text-text-dark">
              <span>Miktar:</span>
              <span className="font-medium">{formData.quantity} adet</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-text-light dark:text-text-dark pt-2 border-t border-border-light dark:border-border-dark">
              <span>Toplam:</span>
              <span>{formData.totalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button type="submit" variant="primary" size="lg" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="material-symbols-outlined mr-2 animate-spin">progress_activity</span>
              Kaydediliyor...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined mr-2">check_circle</span>
              Siparişi Kaydet
            </>
          )}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
          İptal
        </Button>
      </div>
    </form>
  );
}
