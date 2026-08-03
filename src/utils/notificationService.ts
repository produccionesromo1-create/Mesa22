/**
 * Mesa 22 - Unified Push Notification & Audio Chime Service
 */

export interface AppPushNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  timestamp: number;
  type?: 'info' | 'success' | 'alert' | 'order';
}

type NotificationListener = (notification: AppPushNotification) => void;

class NotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private audioCtx: AudioContext | null = null;
  private listeners: Set<NotificationListener> = new Set();

  constructor() {
    this.initServiceWorker();
    this.setupAudioUnlock();
  }

  /**
   * Register Service Worker for push notifications & background support
   */
  private async initServiceWorker() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        this.swRegistration = registration;
        console.log('Mesa 22 Service Worker registrado con éxito:', registration.scope);
      } catch (err) {
        console.warn('No se pudo registrar Service Worker (posible contexto iFrame/sandbox):', err);
      }
    }
  }

  /**
   * Unlock AudioContext on first user interaction to bypass browser autoplay restrictions
   */
  private setupAudioUnlock() {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    };

    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  /**
   * Get current browser notification permission
   */
  public getPermission(): 'granted' | 'denied' | 'default' | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  /**
   * Request native browser push notification permission
   */
  public async requestPermission(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Tu navegador o dispositivo no soporta notificaciones de escritorio.');
      return 'unsupported';
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.playNotificationSound('alert');
        this.sendPushNotification({
          title: '🔔 ¡Notificaciones Push Activadas!',
          body: 'Recibirás alertas en tiempo real de nuevos pedidos, cambios de estado y avisos del sistema.',
          soundType: 'alert'
        });
      }
      return permission;
    } catch (err) {
      console.error('Error al solicitar permiso de notificaciones:', err);
      return this.getPermission();
    }
  }

  /**
   * Play clean synthesized chime sound using Web Audio API
   */
  public playNotificationSound(type: 'new_order' | 'status_update' | 'alert' | 'waiter' = 'new_order') {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }

      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      if (type === 'new_order' || type === 'alert') {
        // High-attention dual chime (G5 -> C6)
        const osc1 = this.audioCtx.createOscillator();
        const gain1 = this.audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(783.99, now); // G5
        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain1);
        gain1.connect(this.audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        const osc2 = this.audioCtx.createOscillator();
        const gain2 = this.audioCtx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1046.50, now + 0.15); // C6
        gain2.gain.setValueAtTime(0.25, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc2.connect(gain2);
        gain2.connect(this.audioCtx.destination);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.6);

      } else if (type === 'waiter') {
        // Soft triple chime for table service
        [523.25, 659.25, 783.99].forEach((freq, idx) => { // C5, E5, G5
          const startTime = now + idx * 0.12;
          const osc = this.audioCtx!.createOscillator();
          const gain = this.audioCtx!.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0.18, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
          osc.connect(gain);
          gain.connect(this.audioCtx!.destination);
          osc.start(startTime);
          osc.stop(startTime + 0.3);
        });

      } else {
        // Simple status update ping (E5 -> A5)
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.2);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      console.warn('AudioContext playback prevented by browser:', e);
    }
  }

  /**
   * Send a Push Notification (both System Native Push & In-App Visual Banner)
   */
  public sendPushNotification(payload: {
    title: string;
    body: string;
    icon?: string;
    tag?: string;
    soundType?: 'new_order' | 'status_update' | 'alert' | 'waiter';
    type?: 'info' | 'success' | 'alert' | 'order';
  }) {
    // 1. Play sound chime
    if (payload.soundType) {
      this.playNotificationSound(payload.soundType);
    } else {
      this.playNotificationSound('status_update');
    }

    // 2. Dispatch in-app push notification toast to state listeners
    const notificationItem: AppPushNotification = {
      id: Math.random().toString(36).substring(2, 9),
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/favicon.ico',
      tag: payload.tag,
      timestamp: Date.now(),
      type: payload.type || 'order'
    };

    this.listeners.forEach((listener) => {
      try {
        listener(notificationItem);
      } catch (err) {
        console.error('Error notifying in-app listener:', err);
      }
    });

    // 3. Try OS Native Push Notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const title = payload.title;
        const options = {
          body: payload.body,
          icon: payload.icon || '/favicon.ico',
          tag: payload.tag || notificationItem.id,
          requireInteraction: true,
          badge: '/favicon.ico',
          vibrate: [200, 100, 200]
        };

        if (this.swRegistration && this.swRegistration.active) {
          this.swRegistration.showNotification(title, options).catch(() => {
            // Fallback to direct Notification constructor
            new Notification(title, options);
          });
        } else {
          new Notification(title, options);
        }
      } catch (err) {
        console.error('Error displaying OS native notification:', err);
      }
    }
  }

  /**
   * Subscribe to in-app push notification toasts
   */
  public subscribe(listener: NotificationListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const notificationService = new NotificationService();
