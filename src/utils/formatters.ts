// Formatting and helper utilities for Dossier profiling

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9, 11)}`;
  }
  return phone;
}

export function formatPassport(passport: string): string {
  const cleaned = passport.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} №${cleaned.slice(4)}`;
  }
  return passport;
}

export function formatSnils(snils: string): string {
  const cleaned = snils.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 9)} ${cleaned.slice(9, 11)}`;
  }
  return snils;
}

export function formatInn(inn: string): string {
  return inn.trim();
}

export function calculateAge(birthDateStr: string): number {
  try {
    const parts = birthDateStr.split('.');
    let bDate: Date;
    if (parts.length === 3) {
      bDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    } else {
      bDate = new Date(birthDateStr);
    }
    const today = new Date(2026, 8, 20); // Current fixed date in 2026
    let age = today.getFullYear() - bDate.getFullYear();
    const m = today.getMonth() - bDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) {
      age--;
    }
    return isNaN(age) || age < 0 ? 34 : age;
  } catch {
    return 34;
  }
}

export function getZodiac(birthDateStr: string): string {
  try {
    const parts = birthDateStr.split('.');
    let day = 15;
    let month = 5;
    if (parts.length === 3) {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    }
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Водолей ♒';
    if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return 'Рыбы ♓';
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Овен ♈';
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Телец ♉';
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Близнецы ♊';
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Рак ♋';
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Лев ♌';
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Дева ♍';
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Весы ♎';
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Скорпион ♏';
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Стрелец ♐';
    return 'Козерог ♑';
  } catch {
    return 'Скорпион ♏';
  }
}

export function getThreatBadgeColor(level: string): { bg: string; border: string; text: string; glow: string } {
  switch (level) {
    case 'CRITICAL':
      return {
        bg: 'bg-clay-soft',
        border: 'border-hair',
        text: 'text-clay',
        glow: 'shadow-[0_10px_30px_rgba(0,0,0,.28)]',
      };
    case 'HIGH':
      return {
        bg: 'bg-orange-950/60',
        border: 'border-orange-500/80',
        text: 'text-orange-400',
        glow: 'shadow-[0_10px_30px_rgba(0,0,0,.28)]',
      };
    case 'ELEVATED':
      return {
        bg: 'bg-gold-soft',
        border: 'border-hair',
        text: 'text-gold',
        glow: 'shadow-[0_10px_30px_rgba(0,0,0,.28)]',
      };
    case 'GUARDED':
      return {
        bg: 'bg-violet-soft',
        border: 'border-hair',
        text: 'text-violet-ink',
        glow: 'shadow-[0_10px_30px_rgba(0,0,0,.28)]',
      };
    default:
      return {
        bg: 'bg-sage-soft',
        border: 'border-hair',
        text: 'text-sage',
        glow: 'shadow-[0_10px_30px_rgba(0,0,0,.28)]',
      };
  }
}
