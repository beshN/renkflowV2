import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { NewOrderFormData } from '@/lib/types';
import { toast } from 'sonner';
import { useAuth } from '@/lib/context/AuthContext';
import { TEMPLATE_BY_KEY, DEFAULT_TEMPLATE_KEY, TemplateKey } from '@/lib/config/templates';
import { Input } from '../ui/Input';
import { formatCurrency } from '@/lib/utils';
import { currencyCodeToSymbol } from '@/lib/utils/currency';
import { 
  User, 
  Mail, 
  Phone, 
  Package, 
  Calendar, 
  Building2, 
  CreditCard, 
  UploadCloud, 
  FileText, 
  X, 
  CheckCircle, 
  Loader2,
  Info 
} from 'lucide-react';

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
  deliveryDate?: string;
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
    currency: 'TRY',
    deliveryDate: '',
    notes: '',
    customFields: {},
  });
  
  const [department, setDepartment] = useState<string>('');
  const [customFields, setCustomFields] = useState<Record<string, string>>(
    (initialData?.customFields as Record<string, string>) || {}
  );
  
  const [files, setFiles] = useState<{ id: string, file: File }[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const template = useMemo(() => {
    const key = (user?.templateKey as TemplateKey) || DEFAULT_TEMPLATE_KEY;
    return TEMPLATE_BY_KEY[key] || TEMPLATE_BY_KEY[DEFAULT_TEMPLATE_KEY];
  }, [user?.templateKey]);
  const todayISO = useMemo(() => new Date().toISOString().split('T')[0], []);

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

    if (formData.deliveryDate && formData.deliveryDate < todayISO) {
      newErrors.deliveryDate = 'Teslimat tarihi geçmiş olamaz';
    }

    let customFieldError = false;
    template.extraFields.forEach((field) => {
      if (field.required && !customFields[field.key]?.trim()) {
        customFieldError = true;
        toast.error(`${field.label} alani gereklidir.`);
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 && !customFieldError;
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
      if (formData.totalAmount != null) data.append('totalAmount', formData.totalAmount.toString());
      data.append('currency', formData.currency);
      data.append('deliveryDate', formData.deliveryDate || '');
      if (formData.notes) data.append('notes', formData.notes);
      if (department) data.append('department', department);
      if (Object.keys(customFields).length > 0) {
        data.append('customFields', JSON.stringify(customFields));
      }
      
      files.forEach(({ file }) => {
        data.append('files', file);
      });

      await onSubmit(data);
      toast.success('Sipariş başarıyla oluşturuldu!', { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sipariş oluşturulurken bir hata oluştu.';
      toast.error(message, { id: toastId });
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

  const handleCustomFieldChange = (key: string, value: string) => {
    setCustomFields((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer Information */}
      <div className="glass-panel p-6 rounded-2xl border border-white/20 dark:border-white/5 shadow-xl shadow-slate-200/20 dark:shadow-black/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
            <User size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Müşteri Bilgileri
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Siparişi veren müşteri veya firma detayları.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <Input
              label="Müşteri Adı *"
              name="customerName"
              value={formData.customerName}
              onChange={handleChange}
              placeholder="Örn: Ahmet Yılmaz"
              errorMessage={errors.customerName}
            />
          </div>
          <div>
            <Input
              label="E-posta"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="ahmet@example.com"
            />
          </div>
          <div>
            <Input
              label="Telefon"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+90 5XX XXX XX XX"
            />
          </div>
        </div>
        
        {template.extraFields.length > 0 && (
          <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Info size={16} className="text-slate-400" />
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Sektörel Alanlar
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {template.extraFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {field.label} {field.required ? '*' : ''}
                  </label>
                  {field.type === 'select' ? (
                    <div className="relative">
                      <select
                        value={customFields[field.key] || ''}
                        onChange={(e) => handleCustomFieldChange(field.key, e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      >
                        <option value="">Seçiniz</option>
                        {field.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    </div>
                  ) : (
                    <Input
                      type={field.type}
                      value={customFields[field.key] || ''}
                      onChange={(e) => handleCustomFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="glass-panel p-6 rounded-2xl border border-white/20 dark:border-white/5 shadow-xl shadow-slate-200/20 dark:shadow-black/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Package size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {template.title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ürün, miktar ve teslimat bilgileri.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <Input
              label={`${template.productLabel} *`}
              name="productName"
              value={formData.productName}
              onChange={handleChange}
              placeholder={template.productPlaceholder}
              errorMessage={errors.productName}
            />
          </div>
          <div>
            <Input
              label={`${template.quantityLabel} *`}
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              min={1}
            />
          </div>
          <div>
            <Input
              label={template.deliveryLabel}
              type="date"
              name="deliveryDate"
              value={formData.deliveryDate}
              onChange={handleChange}
              min={todayISO}
              errorMessage={errors.deliveryDate}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {template.departmentLabel}
            </label>
            <div className="relative">
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              >
                <option value="">Seçiniz</option>
                {template.departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
               <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </div>
          <div>
            <div className="relative">
               <Input
                label={`${template.totalLabel.replace('(TL)', `(${currencyCodeToSymbol(formData.currency)})`)} *`}
                type="number"
                name="totalAmount"
                value={formData.totalAmount}
                onChange={handleChange}
                min={0}
                step="0.01"
              />
            </div>
          </div>
        </div>

        {/* Document Attachment */}
        <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <UploadCloud size={16} className="text-slate-500" />
            Belgeler
          </h3>
          
          <div className="group border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-center cursor-pointer relative">
            <input 
              type="file" 
              multiple 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
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
            <div className="flex flex-col items-center gap-2 pointer-events-none">
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 group-hover:text-blue-500 transition-colors">
                 <UploadCloud size={24} />
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                <span className="text-blue-600 dark:text-blue-400">Dosya seçin</span> veya buraya bırakın
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {template.documentHint} · PNG, JPG, PDF (max. 10MB)
              </p>
            </div>
          </div>
            
          {/* File Preview List */}
          {files.length > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {files.map((fileItem) => (
                <div key={fileItem.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl group/file">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg text-slate-500">
                      <FileText size={20} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate pr-2">
                        {fileItem.file.name}
                      </span>
                      <span className="text-xs text-slate-500">
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
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {template.notesLabel}
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm resize-none"
              placeholder="Sipariş ile ilgili özel notlar..."
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="glass-panel p-6 rounded-2xl border border-white/20 dark:border-white/5 shadow-xl shadow-slate-200/20 dark:shadow-black/20">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Sipariş Özeti
        </h3>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 space-y-3">
          <div className="flex justify-between text-slate-600 dark:text-slate-400 text-sm">
            <span>Miktar</span>
            <span className="font-medium text-slate-900 dark:text-slate-200">{formData.quantity} adet</span>
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
            <span className="font-semibold text-slate-900 dark:text-white">Toplam Tutar</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white font-display">
              {formatCurrency(formData.totalAmount, formData.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-2">
        <Button 
          type="submit" 
          variant="primary" 
          size="lg" 
          className="flex-1 text-base h-12" 
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 animate-spin" size={20} />
              Kaydediliyor...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2" size={20} />
              Siparişi Kaydet
            </>
          )}
        </Button>
        <Button 
          type="button" 
          variant="secondary" 
          size="lg" 
          className="h-12 px-8"
          onClick={() => router.back()}
        >
          İptal
        </Button>
      </div>
    </form>
  );
}
