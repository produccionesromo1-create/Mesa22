import React, { useState, useEffect } from 'react';
import { notificationService, AppPushNotification } from '../utils/notificationService';
import { Bell, BellOff, X, Check, Volume2, Sparkles, ExternalLink } from 'lucide-react';

export default function PushNotificationBanner() {
  const [permission, setPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [inAppNotifications, setInAppNotifications] = useState<AppPushNotification[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    // Sync current browser permission
    setPermission(notificationService.getPermission());

    // Subscribe to incoming push notifications
    const unsubscribe = notificationService.subscribe((notification) => {
      setInAppNotifications((prev) => [notification, ...prev.slice(0, 4)]);

      // Auto dismiss each in-app toast after 7 seconds
      setTimeout(() => {
        setInAppNotifications((current) => current.filter((item) => item.id !== notification.id));
      }, 7000);
    });

    return () => unsubscribe();
  }, []);

  const handleRequestPermission = async () => {
    const res = await notificationService.requestPermission();
    setPermission(res);
  };

  const handleTestNotification = () => {
    notificationService.sendPushNotification({
      title: '🔔 ¡Prueba de Notificación Push Mesa 22!',
      body: 'Las notificaciones y el sonido del sistema están funcionando perfectamente en este dispositivo.',
      soundType: 'new_order',
      type: 'success'
    });
  };

  const dismissToast = (id: string) => {
    setInAppNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <>
      {/* 1. FLOATING TOP IN-APP PUSH TOASTS (OS-like Push Banners) */}
      <div 
        id="push_notifications_container"
        className="fixed top-4 right-4 sm:right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none px-2"
      >
        {inAppNotifications.map((notif) => (
          <div
            key={notif.id}
            className="pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700/80 flex items-start gap-3.5 transform transition-all duration-300 animate-slide-down hover:scale-[1.02]"
          >
            <div className="h-10 w-10 rounded-xl bg-orange-600 flex items-center justify-center shrink-0 shadow-inner mt-0.5 text-white">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <h4 className="font-extrabold text-white text-xs sm:text-sm tracking-tight truncate">
                  {notif.title}
                </h4>
                <span className="text-[10px] text-slate-400 shrink-0 font-medium">Ahora</span>
              </div>
              <p className="text-slate-200 text-xs leading-relaxed line-clamp-3 font-normal">
                {notif.body}
              </p>
            </div>

            <button
              onClick={() => dismissToast(notif.id)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer shrink-0 -mr-1 -mt-1"
              title="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* 2. PROMPT BANNER FOR ENABLING PUSH NOTIFICATIONS IF PERMISSION IS DEFAULT/NOT YET GRANTED */}
      {permission !== 'granted' && !bannerDismissed && permission !== 'unsupported' && (
        <div 
          id="push_permission_prompt_banner"
          className="bg-gradient-to-r from-slate-900 via-orange-950 to-slate-900 text-white text-xs px-4 py-3 shadow-lg border-b border-orange-500/20 relative z-30 shrink-0"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-orange-600/30 text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/30">
                <BellOff className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <p className="font-bold text-slate-100 text-xs sm:text-sm">
                  {permission === 'denied' 
                    ? '⚠️ Notificaciones bloqueadas en tu navegador'
                    : '🔔 ¡Activa las Notificaciones Push en Tiempo Real!'}
                </p>
                <p className="text-slate-300 text-[11px] font-normal">
                  {permission === 'denied'
                    ? 'Para recibir avisos de nuevos pedidos y estatus, habilita el permiso de notificaciones en el candado 🔒 de tu navegador.'
                    : 'Recibe alertas sonoras y emergentes instantáneas de tus comandas, pedidos y repartos sin perderte nada.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {permission === 'default' && (
                <button
                  onClick={handleRequestPermission}
                  className="bg-orange-600 hover:bg-orange-500 text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5" />
                  Activar Push
                </button>
              )}

              <button
                onClick={handleTestNotification}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer flex items-center gap-1 border border-slate-700"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Probar Sonido
              </button>

              <button
                onClick={() => setBannerDismissed(true)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer ml-1"
                title="Ocultar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
