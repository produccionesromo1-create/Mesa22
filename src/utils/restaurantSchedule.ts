import { Restaurant } from '../types';

export interface ScheduleStatus {
  isOpen: boolean;
  reason?: string;
  badgeText: string;
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Checks if a restaurant is currently open or closed based on its rest day and opening hours.
 */
export function checkIsRestaurantOpen(restaurant?: Partial<Restaurant> | null): ScheduleStatus {
  if (!restaurant) {
    return { isOpen: true, badgeText: 'Abierto' };
  }

  const now = new Date();
  const currentDayIndex = now.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  const currentDayName = DAY_NAMES[currentDayIndex];

  // 1. Check rest day ("Día de descanso")
  const restDay = restaurant.restDay?.trim();
  if (restDay && restDay !== 'Ninguno' && restDay.toLowerCase().includes(currentDayName.toLowerCase())) {
    return {
      isOpen: false,
      reason: `Hoy ${currentDayName} es el día de descanso de este restaurante.`,
      badgeText: `Cerrado (Día de descanso: ${restDay})`
    };
  }

  // 2. Parse open and close times
  let openTime: string | undefined = undefined;
  let closeTime: string | undefined = undefined;

  // Always prioritize parsing restaurant.hours first if defined
  if (restaurant.hours?.trim()) {
    const parts = restaurant.hours.trim().split(/\s*(?:[-–—]|hasta|\ba\b)\s*/i);
    if (parts.length >= 2) {
      openTime = parts[0].trim();
      closeTime = parts[1].trim();
    }
  }

  // Fallback to openTime / closeTime properties if hours didn't provide both
  if (!openTime) openTime = restaurant.openTime;
  if (!closeTime) closeTime = restaurant.closeTime;

  if (openTime && closeTime) {
    const parseMins = (timeStr: string) => {
      if (!timeStr) return 0;
      const lower = timeStr.toLowerCase();
      const isPM = lower.includes('pm') || lower.includes('p.m.');
      const isAM = lower.includes('am') || lower.includes('a.m.');

      const clean = lower.replace(/[^0-9:]/g, '');
      const parts = clean.split(':');
      let hours = parseInt(parts[0] || '0', 10);
      let mins = parseInt(parts[1] || '0', 10);

      if (isNaN(hours)) hours = 0;
      if (isNaN(mins)) mins = 0;

      if (isPM && hours < 12) {
        hours += 12;
      } else if (isAM && hours === 12) {
        hours = 0;
      }

      return hours * 60 + mins;
    };

    const currentMins = now.getHours() * 60 + now.getMinutes();
    const openMins = parseMins(openTime);
    const closeMins = parseMins(closeTime);

    // Standard day shift (e.g. 05:00 to 23:59, 11:00 to 22:00)
    if (closeMins > openMins) {
      if (currentMins < openMins || currentMins >= closeMins) {
        return {
          isOpen: false,
          reason: `El restaurante está fuera de su horario de atención (${restaurant.hours || `${openTime} - ${closeTime}`}).`,
          badgeText: `Cerrado (Horario: ${restaurant.hours || `${openTime} - ${closeTime}`})`
        };
      }
    } else if (closeMins < openMins) {
      // Overnight shift (e.g. 18:00 to 02:00)
      if (currentMins < openMins && currentMins >= closeMins) {
        return {
          isOpen: false,
          reason: `El restaurante está fuera de su horario de atención (${restaurant.hours || `${openTime} - ${closeTime}`}).`,
          badgeText: `Cerrado (Horario: ${restaurant.hours || `${openTime} - ${closeTime}`})`
        };
      }
    }
  }

  return {
    isOpen: true,
    badgeText: 'Abierto Ahora'
  };
}
