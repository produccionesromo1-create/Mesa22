import React, { useState, useRef } from 'react';
import { Upload, Link as LinkIcon, Image as ImageIcon, Check, X, RefreshCw, UploadCloud, AlertCircle } from 'lucide-react';
import { compressImageFile } from '../utils/imageUtils';

interface ProductImageUploaderProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
}

const PRESET_IMAGES = [
  { name: 'Tacos', url: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&q=80&w=300' },
  { name: 'Pizza', url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=300' },
  { name: 'Burger', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=300' },
  { name: 'Sushi', url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=300' },
  { name: 'Ensalada', url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=300' },
  { name: 'Pasta', url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=300' },
  { name: 'Postre', url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&q=80&w=300' },
  { name: 'Bebida', url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=300' },
];

export default function ProductImageUploader({ value, onChange, label = 'Foto del Platillo' }: ProductImageUploaderProps) {
  const [activeTab, setActiveTab] = useState<'device' | 'url' | 'presets'>('device');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBase64 = value.startsWith('data:image/');

  const handleFileSelect = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor selecciona un archivo de imagen válido (JPG, PNG, WEBP).');
      return;
    }

    setErrorMessage('');
    setIsProcessing(true);

    try {
      const compressedDataUrl = await compressImageFile(file, 800, 800, 0.82, 15);
      onChange(compressedDataUrl);
    } catch (err: any) {
      console.error('Error al procesar la imagen:', err);
      setErrorMessage(err.message || 'No se pudo procesar la imagen seleccionada.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
          {label} *
        </label>
        {value && (
          <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
            <Check className="w-3 h-3" /> Foto Seleccionada
          </span>
        )}
      </div>

      {/* Tabs / Mode selection buttons */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 rounded-2xl border border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('device')}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'device'
              ? 'bg-white text-slate-800 shadow-xs font-black'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Upload className="w-3.5 h-3.5 text-indigo-600" />
          <span>Dispositivo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'url'
              ? 'bg-white text-slate-800 shadow-xs font-black'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5 text-sky-600" />
          <span>Enlace URL</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('presets')}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'presets'
              ? 'bg-white text-slate-800 shadow-xs font-black'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
          <span>Sugeridas</span>
        </button>
      </div>

      {/* ERROR MESSAGE IF ANY */}
      {errorMessage && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TAB 1: DEVICE UPLOAD */}
      {activeTab === 'device' && (
        <div className="space-y-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleInputChange}
            accept="image/*"
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/50'
                : 'border-gray-200 bg-gray-50/80 hover:bg-white hover:border-indigo-400'
            }`}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center gap-2 py-3">
                <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin" />
                <span className="text-xs font-extrabold text-indigo-700">Comprimiendo y optimizando foto...</span>
              </div>
            ) : (
              <>
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shadow-xs">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-800">
                    Haz clic para seleccionar o arrastra una imagen aquí
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                    Formatos compatibles: JPG, PNG, WEBP (Hasta 10 MB • Se optimiza automáticamente)
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LINK / URL INPUT */}
      {activeTab === 'url' && (
        <div className="space-y-2">
          <div className="relative">
            <input
              type="url"
              value={isBase64 ? '' : value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="ej: https://images.unsplash.com/photo-..."
              className="w-full bg-gray-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs pr-10 focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
            />
            <LinkIcon className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-400" />
          </div>
          <p className="text-[10px] text-gray-400 font-semibold px-1">
            Pega una URL directa de imagen que termine en .jpg, .png o de Unsplash / Imgur.
          </p>
        </div>
      )}

      {/* TAB 3: PRESETS */}
      {activeTab === 'presets' && (
        <div>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_IMAGES.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onChange(p.url)}
                className={`group relative h-12 rounded-xl overflow-hidden border transition cursor-pointer ${
                  value === p.url ? 'border-brand-primary ring-2 ring-brand-primary/30' : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <img
                  src={p.url}
                  alt={p.name}
                  className="w-full h-full object-cover transition duration-300 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-[9px] text-white font-black uppercase tracking-wider">{p.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CURRENT SELECTED PHOTO PREVIEW CARD */}
      {value && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-200 bg-white">
              <img
                src={value}
                alt="Vista previa"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLElement).setAttribute('src', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=300');
                }}
              />
            </div>
            <div className="truncate">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight block">
                {isBase64 ? '📷 Foto de Dispositivo' : '🔗 Enlace de Imagen'}
              </span>
              <p className="text-xs font-extrabold text-slate-800 truncate">
                {isBase64 ? 'Imagen local comprimida lista' : value}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onChange('')}
            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer shrink-0"
            title="Quitar foto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
